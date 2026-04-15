import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';

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

  let client;
  try {
    // Allow authenticated users (students, assistants, admins, developers)
    const user = await authMiddleware(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // For students, use assistant_id; for others, use id
    const studentId = user.assistant_id || user.id;
    const parsedStudentId = studentId ? parseInt(studentId) : null;
    if (!parsedStudentId || isNaN(parsedStudentId)) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Get all students for ranking calculation
    const allStudents = await db.collection('students').find({}).toArray();

    // Calculate rankings for each student
    // Group students by main center and course for efficient ranking
    const centerGroups = {};
    const courseGroups = {};
    
    allStudents.forEach(student => {
      if (student.score !== null && student.score !== undefined) {
        // Group by main center
        const center = student.main_center || 'Unknown';
        if (!centerGroups[center]) {
          centerGroups[center] = [];
        }
        centerGroups[center].push(student);
        
        // Group by course (use course field, fallback to grade)
        const courseKey = student.course || student.grade || 'Unknown';
        if (!courseGroups[courseKey]) {
          courseGroups[courseKey] = [];
        }
        courseGroups[courseKey].push(student);
      }
    });
    
    // Sort each group by score descending
    Object.keys(centerGroups).forEach(center => {
      centerGroups[center].sort((a, b) => (b.score || 0) - (a.score || 0));
    });
    
    Object.keys(courseGroups).forEach(course => {
      courseGroups[course].sort((a, b) => (b.score || 0) - (a.score || 0));
    });
    
    // Find the requested student
    const student = allStudents.find(s => s.id === parsedStudentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const center = student.main_center || 'Unknown';
    const courseKey = student.course || student.grade || 'Unknown';
    
    // Calculate rank within main center
    const sameCenterStudents = centerGroups[center] || [];
    const centerRank = sameCenterStudents.findIndex(s => s.id === parsedStudentId) + 1;
    const centerTotal = sameCenterStudents.length;

    // Calculate rank within course
    const sameCourseStudents = courseGroups[courseKey] || [];
    const courseRank = sameCourseStudents.findIndex(s => s.id === parsedStudentId) + 1;
    const courseTotal = sameCourseStudents.length;

    return res.status(200).json({
      success: true,
      centerRank: centerRank > 0 ? centerRank : null,
      centerTotal: centerTotal > 0 ? centerTotal : null,
      courseRank: courseRank > 0 ? courseRank : null,
      courseTotal: courseTotal > 0 ? courseTotal : null,
      mainCenter: student.main_center || 'Unknown',
      course: student.course || student.grade || 'Unknown'
    });
  } catch (error) {
    console.error('Error fetching student rankings:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    if (client) await client.close();
  }
}
