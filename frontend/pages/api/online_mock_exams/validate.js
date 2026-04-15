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

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { mockExamId, answers, questions } = req.body;

    if (!mockExamId || !answers || !questions) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Get mock exam with correct answers
    const mockExam = await db.collection('mock_exams').findOne({ _id: new ObjectId(mockExamId) });
    
    if (!mockExam) {
      return res.status(404).json({ error: 'Mock exam not found' });
    }

    // Validate answers - count correct answers for the given questions
    let correctCount = 0;
    const results = [];

    questions.forEach((qData, idx) => {
      // Find question by index (since questions are in order)
      const originalQ = mockExam.questions[qData.index];
      
      if (originalQ && answers[idx] !== undefined) {
        const selectedLetter = String.fromCharCode(65 + answers[idx]); // A, B, C, etc.
        // Handle both string and array formats for correct_answer
        const correctAnswerLetter = Array.isArray(originalQ.correct_answer) ? originalQ.correct_answer[0] : originalQ.correct_answer;
        const isCorrect = selectedLetter.toLowerCase() === correctAnswerLetter.toLowerCase();
        if (isCorrect) correctCount++;
        results.push({ isCorrect, questionIndex: idx });
      }
    });

    // Return validation result without exposing correct answers
    return res.status(200).json({ 
      success: true,
      correctCount,
      totalQuestions: questions.length,
      firstFiveCorrect: results.slice(0, 5).every(r => r.isCorrect)
    });
  } catch (error) {
    console.error('Validate Mock Exams API error:', error);
    if (error.message === 'Unauthorized' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}

