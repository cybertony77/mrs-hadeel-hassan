import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';
import { pickQuestionPictureFields } from '../../../lib/questionPictures';
import { itemCenterMatchesStudentMainCenter } from '../../../lib/studentCenterMatch';

function loadEnvConfig() {
  try {
    const envPath = path.join(process.cwd(), '..', 'env.config');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const index = trimmed.indexOf('=');
        if (index !== -1) {
          const key = trimmed.substring(0, index).trim();
          let value = trimmed.substring(index + 1).trim();
          value = value.replace(/^"|"$/g, '');
          envVars[key] = value;
        }
      }
    });
    
    return envVars;
  } catch (error) {
    console.log('⚠️  Could not read env.config, using process.env as fallback');
    return {};
  }
}

const envConfig = loadEnvConfig();
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'mr-george-magdy';

export default async function handler(req, res) {
  let client;
  try {
    // Verify authentication - allow students
    const user = await authMiddleware(req);
    
    // Allow students, admins, developers, and assistants
    if (!['student', 'admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    if (req.method === 'GET') {
      // Get student's course and courseType from students collection
      let studentCourse = null;
      let studentCourseType = null;
      let studentMainCenter = null;
      if (user.role === 'student') {
        // JWT contains assistant_id, use that to find student
        const studentId = user.assistant_id || user.id;
        console.log('🔍 Student API - User from JWT:', { role: user.role, assistant_id: user.assistant_id, id: user.id, studentId });
        if (studentId) {
          const student = await db.collection('students').findOne({ id: studentId });
          console.log('🔍 Student found:', student ? { id: student.id, course: student.course, courseType: student.courseType } : 'NOT FOUND');
          if (student) {
            studentCourse = student.course;
            studentCourseType = student.courseType;
            studentMainCenter = student.main_center;
            console.log('✅ Using student course:', studentCourse, 'courseType:', studentCourseType);
          }
        }
      }

      // Build query filter - filter by course and courseType for students
      if (studentCourse) {
        const studentCourseTrimmed = (studentCourse || '').trim();
        const studentCourseTypeTrimmed = (studentCourseType || '').trim();
        
        // Get all mock exams and filter by course, courseType and activation state
        const allMockExams = await db.collection('mock_exams').find({}).toArray();
        
        // Filter mock exams by course, courseType and activation state
        console.log('🔍 Filtering mock exams. Student course:', studentCourseTrimmed, 'courseType:', studentCourseTypeTrimmed);
        console.log('🔍 Total mock exams before filter:', allMockExams.length);
        const filteredMockExams = allMockExams.filter(me => {
          if (!me.course) {
            console.log('⚠️ Mock exam has no course:', me._id);
            return false;
          }
          const meCourse = (me.course || '').trim();
          const meCourseType = (me.courseType || '').trim();
          const meState = (me.state || me.account_state || 'Activated');
          
          // Course match: if mock exam course is "All", it matches any student course
          const courseMatch = meCourse.toLowerCase() === 'all' || 
                            meCourse.toLowerCase() === studentCourseTrimmed.toLowerCase();
          
          // CourseType match: if mock exam has no courseType, it matches any student courseType
          // If mock exam has courseType, it must match student's courseType (case-insensitive)
          const courseTypeMatch = !meCourseType || 
                                 !studentCourseTypeTrimmed ||
                                 meCourseType.toLowerCase() === studentCourseTypeTrimmed.toLowerCase();
          // Activation state: hide deactivated mock exams from students
          const isActivated = meState !== 'Deactivated';

          const centerMatch = itemCenterMatchesStudentMainCenter(me.center, studentMainCenter);
          
          const matches = courseMatch && courseTypeMatch && isActivated && centerMatch;
          console.log(`🔍 Mock exam course: "${meCourse}" courseType: "${meCourseType}" | Matches: ${matches}`);
          return matches;
        });
        console.log('✅ Filtered mock exams count:', filteredMockExams.length);
        
        // Sort by lesson (ascending), then by date (descending)
        const sortedMockExams = filteredMockExams.sort((a, b) => {
          const aLesson = (a.lesson || '').trim();
          const bLesson = (b.lesson || '').trim();
          if (aLesson !== bLesson) {
            return aLesson.localeCompare(bLesson);
          }
          return b._id.toString().localeCompare(a._id.toString());
        });
        
        // Remove correct_answer from questions for students
        const sanitizedMockExams = sortedMockExams.map(me => {
          const sanitized = {
            _id: me._id,
            course: me.course || null,
            courseType: me.courseType || null,
            center: me.center || null,
            lesson: me.lesson || null,
            lesson_name: me.lesson_name,
            // Expose normalized activation state so frontend can safely filter
            state: me.state || me.account_state || 'Activated',
            mock_exam_type: me.mock_exam_type || 'questions',
            deadline_type: me.deadline_type || 'no_deadline',
            deadline_date: me.deadline_date || null,
            deadline_time: me.deadline_time ?? null,
            timer: me.timer || null,
            shuffle_questions_and_answers: me.shuffle_questions_and_answers || false,
            show_details_after_submitting: me.show_details_after_submitting || false
          };

          if (me.comment) {
            sanitized.comment = me.comment;
          }

          if (me.mock_exam_type === 'pdf') {
            sanitized.pdf_file_name = me.pdf_file_name || '';
            sanitized.pdf_url = me.pdf_url || '';
          }

          if (me.mock_exam_type !== 'pdf' && me.questions && Array.isArray(me.questions)) {
            sanitized.questions = me.questions.map(q => ({
              question_text: q.question_text || '',
              question_picture: q.question_picture || null,
              ...pickQuestionPictureFields(q),
              answers: q.answers || [],
              answer_texts: q.answer_texts || []
            }));
          } else {
            sanitized.questions = [];
          }

          return sanitized;
        });
        
        return res.status(200).json({ success: true, mockExams: sanitizedMockExams });
      } else {
        // If student has no course, return empty array (don't show any mock exams)
        return res.status(200).json({ success: true, mockExams: [] });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Student Mock Exams API error:', error);
    if (error.message === 'Unauthorized' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}

