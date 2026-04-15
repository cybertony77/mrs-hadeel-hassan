import { MongoClient } from 'mongodb';
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

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const student_id = parseInt(id);
  const { mock_exam_id } = req.body;

  if (!mock_exam_id) {
    return res.status(400).json({ error: 'mock_exam_id is required' });
  }

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
    
    // Find the mock exam to get the lesson field
    const mockExamToReset = onlineMockExams.find(
      me => {
        const meIdStr = me.mock_exam_id ? String(me.mock_exam_id) : null;
        const queryIdStr = String(mock_exam_id);
        return meIdStr === queryIdStr;
      }
    );

    // Remove the mock exam from the array
    const updatedMockExams = onlineMockExams.filter(
      me => {
        const meIdStr = me.mock_exam_id ? String(me.mock_exam_id) : null;
        const queryIdStr = String(mock_exam_id);
        return meIdStr !== queryIdStr;
      }
    );

    // Prepare update object
    const updateFields = {
      online_mock_exams: updatedMockExams
    };

    // Also reset in mockExams array if lesson field exists
    if (mockExamToReset && mockExamToReset.lesson) {
      const lesson = mockExamToReset.lesson;
      const examMatch = lesson.match(/Exam\s+(\d+)/i);
      if (examMatch) {
        const examIndex = parseInt(examMatch[1], 10) - 1; // "Exam 1" → index 0
        if (examIndex >= 0 && examIndex < 50) {
          // Reset the exam index to null values
          updateFields[`mockExams.${examIndex}`] = {
            examDegree: null,
            outOf: null,
            percentage: null,
            date: null
          };
        }
      }
    }

    // Update student document
    const updateResult = await db.collection('students').updateOne(
      { id: student_id },
      { $set: updateFields }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({ success: true, message: 'Mock exam reset successfully' });
  } catch (error) {
    console.error('❌ Error resetting mock exam:', error);
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
