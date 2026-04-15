import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../../lib/authMiddleware';

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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI;
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify authentication - only admins, assistants, and developers can view analytics
    const user = await authMiddleware(req);
    if (!['admin', 'assistant', 'developer'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    // Get quiz by ID
    let quiz;
    try {
      quiz = await db.collection('quizzes').findOne({ _id: new ObjectId(id) });
    } catch (e) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Get quiz course, courseType, and lesson
    const quizCourse = quiz.course;
    const quizCourseType = quiz.courseType;
    const quizLesson = quiz.lesson;
    
    if (!quizCourse || !quizLesson) {
      return res.json({
        success: true,
        analytics: {
          notAnswered: 0,
          lessThan50: 0,
          between50And100: 0,
          exactly100: 0,
          totalStudents: 0
        }
      });
    }

    const quizCourseTrimmed = (quizCourse || '').trim();
    const quizCourseTypeTrimmed = (quizCourseType || '').trim();
    const quizLessonTrimmed = (quizLesson || '').trim();

    // Get all students and filter by course and courseType
    const allStudents = await db.collection('students').find({}).toArray();
    const studentsInCourse = allStudents.filter(student => {
      if (!student.course) return false;
      const studentCourse = (student.course || '').trim();
      const studentCourseType = (student.courseType || '').trim();
      
      // Course match: if quiz course is "All", it matches any student course
      const courseMatch = quizCourseTrimmed.toLowerCase() === 'all' || 
                         quizCourseTrimmed.toLowerCase() === studentCourse.toLowerCase();
      
      // CourseType match: if quiz has no courseType, it matches any student courseType
      // If quiz has courseType, it must match student's courseType (case-insensitive)
      const courseTypeMatch = !quizCourseTypeTrimmed || 
                             !studentCourseType ||
                             quizCourseTypeTrimmed.toLowerCase() === studentCourseType.toLowerCase();
      
      return courseMatch && courseTypeMatch;
    });

    const totalStudents = studentsInCourse.length;
    const quizIdStr = quiz._id.toString();

    // Initialize counters and ID arrays
    let notAnswered = 0;
    let lessThan50 = 0;
    let between50And100 = 0;
    let exactly100 = 0;
    const notAnsweredIds = [];
    const lessThan50Ids = [];
    const between50And100Ids = [];
    const exactly100Ids = [];

    // Check each student's result for this quiz
    studentsInCourse.forEach(student => {
      const studentId = student.id || student._id?.toString() || null;
      const onlineQuizzes = student.online_quizzes || [];
      const quizResult = onlineQuizzes.find(qz => {
        const qzId = qz.quiz_id?.toString();
        return qzId === quizIdStr;
      });

      let percentage = 0;
      let hasResult = false;

      // First, try to get result from online_quizzes
      if (quizResult) {
        const percentageStr = quizResult.percentage?.toString().replace('%', '') || '0';
        percentage = parseInt(percentageStr, 10);
        hasResult = true;
      } else {
        // If no result in online_quizzes, check lessons object
        // Find the lesson that matches this quiz's lesson
        const lessons = student.lessons || {};
        const lessonData = lessons[quizLessonTrimmed];
        
        if (lessonData && lessonData.quizDegree) {
          // Parse quizDegree format like "50 / 100"
          const quizDegreeStr = String(lessonData.quizDegree).trim();
          const match = quizDegreeStr.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
          
          if (match) {
            const obtained = parseFloat(match[1]);
            const total = parseFloat(match[2]);
            percentage = total > 0 ? Math.round((obtained / total) * 100) : 0;
            hasResult = true;
          }
        }
      }

      // Categorize based on percentage
      if (!hasResult || percentage === 0) {
        // Student didn't answer
        notAnswered++;
        if (studentId) notAnsweredIds.push(studentId);
      } else if (percentage === 100) {
        exactly100++;
        if (studentId) exactly100Ids.push(studentId);
      } else if (percentage >= 50 && percentage < 100) {
        between50And100++;
        if (studentId) between50And100Ids.push(studentId);
      } else if (percentage > 0 && percentage < 50) {
        lessThan50++;
        if (studentId) lessThan50Ids.push(studentId);
      }
    });

    res.json({
      success: true,
      analytics: {
        notAnswered,
        lessThan50,
        between50And100,
        exactly100,
        totalStudents,
        notAnsweredIds,
        lessThan50Ids,
        between50And100Ids,
        exactly100Ids
      }
    });
  } catch (error) {
    console.error('❌ Error fetching quiz analytics:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

