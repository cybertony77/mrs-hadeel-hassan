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

// Format date as DD/MM/YYYY
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    // Verify authentication - allow students
    const user = await authMiddleware(req);
    if (!['student', 'admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    const { id } = req.query;
    const student_id = parseInt(id);
    // For students, the ID is in assistant_id, for others it's in id
    // Handle both string and number types
    const getUserId = (val) => {
      if (val === null || val === undefined) return null;
      return typeof val === 'number' ? val : parseInt(val);
    };
    
    const userId = user.role === 'student' 
      ? getUserId(user.assistant_id) || getUserId(user.id)
      : getUserId(user.id) || getUserId(user.assistant_id);

    // Students can only update their own data
    if (user.role === 'student' && userId !== student_id) {
      console.error('❌ Student ID mismatch:', { 
        userId, 
        student_id, 
        assistant_id: user.assistant_id, 
        user_id: user.id,
        role: user.role 
      });
      return res.status(403).json({ 
        error: 'Forbidden: You can only update your own data',
        details: { userId, student_id, assistant_id: user.assistant_id, user_id: user.id }
      });
    }

    const { session_id, action, payment_state, lesson } = req.body; // action: 'view' or 'finish', payment_state: 'free' or 'paid' or 'free_if_attended', lesson: lesson name

    if (!session_id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Get student
    const student = await db.collection('students').findOne({ id: student_id });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get homework video session to get week
    const session = await db.collection('homeworks_videos').findOne({ _id: new ObjectId(session_id) });
    if (!session) {
      return res.status(404).json({ error: 'Homework video session not found' });
    }

    if (action === 'view') {
      // Just record that video was opened (no decrement)
      return res.status(200).json({ 
        success: true,
        message: 'Video view recorded'
      });
    } else if (action === 'finish') {
      // Set view_homework_video=true for the lesson and mark attendance
      const lessonName = lesson || session.lesson;
      if (lessonName && lessonName.trim()) {
        const lessons = student.lessons || {};
        const lessonData = lessons[lessonName];

        const attendanceDate = formatDate(new Date());
        const attendanceString = `${attendanceDate} in Online`;

        if (lessonData) {
          // Update existing lesson - set view_homework_video=true and mark attendance
          await db.collection('students').updateOne(
            { id: student_id },
            {
              $set: {
                [`lessons.${lessonName}.view_homework_video`]: true,
                [`lessons.${lessonName}.attended`]: true,
                [`lessons.${lessonName}.lastAttendance`]: attendanceString,
                [`lessons.${lessonName}.lastAttendanceCenter`]: 'Online',
                [`lessons.${lessonName}.attendanceDate`]: attendanceDate
              }
            }
          );
        } else {
          // Lesson doesn't exist, add new lesson entry with view_homework_video=true and attendance
          const newLesson = {
            lesson: lessonName,
            attended: true,
            lastAttendance: attendanceString,
            lastAttendanceCenter: 'Online',
            attendanceDate: attendanceDate,
            hwDone: false,
            view_homework_video: true,
            quizDegree: null,
            comment: null,
            message_state: false,
            homework_degree: null,
            paid: false
          };
          await db.collection('students').updateOne(
            { id: student_id },
            { $set: { [`lessons.${lessonName}`]: newLesson } }
          );
        }

        // Create history record when attendance is marked
        const existingHistory = await db.collection('history').findOne({
          studentId: student_id,
          lesson: lessonName
        });

        if (!existingHistory) {
          const historyRecord = {
            studentId: student.id,
            lesson: lessonName
          };
          
          console.log('📝 Creating history record for homework video attendance:', historyRecord);
          await db.collection('history').insertOne(historyRecord);
          console.log('✅ History record created');
        } else {
          console.log('ℹ️ History record already exists for student', student_id, 'lesson', lessonName);
        }
      }

      return res.status(200).json({ 
        success: true,
        message: 'Homework video marked as viewed'
      });
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "view" or "finish"' });
    }
  } catch (error) {
    console.error('❌ Error in watch-homework-video API:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}
