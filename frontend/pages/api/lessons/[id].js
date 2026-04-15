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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI;
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME;
const JWT_SECRET = envConfig.JWT_SECRET || process.env.JWT_SECRET;

export default async function handler(req, res) {
  const { id } = req.query;
  const lessonId = parseInt(id);
  let client;

  try {
    // Validate environment variables
    if (!MONGO_URI || !DB_NAME || !JWT_SECRET) {
      console.error('Missing environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (isNaN(lessonId)) {
      return res.status(400).json({ error: 'Invalid lesson ID' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Authenticate user
    const user = await authMiddleware(req);

    if (req.method === 'PUT') {
      // Update lesson
      const { name, category } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Lesson name is required' });
      }

      const categoryNorm =
        category === undefined
          ? undefined
          : category == null ||
              category === '' ||
              String(category).trim() === ''
            ? null
            : String(category).trim();

      // Check if lesson exists
      const lesson = await db.collection('lessons').findOne({ id: lessonId });
      if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }

      // Check if new name already exists (excluding current lesson)
      const existingLesson = await db.collection('lessons').findOne({ 
        name: name.trim(),
        id: { $ne: lessonId }
      });
      if (existingLesson) {
        return res.status(400).json({ error: 'Lesson name already exists' });
      }

      const oldName = lesson.name;
      const newName = name.trim();

      const $set = { name: newName };
      if (categoryNorm !== undefined) {
        $set.category = categoryNorm;
      }

      // Update lesson in lessons collection
      await db.collection('lessons').updateOne(
        { id: lessonId },
        { $set }
      );

      // Update lesson name in all students' lessons object if name changed
      if (oldName !== newName) {
        // Find all students that have this lesson in their lessons object
        const studentsWithLesson = await db.collection('students').find({
          [`lessons.${oldName}`]: { $exists: true }
        }).toArray();

        // Update each student's lessons object
        for (const student of studentsWithLesson) {
          if (student.lessons && student.lessons[oldName]) {
            // Get the lesson data
            const lessonData = { ...student.lessons[oldName] };
            
            // Update the lesson field to match the new name
            lessonData.lesson = newName;
            
            // Remove old lesson key and add new lesson key with updated lesson field
            await db.collection('students').updateOne(
              { id: student.id },
              {
                $unset: { [`lessons.${oldName}`]: "" },
                $set: { [`lessons.${newName}`]: lessonData }
              }
            );
          }
        }

        console.log(`✅ Updated lesson name from "${oldName}" to "${newName}" in ${studentsWithLesson.length} student(s)`);
      }

      res.json({ success: true });

    } else if (req.method === 'DELETE') {
      // Delete lesson
      const lesson = await db.collection('lessons').findOne({ id: lessonId });
      if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }

      // Check if lesson is being used by students
      const studentsWithLesson = await db.collection('students').find({
        [`lessons.${lesson.name}`]: { $exists: true }
      }).toArray();
      
      if (studentsWithLesson.length > 0) {
        return res.status(400).json({ 
          error: `Cannot delete lesson. ${studentsWithLesson.length} student(s) have this lesson in their lessons.` 
        });
      }

      await db.collection('lessons').deleteOne({ id: lessonId });
      res.json({ success: true });

    } else {
      res.setHeader('Allow', ['PUT', 'DELETE']);
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Lesson API error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    if (client) await client.close();
  }
}
