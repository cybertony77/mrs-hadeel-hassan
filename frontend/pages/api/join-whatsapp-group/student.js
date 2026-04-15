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

    // Get student ID from user
    const studentId = user.assistant_id || user.id;
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Get student data
    const student = await db.collection('students').findOne({ id: parseInt(studentId) });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get all WhatsApp groups
    const allGroups = await db.collection('join_whatsapp_group').find({}).toArray();

    // Filter groups that match the student (case-insensitive comparison)
    // Match by course (or "All"), courseType (if exists), center, and gender
    const studentCourse = (student.course || '').trim();
    const studentCourseType = (student.courseType || '').trim();
    const studentCenter = (student.main_center || '').trim();
    const studentGender = (student.gender || '').trim();
    
    const matchingGroups = allGroups.filter(group => {
      const groupCourse = (group.course || '').trim();
      const groupCourseType = (group.courseType || '').trim();
      const groupCenter = (group.center || '').trim();
      const groupGender = (group.gender || '').trim();
      
      // Course match: group course is "All" or matches student's course
      const courseMatch = groupCourse.toLowerCase() === 'all' || 
                         groupCourse.toLowerCase() === studentCourse.toLowerCase();
      
      // CourseType match: if group has courseType, it must match student's courseType
      // If group has no courseType, it matches any student
      const courseTypeMatch = !groupCourseType || 
                             groupCourseType === '' || 
                             groupCourseType.toLowerCase() === studentCourseType.toLowerCase();
      
      // Center match: if group has a center, it must match student's center
      // If group has no center (empty), it matches any student
      const centerMatch = groupCenter === '' || 
                         groupCenter.toLowerCase() === studentCenter.toLowerCase();
      
      // Gender match: group gender is "Both" or matches student's gender
      const genderMatch = groupGender.toLowerCase() === 'both' || 
                         groupGender.toLowerCase() === studentGender.toLowerCase();

      return courseMatch && courseTypeMatch && centerMatch && genderMatch;
    });

    return res.status(200).json({
      success: true,
      groups: matchingGroups.map(group => ({
        _id: group._id.toString(),
        title: group.title,
        link: group.link,
        course: group.course,
        courseType: group.courseType,
        center: group.center,
        gender: group.gender
      }))
    });
  } catch (error) {
    console.error('Error fetching student WhatsApp groups:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    if (client) await client.close();
  }
}
