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

function getQuestionPicturesFromPayload(question = {}) {
  const pictures = [];
  pictures[0] = question.question_picture || null;
  Object.keys(question)
    .filter((key) => /^question_picture_\d+$/.test(key))
    .sort((a, b) => Number(a.split('_').pop()) - Number(b.split('_').pop()))
    .forEach((key) => {
      const idx = Number(key.split('_').pop()) - 1;
      if (idx >= 1) pictures[idx] = question[key] || null;
    });
  return pictures.filter((pic) => !!pic);
}

function normalizeQuestionPictures(question = {}) {
  const pictures = [question.question_picture || null];
  Object.keys(question)
    .filter((key) => /^question_picture_\d+$/.test(key))
    .sort((a, b) => Number(a.split('_').pop()) - Number(b.split('_').pop()))
    .forEach((key) => {
      const idx = Number(key.split('_').pop()) - 1;
      if (idx >= 1) pictures[idx] = question[key] || null;
    });

  const normalized = { question_picture: pictures[0] || null };
  for (let i = 1; i < pictures.length; i++) {
    normalized[`question_picture_${i + 1}`] = pictures[i] || null;
  }
  return normalized;
}

export default async function handler(req, res) {
  let client;
  try {
    // Verify authentication
    const user = await authMiddleware(req);
    
    // Check if user has required role (admin, developer, or assistant)
    if (!['admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    if (req.method === 'GET') {
      // Get all quizzes, sorted by course, then lesson, then date descending
      const quizzes = await db.collection('quizzes')
        .find({})
        .sort({ course: 1, lesson: 1, date: -1 })
        .toArray();
      
      return res.status(200).json({ success: true, quizzes });
    }

    if (req.method === 'POST') {
      const { lesson_name, timer, questions, lesson, course, courseType, center, quiz_type, deadline_type, deadline_date, shuffle_questions_and_answers, show_details_after_submitting, comment, pdf_file_name, pdf_url, state } = req.body;

      const effectiveQuizType = quiz_type || 'questions';

      if (!course || course.trim() === '') {
        return res.status(400).json({ error: '❌ Course is required' });
      }

      if (!lesson || lesson.trim() === '') {
        return res.status(400).json({ error: '❌ Lesson is required' });
      }

      if (!lesson_name || lesson_name.trim() === '') {
        return res.status(400).json({ error: '❌ Lesson name is required' });
      }

      if (effectiveQuizType === 'pdf') {
        if (!pdf_file_name || pdf_file_name.trim() === '') {
          return res.status(400).json({ error: '❌ PDF file name is required' });
        }
        if (!pdf_url || pdf_url.trim() === '') {
          return res.status(400).json({ error: '❌ PDF file is required' });
        }
      } else {
        // Validate questions
        if (!Array.isArray(questions) || questions.length === 0) {
          return res.status(400).json({ error: '❌ At least one question is required' });
        }
      }

      // Validate deadline if with deadline
      if (deadline_type === 'with_deadline') {
        if (!deadline_date) {
          return res.status(400).json({ error: '❌ Deadline date is required' });
        }
        const selectedDate = new Date(deadline_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate <= today) {
          return res.status(400).json({ error: '❌ Deadline date must be in the future' });
        }
      }

      if (effectiveQuizType === 'questions') {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const hasQuestionText = q.question_text && q.question_text.trim() !== '';
          const hasQuestionImage = getQuestionPicturesFromPayload(q).length > 0;
          if (!hasQuestionText && !hasQuestionImage) {
            return res.status(400).json({ error: `❌ Question ${i + 1}: Question must have at least question text or image (or both)` });
          }
          if (!Array.isArray(q.answers) || q.answers.length < 2) {
            return res.status(400).json({ error: `❌ Question ${i + 1}: At least 2 answers (A and B) are required` });
          }
          for (let j = 0; j < q.answers.length; j++) {
            const expectedLetter = String.fromCharCode(65 + j);
            if (q.answers[j] !== expectedLetter) {
              return res.status(400).json({ error: `❌ Question ${i + 1}: Answers must be letters A, B, C, D, etc. in order` });
            }
          }
          if (!q.correct_answer) {
            return res.status(400).json({ error: `❌ Question ${i + 1}: Correct answer is required` });
          }
          const correctAnswerLetter = Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer;
          const correctLetterUpper = correctAnswerLetter.toUpperCase();
          if (!q.answers.includes(correctLetterUpper)) {
            return res.status(400).json({ error: `❌ Question ${i + 1}: Correct answer must be one of the provided answers` });
          }
          if (q.answer_texts && Array.isArray(q.answer_texts) && q.answer_texts.length !== q.answers.length) {
            return res.status(400).json({ error: `❌ Question ${i + 1}: Answer texts array must match answers array length` });
          }
        }
      }

      // Check for duplicate course, courseType, and lesson combination
      const courseTrimmed = course.trim();
      const courseTypeTrimmed = courseType ? courseType.trim() : '';
      const lessonTrimmed = lesson.trim();
      const centerTrimmed = center && String(center).trim() !== '' ? String(center).trim() : null;
      
      const existingQuiz = await db.collection('quizzes').findOne({
        course: courseTrimmed,
        courseType: courseTypeTrimmed || null,
        lesson: lessonTrimmed,
        ...duplicateCenterMongoFragment(centerTrimmed),
      });

      if (existingQuiz) {
        return res.status(400).json({
          error: '❌ A quiz with this course, course type, lesson, and center already exists',
        });
      }

      // Normalize quiz state (default to "Activated")
      let finalState = 'Activated';
      if (state === 'Activated' || state === 'Deactivated') {
        finalState = state;
      }

      const quizDoc = {
        lesson_name: lesson_name.trim(),
        course: courseTrimmed,
        courseType: courseTypeTrimmed || null,
        center: centerTrimmed,
        lesson: lessonTrimmed,
        quiz_type: effectiveQuizType,
        deadline_type: deadline_type || 'no_deadline',
        deadline_date: deadline_type === 'with_deadline' ? deadline_date : null,
        timer: effectiveQuizType === 'questions' ? (timer || null) : null,
        shuffle_questions_and_answers: effectiveQuizType === 'questions' ? (shuffle_questions_and_answers === true || shuffle_questions_and_answers === 'true') : false,
        show_details_after_submitting: effectiveQuizType === 'questions' ? (show_details_after_submitting === true || show_details_after_submitting === 'true') : false,
        date: new Date(),
        comment: comment && comment.trim() !== '' ? comment.trim() : null,
        state: finalState,
      };

      if (effectiveQuizType === 'pdf') {
        quizDoc.pdf_file_name = pdf_file_name.trim();
        quizDoc.pdf_url = pdf_url.trim();
      } else {
        quizDoc.questions = questions.map(q => ({
          question_text: q.question_text || '',
          ...normalizeQuestionPictures(q),
          answers: q.answers,
          answer_texts: q.answer_texts || [],
          correct_answer: q.correct_answer,
          question_explanation: q.question_explanation || ''
        }));
        quizDoc.questions_count = questions.length;
        quizDoc.questions_with_images = questions.filter(q => q.question_picture).length;
      }

      const result = await db.collection('quizzes').insertOne(quizDoc);
      
      return res.status(201).json({ 
        success: true, 
        message: 'Quiz created successfully',
        quiz: { ...quizDoc, _id: result.insertedId }
      });
    }

    if (req.method === 'PUT') {
      const { id } = req.query;
      const { lesson_name, timer, questions, lesson, course, courseType, center, quiz_type, deadline_type, deadline_date, shuffle_questions_and_answers, show_details_after_submitting, comment, pdf_file_name, pdf_url, state } = req.body;

      const effectiveQuizType = quiz_type || 'questions';

      if (!id) {
        return res.status(400).json({ error: '❌ Quiz ID is required' });
      }

      if (!course || course.trim() === '') {
        return res.status(400).json({ error: '❌ Course is required' });
      }

      if (!lesson || lesson.trim() === '') {
        return res.status(400).json({ error: '❌ Lesson is required' });
      }

      if (!lesson_name || lesson_name.trim() === '') {
        return res.status(400).json({ error: '❌ Lesson name is required' });
      }

      if (effectiveQuizType === 'pdf') {
        if (!pdf_file_name || pdf_file_name.trim() === '') {
          return res.status(400).json({ error: '❌ PDF file name is required' });
        }
        if (!pdf_url || pdf_url.trim() === '') {
          return res.status(400).json({ error: '❌ PDF file is required' });
        }
      } else {
        if (!Array.isArray(questions) || questions.length === 0) {
          return res.status(400).json({ error: '❌ At least one question is required' });
        }
      }

      // Validate deadline if with deadline
      if (deadline_type === 'with_deadline') {
        if (!deadline_date) {
          return res.status(400).json({ error: '❌ Deadline date is required' });
        }
        const selectedDate = new Date(deadline_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate <= today) {
          return res.status(400).json({ error: '❌ Deadline date must be in the future' });
        }
      }

      if (effectiveQuizType === 'questions') {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const hasQuestionText = q.question_text && q.question_text.trim() !== '';
          const hasQuestionImage = getQuestionPicturesFromPayload(q).length > 0;
          if (!hasQuestionText && !hasQuestionImage) {
            return res.status(400).json({ error: `❌ Question ${i + 1}: Question must have at least question text or image (or both)` });
          }
          if (!Array.isArray(q.answers) || q.answers.length < 2) {
            return res.status(400).json({ error: `❌ Question ${i + 1}: At least 2 answers (A and B) are required` });
          }
          for (let j = 0; j < q.answers.length; j++) {
            const expectedLetter = String.fromCharCode(65 + j);
            if (q.answers[j] !== expectedLetter) {
              return res.status(400).json({ error: `❌ Question ${i + 1}: Answers must be letters A, B, C, D, etc. in order` });
            }
          }
          if (!q.correct_answer) {
            return res.status(400).json({ error: `❌ Question ${i + 1}: Correct answer is required` });
          }
          const correctAnswerLetter = Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer;
          const correctLetterUpper = correctAnswerLetter.toUpperCase();
          if (!q.answers.includes(correctLetterUpper)) {
            return res.status(400).json({ error: `❌ Question ${i + 1}: Correct answer must be one of the provided answers` });
          }
          if (q.answer_texts && Array.isArray(q.answer_texts) && q.answer_texts.length !== q.answers.length) {
            return res.status(400).json({ error: `❌ Question ${i + 1}: Answer texts array must match answers array length` });
          }
        }
      }

      // Validate course, courseType, and lesson combination uniqueness (excluding current quiz)
      const courseTrimmed = course.trim();
      const courseTypeTrimmed = courseType ? courseType.trim() : '';
      const lessonTrimmed = lesson.trim();
      const centerTrimmed = center && String(center).trim() !== '' ? String(center).trim() : null;
      
      const existingQuiz = await db.collection('quizzes').findOne({
        course: courseTrimmed,
        courseType: courseTypeTrimmed || null,
        lesson: lessonTrimmed,
        ...duplicateCenterMongoFragment(centerTrimmed),
        _id: { $ne: new ObjectId(id) }, // Exclude current quiz
      });
      if (existingQuiz) {
        return res.status(400).json({
          error: `❌ A quiz with this course, course type, lesson, and center already exists.`,
        });
      }

      // Normalize quiz state if provided
      let finalState = null;
      if (state === 'Activated' || state === 'Deactivated') {
        finalState = state;
      }

      const updateData = {
        course: courseTrimmed,
        courseType: courseTypeTrimmed || null,
        center: centerTrimmed,
        lesson: lessonTrimmed,
        lesson_name: lesson_name.trim(),
        quiz_type: effectiveQuizType,
        deadline_type: deadline_type || 'no_deadline',
        deadline_date: deadline_type === 'with_deadline' ? deadline_date : null,
        timer: effectiveQuizType === 'questions' ? (timer === null || timer === undefined ? null : parseInt(timer)) : null,
        shuffle_questions_and_answers: effectiveQuizType === 'questions' ? (shuffle_questions_and_answers === true || shuffle_questions_and_answers === 'true') : false,
        show_details_after_submitting: effectiveQuizType === 'questions' ? (show_details_after_submitting === true || show_details_after_submitting === 'true') : false,
        comment: comment && comment.trim() !== '' ? comment.trim() : null,
      };

      if (finalState) {
        updateData.state = finalState;
      }

      let unsetFields = {};

      if (effectiveQuizType === 'pdf') {
        updateData.pdf_file_name = pdf_file_name.trim();
        updateData.pdf_url = pdf_url.trim();
        unsetFields = { questions: '', questions_count: '', questions_with_images: '', book_name: '', from_page: '', to_page: '' };
      } else {
        updateData.questions = questions.map(q => ({
          question_text: q.question_text || '',
          ...normalizeQuestionPictures(q),
          answers: q.answers,
          answer_texts: q.answer_texts || [],
          correct_answer: (() => {
            const hasText = q.answer_texts && q.answer_texts.length > 0 && q.answer_texts.some(text => text && text.trim() !== '');
            const correctAnswerLetter = Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer;
            const correctAnswerLetterLower = correctAnswerLetter.toLowerCase();
            const correctAnswerIdx = q.answers.indexOf(correctAnswerLetterLower.toUpperCase());
            const correctAnswerText = (correctAnswerIdx !== -1 && q.answer_texts && q.answer_texts[correctAnswerIdx]) 
              ? q.answer_texts[correctAnswerIdx] 
              : null;
            return hasText && correctAnswerText 
              ? [correctAnswerLetterLower, correctAnswerText]
              : correctAnswerLetterLower;
          })(),
          question_explanation: q.question_explanation || ''
        }));
        updateData.questions_count = questions.length;
        updateData.questions_with_images = questions.filter(q => q.question_picture).length;
        unsetFields = { pdf_file_name: '', pdf_url: '', book_name: '', from_page: '', to_page: '' };
      }

      const updateQuery = { 
        $set: updateData,
        ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {})
      };

      // Also remove old account_state field if present (we now use "state")
      const existing = await db.collection('quizzes').findOne({ _id: new ObjectId(id) });
      if (existing && existing.account_state !== undefined) {
        updateQuery.$unset = { ...(updateQuery.$unset || {}), account_state: '' };
      }

      const result = await db.collection('quizzes').updateOne(
        { _id: new ObjectId(id) },
        updateQuery
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: '❌ Quiz not found' });
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Quiz updated successfully' 
      });
    }

    if (req.method === 'DELETE') {
      // Delete quiz
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: '❌ Quiz ID is required' });
      }

      const result = await db.collection('quizzes').deleteOne(
        { _id: new ObjectId(id) }
      );

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: '❌ Quiz not found' });
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Quiz deleted successfully' 
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Quizzes API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}

