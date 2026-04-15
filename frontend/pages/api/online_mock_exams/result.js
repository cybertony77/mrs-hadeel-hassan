import { MongoClient, ObjectId } from 'mongodb';
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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'mr-george-magdy';

export default async function handler(req, res) {
  let client;
  try {
    // Verify authentication - allow students
    const user = await authMiddleware(req);
    
    // Allow students, admins, developers, and assistants
    if (!['student', 'admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Mock exam ID is required' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Get mock exam with correct answers for result display
    const mockExam = await db.collection('mock_exams').findOne({ _id: new ObjectId(id) });
    
    if (!mockExam) {
      return res.status(404).json({ error: 'Mock exam not found' });
    }

    // Return mock exam with correct answers (for result page only)
    return res.status(200).json({ 
      success: true,
      mockExam: {
        _id: mockExam._id,
        lesson_name: mockExam.lesson_name,
        timer: mockExam.timer,
        lesson: mockExam.lesson || null,
        questions: mockExam.questions.map(q => ({
          question_picture: q.question_picture,
          question_text: q.question_text,
          answers: q.answers,
          answer_texts: q.answer_texts || [],
          correct_answer: q.correct_answer,
          question_explanation: q.question_explanation || ''
        }))
      }
    });
  } catch (error) {
    console.error('Result Mock Exams API error:', error);
    if (error.message === 'Unauthorized' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}

