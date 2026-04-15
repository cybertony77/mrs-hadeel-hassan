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
        console.log('🔍 Quiz API - User from JWT:', { role: user.role, assistant_id: user.assistant_id, id: user.id, studentId });
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
        
        // Get all quizzes and filter by course, courseType and activation state
        const allQuizzes = await db.collection('quizzes').find({}).toArray();
        
        // Filter quizzes by course, courseType and activation state
        console.log('🔍 Filtering quizzes. Student course:', studentCourseTrimmed, 'courseType:', studentCourseTypeTrimmed);
        console.log('🔍 Total quizzes before filter:', allQuizzes.length);
        const filteredQuizzes = allQuizzes.filter(quiz => {
          if (!quiz.course) {
            console.log('⚠️ Quiz has no course:', quiz._id);
            return false;
          }
          const quizCourse = (quiz.course || '').trim();
          const quizCourseType = (quiz.courseType || '').trim();
          const quizState = (quiz.state || quiz.account_state || 'Activated');
          
          // Course match: if quiz course is "All", it matches any student course
          const courseMatch = quizCourse.toLowerCase() === 'all' || 
                            quizCourse.toLowerCase() === studentCourseTrimmed.toLowerCase();
          
          // CourseType match: if quiz has no courseType, it matches any student courseType
          // If quiz has courseType, it must match student's courseType (case-insensitive)
          const courseTypeMatch = !quizCourseType || 
                                 !studentCourseTypeTrimmed ||
                                 quizCourseType.toLowerCase() === studentCourseTypeTrimmed.toLowerCase();
          // Activation state: hide deactivated quizzes from students
          const isActivated = quizState !== 'Deactivated';

          const centerMatch = itemCenterMatchesStudentMainCenter(quiz.center, studentMainCenter);
          
          const matches = courseMatch && courseTypeMatch && isActivated && centerMatch;
          console.log(`🔍 Quiz course: "${quizCourse}" courseType: "${quizCourseType}" | Matches: ${matches}`);
          return matches;
        });
        console.log('✅ Filtered quizzes count:', filteredQuizzes.length);
        
        // Sort by lesson (ascending), then by date (descending)
        const sortedQuizzes = filteredQuizzes.sort((a, b) => {
          const aLesson = (a.lesson || '').trim();
          const bLesson = (b.lesson || '').trim();
          if (aLesson !== bLesson) {
            return aLesson.localeCompare(bLesson);
          }
          return b._id.toString().localeCompare(a._id.toString());
        });
        
        // Remove correct_answer from questions for students
        const sanitizedQuizzes = sortedQuizzes.map(quiz => {
          const sanitized = {
            _id: quiz._id,
            course: quiz.course || null,
            courseType: quiz.courseType || null,
            center: quiz.center || null,
            lesson: quiz.lesson || null,
            lesson_name: quiz.lesson_name,
            // Expose normalized activation state so frontend can safely filter
            state: quiz.state || quiz.account_state || 'Activated',
            quiz_type: quiz.quiz_type || 'questions',
            deadline_type: quiz.deadline_type || 'no_deadline',
            deadline_date: quiz.deadline_date || null,
            timer: quiz.timer,
            shuffle_questions_and_answers: quiz.shuffle_questions_and_answers || false,
            show_details_after_submitting: quiz.show_details_after_submitting || false,
          };

          if (quiz.comment) {
            sanitized.comment = quiz.comment;
          }

          if (quiz.quiz_type === 'pdf') {
            sanitized.pdf_file_name = quiz.pdf_file_name || '';
            sanitized.pdf_url = quiz.pdf_url || '';
          }

          if (quiz.quiz_type !== 'pdf') {
            sanitized.questions = (quiz.questions || []).map(q => ({
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
        
        return res.status(200).json({ success: true, quizzes: sanitizedQuizzes });
      } else {
        // If student has no course, return empty array (don't show any quizzes)
        return res.status(200).json({ success: true, quizzes: [] });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Student Quizzes API error:', error);
    if (error.message === 'Unauthorized' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}

