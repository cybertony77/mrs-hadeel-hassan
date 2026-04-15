import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { getCookieValue } from '../../../lib/cookies';
import { authMiddleware } from "../../../lib/authMiddleware";

// Load environment variables from env.config
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
          value = value.replace(/^"|"$/g, ''); // strip quotes
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
const JWT_SECRET = envConfig.JWT_SECRET || process.env.JWT_SECRET || 'topphysics_secret';
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'topphysics';

console.log('🔗 Using Mongo URI:', MONGO_URI);

// Auth middleware is now imported from shared utility

export default async function handler(req, res) {
  const { id } = req.query;
  const student_id = parseInt(id);
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify authentication
    const user = await authMiddleware(req);
    
    if (req.method === 'GET') {
      // Get student info
      const student = await db.collection('students').findOne({ id: student_id });
      if (!student) return res.status(404).json({ error: 'Student not found' });
      
      // Find the current lesson (last attended lesson or default if none)
      let currentLesson;
      if (student.lessons && typeof student.lessons === 'object') {
        const attendedLessons = Object.values(student.lessons).filter(l => l && l.attended);
        currentLesson = attendedLessons.length > 0 ? 
          attendedLessons[attendedLessons.length - 1] : 
          Object.values(student.lessons)[0];
      }
      if (!currentLesson) {
        // Load lessons from database
        const lessonsFromDB = await db.collection('lessons').find({}).sort({ id: 1 }).toArray();
        const lessonNames = lessonsFromDB.map(l => l.name);
        const defaultLessonName = lessonNames.length > 0 ? lessonNames[0] : 'Lesson 1';
        currentLesson = { lesson: defaultLessonName, attended: false, lastAttendance: null, lastAttendanceCenter: null, hwDone: false, quizDegree: null, message_state: false, homework_degree: null };
      }
      
      let lastAttendance = currentLesson.lastAttendance;
      if (currentLesson.lastAttendance && currentLesson.lastAttendanceCenter) {
        // Try to parse the date part and reformat
        const dateMatch = currentLesson.lastAttendance.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
        let dateStr = currentLesson.lastAttendance;
        if (dateMatch) {
          dateStr = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
        }
        lastAttendance = `${dateStr} in ${currentLesson.lastAttendanceCenter}`;
      }
      
      res.json({
        id: student.id,
        name: student.name,
        gender: student.gender || null,
        grade: student.grade,
        course: student.course !== undefined && student.course !== null && student.course !== '' ? student.course : null, // Return course if it exists and is not empty, otherwise null
        courseType: student.courseType || null,
        phone: student.phone,
        parents_phone: student.parentsPhone || student.parentsPhone1 || null,
        center: student.center,
        main_center: student.main_center,
        main_comment: (student.main_comment ?? student.comment ?? null),
        attended_the_session: currentLesson.attended,
        lastAttendance: lastAttendance,
        lastAttendanceCenter: currentLesson.lastAttendanceCenter,
        attendanceLesson: currentLesson.lesson,
        hwDone: currentLesson.hwDone,
        homework_degree: currentLesson.homework_degree,
        school: student.school || null,
        age: student.age || null,
        quizDegree: currentLesson.quizDegree,
        message_state: currentLesson.message_state,
        account_state: student.account_state || "Activated", // Default to Activated
        score: student.score !== null && student.score !== undefined ? student.score : 0,
        lessons: student.lessons || {}, // Include the full lessons object
        payment: student.payment || null, // Include payment data
        online_sessions: student.online_sessions || [], // Include online_sessions for VVC restore
        homeworks_videos: student.homeworks_videos || [], // Include homeworks_videos for VHC restore
        online_homeworks: student.online_homeworks || [], // Include online_homeworks for degree lookup
        online_quizzes: student.online_quizzes || [], // Include online_quizzes for degree lookup
        online_mock_exams: student.online_mock_exams || [], // Include online_mock_exams for degree lookup
        mockExams: student.mockExams || [] // Include mockExams array for charts
      });
    } else if (req.method === 'PUT') {
      // Edit student - handle partial updates properly
      const { name, grade, course, courseType, phone, parents_phone, main_center, age, gender, school, main_comment, comment, account_state, score } = req.body;
      
      // Validate grade is required
      if (grade !== undefined && (grade === null || grade === '')) {
        return res.status(400).json({ error: 'Grade is required' });
      }

      // Build update object with only defined values (not null or undefined)
      const update = {};
      
      if (name !== undefined && name !== null) {
        update.name = name;
      }
      if (grade !== undefined && grade !== null) {
        update.grade = grade;
      }
      if (course !== undefined && course !== null) {
        update.course = course;
      }
      if (courseType !== undefined && courseType !== null) {
        update.courseType = courseType;
      }
      if (phone !== undefined && phone !== null) {
        update.phone = phone;
      }
      if (parents_phone !== undefined && parents_phone !== null) {
        update.parentsPhone = parents_phone;
      }
      if (main_center !== undefined && main_center !== null) {
        update.main_center = main_center;
      }
      if (age !== undefined) {
        // Handle empty string or null age - set to null in database
        if (age === '' || age === null) {
          update.age = null;
        } else {
          update.age = age;
        }
      }
      if (gender !== undefined && gender !== null) {
        update.gender = gender;
      }
      if (school !== undefined && school !== null) {
        update.school = school;
      }
      if (main_comment !== undefined) {
        update.main_comment = main_comment; // allow null or string
      } else if (comment !== undefined) {
        // backward compat
        update.main_comment = comment;
      }
      if (account_state !== undefined && account_state !== null) {
        update.account_state = account_state;
      }
      if (score !== undefined && score !== null) {
        // Handle score updates - ensure it's a number
        update.score = typeof score === 'number' ? score : parseInt(score, 10);
      }
      
      // Handle weeks array updates (for hwDone and quizDegree)
      const { weeks_update } = req.body;
      if (weeks_update) {
        const { week, hwDone, quizDegree } = weeks_update;
        if (week !== undefined && week !== null) {
          const student = await db.collection('students').findOne({ id: student_id });
          if (!student) return res.status(404).json({ error: 'Student not found' });
          
          const weeks = student.weeks || [];
          const weekNum = typeof week === 'number' ? week : parseInt(week, 10);
          
          // Find or create week entry
          let weekIndex = weeks.findIndex(w => {
            const wWeek = typeof w.week === 'number' ? w.week : parseInt(w.week, 10);
            return !isNaN(wWeek) && wWeek === weekNum;
          });
          
          if (weekIndex === -1) {
            // Create new week entry
            weeks.push({
              week: weekNum,
              attended: false,
              lastAttendance: null,
              lastAttendanceCenter: null,
              hwDone: hwDone !== undefined ? hwDone : false,
              quizDegree: quizDegree !== undefined ? quizDegree : null,
              comment: null,
              message_state: false
            });
          } else {
            // Update existing week entry
            if (hwDone !== undefined) {
              weeks[weekIndex].hwDone = hwDone;
            }
            if (quizDegree !== undefined) {
              weeks[weekIndex].quizDegree = quizDegree;
            }
          }
          
          update.weeks = weeks;
        }
      }
      
      // Only proceed if there are fields to update
      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      
      const result = await db.collection('students').updateOne(
        { id: student_id },
        { $set: update }
      );
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Student not found' });
      res.json({ success: true });
    } else if (req.method === 'DELETE') {
      // Delete student
      // First, check if student has an account in users collection
      const userAccount = await db.collection('users').findOne({
        id: student_id,
        role: 'student'
      });

      let deletedEmail = null;

      // If user account exists, delete it
      if (userAccount) {
        deletedEmail = userAccount.email || null;

        // Delete the user account
        await db.collection('users').deleteOne({
          id: student_id,
          role: 'student'
        });
      }

      // Delete VAC record if it exists for this student
      const vacResult = await db.collection('VAC').deleteOne({ account_id: student_id });
      const vacDeleted = vacResult.deletedCount > 0;

      // Delete student from students collection
      const result = await db.collection('students').deleteOne({ id: student_id });
      if (result.deletedCount === 0) return res.status(404).json({ error: 'Student not found' });
      
      res.json({ 
        success: true,
        accountDeleted: !!userAccount,
        email: deletedEmail,
        vacDeleted: vacDeleted
      });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    if (error.message.includes('Unauthorized') || error.message.includes('Invalid token')) {
      res.status(401).json({ error: error.message });
    } else {
      console.error('Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } finally {
    if (client) await client.close();
  }
} 