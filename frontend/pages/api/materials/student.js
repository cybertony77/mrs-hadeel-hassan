import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';
import { itemCenterMatchesStudentMainCenter } from '../../../lib/studentCenterMatch';

function loadEnvConfig() {
  try {
    const envPath = path.join(process.cwd(), '..', 'env.config');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    envContent.split('\n').forEach((line) => {
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
    return {};
  }
}

const envConfig = loadEnvConfig();
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'mr-george-magdy';

export default async function handler(req, res) {
  let client;
  try {
    const user = await authMiddleware(req);
    if (!['student', 'admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    let studentCourse = null;
    let studentCourseType = null;
    let studentMainCenter = null;
    if (user.role === 'student') {
      const studentId = user.assistant_id || user.id;
      if (!studentId) return res.status(200).json({ success: true, materials: [] });
      const student = await db.collection('students').findOne({ id: studentId });
      if (!student) return res.status(200).json({ success: true, materials: [] });
      studentCourse = student.course;
      studentCourseType = student.courseType;
      studentMainCenter = student.main_center;
    }

    const allMaterials = await db.collection('material').find({}).sort({ material_name: 1, date: -1 }).toArray();
    if (!studentCourse) return res.status(200).json({ success: true, materials: [] });

    const studentCourseTrimmed = (studentCourse || '').trim();
    const studentCourseTypeTrimmed = (studentCourseType || '').trim();
    const filtered = allMaterials.filter((item) => {
      const itemCourse = (item.course || '').trim();
      const itemCourseType = (item.courseType || '').trim();
      const itemState = item.state || 'Activated';
      const courseMatch = itemCourse.toLowerCase() === 'all' || itemCourse.toLowerCase() === studentCourseTrimmed.toLowerCase();
      const courseTypeMatch = !itemCourseType || !studentCourseTypeTrimmed || itemCourseType.toLowerCase() === studentCourseTypeTrimmed.toLowerCase();
      const isActivated = itemState !== 'Deactivated';
      const centerMatch = itemCenterMatchesStudentMainCenter(item.center, studentMainCenter);
      return courseMatch && courseTypeMatch && isActivated && centerMatch;
    });

    return res.status(200).json({ success: true, materials: filtered });
  } catch (error) {
    console.error('Student materials API error:', error);
    if (error.message === 'Unauthorized' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}
