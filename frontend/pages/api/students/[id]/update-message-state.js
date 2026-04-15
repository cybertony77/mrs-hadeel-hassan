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

console.log('🔗 Using Mongo URI:', MONGO_URI);

// Auth middleware is now imported from shared utility

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { id } = req.query;
  const student_id = parseInt(id);
  const { message_state, lesson } = req.body;
  
  console.log('📱 Updating message state for student:', student_id);
  console.log('📅 Message state data:', { message_state, lesson });
  
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify authentication
    const user = await authMiddleware(req);
    console.log('✅ Authentication successful for user:', user.assistant_id);
    
    // Get the current student data
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
    const lessonName = lesson || (lessonNames.length > 0 ? lessonNames[0] : 'Lesson 1');
    
    console.log(`Updating message_state for student ${student_id}, lesson ${lessonName} to:`, message_state);
    
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
            hwDone: false,
            quizDegree: null,
            comment: null,
            message_state: false,
            homework_degree: null
          } } }
        );
        // Refresh student in-memory reference
        student.lessons[lessonName] = {
          lesson: lessonName,
          attended: false,
          lastAttendance: null,
          lastAttendanceCenter: null,
          hwDone: false,
          quizDegree: null,
          comment: null,
          message_state: false,
          homework_degree: null
        };
      }
    };

    await ensureLessonExists();
    
    // Update the specific lesson in the lessons object
    const result = await db.collection('students').updateOne(
      { id: student_id },
      { $set: { [`lessons.${lessonName}.message_state`]: !!message_state } }
    );
    
    if (result.matchedCount === 0) {
      console.log('❌ Failed to update student:', student_id);
      return res.status(404).json({ error: 'Student not found' });
    }
    console.log(`✅ Message state updated for student ${student_id}, lesson ${lessonName} to ${!!message_state}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error in update-message-state endpoint:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Invalid token')) {
      res.status(401).json({ error: error.message });
    } else {
      console.error('Error updating message state:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } finally {
    if (client) await client.close();
  }
} 