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
        
        // Get all homeworks and filter by course, courseType and activation state
        const allHomeworks = await db.collection('homeworks').find({}).toArray();
        
        // Filter homeworks by course, courseType and activation state
        console.log('🔍 Filtering homeworks. Student course:', studentCourseTrimmed, 'courseType:', studentCourseTypeTrimmed);
        console.log('🔍 Total homeworks before filter:', allHomeworks.length);
        const filteredHomeworks = allHomeworks.filter(hw => {
          if (!hw.course) {
            console.log('⚠️ Homework has no course:', hw._id);
            return false;
          }
          const hwCourse = (hw.course || '').trim();
          const hwCourseType = (hw.courseType || '').trim();
          const hwState = (hw.state || hw.account_state || 'Activated');
          
          // Course match: if homework course is "All", it matches any student course
          const courseMatch = hwCourse.toLowerCase() === 'all' || 
                            hwCourse.toLowerCase() === studentCourseTrimmed.toLowerCase();
          
          // CourseType match: if homework has no courseType, it matches any student courseType
          // If homework has courseType, it must match student's courseType (case-insensitive)
          const courseTypeMatch = !hwCourseType || 
                                 !studentCourseTypeTrimmed ||
                                 hwCourseType.toLowerCase() === studentCourseTypeTrimmed.toLowerCase();
          // Activation state: hide deactivated homeworks from students
          const isActivated = hwState !== 'Deactivated';

          const centerMatch = itemCenterMatchesStudentMainCenter(hw.center, studentMainCenter);
          
          const matches = courseMatch && courseTypeMatch && isActivated && centerMatch;
          console.log(`🔍 Homework course: "${hwCourse}" courseType: "${hwCourseType}" | Matches: ${matches}`);
          return matches;
        });
        console.log('✅ Filtered homeworks count:', filteredHomeworks.length);
        
        // Sort by lesson (ascending), then by date (descending)
        const sortedHomeworks = filteredHomeworks.sort((a, b) => {
          const aLesson = (a.lesson || '').trim();
          const bLesson = (b.lesson || '').trim();
          if (aLesson !== bLesson) {
            return aLesson.localeCompare(bLesson);
          }
          return b._id.toString().localeCompare(a._id.toString());
        });
        
        // Remove correct_answer from questions for students
        const sanitizedHomeworks = sortedHomeworks.map(hw => {
          const sanitized = {
            _id: hw._id,
            course: hw.course || null,
            courseType: hw.courseType || null,
            center: hw.center || null,
            lesson: hw.lesson || null,
            lesson_name: hw.lesson_name,
            // Expose normalized activation state so frontend can safely filter
            state: hw.state || hw.account_state || 'Activated',
            homework_type: hw.homework_type || 'questions',
            deadline_type: hw.deadline_type || 'no_deadline',
            deadline_date: hw.deadline_date || null,
            timer: hw.timer || null,
            shuffle_questions_and_answers: hw.shuffle_questions_and_answers || false,
            show_details_after_submitting: hw.show_details_after_submitting || false
          };

          if (hw.comment) {
            sanitized.comment = hw.comment;
          }

          // Add pages_from_book fields if applicable
          if (hw.homework_type === 'pages_from_book') {
            sanitized.book_name = hw.book_name || '';
            sanitized.from_page = hw.from_page || null;
            sanitized.to_page = hw.to_page || null;
          }

          // Add PDF fields if applicable
          if (hw.homework_type === 'pdf') {
            sanitized.pdf_file_name = hw.pdf_file_name || '';
            sanitized.pdf_url = hw.pdf_url || '';
          }

          // Add questions if applicable (only for questions type)
          if (hw.homework_type === 'questions' && hw.questions && Array.isArray(hw.questions)) {
            sanitized.questions = hw.questions.map(q => ({
              question_text: q.question_text || '',
              question_picture: q.question_picture || null,
              ...pickQuestionPictureFields(q),
              answers: q.answers || [],
              answer_texts: q.answer_texts || []
              // Note: correct_answer is intentionally excluded for students
            }));
          } else {
            sanitized.questions = [];
          }

          return sanitized;
        });
        
        return res.status(200).json({ success: true, homeworks: sanitizedHomeworks });
      } else {
        // If student has no course, return empty array (don't show any homeworks)
        return res.status(200).json({ success: true, homeworks: [] });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Student Homeworks API error:', error);
    if (error.message === 'Unauthorized' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}

