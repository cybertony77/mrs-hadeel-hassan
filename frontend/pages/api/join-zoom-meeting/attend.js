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
const PAYMENT_SYSTEM_ENABLED = envConfig.SYSTEM_PAYMENT_SYSTEM === 'true' || process.env.SYSTEM_PAYMENT_SYSTEM === 'true';
const SCORING_SYSTEM_ENABLED = envConfig.SYSTEM_SCORING_SYSTEM === 'true' || process.env.SYSTEM_SCORING_SYSTEM === 'true';

// Format date as DD/MM/YYYY
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    const user = await authMiddleware(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const studentId = user.assistant_id || user.id;
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    const { lesson } = req.body;
    if (!lesson) {
      return res.status(400).json({ error: 'Lesson is required' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Get student data
    const student = await db.collection('students').findOne({ id: parseInt(studentId) });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Ensure lessons is an object
    if (!student.lessons || Array.isArray(student.lessons)) {
      await db.collection('students').updateOne(
        { id: parseInt(studentId) },
        { $set: { lessons: {} } }
      );
      student.lessons = {};
    }

    // Check if lesson already exists and is attended
    const lessonData = student.lessons[lesson];
    const alreadyAttended = lessonData && lessonData.attended === true;

    if (alreadyAttended) {
      // Already attended - don't deduct sessions, don't apply scoring, just return success
      return res.status(200).json({
        success: true,
        message: 'Already attended this lesson',
        alreadyAttended: true,
        sessionDeducted: false
      });
    }

    // Build attendance data (same schema as scan page / online sessions)
    const now = new Date();
    const attendanceDateOnly = formatDate(now);
    const attendanceString = `${attendanceDateOnly} in Online`;

    const updateQuery = {};
    let sessionDeducted = false;

    if (lessonData) {
      // Lesson exists but not attended - update it
      updateQuery[`lessons.${lesson}.attended`] = true;
      updateQuery[`lessons.${lesson}.lastAttendance`] = attendanceString;
      updateQuery[`lessons.${lesson}.lastAttendanceCenter`] = 'Online';
      updateQuery[`lessons.${lesson}.attendanceDate`] = attendanceDateOnly;
      updateQuery[`lessons.${lesson}.paid`] = true;
    } else {
      // Lesson doesn't exist - create it with full schema
      updateQuery[`lessons.${lesson}`] = {
        lesson: lesson,
        attended: true,
        lastAttendance: attendanceString,
        lastAttendanceCenter: 'Online',
        attendanceDate: attendanceDateOnly,
        hwDone: false,
        quizDegree: null,
        comment: null,
        message_state: false,
        homework_degree: null,
        paid: true
      };
    }

    // Deduct session if payment system enabled, lesson wasn't already paid, and sessions > 0
    const isLessonPaid = lessonData && lessonData.paid === true;
    if (PAYMENT_SYSTEM_ENABLED && !isLessonPaid) {
      const currentSessions = student.payment?.numberOfSessions || 0;
      if (currentSessions > 0) {
        updateQuery['payment.numberOfSessions'] = currentSessions - 1;
        sessionDeducted = true;
      }
    }

    // Apply the update
    await db.collection('students').updateOne(
      { id: parseInt(studentId) },
      { $set: updateQuery }
    );

    // Add to history collection (same as scan page / online session attendance)
    try {
      const existingHistory = await db.collection('history').findOne({
        studentId: parseInt(studentId),
        lesson: lesson
      });

      if (!existingHistory) {
        await db.collection('history').insertOne({
          studentId: parseInt(studentId),
          lesson: lesson
        });
      }
    } catch (historyErr) {
      console.error('⚠️ Failed to add zoom attendance to history:', historyErr);
    }

    // === SCORING SYSTEM: Apply attendance scoring (status: 'attend') ===
    if (SCORING_SYSTEM_ENABLED) {
      try {
        // Check if 'attend' scoring was already applied for this student + lesson
        const existingScoringHistory = await db.collection('scoring_system_history').findOne({
          studentId: parseInt(studentId),
          type: 'attendance',
          lesson: lesson,
          'data.status': 'attend'
        });

        if (!existingScoringHistory) {
          // Forward auth headers for internal API calls
          const protocol = req.headers['x-forwarded-proto'] || 'http';
          const host = req.headers.host;
          const baseUrl = `${protocol}://${host}`;

          const headers = { 'Content-Type': 'application/json' };
          if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
          }
          if (req.headers.cookie) {
            headers['Cookie'] = req.headers.cookie;
          }

          // Check previous scoring history for this lesson
          let previousStatus = null;
          try {
            const historyRes = await fetch(`${baseUrl}/api/scoring/get-last-history`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                studentId: parseInt(studentId),
                type: 'attendance',
                lesson: lesson
              })
            });
            if (historyRes.ok) {
              const historyData = await historyRes.json();
              if (historyData.found) {
                previousStatus = historyData.history?.data?.status || null;
              }
            }
          } catch (e) {
            console.error('⚠️ Failed to get scoring history:', e);
          }

          // Apply 'attend' attendance scoring
          try {
            const calcRes = await fetch(`${baseUrl}/api/scoring/calculate`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                studentId: parseInt(studentId),
                type: 'attendance',
                lesson: lesson,
                data: {
                  status: 'attend',
                  previousStatus: previousStatus
                }
              })
            });
            if (calcRes.ok) {
              console.log(`[SCORING] Attend score applied for student ${studentId}, lesson "${lesson}" via Zoom`);
            } else {
              const errData = await calcRes.json().catch(() => ({}));
              console.error('⚠️ Scoring calculate failed:', errData);
            }
          } catch (e) {
            console.error('⚠️ Failed to apply scoring:', e);
          }
        } else {
          console.log(`[SCORING] Attend scoring already applied for student ${studentId}, lesson "${lesson}" — skipping`);
        }
      } catch (scoringErr) {
        console.error('⚠️ Failed to process scoring for zoom attendance:', scoringErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Attendance recorded successfully',
      alreadyAttended: false,
      sessionDeducted
    });
  } catch (error) {
    console.error('Error in zoom meeting attend API:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    if (client) await client.close();
  }
}
