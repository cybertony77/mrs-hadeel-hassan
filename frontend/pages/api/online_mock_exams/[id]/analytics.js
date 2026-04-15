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

    // Get mock exam by ID
    let mockExam;
    try {
      mockExam = await db.collection('mock_exams').findOne({ _id: new ObjectId(id) });
    } catch (e) {
      return res.status(404).json({ error: 'Mock exam not found' });
    }
    
    if (!mockExam) {
      return res.status(404).json({ error: 'Mock exam not found' });
    }

    // Get mock exam course, courseType, and lesson
    const mockExamCourse = mockExam.course;
    const mockExamCourseType = mockExam.courseType;
    const mockExamLesson = mockExam.lesson;
    
    if (!mockExamCourse || !mockExamLesson) {
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

    const mockExamCourseTrimmed = (mockExamCourse || '').trim();
    const mockExamCourseTypeTrimmed = (mockExamCourseType || '').trim();
    const mockExamLessonTrimmed = (mockExamLesson || '').trim();

    // Get all students and filter by course and courseType
    const allStudents = await db.collection('students').find({}).toArray();
    const studentsInCourse = allStudents.filter(student => {
      if (!student.course) return false;
      const studentCourse = (student.course || '').trim();
      const studentCourseType = (student.courseType || '').trim();
      
      // Course match: if mock exam course is "All", it matches any student course
      const courseMatch = mockExamCourseTrimmed.toLowerCase() === 'all' || 
                         mockExamCourseTrimmed.toLowerCase() === studentCourse.toLowerCase();
      
      // CourseType match: if mock exam has no courseType, it matches any student courseType
      // If mock exam has courseType, it must match student's courseType (case-insensitive)
      const courseTypeMatch = !mockExamCourseTypeTrimmed || 
                             !studentCourseType ||
                             mockExamCourseTypeTrimmed.toLowerCase() === studentCourseType.toLowerCase();
      
      return courseMatch && courseTypeMatch;
    });

    const totalStudents = studentsInCourse.length;
    const mockExamIdStr = mockExam._id.toString();

    // Initialize counters and ID arrays
    let notAnswered = 0;
    let lessThan50 = 0;
    let between50And100 = 0;
    let exactly100 = 0;
    const notAnsweredIds = [];
    const lessThan50Ids = [];
    const between50And100Ids = [];
    const exactly100Ids = [];

    // Check each student's result for this mock exam
    studentsInCourse.forEach(student => {
      const studentId = student.id || student._id?.toString() || null;
      const onlineMockExams = student.online_mock_exams || [];
      const mockExamResult = onlineMockExams.find(me => {
        const meId = me.mock_exam_id?.toString();
        return meId === mockExamIdStr;
      });

      let percentage = 0;
      let hasResult = false;

      // First, try to get result from online_mock_exams
      if (mockExamResult) {
        const percentageStr = mockExamResult.percentage?.toString().replace('%', '') || '0';
        percentage = parseInt(percentageStr, 10);
        hasResult = true;
      } else {
        // If no result in online_mock_exams, check mockExams array (legacy support)
        const mockExams = student.mockExams || [];
        // Note: mockExams array doesn't have lesson-based lookup, so we skip this for now
        // Students should use online_mock_exams array
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
    console.error('❌ Error fetching mock exam analytics:', error);
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

