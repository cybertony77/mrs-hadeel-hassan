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
  let client;
  let db;

  try {
    console.log('🔍 Lessons API called:', { method: req.method, url: req.url });
    
    // Validate environment variables
    if (!MONGO_URI || !DB_NAME || !JWT_SECRET) {
      console.error('❌ Missing environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error', 
        details: 'Missing required environment variables'
      });
    }

    console.log('🔗 Connecting to MongoDB...');
    try {
      client = await MongoClient.connect(MONGO_URI);
      db = client.db(DB_NAME);
      console.log('✅ Connected to database:', DB_NAME);
    } catch (dbError) {
      console.error('❌ MongoDB connection failed:', dbError);
      return res.status(500).json({ 
        error: 'Database connection failed', 
        details: dbError.message 
      });
    }

    // Authenticate user
    console.log('🔐 Authenticating user...');
    const user = await authMiddleware(req);
    console.log('✅ User authenticated:', user.id);

    if (req.method === 'GET') {
      // Get all lessons
      console.log('📋 Fetching lessons from database...');
      const lessons = await db.collection('lessons').find({}).sort({ id: 1 }).toArray();
      console.log(`✅ Found ${lessons.length} lessons`);
      res.json({ lessons });

    } else if (req.method === 'POST') {
      // Create new lesson
      const { name, category } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Lesson name is required' });
      }

      const categoryNorm =
        category == null ||
        category === '' ||
        String(category).trim() === ''
          ? null
          : String(category).trim();

      // Check if lesson already exists
      const existingLesson = await db.collection('lessons').findOne({ name: name.trim() });
      if (existingLesson) {
        return res.status(400).json({ error: 'Lesson already exists' });
      }

      // Get next ID
      const lastLesson = await db.collection('lessons').findOne({}, { sort: { id: -1 } });
      const nextId = lastLesson ? lastLesson.id + 1 : 1;

      const newLesson = {
        id: nextId,
        name: name.trim(),
        createdAt: new Date(),
        category: categoryNorm,
      };

      await db.collection('lessons').insertOne(newLesson);
      res.json({ success: true, lesson: newLesson });

    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Lessons API error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    if (error.message === 'No token provided') {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    if (client) await client.close();
  }
}
