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

// Get current time (minutes since midnight) in Egypt/Cairo timezone
function getCairoNowMinutes() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const hourPart = parts.find((p) => p.type === 'hour');
  const minutePart = parts.find((p) => p.type === 'minute');

  const hours = hourPart ? parseInt(hourPart.value, 10) : 0;
  const minutes = minutePart ? parseInt(minutePart.value, 10) : 0;

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

// Convert stored time object (hours, minutes, AM/PM) into minutes since midnight (Cairo local day)
function timeObjToMinutes(timeObj) {
  if (!timeObj || !timeObj.hours || !timeObj.minutes || !timeObj.period) return null;

  let hours = parseInt(timeObj.hours, 10);
  const minutes = parseInt(timeObj.minutes, 10);
  const period = String(timeObj.period || '').toUpperCase();

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  // Convert to 24-hour format
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Get student data
    const student = await db.collection('students').findOne({ id: parseInt(studentId) });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get zoom meeting (only one)
    const meetings = await db.collection('join_zoom_meeting').find({}).toArray();

    if (meetings.length === 0) {
      return res.status(200).json({ success: true, meeting: null });
    }

    const meeting = meetings[0];
    const nowMinutes = getCairoNowMinutes();

    if (nowMinutes === null) {
      // Fallback: if timezone calculation fails, hide meeting to be safe
      return res.status(200).json({ success: true, meeting: null });
    }

    // Check course match
    const studentCourse = (student.course || '').trim().toLowerCase();
    const meetingCourse = (meeting.course || '').trim().toLowerCase();
    const courseMatch = meetingCourse === 'all' || meetingCourse === studentCourse;

    if (!courseMatch) {
      return res.status(200).json({ success: true, meeting: null });
    }

    // Check courseType match (if meeting has courseType set)
    const studentCourseType = (student.courseType || '').trim().toLowerCase();
    const meetingCourseType = (meeting.courseType || '').trim().toLowerCase();
    if (meetingCourseType && meetingCourseType !== '' && meetingCourseType !== studentCourseType) {
      return res.status(200).json({ success: true, meeting: null });
    }

    // Check if the student already attended this meeting's lesson
    const meetingLesson = meeting.lesson || null;
    const studentAlreadyAttended = meetingLesson && 
      student.lessons && 
      student.lessons[meetingLesson] && 
      student.lessons[meetingLesson].attended === true;

    // Check deadline (Egypt/Cairo): if deadline exists and deadline <= now, hide
    // BUT if the student already attended this lesson, don't hide (they may need to rejoin)
    if (
      !studentAlreadyAttended &&
      meeting.deadline &&
      meeting.deadline.hours &&
      meeting.deadline.minutes &&
      meeting.deadline.period
    ) {
      const deadlineMinutes = timeObjToMinutes(meeting.deadline);
      if (deadlineMinutes !== null && deadlineMinutes <= nowMinutes) {
        return res.status(200).json({ success: true, meeting: null });
      }
    }

    // Check start date (Egypt/Cairo): if start date exists and start > now, hide
    if (
      meeting.dateOfStart &&
      meeting.dateOfStart.hours &&
      meeting.dateOfStart.minutes &&
      meeting.dateOfStart.period
    ) {
      const startMinutes = timeObjToMinutes(meeting.dateOfStart);
      if (startMinutes !== null && startMinutes > nowMinutes) {
        return res.status(200).json({ success: true, meeting: null });
      }
    }

    // Check end date (Egypt/Cairo): if end date exists and end < now, hide
    if (
      meeting.dateOfEnd &&
      meeting.dateOfEnd.hours &&
      meeting.dateOfEnd.minutes &&
      meeting.dateOfEnd.period
    ) {
      const endMinutes = timeObjToMinutes(meeting.dateOfEnd);
      if (endMinutes !== null && endMinutes < nowMinutes) {
        return res.status(200).json({ success: true, meeting: null });
      }
    }

    // All checks passed - return the meeting
    return res.status(200).json({
      success: true,
      meeting: {
        _id: meeting._id.toString(),
        link: meeting.link,
        course: meeting.course,
        courseType: meeting.courseType,
        lesson: meeting.lesson || null,
        deadline: meeting.deadline,
        dateOfStart: meeting.dateOfStart,
        dateOfEnd: meeting.dateOfEnd
      }
    });
  } catch (error) {
    console.error('Error fetching student zoom meeting:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    if (client) await client.close();
  }
}
