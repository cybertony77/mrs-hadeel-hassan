import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';
import { duplicateCenterMongoFragment } from '../../../lib/onlineItemDuplicate';

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
    if (!['admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    const collection = db.collection('material');

    if (req.method === 'GET') {
      const materials = await collection.find({}).sort({ course: 1, material_name: 1, date: -1 }).toArray();
      return res.status(200).json({ success: true, materials });
    }

    if (req.method === 'POST') {
      const { course, courseType, center, material_name, comment, pdf_file_name, pdf_url, state } = req.body;
      if (!course || !String(course).trim()) return res.status(400).json({ error: '❌ Material course is required' });
      if (!material_name || !String(material_name).trim()) return res.status(400).json({ error: '❌ Material name is required' });
      if (!pdf_file_name || !String(pdf_file_name).trim()) return res.status(400).json({ error: '❌ PDF file name is required' });
      if (!pdf_url || !String(pdf_url).trim()) return res.status(400).json({ error: '❌ PDF file is required' });

      const courseTrimmed = String(course).trim();
      const courseTypeTrimmed = courseType ? String(courseType).trim() : '';
      const centerTrimmed = center && String(center).trim() !== '' ? String(center).trim() : null;
      const materialNameTrimmed = String(material_name).trim();

      const existing = await collection.findOne({
        course: courseTrimmed,
        courseType: courseTypeTrimmed || null,
        material_name: materialNameTrimmed,
        ...duplicateCenterMongoFragment(centerTrimmed),
      });
      if (existing) {
        return res.status(400).json({ error: '❌ A material with this course, course type, material name, and center already exists.' });
      }

      const item = {
        course: courseTrimmed,
        courseType: courseTypeTrimmed || null,
        center: centerTrimmed,
        material_name: materialNameTrimmed,
        comment: comment && String(comment).trim() ? String(comment).trim() : null,
        pdf_file_name: String(pdf_file_name).trim(),
        pdf_url: String(pdf_url).trim(),
        state: state === 'Deactivated' ? 'Deactivated' : 'Activated',
        date: new Date().toISOString(),
      };
      const result = await collection.insertOne(item);
      return res.status(201).json({ success: true, message: 'Material created successfully', material: { ...item, _id: result.insertedId } });
    }

    if (req.method === 'PUT') {
      const { id } = req.query;
      const { course, courseType, center, material_name, comment, pdf_file_name, pdf_url, state } = req.body;
      if (!id) return res.status(400).json({ error: '❌ Material ID is required' });
      if (!course || !String(course).trim()) return res.status(400).json({ error: '❌ Material course is required' });
      if (!material_name || !String(material_name).trim()) return res.status(400).json({ error: '❌ Material name is required' });
      if (!pdf_file_name || !String(pdf_file_name).trim()) return res.status(400).json({ error: '❌ PDF file name is required' });
      if (!pdf_url || !String(pdf_url).trim()) return res.status(400).json({ error: '❌ PDF file is required' });

      const courseTrimmed = String(course).trim();
      const courseTypeTrimmed = courseType ? String(courseType).trim() : '';
      const centerTrimmed = center && String(center).trim() !== '' ? String(center).trim() : null;
      const materialNameTrimmed = String(material_name).trim();

      const existing = await collection.findOne({
        course: courseTrimmed,
        courseType: courseTypeTrimmed || null,
        material_name: materialNameTrimmed,
        ...duplicateCenterMongoFragment(centerTrimmed),
        _id: { $ne: new ObjectId(id) },
      });
      if (existing) {
        return res.status(400).json({ error: '❌ A material with this course, course type, material name, and center already exists.' });
      }

      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            course: courseTrimmed,
            courseType: courseTypeTrimmed || null,
            center: centerTrimmed,
            material_name: materialNameTrimmed,
            comment: comment && String(comment).trim() ? String(comment).trim() : null,
            pdf_file_name: String(pdf_file_name).trim(),
            pdf_url: String(pdf_url).trim(),
            state: state === 'Deactivated' ? 'Deactivated' : 'Activated',
          },
        }
      );
      if (result.matchedCount === 0) return res.status(404).json({ error: '❌ Material not found' });
      return res.status(200).json({ success: true, message: 'Material updated successfully' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: '❌ Material ID is required' });
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      if (!result.deletedCount) return res.status(404).json({ error: '❌ Material not found' });
      return res.status(200).json({ success: true, message: 'Material deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Materials API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}
