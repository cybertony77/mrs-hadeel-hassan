import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';

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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  let client;
  let db;
  try {
    console.log('📋 History API called - optimizing for large datasets...');
    
    // Validate environment variables
    if (!MONGO_URI || !DB_NAME || !JWT_SECRET) {
      console.error('❌ Missing environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error', 
        details: 'Missing required environment variables'
      });
    }

    console.log('🔗 Connecting to MongoDB...');
    client = await MongoClient.connect(MONGO_URI);
    db = client.db(DB_NAME);
    console.log('✅ Connected to database:', DB_NAME);
    
    // Verify authentication
    console.log('🔐 Authenticating user...');
    const user = await authMiddleware(req);
    console.log('✅ User authenticated:', user.assistant_id || user.id);
    
    // Optimized approach: Get history records and join with students
    console.log('📊 Fetching history records...');
    
    // Get all history records (with lesson field)
    const historyRecords = await db.collection('history')
      .find({})
      .sort({ studentId: 1, lesson: 1 })
      .toArray();
    
    console.log(`✅ Found ${historyRecords.length} history records`);
    
    // Get unique student IDs from history
    const studentIds = [...new Set(historyRecords.map(record => record.studentId))];
    console.log(`📋 Processing ${studentIds.length} unique students`);
    
    // Get all students with their lessons data
    const students = await db.collection('students')
      .find(
        { id: { $in: studentIds } },
        {
          projection: {
            id: 1,
            name: 1,
            gender: 1,
            grade: 1,
            course: 1,
            courseType: 1,
            school: 1,
            phone: 1,
            parentsPhone: 1,
            main_center: 1,
            main_comment: 1,
            comment: 1,
            lessons: 1
          }
        }
      )
      .toArray();
    
    console.log(`✅ Fetched ${students.length} students`);
    
    // Create a map for quick student lookup
    const studentMap = new Map();
    students.forEach(student => {
      studentMap.set(student.id, student);
    });
    
    // Group by student to match the expected frontend format
    const studentHistoryMap = new Map();
    
    // Process history records in batches
    const batchSize = 100;
    for (let i = 0; i < historyRecords.length; i += batchSize) {
      const batch = historyRecords.slice(i, i + batchSize);
      
      batch.forEach(historyRecord => {
        const studentId = historyRecord.studentId;
        const student = studentMap.get(studentId);
        
        if (!student) {
          console.warn(`⚠️ Student ${studentId} not found for history record`);
          return;
        }
        
        // Get lesson name from history record (support both lesson and week for backward compatibility)
        const lessonName = historyRecord.lesson || (historyRecord.week ? `Week ${historyRecord.week}` : 'Unknown Lesson');
        
        // Get lesson data from student.lessons object
        let lessonData = null;
        if (student.lessons && typeof student.lessons === 'object' && !Array.isArray(student.lessons)) {
          lessonData = student.lessons[lessonName] || null;
        }
        
        // Only include records where student attended the lesson
        if (!lessonData || lessonData.attended !== true) {
          return;
        }
        
        // Initialize student in map if not present
        if (!studentHistoryMap.has(studentId)) {
          studentHistoryMap.set(studentId, {
            id: student.id,
            name: student.name,
            gender: student.gender || null,
            grade: student.grade,
            course: student.course || student.grade, // Prioritize course over grade
            courseType: student.courseType || null,
            school: student.school,
            phone: student.phone,
            parentsPhone: student.parentsPhone,
            main_comment: student.main_comment || student.comment || '',
            lessons: (student.lessons && typeof student.lessons === 'object' && !Array.isArray(student.lessons)) ? student.lessons : {},
            historyRecords: []
          });
        }
        
        // Create history record with lesson data
        const record = {
          studentId: studentId,
          lesson: lessonName,
          main_center: student.main_center || 'N/A',
          center: lessonData.lastAttendanceCenter || 'n/a',
          lastAttendance: lessonData.lastAttendance || 'n/a', // Use lastAttendance instead of attendanceDate
          hwDone: lessonData.hwDone !== undefined ? lessonData.hwDone : false,
          hwDegree: lessonData.homework_degree || null,
          quizDegree: lessonData.quizDegree || null,
          message_state: lessonData.message_state !== undefined ? lessonData.message_state : false
        };
        
        studentHistoryMap.get(studentId).historyRecords.push(record);
      });
    }
    
    // Convert map to array and sort by student ID
    const result = Array.from(studentHistoryMap.values()).sort((a, b) => a.id - b.id);
    
    console.log(`📈 Returning history for ${result.length} students with ${result.reduce((total, student) => total + student.historyRecords.length, 0)} attendance records`);
    res.json(result);
    
  } catch (error) {
    console.error('❌ History API error:', error);
    
    if (error.message.includes('Unauthorized') || error.message.includes('Invalid token')) {
      return res.status(401).json({ error: error.message });
    }
    
    if (error.message === 'No token provided') {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch history data', 
      details: error.message 
    });
  } finally {
    if (client) await client.close();
  }
} 