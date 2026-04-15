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

  const { id } = req.query;
  const student_id = parseInt(id);

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify authentication
    await authMiddleware(req);

    // Get student data
    const student = await db.collection('students').findOne({ id: student_id });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const onlineMockExams = student.online_mock_exams || [];
    const mainCenter = student.main_center;

    const mockExamsWithDetails = (
      await Promise.all(
        onlineMockExams.map(async (meResult) => {
          try {
            const mockExam = await db.collection('mock_exams').findOne({
              _id: new ObjectId(meResult.mock_exam_id),
            });
            if (!mockExam) {
              return null;
            }
            if (!itemCenterMatchesStudentMainCenter(mockExam.center, mainCenter)) {
              return null;
            }
            return {
              ...meResult,
              mockExam: {
                _id: mockExam._id,
                lesson_name: mockExam.lesson_name,
                lesson: mockExam.lesson,
                timer: mockExam.timer,
                questions: mockExam.questions ? mockExam.questions.length : 0,
              },
            };
          } catch (err) {
            console.error(`Error fetching mock exam ${meResult.mock_exam_id}:`, err);
            return null;
          }
        })
      )
    ).filter(Boolean);

    res.json({
      success: true,
      mockExams: mockExamsWithDetails,
    });
  } catch (error) {
    console.error('❌ Error fetching online mock exams:', error);
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
