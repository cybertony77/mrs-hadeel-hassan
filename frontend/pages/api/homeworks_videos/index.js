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

// Extract YouTube video ID from URL
function extractYouTubeId(url) {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

// Format date as MM/DD/YYYY at hour:minute AM/PM
function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const hoursStr = String(hours).padStart(2, '0');
  
  return `${month}/${day}/${year} at ${hoursStr}:${minutes} ${ampm}`;
}

export default async function handler(req, res) {
  let client;
  let db;

  try {
    // Validate environment variables
    if (!MONGO_URI || !DB_NAME || !JWT_SECRET) {
      console.error('❌ Missing environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error', 
        details: 'Missing required environment variables'
      });
    }

    // Connect to MongoDB
    client = await MongoClient.connect(MONGO_URI);
    db = client.db(DB_NAME);

    // Authenticate user - only admin, developer, or assistant can access
    const user = await authMiddleware(req);
    if (!['admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    if (req.method === 'GET') {
      // Get all homeworks videos, sorted by course, courseType, lesson, then date descending
      const sessions = await db.collection('homeworks_videos')
        .find({})
        .sort({ course: 1, courseType: 1, lesson: 1, date: -1 })
        .toArray();
      
      res.json({ sessions });

    } else if (req.method === 'POST') {
      // Create new homework video
      const { name, video_urls, videos, description, course, courseType, lesson, payment_state, state } = req.body;

      // Validate required fields
      if (!course || !course.trim()) {
        return res.status(400).json({ error: 'Course is required' });
      }

      if (!lesson || !lesson.trim()) {
        return res.status(400).json({ error: 'Lesson is required' });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const allowedPaymentStatesPost = ['paid', 'free', 'free_if_homework_done', 'free_if_attended'];
      if (!payment_state || !allowedPaymentStatesPost.includes(payment_state)) {
        return res.status(400).json({
          error:
            'Video Payment State is required and must be "paid", "free", "free_if_homework_done", or "free_if_attended"',
        });
      }

      // Handle both old format (video_urls) and new format (videos array)
      // Supports YouTube and Cloudflare R2 video types
      let videoData = {};
      
      if (videos && Array.isArray(videos) && videos.length > 0) {
        // New format: videos array with video_type and video_id
        for (let index = 0; index < videos.length; index++) {
          const video = videos[index];
          if (video && video.video_type && video.video_id) {
            if (video.video_type === 'youtube') {
              videoData[`video_ID_${index + 1}`] = video.video_id;
              videoData[`video_type_${index + 1}`] = 'youtube';
              if (video.video_name && video.video_name.trim()) {
                videoData[`video_name_${index + 1}`] = video.video_name.trim();
              }
            } else if (video.video_type === 'r2') {
              videoData[`video_ID_${index + 1}`] = video.video_id;
              videoData[`video_type_${index + 1}`] = 'r2';
              if (video.video_name && video.video_name.trim()) {
                videoData[`video_name_${index + 1}`] = video.video_name.trim();
              }
            } else {
              return res.status(400).json({ error: `Invalid video type at position ${index + 1}. Supported types: youtube, r2.` });
            }
          } else if (video && video.video_id) {
            // If no video_type specified, assume YouTube and extract ID from URL if needed
            let videoId = video.video_id;
            if (videoId.includes('youtube.com') || videoId.includes('youtu.be')) {
              videoId = extractYouTubeId(videoId);
              if (!videoId) {
                return res.status(400).json({ error: `Invalid YouTube URL at position ${index + 1}` });
              }
            }
            videoData[`video_ID_${index + 1}`] = videoId;
            videoData[`video_type_${index + 1}`] = 'youtube';
            if (video.video_name && video.video_name.trim()) {
              videoData[`video_name_${index + 1}`] = video.video_name.trim();
            }
          } else {
            return res.status(400).json({ error: `Invalid video data at position ${index + 1}` });
          }
        }
      } else if (video_urls && Array.isArray(video_urls) && video_urls.length > 0) {
        // Old format: video_urls array (YouTube only)
        for (let index = 0; index < video_urls.length; index++) {
          const url = video_urls[index];
          if (url && url.trim()) {
            const videoId = extractYouTubeId(url.trim());
            if (videoId) {
              videoData[`video_ID_${index + 1}`] = videoId;
              videoData[`video_type_${index + 1}`] = 'youtube';
            } else {
              return res.status(400).json({ error: `Invalid YouTube URL at position ${index + 1}` });
            }
          }
        }
      } else {
        return res.status(400).json({ error: 'At least one video is required' });
      }

      if (Object.keys(videoData).length === 0) {
        return res.status(400).json({ error: 'At least one valid video is required' });
      }

      // Normalize session state (default to "Activated")
      let finalState = 'Activated';
      if (state === 'Activated' || state === 'Deactivated') {
        finalState = state;
      }

      // Create session document
      const session = {
        course: course.trim(),
        courseType: courseType && courseType.trim() ? courseType.trim() : null,
        lesson: lesson.trim(),
        payment_state: payment_state,
        name: name.trim(),
        ...videoData,
        description: description && description.trim() ? description.trim() : null,
        date: formatDate(new Date()),
        state: finalState
      };

      // Insert into database
      const result = await db.collection('homeworks_videos').insertOne(session);
      
      res.status(201).json({ 
        success: true, 
        session: { ...session, _id: result.insertedId }
      });

    } else if (req.method === 'PUT') {
      // Update homework video
      const { id } = req.query;
      const { name, video_urls, videos, description, course, courseType, lesson, payment_state, state } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      // Validate required fields
      if (!course || !course.trim()) {
        return res.status(400).json({ error: 'Course is required' });
      }

      if (!lesson || !lesson.trim()) {
        return res.status(400).json({ error: 'Lesson is required' });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const allowedPaymentStatesPut = ['paid', 'free', 'free_if_homework_done', 'free_if_attended'];
      if (!payment_state || !allowedPaymentStatesPut.includes(payment_state)) {
        return res.status(400).json({
          error:
            'Video Payment State is required and must be "paid", "free", "free_if_homework_done", or "free_if_attended"',
        });
      }

      // Handle both old format (video_urls) and new format (videos array)
      // Supports YouTube and Cloudflare R2 video types
      let videoData = {};
      
      if (videos && Array.isArray(videos) && videos.length > 0) {
        // New format: videos array with video_type and video_id
        for (let index = 0; index < videos.length; index++) {
          const video = videos[index];
          if (video && video.video_type && video.video_id) {
            if (video.video_type === 'youtube') {
              videoData[`video_ID_${index + 1}`] = video.video_id;
              videoData[`video_type_${index + 1}`] = 'youtube';
              if (video.video_name && video.video_name.trim()) {
                videoData[`video_name_${index + 1}`] = video.video_name.trim();
              }
            } else if (video.video_type === 'r2') {
              videoData[`video_ID_${index + 1}`] = video.video_id;
              videoData[`video_type_${index + 1}`] = 'r2';
              if (video.video_name && video.video_name.trim()) {
                videoData[`video_name_${index + 1}`] = video.video_name.trim();
              }
            } else {
              return res.status(400).json({ error: `Invalid video type at position ${index + 1}. Supported types: youtube, r2.` });
            }
          } else if (video && video.video_id) {
            // If no video_type specified, assume YouTube and extract ID from URL if needed
            let videoId = video.video_id;
            if (videoId.includes('youtube.com') || videoId.includes('youtu.be')) {
              videoId = extractYouTubeId(videoId);
              if (!videoId) {
                return res.status(400).json({ error: `Invalid YouTube URL at position ${index + 1}` });
              }
            }
            videoData[`video_ID_${index + 1}`] = videoId;
            videoData[`video_type_${index + 1}`] = 'youtube';
            if (video.video_name && video.video_name.trim()) {
              videoData[`video_name_${index + 1}`] = video.video_name.trim();
            }
          } else {
            return res.status(400).json({ error: `Invalid video data at position ${index + 1}` });
          }
        }
      } else if (video_urls && Array.isArray(video_urls) && video_urls.length > 0) {
        // Old format: video_urls array (YouTube only)
        for (let index = 0; index < video_urls.length; index++) {
          const url = video_urls[index];
          if (url && url.trim()) {
            const videoId = extractYouTubeId(url.trim());
            if (videoId) {
              videoData[`video_ID_${index + 1}`] = videoId;
              videoData[`video_type_${index + 1}`] = 'youtube';
            } else {
              return res.status(400).json({ error: `Invalid YouTube URL at position ${index + 1}` });
            }
          }
        }
      } else {
        return res.status(400).json({ error: 'At least one video is required' });
      }

      if (Object.keys(videoData).length === 0) {
        return res.status(400).json({ error: 'At least one valid video is required' });
      }

      // Get existing session to clean up old video fields
      const session = await db.collection('homeworks_videos').findOne({ _id: new ObjectId(id) });
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Normalize session state if provided
      let finalState = null;
      if (state === 'Activated' || state === 'Deactivated') {
        finalState = state;
      }

      // Update session document
      const updateData = {
        course: course.trim(),
        courseType: courseType && courseType.trim() ? courseType.trim() : null,
        lesson: lesson.trim(),
        payment_state: payment_state,
        name: name.trim(),
        ...videoData,
        description: description && description.trim() ? description.trim() : null,
        date: formatDate(new Date())
      };

      if (finalState) {
        updateData.state = finalState;
      }

      // Remove old video_ID, video_type, and video_name fields that are not in the new list
      const keysToRemove = Object.keys(session).filter(key => 
        (key.startsWith('video_ID_') || key.startsWith('video_type_') || key.startsWith('video_name_')) && 
        !videoData[key]
      );
      
      const updateQuery = { $set: updateData };
      if (keysToRemove.length > 0 || session.account_state !== undefined) {
        const unsetFields = {};
        keysToRemove.forEach(key => {
          unsetFields[key] = '';
        });
        // Also remove old account_state field if present (we now use "state")
        if (session.account_state !== undefined) {
          unsetFields.account_state = '';
        }
        updateQuery.$unset = unsetFields;
      }

      const result = await db.collection('homeworks_videos').updateOne(
        { _id: new ObjectId(id) },
        updateQuery
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({ success: true, message: 'Session updated successfully' });

    } else if (req.method === 'DELETE') {
      // Delete homework video
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      const result = await db.collection('homeworks_videos').deleteOne(
        { _id: new ObjectId(id) }
      );

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({ success: true, message: 'Session deleted successfully' });

    } else {
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('❌ Error in homeworks_videos API:', error);
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
