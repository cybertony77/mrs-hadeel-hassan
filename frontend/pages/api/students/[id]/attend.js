import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../../lib/authMiddleware';

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
const PAYMENT_SYSTEM_ENABLED = envConfig.SYSTEM_PAYMENT_SYSTEM === 'true' || process.env.SYSTEM_PAYMENT_SYSTEM === 'true';

console.log('🔗 Using Mongo URI:', MONGO_URI);

// Auth middleware is now imported from shared utility

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { id } = req.query;
  const student_id = parseInt(id);
  const { attended, lastAttendance, lastAttendanceCenter, attendanceLesson } = req.body;
  
  if (attendanceLesson === undefined || attendanceLesson === null) {
    console.log('❌ attendanceLesson missing in request body for student', student_id);
    return res.status(400).json({ error: 'attendanceLesson is required' });
  }
  
  console.log('🎯 Toggling attendance for student:', student_id);
  console.log('📅 Attendance data:', { attended, lastAttendance, lastAttendanceCenter, attendanceLesson });
  
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify authentication
    const user = await authMiddleware(req);
    console.log('✅ Authentication successful for user:', user.assistant_id);
    
    // Get the student data first
    const student = await db.collection('students').findOne({ id: student_id });
    if (!student) {
      console.log('❌ Student not found:', student_id);
      return res.status(404).json({ error: 'Student not found' });
    }
    console.log('✅ Found student:', student.name);
    
    // Check if student account is deactivated
    if (student.account_state === 'Deactivated') {
      console.log('❌ Student account is deactivated:', student_id);
      return res.status(403).json({ error: 'Student account is deactivated' });
    }
    
    // Load lessons from database
    const lessonsFromDB = await db.collection('lessons').find({}).sort({ id: 1 }).toArray();
    const lessonNames = lessonsFromDB.map(l => l.name);
    
    // Determine which lesson to update
    const lessonName = attendanceLesson || (lessonNames.length > 0 ? lessonNames[0] : 'Lesson 1');
    
    // Ensure the target lesson exists; if not, create it with default schema
    const ensureLessonExists = async () => {
      console.log(`🔍 Current student lessons structure:`, typeof student.lessons, student.lessons);
      
      // Handle case where lessons might be an array (old format) or undefined
      if (!student.lessons || Array.isArray(student.lessons)) {
        console.log(`🔄 Converting lessons from array to object format for student ${student_id}`);
        student.lessons = {};
        // Update the database to use object format
        await db.collection('students').updateOne(
          { id: student_id },
          { $set: { lessons: {} } }
        );
      }
      
      if (!student.lessons[lessonName]) {
        console.log(`🧩 Creating missing lesson "${lessonName}" for student ${student_id}`);
        await db.collection('students').updateOne(
          { id: student_id },
          { $set: { [`lessons.${lessonName}`]: {
            lesson: lessonName,
            attended: false,
            lastAttendance: null,
            lastAttendanceCenter: null,
            attendanceDate: null,
            hwDone: false,
            quizDegree: "No Quiz",
            comment: null,
            message_state: false,
            homework_degree: null,
            paid: false
          } } }
        );
        // Refresh student in-memory reference
        student.lessons[lessonName] = {
          lesson: lessonName,
          attended: false,
          lastAttendance: null,
          lastAttendanceCenter: null,
          attendanceDate: null,
          hwDone: false,
          quizDegree: "No Quiz",
          comment: null,
          message_state: false,
          homework_degree: null,
          paid: false
        };
      }
    };

    await ensureLessonExists();
    
    if (attended) {
      // Check if student has available sessions or if this lesson is already paid (only if payment system is enabled)
      const currentSessions = student.payment?.numberOfSessions || 0;
      const isLessonPaid = student.lessons && student.lessons[lessonName] && student.lessons[lessonName].paid === true;
      
      if (PAYMENT_SYSTEM_ENABLED && currentSessions <= 0 && !isLessonPaid) {
        console.log('❌ Student has no available sessions and lesson is not paid:', student_id);
        return res.status(400).json({ error: 'No available sessions' });
      }
      
      // Compute attendance date in DD/MM/YYYY format using local timezone
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = String(now.getFullYear());
      const attendanceDateOnly = `${day}/${month}/${year}`;

      // Mark as attended and set paid to true
      const updateQuery = {
        [`lessons.${lessonName}.attended`]: true,
        [`lessons.${lessonName}.lastAttendance`]: lastAttendance || null,
        [`lessons.${lessonName}.lastAttendanceCenter`]: lastAttendanceCenter || null,
        [`lessons.${lessonName}.attendanceDate`]: attendanceDateOnly,
        [`lessons.${lessonName}.paid`]: true
      };
      
      // Only decrement sessions if payment system is enabled and lesson wasn't already paid
      if (PAYMENT_SYSTEM_ENABLED && !isLessonPaid && currentSessions > 0) {
        updateQuery['payment.numberOfSessions'] = currentSessions - 1;
      }
      
      console.log('🔧 Updating database with query:', updateQuery);
      const result = await db.collection('students').updateOne(
        { id: student_id },
        { $set: updateQuery }
      );
      
      console.log('🔧 Database update result:', result);
      
      if (result.matchedCount === 0) {
        console.log('❌ Failed to update student:', student_id);
        return res.status(404).json({ error: 'Student not found' });
      }
      console.log('✅ Student marked as attended for lesson', lessonName, 'and sessions decremented to', currentSessions - 1);
      
      // Create simplified history record (only studentId and lesson)
      const historyRecord = {
        studentId: student.id,
        lesson: lessonName
      };
      
      console.log('📝 Creating simplified history record:', historyRecord);
      const historyResult = await db.collection('history').insertOne(historyRecord);
      console.log('✅ History record created with ID:', historyResult.insertedId);
      
    } else {
      // Mark as not attended (unattend)
      // Also reset hw and quiz since student didn't attend
      const currentSessions = student.payment?.numberOfSessions || 0;
      const wasLessonPaid = student.lessons && student.lessons[lessonName] && student.lessons[lessonName].paid === true;
      
      const updateQuery = {
        [`lessons.${lessonName}.attended`]: false,
        [`lessons.${lessonName}.lastAttendance`]: null,
        [`lessons.${lessonName}.lastAttendanceCenter`]: null,
        [`lessons.${lessonName}.attendanceDate`]: null,
        [`lessons.${lessonName}.hwDone`]: false,
        [`lessons.${lessonName}.quizDegree`]: null,
        [`lessons.${lessonName}.comment`]: null,
        [`lessons.${lessonName}.message_state`]: false,
        [`lessons.${lessonName}.homework_degree`]: null,
        [`lessons.${lessonName}.paid`]: false
      };
      
      // Only increment sessions back if payment system is enabled and the lesson was paid (meaning it consumed a session)
      if (PAYMENT_SYSTEM_ENABLED && wasLessonPaid) {
        updateQuery['payment.numberOfSessions'] = currentSessions + 1;
      }
      
      const result = await db.collection('students').updateOne(
        { id: student_id },
        { $set: updateQuery }
      );
      
      if (result.matchedCount === 0) {
        console.log('❌ Failed to update student:', student_id);
        return res.status(404).json({ error: 'Student not found' });
      }
      console.log('✅ Student marked as not attended for lesson', lessonName, 'and sessions incremented to', currentSessions + 1);
      
      // Remove simplified history record for this student and lesson
      const historyDeleteResult = await db.collection('history').deleteMany({
        studentId: student_id,
        lesson: lessonName
      });
      console.log('🗑️ Removed', historyDeleteResult.deletedCount, 'history records');
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error in attend endpoint:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Invalid token')) {
      res.status(401).json({ error: error.message });
    } else {
      console.error('Error toggling attendance:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } finally {
    if (client) await client.close();
  }
} 