import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../../lib/authMiddleware';
import { itemCenterMatchesStudentMainCenter } from '../../../../lib/studentCenterMatch';

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
  const student_id = parseInt(id);
  const { mock_exam_id } = req.query;

  if (!mock_exam_id) {
    return res.status(400).json({ error: 'mock_exam_id is required' });
  }

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    await authMiddleware(req);

    const student = await db.collection('students').findOne({ id: student_id });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const mockExam = await db.collection('mock_exams').findOne({ _id: new ObjectId(mock_exam_id) });
    if (!mockExam) {
      return res.status(404).json({ error: 'Mock exam not found' });
    }

    if (!itemCenterMatchesStudentMainCenter(mockExam.center, student.main_center)) {
      return res.status(403).json({ error: 'This mock exam is not available for this student center' });
    }

    const onlineMockExams = student.online_mock_exams || [];
    const mockExamIdStr = String(mock_exam_id);
    const matchingResult = onlineMockExams.find(
      (me) => me.mock_exam_id && String(me.mock_exam_id) === mockExamIdStr
    );

    if (!matchingResult) {
      return res.status(404).json({ error: 'Mock exam result not found' });
    }

    res.json({
      success: true,
      mockExam,
      result: matchingResult,
    });
  } catch (error) {
    console.error('❌ Error fetching mock exam preview details:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}
