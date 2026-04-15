import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../../lib/authMiddleware';
import { verifySignature } from '../../../../lib/hmac';
import { itemCenterMatchesStudentMainCenter } from '../../../../lib/studentCenterMatch';

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

  const { id, sig } = req.query;
  const student_id = parseInt(id);

  let client;
  let isPublicAccess = false;

  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Check if this is a public access request (with HMAC signature)
    if (sig) {
      const studentIdFromQuery = String(id || '').trim();
      const signature = String(sig).trim();
      if (studentIdFromQuery && signature && verifySignature(studentIdFromQuery, signature)) {
        isPublicAccess = true;
      } else {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // If not public access, verify authentication
    if (!isPublicAccess) {
      // Verify authentication - allow students to view their own results, or admins/assistants/developers to view any student
      const user = await authMiddleware(req);
      const userId = user.assistant_id || user.id; // JWT contains assistant_id for students
      
      // Students can only view their own results
      if (user.role === 'student' && userId !== student_id) {
        return res.status(403).json({ error: 'Forbidden: You can only view your own results' });
      }
      
      // Admins, assistants, and developers can view any student's results
      if (!['student', 'admin', 'assistant', 'developer'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Access denied' });
      }
    }

    // Get student data
    const student = await db.collection('students').findOne({ id: student_id });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get student's course and courseType
    const studentCourse = student.course;
    const studentCourseType = student.courseType;
    const studentMainCenter = student.main_center;
    
    if (!studentCourse) {
      // If student has no course, return empty array
      return res.json({ 
        success: true,
        chartData: []
      });
    }

    // Get all mock exam results from online_mock_exams
    const onlineMockExams = student.online_mock_exams || [];
    
    // Create a map of mock_exam_id to result data (percentage and result string)
    // Store with both original format and normalized ObjectId format for matching
    const resultMap = {};
    onlineMockExams.forEach(meResult => {
      if (meResult.mock_exam_id) {
        const meIdOriginal = meResult.mock_exam_id.toString();
        const percentage = parseInt(meResult.percentage?.toString().replace('%', '') || '0');
        const result = meResult.result || '0 / 0'; // Format: "8 / 10"
        const resultData = { percentage, result };
        
        // Store with original format
        resultMap[meIdOriginal] = resultData;
        
        // Also store with normalized ObjectId format if it's a valid ObjectId
        if (ObjectId.isValid(meIdOriginal)) {
          try {
            const objId = new ObjectId(meIdOriginal);
            resultMap[objId.toString()] = resultData;
          } catch (e) {
            // Ignore conversion errors
          }
        }
      }
    });

    // Get ALL mock exams for this student's course and courseType (not just completed ones)
    const studentCourseTrimmed = (studentCourse || '').trim();
    const studentCourseTypeTrimmed = (studentCourseType || '').trim();
    const allMockExams = await db.collection('mock_exams').find({}).toArray();
    
    // Only consider activated mock exams for performance calculations
    const activeMockExams = allMockExams.filter(me => {
      const meState = (me.state || me.account_state || 'Activated');
      return meState !== 'Deactivated';
    });
    
    // Filter mock exams by course, courseType, and type (only include questions)
    const filteredMockExams = activeMockExams.filter(me => {
      if (!me.course || !me.lesson) return false;
      const mockType = (me.mock_exam_type || 'questions').toLowerCase();
      if (mockType !== 'questions') return false;
      const meCourse = (me.course || '').trim();
      const meCourseType = (me.courseType || '').trim();
      
      // Course match: if mock exam course is "All", it matches any student course
      const courseMatch = meCourse.toLowerCase() === 'all' || 
                         meCourse.toLowerCase() === studentCourseTrimmed.toLowerCase();
      
      // CourseType match: if mock exam has no courseType, it matches any student courseType
      // If mock exam has courseType, it must match student's courseType (case-insensitive)
      const courseTypeMatch = !meCourseType || 
                             !studentCourseTypeTrimmed ||
                             meCourseType.toLowerCase() === studentCourseTypeTrimmed.toLowerCase();

      const centerMatch = itemCenterMatchesStudentMainCenter(me.center, studentMainCenter);
      
      return courseMatch && courseTypeMatch && centerMatch;
    });

    // List ALL available mock exams for the student in the chart
    // Use online_mock_exams as primary data, fallback to mockExams array
    const lessonDataMap = {};
    
    // Step 1: Create entries for ALL available mock exams (even not submitted)
    filteredMockExams.forEach(mockExam => {
      const lessonName = mockExam.lesson;
      if (!lessonName) return;
      
      if (!lessonDataMap[lessonName]) {
        lessonDataMap[lessonName] = {
          lesson_name: lessonName,
          percentage: 0,
          result: '0 / 0'
        };
      }
      
      // Step 2: Fill data from online_mock_exams (primary source)
      const meIdStr = mockExam._id.toString();
      const resultData = resultMap[meIdStr];
      
      if (resultData && resultData.percentage > (lessonDataMap[lessonName].percentage || 0)) {
        lessonDataMap[lessonName].percentage = resultData.percentage;
        lessonDataMap[lessonName].result = resultData.result;
      }
    });

    // Step 3: Fallback to mockExams array for entries still without data
    if (student.mockExams && Array.isArray(student.mockExams)) {
      student.mockExams.forEach((exam, index) => {
        if (!exam) return;
        const examLabel = `Exam ${index + 1}`;
        
        // Only use fallback if the lesson exists in chart but has no data yet
        if (lessonDataMap[examLabel] && lessonDataMap[examLabel].percentage === 0) {
          if (exam.percentage > 0 || exam.examDegree > 0) {
            lessonDataMap[examLabel].percentage = exam.percentage || 0;
            lessonDataMap[examLabel].result = exam.examDegree && exam.outOf 
              ? `${exam.examDegree} / ${exam.outOf}` 
              : '0 / 0';
          }
        }
      });
    }

    // Convert to array and sort by exam number
    const chartData = Object.values(lessonDataMap)
      .sort((a, b) => {
        const numA = parseInt((a.lesson_name.match(/\d+/) || [0])[0], 10);
        const numB = parseInt((b.lesson_name.match(/\d+/) || [0])[0], 10);
        if (numA && numB) return numA - numB;
        return a.lesson_name.localeCompare(b.lesson_name);
      });

    // Always return success with chartData (empty array if no data)
    res.json({ 
      success: true,
      chartData: chartData
    });
  } catch (error) {
    console.error('❌ Error fetching mock exam performance:', error);
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
