import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import Title from '../../../../components/Title';
import MockExamSelect from '../../../../components/MockExamSelect';
import CourseSelect from '../../../../components/CourseSelect';
import CourseTypeSelect from '../../../../components/CourseTypeSelect';
import CenterSelect from '../../../../components/CenterSelect';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../../lib/axios';
import Image from 'next/image';
import ZoomableImage from '../../../../components/ZoomableImage';
import AccountStateSelect from '../../../../components/AccountStateSelect';
import ImportExistingOnlineItemModal from '../../../../components/ImportExistingOnlineItemModal';
import { formatMockExamPickerLabel } from '../../../../lib/importOnlineItemLabels';
import { buildMockExamImportFormState } from '../../../../lib/importOnlineFormState';
import { fetchImportedQuestionImageUrls } from '../../../../lib/fetchImportedQuestionImageUrls';
import { centersMatchDuplicateClient } from '../../../../lib/onlineItemDuplicate';


export default function EditMockExam() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = router.query;
  const [formData, setFormData] = useState({
    lesson_name: '',
    comment: '',
    deadline_type: 'no_deadline',
    deadline_date: '',
    mock_exam_type: 'questions',
    timer_type: 'no_timer',
    timer: null,
    shuffle_questions_and_answers: false,
    show_details_after_submitting: false,
    pdf_file_name: '',
    pdf_url: '',
    questions: [{
      question_text: '',
      question_picture: null,
      answers: ['A', 'B'],
      answer_texts: ['', ''],
      correct_answer: '',
      question_explanation: ''
    }] || []
  });
  const [activeTab, setActiveTab] = useState('questions');
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfUploadProgress, setPdfUploadProgress] = useState(0);
  const [pdfUploadError, setPdfUploadError] = useState('');
  const pdfFileInputRef = useRef(null);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
  const [selectedCourseType, setSelectedCourseType] = useState('');
  const [courseTypeDropdownOpen, setCourseTypeDropdownOpen] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState('');
  const [centerDropdownOpen, setCenterDropdownOpen] = useState(false);
  const [selectedMockExam, setSelectedMockExam] = useState('');
  const [errors, setErrors] = useState({});
  const [uploadingImages, setUploadingImages] = useState({});
  const [imagePreviews, setImagePreviews] = useState({});
  const [imageUrls, setImageUrls] = useState({});
  const [loadingImages, setLoadingImages] = useState({});
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const errorTimeoutRef = useRef(null);
  const [accountState, setAccountState] = useState('Activated');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importSelectedId, setImportSelectedId] = useState('');
  const [importApplyLoading, setImportApplyLoading] = useState(false);

  // Auto-hide errors after 6 seconds
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      // Clear any existing timeout
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      // Set new timeout to clear errors after 6 seconds
      errorTimeoutRef.current = setTimeout(() => {
        setErrors({});
      }, 6000);
    }
    // Cleanup on unmount
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, [errors]);

  // Fetch mock exam data
  const { data: mockExamData, isLoading, error: mockExamError } = useQuery({
    queryKey: ['mock-exam', id],
    queryFn: async () => {
      const response = await apiClient.get('/api/online_mock_exams');
      const mockExam = response.data.mockExams.find(me => me._id === id);
      if (!mockExam) throw new Error('Mock exam not found');
      return mockExam;
    },
    enabled: !!id,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  // Fetch all mock exams for duplicate validation
  const { data: mockExamsData } = useQuery({
    queryKey: ['online_mock_exams'],
    queryFn: async () => {
      const response = await apiClient.get('/api/online_mock_exams');
      return response.data;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const mockExams = mockExamsData?.mockExams || [];

  const importMockExamOptions = useMemo(
    () =>
      mockExams
        .filter((me) => id && String(me._id) !== String(id))
        .map((m) => ({
          value: String(m._id),
          label: formatMockExamPickerLabel(m),
        })),
    [mockExams, id]
  );

  const handleImportApply = async () => {
    if (!importSelectedId) return;
    const me = mockExams.find((m) => String(m._id) === importSelectedId);
    if (!me) return;
    const built = buildMockExamImportFormState(me);
    if (!built) return;
    setImportApplyLoading(true);
    try {
      setFormData(built.formData);
      setSelectedCourse(built.selectedCourse);
      setSelectedCourseType(built.selectedCourseType);
      setSelectedCenter(built.selectedCenter);
      setSelectedMockExam(built.selectedMockExam);
      setAccountState(built.accountState);
      setActiveTab(built.activeTab);
      setErrors({});
      setImagePreviews({});
      setImageUrls({});
      if (built.formData.mock_exam_type === 'questions' && built.formData.questions?.length) {
        const urls = await fetchImportedQuestionImageUrls(
          built.formData.questions,
          'online_mock_exams',
          apiClient
        );
        setImageUrls(urls);
      }
      setImportModalOpen(false);
      setImportSelectedId('');
    } finally {
      setImportApplyLoading(false);
    }
  };

  // Redirect if mock exam not found
  useEffect(() => {
    if (id && !isLoading) {
      if (mockExamError || (mockExamsData && !mockExamsData.mockExams.find(me => me._id === id))) {
        router.push('/dashboard/manage_online_system/online_mock_exams');
      }
    }
  }, [id, mockExamError, isLoading, mockExamsData, router]);

  // Load mock exam data into form (only once when mockExamData first loads)
  const [dataLoaded, setDataLoaded] = useState(false);
  const dataLoadedRef = useRef(false); // Use ref to prevent reset on re-renders
  
  useEffect(() => {
    if (mockExamData && !dataLoaded && !dataLoadedRef.current) {
      setSelectedCourse(mockExamData.course || '');
      setSelectedCourseType(mockExamData.courseType || '');
      setSelectedCenter(mockExamData.center || '');
      setSelectedMockExam(mockExamData.lesson || '');
      
      const meType = mockExamData.mock_exam_type || 'questions';
      setActiveTab(meType);

      setFormData({
        lesson_name: mockExamData.lesson_name || '',
        comment: mockExamData.comment || '',
        deadline_type: mockExamData.deadline_type || (mockExamData.deadline_date ? 'with_deadline' : 'no_deadline'),
        deadline_date: mockExamData.deadline_date || '',
        mock_exam_type: meType,
        timer_type: mockExamData.timer === null || mockExamData.timer === undefined ? 'no_timer' : 'with_timer',
        timer: mockExamData.timer || null,
        shuffle_questions_and_answers: mockExamData.shuffle_questions_and_answers === true || mockExamData.shuffle_questions_and_answers === 'true' ? true : false,
        show_details_after_submitting: mockExamData.show_details_after_submitting === true || mockExamData.show_details_after_submitting === 'true' ? true : false,
        pdf_file_name: mockExamData.pdf_file_name || '',
        pdf_url: mockExamData.pdf_url || '',
        questions: meType === 'questions' && mockExamData.questions && Array.isArray(mockExamData.questions)
          ? mockExamData.questions.map(q => ({
              question_text: q.question_text || '',
              question_picture: q.question_picture || null,
              ...Object.keys(q)
                .filter((key) => /^question_picture_\d+$/.test(key))
                .reduce((acc, key) => ({ ...acc, [key]: q[key] || null }), {}),
              answers: q.answers && q.answers.length > 0 ? q.answers : ['A', 'B'],
              answer_texts: q.answer_texts && q.answer_texts.length > 0 ? q.answer_texts : (q.answers ? q.answers.map(() => '') : ['', '']),
              correct_answer: q.correct_answer || '',
              question_explanation: q.question_explanation || ''
            }))
          : [{
              question_text: '',
              question_picture: null,
              answers: ['A', 'B'],
              answer_texts: ['', ''],
              correct_answer: '',
              question_explanation: ''
            }]
      });
      setDataLoaded(true);
      dataLoadedRef.current = true; // Mark as loaded in ref

      // Load state from new 'state' field, fallback to old 'account_state' for backwards compatibility
      setAccountState(mockExamData.state || mockExamData.account_state || 'Activated');

      // Load image URLs for existing images
      const loadImageUrls = async () => {
        const urlPromises = mockExamData.questions?.flatMap((q, idx) => {
          const pictures = [];
          pictures[0] = q?.question_picture || null;
          Object.keys(q || {})
            .filter((key) => /^question_picture_\d+$/.test(key))
            .sort((a, b) => Number(a.split('_').pop()) - Number(b.split('_').pop()))
            .forEach((key) => {
              const pictureIndex = Number(key.split('_').pop()) - 1;
              if (pictureIndex >= 1) pictures[pictureIndex] = q[key] || null;
            });

          return pictures.map((publicId, imageIdx) => ({ publicId, imageKey: `${idx}_${imageIdx}` }));
        }).filter((item) => !!item.publicId).map(async ({ publicId, imageKey }) => {
          setLoadingImages(prev => ({ ...prev, [imageKey]: true }));
          try {
            const response = await apiClient.get(`/api/online_mock_exams/image?public_id=${publicId}`);
            if (response.data?.url) {
              setImageUrls(prev => ({ ...prev, [imageKey]: response.data.url }));
            }
          } catch (err) {
            console.error(`Failed to load image ${imageKey}:`, err);
          } finally {
            setLoadingImages(prev => {
              const newLoading = { ...prev };
              delete newLoading[imageKey];
              return newLoading;
            });
          }
        }) || [];
        await Promise.all(urlPromises);
      };
      loadImageUrls();
    }
  }, [mockExamData, dataLoaded]);

  const updateMockExamMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.put(`/api/online_mock_exams?id=${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['online_mock_exams']);
      queryClient.invalidateQueries(['mock-exam', id]);
      router.push('/dashboard/manage_online_system/online_mock_exams');
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.error || 'Failed to update mock exam';
      setErrors({ general: errorMsg.startsWith('❌') ? errorMsg : `❌ ${errorMsg}` });
    },
  });

  const getQuestionPictures = (question) => {
    if (!question || typeof question !== 'object') return [null];
    const pictures = [];
    pictures[0] = question.question_picture || null;
    Object.keys(question)
      .filter((key) => /^question_picture_\d+$/.test(key))
      .sort((a, b) => Number(a.split('_').pop()) - Number(b.split('_').pop()))
      .forEach((key) => {
        const idx = Number(key.split('_').pop()) - 1;
        if (idx >= 1) pictures[idx] = question[key] || null;
      });
    return pictures.length ? pictures.map((pic) => pic || null) : [null];
  };

  const buildQuestionPicturesPayload = (pictures) => {
    const payload = { question_picture: pictures[0] || null };
    for (let i = 1; i < pictures.length; i++) payload[`question_picture_${i + 1}`] = pictures[i] || null;
    return payload;
  };

  const updateQuestionPictures = (questionIndex, pictures) => {
    setFormData((prev) => {
      const newQuestions = [...prev.questions];
      const currentQuestion = { ...newQuestions[questionIndex] };
      Object.keys(currentQuestion).forEach((key) => { if (/^question_picture_\d+$/.test(key)) delete currentQuestion[key]; });
      newQuestions[questionIndex] = { ...currentQuestion, ...buildQuestionPicturesPayload(pictures) };
      return { ...prev, questions: newQuestions };
    });
  };

  /** After removing a middle/extra slot, shift UI state keys so slot N matches image N (lastIndexOf parses qIdx 10+). */
  const reindexQuestionImageSlotKeys = (prev, questionIndex, removedImageIndex) => {
    const next = {};
    for (const [key, val] of Object.entries(prev)) {
      const lastUs = key.lastIndexOf('_');
      if (lastUs <= 0) {
        next[key] = val;
        continue;
      }
      const q = Number(key.slice(0, lastUs));
      const idx = Number(key.slice(lastUs + 1));
      if (Number.isNaN(q) || Number.isNaN(idx)) {
        next[key] = val;
        continue;
      }
      if (q !== questionIndex) {
        next[key] = val;
        continue;
      }
      if (idx === removedImageIndex) continue;
      if (idx > removedImageIndex) {
        next[`${questionIndex}_${idx - 1}`] = val;
      } else {
        next[key] = val;
      }
    }
    return next;
  };

  const reindexQuestionImageErrors = (prev, questionIndex, removedImageIndex) => {
    const next = { ...prev };
    delete next[`question_${questionIndex}_image_${removedImageIndex}`];
    const errPrefix = `question_${questionIndex}_image_`;
    const movers = Object.keys(next)
      .filter((k) => k.startsWith(errPrefix))
      .map((k) => {
        const idx = Number(k.slice(errPrefix.length));
        return { k, idx };
      })
      .filter(({ idx }) => !Number.isNaN(idx) && idx > removedImageIndex)
      .sort((a, b) => a.idx - b.idx);
    for (const { k, idx } of movers) {
      const v = next[k];
      delete next[k];
      next[`question_${questionIndex}_image_${idx - 1}`] = v;
    }
    return next;
  };

  const reindexDragOverForQuestion = (dragOverIndex, questionIndex, removedImageIndex) => {
    if (dragOverIndex == null || dragOverIndex === '') return dragOverIndex;
    const key = String(dragOverIndex);
    const lastUs = key.lastIndexOf('_');
    if (lastUs <= 0) return dragOverIndex;
    const q = Number(key.slice(0, lastUs));
    const idx = Number(key.slice(lastUs + 1));
    if (Number.isNaN(q) || Number.isNaN(idx) || q !== questionIndex) return dragOverIndex;
    if (idx === removedImageIndex) return null;
    if (idx > removedImageIndex) return `${questionIndex}_${idx - 1}`;
    return dragOverIndex;
  };

  // Handle image upload
  const handleImageUpload = async (questionIndex, imageIndex, file) => {
    if (!file) return;
    const imageKey = `${questionIndex}_${imageIndex}`;

    // Allowed image MIME types
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'];
    
    // Validate file type
    if (!file.type || !ALLOWED_MIME_TYPES.includes(file.type)) {
      setErrors(prev => ({ ...prev, [`question_${questionIndex}_image_${imageIndex}`]: '❌ Invalid file type. Only image formats (JPEG/JPG, PNG, GIF, SVG, WEBP, ICO) are allowed.' }));
      return;
    }

    // Validate file size (10 MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_FILE_SIZE) {
      setErrors(prev => ({ ...prev, [`question_${questionIndex}_image_${imageIndex}`]: '❌ Sorry, Max image size is 10 MB, Please try another picture' }));
      // Clear preview if exists
      setImagePreviews(prev => {
        const newPreviews = { ...prev };
        delete newPreviews[imageKey];
        return newPreviews;
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreviews(prev => ({ ...prev, [imageKey]: reader.result }));
    };
    reader.readAsDataURL(file);

    // Upload to Cloudinary
    setUploadingImages(prev => ({ ...prev, [imageKey]: true }));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`question_${questionIndex}_image_${imageIndex}`];
      return newErrors;
    });
    
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await apiClient.post('/api/upload/quiz-question-image', {
        file: base64,
        fileName: file.name,
        fileType: file.type,
        folder: 'mock-exams-questions-images'
      });

      if (response.data.success && response.data.public_id) {
        const newPublicId = response.data.public_id;
        const currentPictures = getQuestionPictures(formData.questions[questionIndex]);
        const nextPictures = [...currentPictures];
        nextPictures[imageIndex] = newPublicId;
        updateQuestionPictures(questionIndex, nextPictures);
        // Fetch signed URL for the newly uploaded image
        try {
          const urlResponse = await apiClient.get(`/api/online_mock_exams/image?public_id=${newPublicId}`);
          if (urlResponse.data?.url) {
            setImageUrls(prev => ({ ...prev, [imageKey]: urlResponse.data.url }));
          }
        } catch (urlErr) {
          console.error('Failed to fetch signed URL for new image:', urlErr);
          // Keep the preview for now
        }
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      let errorMessage = '❌ Failed to upload image. Please try again.';
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
        if (!errorMessage.startsWith('❌')) {
          errorMessage = `❌ ${errorMessage}`;
        }
        // Check if it's a size error
        if (errorMessage.toLowerCase().includes('max image size') || errorMessage.toLowerCase().includes('size is 10 mb') || errorMessage.toLowerCase().includes('too large')) {
          errorMessage = '❌ Sorry, Max image size is 10 MB, Please try another picture';
        }
      } else if (err.response?.status === 413 || err.message?.includes('413') || err.message?.includes('PayloadTooLargeError')) {
        errorMessage = '❌ Sorry, Max image size is 10 MB, Please try another picture';
      } else if (err.message?.includes('ERR_CONNECTION_RESET') || err.message?.includes('Network Error') || err.code === 'ECONNRESET') {
        errorMessage = '❌ Connection error. The image may be too large. Please try a smaller image (max 10 MB).';
      } else if (err.message) {
        errorMessage = `❌ ${err.message}`;
      }
      
      setErrors(prev => ({ ...prev, [`question_${questionIndex}_image_${imageIndex}`]: errorMessage }));
      setImagePreviews(prev => {
        const newPreviews = { ...prev };
        delete newPreviews[imageKey];
        return newPreviews;
      });
    } finally {
      setUploadingImages(prev => {
        const newLoading = { ...prev };
        delete newLoading[imageKey];
        return newLoading;
      });
    }
  };

  const addImageContainer = (questionIndex) => {
    const currentPictures = getQuestionPictures(formData.questions[questionIndex]);
    updateQuestionPictures(questionIndex, [...currentPictures, null]);
  };

  // Handle remove image
  const handleRemoveImage = (questionIndex, imageIndex) => {
    const currentPictures = getQuestionPictures(formData.questions[questionIndex]);
    const nextPictures = [...currentPictures];
    nextPictures[imageIndex] = null;
    updateQuestionPictures(questionIndex, nextPictures);
    const imageKey = `${questionIndex}_${imageIndex}`;
    setImagePreviews(prev => {
      const newPreviews = { ...prev };
      delete newPreviews[imageKey];
      return newPreviews;
    });
    setImageUrls(prev => {
      const newUrls = { ...prev };
      delete newUrls[imageKey];
      return newUrls;
    });
  };

  const removeImageContainer = (questionIndex, imageIndex) => {
    const currentPictures = getQuestionPictures(formData.questions[questionIndex]);
    if (imageIndex === 0 || currentPictures.length <= 1) return;
    const nextPictures = currentPictures.filter((_, idx) => idx !== imageIndex);
    updateQuestionPictures(questionIndex, nextPictures);
    setImagePreviews((prev) => reindexQuestionImageSlotKeys(prev, questionIndex, imageIndex));
    setImageUrls((prev) => reindexQuestionImageSlotKeys(prev, questionIndex, imageIndex));
    setUploadingImages((prev) => reindexQuestionImageSlotKeys(prev, questionIndex, imageIndex));
    setLoadingImages((prev) => reindexQuestionImageSlotKeys(prev, questionIndex, imageIndex));
    setErrors((prev) => reindexQuestionImageErrors(prev, questionIndex, imageIndex));
    setDragOverIndex((d) => reindexDragOverForQuestion(d, questionIndex, imageIndex));
  };

  // Drag and drop handlers
  const handleDragOver = (e, questionIndex, imageIndex) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(`${questionIndex}_${imageIndex}`);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
  };

  const handleDrop = (e, questionIndex, imageIndex) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleImageUpload(questionIndex, imageIndex, file);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
  };

  const handleTimerTypeChange = (e) => {
    const timerType = e.target.value;
    setFormData(prev => ({
      ...prev,
      timer_type: timerType,
      timer: timerType === 'no_timer' ? null : prev.timer
    }));
  };

  const handleQuestionChange = (questionIndex, field, value) => {
    setFormData(prev => {
      const newQuestions = [...prev.questions];
      const currentQuestion = newQuestions[questionIndex];
      
      // If answer_texts are being updated, sync correct_answer
      if (field === 'answer_texts') {
        const newAnswerTexts = value;
        const currentCorrectAnswer = currentQuestion.correct_answer;
        
        // If correct_answer is an array [letter, text], update the text part
        if (Array.isArray(currentCorrectAnswer)) {
          const correctLetter = currentCorrectAnswer[0];
          const correctLetterIdx = currentQuestion.answers.indexOf(correctLetter.toUpperCase());
          if (correctLetterIdx !== -1 && newAnswerTexts[correctLetterIdx] !== undefined) {
            // Update the text part of correct_answer
            currentQuestion.correct_answer = [correctLetter, newAnswerTexts[correctLetterIdx]];
          }
        } else if (currentCorrectAnswer) {
          // If correct_answer is a string, check if we should convert to array format
          const correctLetterIdx = currentQuestion.answers.indexOf(currentCorrectAnswer.toUpperCase());
          if (correctLetterIdx !== -1 && newAnswerTexts[correctLetterIdx] && newAnswerTexts[correctLetterIdx].trim() !== '') {
            // Convert to array format if text exists
            currentQuestion.correct_answer = [currentCorrectAnswer.toLowerCase(), newAnswerTexts[correctLetterIdx]];
          }
        }
      }
      
      // If correct_answer is being set, format it properly based on answer_texts
      if (field === 'correct_answer') {
        const answerTexts = currentQuestion.answer_texts || [];
        const rawLetter = Array.isArray(value) ? value[0] : value;
        const answerLetter = (typeof rawLetter === 'string' ? rawLetter : String(rawLetter || '')).toLowerCase();
        const answerLetterIdx = currentQuestion.answers.indexOf(answerLetter.toUpperCase());
        
        if (answerLetterIdx !== -1 && answerTexts[answerLetterIdx] && answerTexts[answerLetterIdx].trim() !== '') {
          // Store as [letter, text] if text exists
          currentQuestion.correct_answer = [answerLetter, answerTexts[answerLetterIdx]];
        } else {
          // Store as just letter if no text
          currentQuestion.correct_answer = answerLetter;
        }
      }
      
      newQuestions[questionIndex] = {
        ...currentQuestion,
        [field]: value
      };
      return { ...prev, questions: newQuestions };
    });
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`question_${questionIndex}_${field}`];
      return newErrors;
    });
  };

  // Removed handleAnswerChange - answers are now just letters, managed by addAnswer/removeAnswer

  const addAnswer = (questionIndex) => {
    setFormData(prev => {
      const newQuestions = [...prev.questions];
      const currentAnswers = newQuestions[questionIndex].answers;
      const currentAnswerTexts = newQuestions[questionIndex].answer_texts || [];
      const nextLetter = String.fromCharCode(65 + currentAnswers.length); // A=65, B=66, C=67, etc.
      newQuestions[questionIndex] = {
        ...newQuestions[questionIndex],
        answers: [...currentAnswers, nextLetter],
        answer_texts: [...currentAnswerTexts, '']
      };
      return { ...prev, questions: newQuestions };
    });
  };

  const removeAnswer = (questionIndex, answerIndex) => {
    if (answerIndex < 2) return; // Can't remove A or B
    
    setFormData(prev => {
      const newQuestions = [...prev.questions];
      const currentAnswers = newQuestions[questionIndex].answers;
      const currentAnswerTexts = newQuestions[questionIndex].answer_texts || [];
      const removedLetter = currentAnswers[answerIndex];
      const correctAnswer = newQuestions[questionIndex].correct_answer;
      
      // Remove the answer at the specified index
      const newAnswers = currentAnswers.filter((_, idx) => idx !== answerIndex);
      const newAnswerTexts = currentAnswerTexts.filter((_, idx) => idx !== answerIndex);
      
      // Reorder answers to be sequential (A, B, C, D, ...)
      const reorderedAnswers = newAnswers.map((_, idx) => String.fromCharCode(65 + idx));
      
      // Update correct_answer if the removed answer was the correct one
      let newCorrectAnswer = correctAnswer;
      if (correctAnswer === removedLetter.toLowerCase()) {
        newCorrectAnswer = '';
      } else if (correctAnswer) {
        // Find the new position of the correct answer after reordering
        const correctLetterUpper = correctAnswer.toUpperCase();
        const oldIndex = currentAnswers.indexOf(correctLetterUpper);
        if (oldIndex > answerIndex) {
          // The correct answer was after the removed one, so it moves up by 1
          const newLetter = String.fromCharCode(65 + oldIndex - 1).toLowerCase();
          newCorrectAnswer = newLetter;
        }
        // If oldIndex < answerIndex, the correct answer stays the same letter
      }
      
      newQuestions[questionIndex] = {
        ...newQuestions[questionIndex],
        answers: reorderedAnswers,
        answer_texts: newAnswerTexts,
        correct_answer: newCorrectAnswer
      };
      return { ...prev, questions: newQuestions };
    });
  };

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, {
        question_text: '',
        question_picture: null,
        answers: ['A', 'B'],
        answer_texts: ['', ''],
        correct_answer: '',
        question_explanation: ''
      }]
    }));
  };

  const removeQuestion = (questionIndex) => {
    if (!formData.questions || formData.questions.length === 1) {
      setErrors({ general: '❌ At least one question is required' });
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, idx) => idx !== questionIndex)
    }));
    setImagePreviews(prev => {
      const newPreviews = { ...prev };
      delete newPreviews[questionIndex];
      return newPreviews;
    });
    setImageUrls(prev => {
      const newUrls = { ...prev };
      delete newUrls[questionIndex];
      return newUrls;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    // Check if any images are still uploading
    const isUploading = Object.keys(uploadingImages).length > 0;
    if (isUploading) {
      setErrors({ general: '❌ Please wait for all images to finish uploading before saving' });
      return;
    }

    // Validate course
    if (!selectedCourse || selectedCourse.trim() === '') {
      newErrors.course = '❌ Course is required';
    }

    // Validate mock exam
    if (!selectedMockExam || selectedMockExam.trim() === '') {
      newErrors.mockExam = '❌ Mock Exam is required';
    }

    // Validate lesson name
    if (!formData.lesson_name || formData.lesson_name.trim() === '') {
      newErrors.lesson_name = '❌ Lesson name is required';
    }

    if (formData.mock_exam_type === 'pdf') {
      if (!formData.pdf_file_name || formData.pdf_file_name.trim() === '') {
        newErrors.pdf_file_name = '❌ PDF file name is required';
      }
      if (!formData.pdf_url || formData.pdf_url.trim() === '') {
        newErrors.pdf_url = '❌ PDF file is required';
      }
    } else {
      if (formData.timer_type === 'with_timer') {
        if (!formData.timer || parseInt(formData.timer) < 1) {
          newErrors.timer = '❌ Timer must be at least 1 minute';
        }
      }
      if (!formData.questions || !Array.isArray(formData.questions) || formData.questions.length === 0) {
        newErrors.questions = '❌ At least one question is required';
      } else {
        formData.questions.forEach((q, qIdx) => {
          const hasQuestionText = q.question_text && q.question_text.trim() !== '';
          const hasQuestionImage = getQuestionPictures(q).some((pic) => !!pic);
          if (!hasQuestionText && !hasQuestionImage) {
            newErrors[`question_${qIdx}_text_or_image`] = '❌ Question must have at least question text or image (or both)';
          }
          if (!q.answers || q.answers.length < 2) {
            newErrors[`question_${qIdx}_answers`] = '❌ At least 2 answers (A and B) are required';
          }
          if (!q.correct_answer) {
            newErrors[`question_${qIdx}_correct`] = '❌ Please select the correct answer';
          }
        });
      }
    }

    // Validate deadline date if with deadline is selected
    if (formData.deadline_type === 'with_deadline') {
      if (!formData.deadline_date) {
        newErrors.deadline_date = '❌ Deadline date is required';
      } else {
        const selectedDate = new Date(formData.deadline_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate <= today) {
          newErrors.deadline_date = '❌ Deadline date must be in the future';
        }
      }
    }
    
    // Validate shuffle_questions_and_answers is required
    if (formData.shuffle_questions_and_answers === undefined || formData.shuffle_questions_and_answers === null) {
      newErrors.shuffle_questions_and_answers = '❌ Shuffle Questions and Answers is required';
    }

    // Validate show_details_after_submitting is required
    if (formData.show_details_after_submitting === undefined || formData.show_details_after_submitting === null) {
      newErrors.show_details_after_submitting = '❌ Show details after submitting is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Check for duplicate course, courseType, lesson, and center (exclude current mock exam)
    const courseTrimmed = selectedCourse.trim();
    const courseTypeTrimmed = selectedCourseType ? selectedCourseType.trim() : '';
    const mockExamTrimmed = selectedMockExam.trim();
    
    const duplicateMockExam = mockExams.find(
      mockExam => {
        if (mockExam._id === id) return false;
        const meCourse = (mockExam.course || '').trim();
        const meCourseType = (mockExam.courseType || '').trim();
        const meLesson = (mockExam.lesson || '').trim();
        return meCourse === courseTrimmed && 
               (meCourseType || '') === courseTypeTrimmed && 
               meLesson === mockExamTrimmed &&
               centersMatchDuplicateClient(selectedCenter, mockExam.center);
      }
    );
    if (duplicateMockExam) {
      newErrors.general = '❌ A mock exam with this course, course type, lesson, and center already exists';
      setErrors(newErrors);
      
      // Clear error after 6 seconds
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = setTimeout(() => {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.general;
          return newErrors;
        });
      }, 6000);
      return;
    }

    // Prepare data for API
    const submitData = {
      lesson_name: formData.lesson_name.trim(),
      comment: formData.comment ? formData.comment.trim() : '',
      course: courseTrimmed,
      courseType: courseTypeTrimmed || null,
      center: selectedCenter.trim() || null,
      lesson: mockExamTrimmed,
      mock_exam_type: formData.mock_exam_type || 'questions',
      deadline_type: formData.deadline_type,
      deadline_date: formData.deadline_type === 'with_deadline' ? formData.deadline_date : null,
      timer: formData.mock_exam_type === 'questions' && formData.timer_type === 'with_timer' ? parseInt(formData.timer) : null,
      shuffle_questions_and_answers: formData.mock_exam_type === 'questions' ? formData.shuffle_questions_and_answers : false,
      show_details_after_submitting: formData.mock_exam_type === 'questions' ? formData.show_details_after_submitting : false,
    };

    if (accountState) {
      // Send normalized state field to API
      submitData.state = accountState;
    }

    if (formData.mock_exam_type === 'pdf') {
      submitData.pdf_file_name = formData.pdf_file_name.trim();
      submitData.pdf_url = formData.pdf_url.trim();
    } else {
      submitData.questions = formData.questions && Array.isArray(formData.questions) ? formData.questions.map(q => ({
        question_text: q.question_text || '',
        ...buildQuestionPicturesPayload(getQuestionPictures(q)),
        answers: q.answers,
        answer_texts: q.answer_texts || [],
        correct_answer: q.correct_answer,
        question_explanation: q.question_explanation || ''
      })) : [];
    }

    console.log('Submitting mock exam data:', {
      lesson_name: submitData.lesson_name,
      timer: submitData.timer,
      questions_count: submitData.questions.length,
      questions_with_images: submitData.questions.filter(q => q.question_picture).length
    });

    updateMockExamMutation.mutate(submitData);
  };

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px"
      }}>
        <div style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
          <Title backText="Back" href="/dashboard/manage_online_system/online_mock_exams">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Image src="/edit.svg" alt="Edit" width={32} height={32} />
              Edit Online Mock Exam
            </div>
          </Title>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '40px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div style={{
              width: "50px",
              height: "50px",
              border: "4px solid rgba(31, 168, 220, 0.2)",
              borderTop: "4px solid #1FA8DC",
              borderRadius: "50%",
              margin: "0 auto 20px",
              animation: "spin 1s linear infinite"
            }} />
            <p style={{ color: "#6c757d", fontSize: "1rem" }}>Loading mock exam...</p>
            <style jsx>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      </div>
    );
  }

  if (!mockExamData) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px"
      }}>
        <div style={{ maxWidth: 800, margin: "40px auto", padding: "12px" }}>
          <Title backText="Back" href="/dashboard/manage_online_system/online_mock_exams">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Image src="/edit.svg" alt="Edit" width={32} height={32} />
              Edit Homework
            </div>
          </Title>
          <div style={{ textAlign: 'center', padding: '40px', color: '#dc3545' }}>❌ Homework not found</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div style={{ maxWidth: 800, margin: "40px auto", padding: "12px" }}>
        <Title backText="Back" href="/dashboard/manage_online_system/online_mock_exams">Edit Online Mock Exam</Title>

        <div className="form-container" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          <form onSubmit={handleSubmit}>
            <div
              style={{
                marginBottom: '24px',
                padding: '18px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                border: '1.5px solid #ddd6fe',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div style={{ fontWeight: 700, color: '#4c1d95', marginBottom: '8px', fontSize: '1rem', width: '100%' }}>
                Import from another mock exam
              </div>
              <p style={{ margin: '0 0 14px', fontSize: '0.88rem', color: '#5b21b6', lineHeight: 1.45, maxWidth: '520px' }}>
                Copy content from another mock exam into this editor. Save when you are ready.
              </p>
              <button
                type="button"
                onClick={() => {
                  setImportSelectedId('');
                  setImportModalOpen(true);
                }}
                style={{
                  padding: '12px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.35)',
                  width: '100%',
                  maxWidth: '320px',
                }}
              >
                Choose mock exam to import…
              </button>
            </div>

            {/* Mock Exam Course */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                Mock Exam Course <span style={{ color: 'red' }}>*</span>
              </label>
              <CourseSelect
                selectedGrade={selectedCourse}
                onGradeChange={(course) => {
                  setSelectedCourse(course);
                  if (errors.course) {
                    setErrors({ ...errors, course: '' });
                  }
                }}
                isOpen={courseDropdownOpen}
                onToggle={() => {
                  setCourseDropdownOpen(!courseDropdownOpen);
                  setCourseTypeDropdownOpen(false);
                  setCenterDropdownOpen(false);
                }}
                onClose={() => setCourseDropdownOpen(false)}
                showAllOption={true}
                required={true}
              />
              {errors.course && (
                <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                  {errors.course}
                </div>
              )}
            </div>

            {/* Mock Exam Course Type */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                Mock Exam Course Type
              </label>
              <CourseTypeSelect
                selectedCourseType={selectedCourseType}
                onCourseTypeChange={(courseType) => {
                  setSelectedCourseType(courseType);
                  if (errors.courseType) {
                    setErrors({ ...errors, courseType: '' });
                  }
                }}
                isOpen={courseTypeDropdownOpen}
                onToggle={() => {
                  setCourseTypeDropdownOpen(!courseTypeDropdownOpen);
                  setCourseDropdownOpen(false);
                  setCenterDropdownOpen(false);
                }}
                onClose={() => setCourseTypeDropdownOpen(false)}
              />
              {errors.courseType && (
                <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                  {errors.courseType}
                </div>
              )}
            </div>

            {/* Mock Exam Center (optional) */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                Mock Exam Center
              </label>
              <CenterSelect
                selectedCenter={selectedCenter}
                onCenterChange={setSelectedCenter}
                required={false}
                isOpen={centerDropdownOpen}
                onToggle={() => {
                  setCenterDropdownOpen(!centerDropdownOpen);
                  setCourseDropdownOpen(false);
                  setCourseTypeDropdownOpen(false);
                }}
                onClose={() => setCenterDropdownOpen(false)}
              />
            </div>

            {/* Mock Exam */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                Mock Exam <span style={{ color: 'red' }}>*</span>
              </label>
              <MockExamSelect
                selectedMockExam={selectedMockExam}
                onSelectMockExam={(exam) => {
                  setSelectedMockExam(exam);
                  if (errors.mockExam) {
                    setErrors({ ...errors, mockExam: '' });
                  }
                }}
                placeholder="Select Mock Exam"
              />
              {errors.mockExam && (
                <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                  {errors.mockExam}
                </div>
              )}
            </div>

            {/* Mock Exam State */}
            <AccountStateSelect
              value={accountState}
              onChange={setAccountState}
              label="Mock Exam State"
              placeholder="Select Mock Exam State"
            />

            {/* Lesson Name */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                Mock Exam Name <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                name="lesson_name"
                value={formData.lesson_name}
                onChange={handleInputChange}
                placeholder="Enter Mock Exam Name"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: errors.lesson_name ? '2px solid #dc3545' : '2px solid #e9ecef',
                  borderRadius: '10px',
                  fontSize: '1rem'
                }}
              />
              {errors.lesson_name && (
                <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                  {errors.lesson_name}
                </div>
              )}
            </div>

            {/* Comment (Optional) */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                Comment (Optional)
              </label>
              <textarea
                name="comment"
                value={formData.comment}
                onChange={handleInputChange}
                placeholder="Add a comment or note..."
                rows={3}
                style={{ width: '100%', padding: '12px 16px', border: '2px solid #e9ecef', borderRadius: '10px', fontSize: '1rem', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {/* Tabs Container (Questions / PDF) */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e9ecef', marginBottom: '20px' }}>
                <button type="button" onClick={() => { setActiveTab('questions'); setFormData({ ...formData, mock_exam_type: 'questions', pdf_file_name: '', pdf_url: '' }); }}
                  style={{ padding: '12px 24px', border: 'none', borderBottom: activeTab === 'questions' ? '3px solid #1FA8DC' : '3px solid transparent', backgroundColor: 'transparent', color: activeTab === 'questions' ? '#1FA8DC' : '#6c757d', fontWeight: activeTab === 'questions' ? '600' : '500', cursor: 'pointer', fontSize: '1rem', transition: 'all 0.2s ease' }}>
                  Questions
                </button>
                <button type="button" onClick={() => { setActiveTab('pdf'); setFormData({ ...formData, mock_exam_type: 'pdf', questions: [{ question_text: '', question_picture: null, answers: ['A', 'B'], answer_texts: ['', ''], correct_answer: '', question_explanation: '' }], timer_type: 'no_timer', timer: null }); }}
                  style={{ padding: '12px 24px', border: 'none', borderBottom: activeTab === 'pdf' ? '3px solid #1FA8DC' : '3px solid transparent', backgroundColor: 'transparent', color: activeTab === 'pdf' ? '#1FA8DC' : '#6c757d', fontWeight: activeTab === 'pdf' ? '600' : '500', cursor: 'pointer', fontSize: '1rem', transition: 'all 0.2s ease' }}>
                  PDF
                </button>
              </div>

              {activeTab === 'pdf' && (
                <div style={{ padding: '20px', border: '2px solid #e9ecef', borderRadius: '12px', backgroundColor: '#f8f9fa' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>File Name <span style={{ color: 'red' }}>*</span></label>
                    <input type="text" value={formData.pdf_file_name} onChange={(e) => setFormData({ ...formData, pdf_file_name: e.target.value })} placeholder="Enter PDF File Name"
                      style={{ width: '100%', padding: '12px 16px', border: errors.pdf_file_name ? '2px solid #dc3545' : '2px solid #e9ecef', borderRadius: '10px', fontSize: '1rem' }} />
                    {errors.pdf_file_name && <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>{errors.pdf_file_name}</div>}
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>Upload PDF <span style={{ color: 'red' }}>*</span></label>

                    {!formData.pdf_url && !pdfUploading && !pdfUploadError && (
                      <div onClick={() => pdfFileInputRef.current?.click()}
                        style={{ border: errors.pdf_url ? '2px dashed #dc3545' : '2px dashed #ccc', borderRadius: '8px', padding: '32px 20px', textAlign: 'center', cursor: 'pointer', backgroundColor: '#fff', transition: 'border-color 0.2s ease' }}
                        onMouseOver={(e) => { if (!errors.pdf_url) e.currentTarget.style.borderColor = '#1FA8DC'; }}
                        onMouseOut={(e) => { if (!errors.pdf_url) e.currentTarget.style.borderColor = '#ccc'; }}>
                        <div style={{ fontSize: '2rem', marginBottom: '8px', color: '#999' }}>+</div>
                        <div style={{ color: '#666', fontSize: '0.95rem' }}>Click to select a PDF file</div>
                        <div style={{ color: '#999', fontSize: '0.8rem', marginTop: '4px' }}>PDF (max 20MB)</div>
                      </div>
                    )}

                    {pdfUploading && (
                      <div style={{ border: '2px solid #1FA8DC', borderRadius: '8px', padding: '20px', backgroundColor: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <span style={{ color: '#333', fontSize: '0.9rem', fontWeight: '500' }}>Uploading PDF...</span>
                          <span style={{ color: '#1FA8DC', fontSize: '0.85rem', fontWeight: '600' }}>{pdfUploadProgress}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pdfUploadProgress}%`, height: '100%', backgroundColor: '#1FA8DC', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    )}

                    {formData.pdf_url && !pdfUploading && (
                      <div style={{ border: '2px solid #28a745', borderRadius: '8px', padding: '16px 20px', backgroundColor: '#f0fff4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ color: '#28a745', fontWeight: '600', fontSize: '0.9rem' }}>✅ Uploaded successfully</div>
                          <div style={{ color: '#666', fontSize: '0.85rem', marginTop: '2px' }}>{formData.pdf_file_name || 'PDF file'}</div>
                        </div>
                        <button type="button" onClick={() => { setFormData(prev => ({ ...prev, pdf_url: '' })); if (pdfFileInputRef.current) pdfFileInputRef.current.value = ''; }}
                          style={{ padding: '6px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                          ❌ Remove
                        </button>
                      </div>
                    )}

                    {pdfUploadError && !pdfUploading && !formData.pdf_url && (
                      <div style={{ border: '2px solid #dc3545', borderRadius: '8px', padding: '16px 20px', backgroundColor: '#fff5f5' }}>
                        <div style={{ color: '#dc3545', fontWeight: '500', fontSize: '0.9rem', marginBottom: '8px' }}>❌ Upload failed: {pdfUploadError}</div>
                        <button type="button" onClick={() => { setPdfUploadError(''); if (pdfFileInputRef.current) pdfFileInputRef.current.value = ''; }}
                          style={{ padding: '6px 14px', backgroundColor: '#1FA8DC', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                          Try Again
                        </button>
                      </div>
                    )}

                    <input ref={pdfFileInputRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files[0]; if (!file) return;
                        if (file.type !== 'application/pdf') { setPdfUploadError('Only PDF files are allowed'); return; }
                        if (file.size > 20 * 1024 * 1024) { setPdfUploadError('File size exceeds 20MB limit'); return; }
                        setPdfUploadError('');
                        setPdfUploading(true);
                        setPdfUploadProgress(0);
                        try { const reader = new FileReader();
                          reader.onprogress = (evt) => { if (evt.lengthComputable) setPdfUploadProgress(Math.round((evt.loaded / evt.total) * 30)); };
                          reader.onload = async () => {
                            setPdfUploadProgress(30);
                            try { const response = await apiClient.post('/api/upload/pdf-file', { file: reader.result, fileType: file.type, folder: 'MockExams-PDFs' },
                              { onUploadProgress: (p) => { if (p.total) setPdfUploadProgress(30 + Math.round((p.loaded / p.total) * 70)); } });
                              if (response.data.success) { setPdfUploadProgress(100); setFormData(prev => ({ ...prev, pdf_url: response.data.url })); setErrors(prev => { const n = { ...prev }; delete n.pdf_url; return n; }); }
                            } catch (err) { setPdfUploadError(err.response?.data?.error || 'Failed to upload PDF'); } finally { setPdfUploading(false); } }; reader.readAsDataURL(file);
                        } catch (err) { setPdfUploadError('Failed to read file'); setPdfUploading(false); }
                      }}
                    />

                    {errors.pdf_url && !pdfUploadError && <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>{errors.pdf_url}</div>}
                  </div>
                </div>
              )}
            </div>

            {/* Questions Content */}
            {activeTab === 'questions' && <div>
                {/* Deadline Radio */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', textAlign: 'left' }}>
                    Deadline
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: formData.deadline_type === 'no_deadline' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: formData.deadline_type === 'no_deadline' ? '#f0f8ff' : 'white' }}>
                      <input
                        type="radio"
                        name="deadline_type"
                        value="no_deadline"
                        checked={formData.deadline_type === 'no_deadline'}
                        onChange={(e) => setFormData({ ...formData, deadline_type: e.target.value, deadline_date: '' })}
                        style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: '500' }}>No Deadline Date</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: formData.deadline_type === 'with_deadline' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: formData.deadline_type === 'with_deadline' ? '#f0f8ff' : 'white' }}>
                      <input
                        type="radio"
                        name="deadline_type"
                        value="with_deadline"
                        checked={formData.deadline_type === 'with_deadline'}
                        onChange={(e) => setFormData({ ...formData, deadline_type: e.target.value })}
                        style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: '500' }}>With Deadline Date</span>
                    </label>
                  </div>
                </div>

                {/* Deadline Date Input (if with deadline) */}
                {formData.deadline_type === 'with_deadline' && (
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                      Deadline Date <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.deadline_date}
                      onChange={(e) => setFormData({ ...formData, deadline_date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: errors.deadline_date ? '2px solid #dc3545' : '2px solid #e9ecef',
                        borderRadius: '10px',
                        fontSize: '1rem',
                        transition: 'all 0.3s ease',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                      onFocus={(e) => {
                        e.target.style.border = '2px solid #1FA8DC';
                        e.target.style.boxShadow = '0 0 0 3px rgba(31, 168, 220, 0.1)';
                      }}
                      onBlur={(e) => {
                        if (!errors.deadline_date) {
                          e.target.style.border = '2px solid #e9ecef';
                          e.target.style.boxShadow = 'none';
                        }
                      }}
                    />
                    {errors.deadline_date && (
                      <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                        {errors.deadline_date}
                      </div>
                    )}
                  </div>
                )}

                {/* Timer Radio */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', textAlign: 'left' }}>
                    Timer <span style={{ color: 'red' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: formData.timer_type === 'no_timer' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: formData.timer_type === 'no_timer' ? '#f0f8ff' : 'white' }}>
                      <input
                        type="radio"
                        name="timer_type"
                        value="no_timer"
                        checked={formData.timer_type === 'no_timer'}
                        onChange={handleTimerTypeChange}
                        style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: '500' }}>No Timer</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: formData.timer_type === 'with_timer' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: formData.timer_type === 'with_timer' ? '#f0f8ff' : 'white' }}>
                      <input
                        type="radio"
                        name="timer_type"
                        value="with_timer"
                        checked={formData.timer_type === 'with_timer'}
                        onChange={handleTimerTypeChange}
                        style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: '500' }}>With Timer</span>
                    </label>
                  </div>
                </div>

                {/* Timer Input (if with timer) */}
                {formData.timer_type === 'with_timer' && (
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                      Enter time in minutes <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="number"
                      name="timer"
                      min="1"
                      value={formData.timer || ''}
                      onChange={handleInputChange}
                      placeholder="Enter time in minutes"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: errors.timer ? '2px solid #dc3545' : '2px solid #e9ecef',
                        borderRadius: '10px',
                        fontSize: '1rem'
                      }}
                    />
                    {errors.timer && (
                      <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                        {errors.timer}
                      </div>
                    )}
                  </div>
                )}

                {/* Shuffle Questions and Answers Radio */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', textAlign: 'left' }}>
                    Shuffle Questions and Answers <span style={{ color: 'red' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: formData.shuffle_questions_and_answers === false ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: formData.shuffle_questions_and_answers === false ? '#f0f8ff' : 'white' }}>
                      <input
                        type="radio"
                        name="shuffle_questions_and_answers"
                        value="false"
                        checked={formData.shuffle_questions_and_answers === false}
                        onChange={(e) => setFormData({ ...formData, shuffle_questions_and_answers: false })}
                        style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: '500' }}>No</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: formData.shuffle_questions_and_answers === true ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: formData.shuffle_questions_and_answers === true ? '#f0f8ff' : 'white' }}>
                      <input
                        type="radio"
                        name="shuffle_questions_and_answers"
                        value="true"
                        checked={formData.shuffle_questions_and_answers === true}
                        onChange={(e) => setFormData({ ...formData, shuffle_questions_and_answers: true })}
                        style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: '500' }}>Yes</span>
                    </label>
                  </div>
                </div>

                {/* Show details after submitting Radio */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', textAlign: 'left' }}>
                    Show details after submitting <span style={{ color: 'red' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: formData.show_details_after_submitting === false ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: formData.show_details_after_submitting === false ? '#f0f8ff' : 'white' }}>
                      <input
                        type="radio"
                        name="show_details_after_submitting"
                        value="false"
                        checked={formData.show_details_after_submitting === false}
                        onChange={(e) => setFormData({ ...formData, show_details_after_submitting: false })}
                        style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: '500' }}>No</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: formData.show_details_after_submitting === true ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: formData.show_details_after_submitting === true ? '#f0f8ff' : 'white' }}>
                      <input
                        type="radio"
                        name="show_details_after_submitting"
                        value="true"
                        checked={formData.show_details_after_submitting === true}
                        onChange={(e) => setFormData({ ...formData, show_details_after_submitting: true })}
                        style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: '500' }}>Yes</span>
                    </label>
                  </div>
                </div>

                {/* Questions */}
                {formData.questions && Array.isArray(formData.questions) && formData.questions.map((question, qIdx) => (
              <div key={qIdx} className="question-section" style={{ marginBottom: '32px', padding: '20px', border: '2px solid #e9ecef', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <label style={{ fontWeight: '600', fontSize: '1.1rem', textAlign: 'left' }}>
                    Question {qIdx + 1}
                  </label>
                  {formData.questions && formData.questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(qIdx)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Image src="/trash2.svg" alt="Remove" width={18} height={18} style={{ display: 'inline-block' }} />
                      Remove Question
                    </button>
                  )}
                </div>

                {/* Question Image Uploads */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.875rem', color: '#6c757d', marginBottom: '8px' }}>
                    Max size: 10 MB
                  </div>
                  {(() => {
                    const questionPictures = getQuestionPictures(question);
                    return questionPictures.map((questionImage, imageIdx) => {
                    const isLastImageSlot = imageIdx === questionPictures.length - 1;
                    const imageKey = `${qIdx}_${imageIdx}`;
                    const hasImage = !!questionImage || !!imagePreviews[imageKey] || !!imageUrls[imageKey];
                    return (
                      <div key={imageKey} style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                          {imageIdx === 0 ? 'Question Image' : `Question Image ${imageIdx + 1}`}
                        </label>
                        {hasImage ? (
                          <div className="question-image-container" style={{ position: 'relative', width: '100%', transition: 'all 0.3s ease' }}>
                            {loadingImages[imageKey] ? <div style={{ width: '100%', padding: '40px', textAlign: 'center', color: '#6c757d' }}>Loading image...</div> : <ZoomableImage src={imagePreviews[imageKey] || imageUrls[imageKey] || ''} alt="Question" />}
                            <div className="question-image-trash" onClick={(e) => { e.stopPropagation(); handleRemoveImage(qIdx, imageIdx); }} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 72, height: 72, borderRadius: '50%', background: '#dc3545', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.3s ease', zIndex: 100, cursor: 'pointer', pointerEvents: 'none' }}>
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </div>
                            {uploadingImages[imageKey] && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 64, height: 64, borderRadius: '50%', background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}><div style={{ width: '40px', height: '40px', border: '4px solid rgba(255, 255, 255, 0.3)', borderTop: '4px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>}
                          </div>
                        ) : (
                          <div onDragOver={(e) => handleDragOver(e, qIdx, imageIdx)} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, qIdx, imageIdx)} style={{ border: `2px dashed ${dragOverIndex === imageKey ? '#1FA8DC' : '#e9ecef'}`, borderRadius: '12px', padding: '40px 20px', textAlign: 'center', backgroundColor: dragOverIndex === imageKey ? '#f0f8ff' : 'white', transition: 'all 0.3s ease', cursor: uploadingImages[imageKey] ? 'not-allowed' : 'pointer' }}>
                            <div style={{ marginBottom: '16px' }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1FA8DC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto', display: 'block' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg></div>
                            <p style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: '500', color: '#333' }}>Drag your file here</p>
                            <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: '#6c757d' }}>or</p>
                            <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(qIdx, imageIdx, file); }} style={{ display: 'none' }} id={`question-image-${qIdx}-${imageIdx}`} disabled={uploadingImages[imageKey]} />
                            <label htmlFor={`question-image-${qIdx}-${imageIdx}`} style={{ display: 'inline-block', padding: '12px 24px', backgroundColor: uploadingImages[imageKey] ? '#6c757d' : '#1FA8DC', color: 'white', borderRadius: '8px', cursor: uploadingImages[imageKey] ? 'not-allowed' : 'pointer', fontSize: '0.9rem', fontWeight: '600', opacity: uploadingImages[imageKey] ? 0.7 : 1, transition: 'all 0.2s ease' }}>
                              {uploadingImages[imageKey] ? 'Uploading...' : 'Browse'}
                            </label>
                          </div>
                        )}
                        <div className="image-buttons-container" style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', width: '100%', marginTop: '8px' }}>
                          {imageIdx > 0 && <button type="button" onClick={() => removeImageContainer(qIdx, imageIdx)} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}><Image src="/trash2.svg" alt="Remove" width={18} height={18} style={{ display: 'inline-block' }} />Remove</button>}
                          {isLastImageSlot && <button type="button" onClick={() => addImageContainer(qIdx)} style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}><Image src="/plus.svg" alt="Add" width={18} height={18} style={{ display: 'inline-block' }} />Add</button>}
                        </div>
                        {errors[`question_${qIdx}_image_${imageIdx}`] && <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>{errors[`question_${qIdx}_image_${imageIdx}`]}</div>}
                      </div>
                    );
                  });
                  })()}
                </div>

                {/* Question Text Input (after image) */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                    Question Text
                  </label>
                  <textarea
                    value={question.question_text || ''}
                    onChange={(e) => handleQuestionChange(qIdx, 'question_text', e.target.value)}
                    placeholder="Enter question text (optional)"
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: errors[`question_${qIdx}_text`] ? '2px solid #dc3545' : '2px solid #e9ecef',
                      borderRadius: '10px',
                      fontSize: '1rem',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                  {errors[`question_${qIdx}_text`] && (
                    <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                      {errors[`question_${qIdx}_text`]}
                    </div>
                  )}
                </div>

                {/* Answers */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', textAlign: 'left' }}>
                    Answers
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {question.answers.map((answerLetter, aIdx) => {
                      const isLastAnswer = aIdx === question.answers.length - 1;
                      const hasTrashButton = aIdx >= 2;
                      const showAddButton = isLastAnswer && (aIdx === 1 || hasTrashButton);
                      const answerText = question.answer_texts && question.answer_texts[aIdx] ? question.answer_texts[aIdx] : '';
                      
                      return (
                        <div key={aIdx} style={{ marginBottom: '12px' }}>
                          <div className="answer-option-row" style={{ 
                            display: 'flex', 
                            gap: '12px', 
                            alignItems: 'center',
                            padding: '12px',
                            border: '2px solid #e9ecef',
                            borderRadius: '8px',
                            backgroundColor: '#f8f9fa'
                          }}>
                            <div style={{ 
                              minWidth: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#1FA8DC',
                              color: 'white',
                              borderRadius: '6px',
                              fontSize: '1rem',
                              fontWeight: '700'
                            }}>
                              {answerLetter}
                            </div>
                            
                            <input
                              type="text"
                              value={answerText}
                              onChange={(e) => {
                                const newAnswerTexts = [...(question.answer_texts || [])];
                                newAnswerTexts[aIdx] = e.target.value;
                                handleQuestionChange(qIdx, 'answer_texts', newAnswerTexts);
                                
                                // Sync correct_answer if this is the correct answer
                                const currentCorrectAnswer = question.correct_answer;
                                if (Array.isArray(currentCorrectAnswer) && currentCorrectAnswer[0] === answerLetter.toLowerCase()) {
                                  // Update the text part
                                  handleQuestionChange(qIdx, 'correct_answer', [answerLetter.toLowerCase(), e.target.value]);
                                } else if (currentCorrectAnswer === answerLetter.toLowerCase() && e.target.value.trim() !== '') {
                                  // Convert to array format if text is added
                                  handleQuestionChange(qIdx, 'correct_answer', [answerLetter.toLowerCase(), e.target.value]);
                                }
                              }}
                              placeholder={`Option ${answerLetter} text (optional)`}
                              style={{
                                flex: 1,
                                padding: '10px 12px',
                                border: '2px solid #e9ecef',
                                borderRadius: '8px',
                                fontSize: '0.95rem'
                              }}
                            />
                          </div>
                          
                          <div className="answer-buttons-container" style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', width: '100%', marginTop: '8px' }}>
                            {hasTrashButton && (
                              <button
                                type="button"
                                onClick={() => removeAnswer(qIdx, aIdx)}
                                style={{
                                  padding: '8px 16px',
                                  backgroundColor: '#dc3545',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '0.9rem',
                                  fontWeight: '600',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <Image src="/trash2.svg" alt="Remove" width={18} height={18} style={{ display: 'inline-block' }} />
                                Remove
                              </button>
                            )}
                            {showAddButton && (
                              <button
                                type="button"
                                onClick={() => addAnswer(qIdx)}
                                style={{
                                  padding: '8px 16px',
                                  backgroundColor: '#28a745',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '0.9rem',
                                  fontWeight: '600',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <Image src="/plus.svg" alt="Add" width={18} height={18} style={{ display: 'inline-block' }} />
                                Add Option
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Correct Answer Radio */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                    Correct Answer <span style={{ color: 'red' }}>*</span>
                  </label>
                  <div className="correct-answer-radio" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {question.answers.map((answerLetter, aIdx) => {
                      const answerText = question.answer_texts && question.answer_texts[aIdx] ? question.answer_texts[aIdx] : '';
                      // Check if this answer is selected - handle both string and array formats
                      const isCorrect = Array.isArray(question.correct_answer) 
                        ? question.correct_answer[0] === answerLetter.toLowerCase()
                        : question.correct_answer === answerLetter.toLowerCase();
                      
                      return (
                        <label key={aIdx} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '12px', borderRadius: '8px', border: isCorrect ? '2px solid #28a745' : '2px solid #e9ecef', backgroundColor: isCorrect ? '#f0fff4' : 'white' }}>
                          <input
                            type="radio"
                            name={`correct_answer_${qIdx}`}
                            value={answerLetter.toLowerCase()}
                            checked={isCorrect}
                            onChange={(e) => handleQuestionChange(qIdx, 'correct_answer', e.target.value)}
                            style={{ marginRight: '12px', width: '20px', height: '20px', cursor: 'pointer' }}
                          />
                          <div style={{
                            minWidth: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#1FA8DC',
                            color: 'white',
                            borderRadius: '6px',
                            fontSize: '1rem',
                            fontWeight: '700',
                            marginRight: '12px'
                          }}>
                            {answerLetter}
                          </div>
                          {answerText && (
                            <span style={{ flex: 1, marginLeft: '8px', fontSize: '0.95rem' }}>
                              {answerText}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  {errors[`question_${qIdx}_correct`] && (
                    <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                      {errors[`question_${qIdx}_correct`]}
                    </div>
                  )}
                </div>

                {/* Question Explanation */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                    Question Explanation
                  </label>
                  <textarea
                    value={question.question_explanation || ''}
                    onChange={(e) => handleQuestionChange(qIdx, 'question_explanation', e.target.value)}
                    placeholder="Enter explanation for this question (optional)"
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e9ecef',
                      borderRadius: '10px',
                      fontSize: '1rem',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      minHeight: '100px'
                    }}
                  />
                </div>
              </div>
                ))}

                {/* Add Question Button */}
                <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={addQuestion}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Image src="/plus.svg" alt="Add" width={20} height={20} style={{ display: 'inline-block' }} />
                    Add Question
                  </button>
                </div>
            </div>}

            {/* Error Message */}
            {errors.general && (
              <div style={{
                background: '#fee2e2',
                color: '#991b1b',
                borderRadius: 10,
                padding: 16,
                marginBottom: 24,
                textAlign: 'center',
                fontWeight: 600,
                border: '1.5px solid #fca5a5',
                fontSize: '1.1rem'
              }}>
                {errors.general}
              </div>
            )}

            {/* Submit Button */}
            <div className="submit-buttons" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="submit"
                disabled={updateMockExamMutation.isPending || Object.keys(uploadingImages).length > 0}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (updateMockExamMutation.isPending || Object.keys(uploadingImages).length > 0) ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  opacity: (updateMockExamMutation.isPending || Object.keys(uploadingImages).length > 0) ? 0.7 : 1
                }}
              >
                {updateMockExamMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/manage_online_system/online_mock_exams')}
                disabled={updateMockExamMutation.isPending}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: updateMockExamMutation.isPending ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  opacity: updateMockExamMutation.isPending ? 0.7 : 1
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      <ImportExistingOnlineItemModal
        open={importModalOpen}
        onClose={() => {
          if (!importApplyLoading) setImportModalOpen(false);
        }}
        title="Import mock exam"
        description="Pick another mock exam to copy into this editor."
        options={importMockExamOptions}
        selectedValue={importSelectedId}
        onSelectedValueChange={setImportSelectedId}
        onApply={handleImportApply}
        applyLabel="Load"
        emptyMessage="No other mock exams available."
        applyLoading={importApplyLoading}
      />

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .question-image-container:hover .zoomable-image {
          filter: blur(4px);
        }
        .question-image-container:hover .question-image-trash {
          opacity: 1 !important;
          pointer-events: auto !important;
        }
        @media (max-width: 768px) {
          .page-wrapper {
            padding: 10px 5px !important;
          }
          .page-content {
            margin: 20px auto !important;
            padding: 8px !important;
          }
          .form-container {
            padding: 16px !important;
          }
          .answer-buttons-container {
            flex-direction: row !important;
            flex-wrap: wrap !important;
            margin-top: 8px !important;
          }
          .answer-buttons-container button {
          }
          .image-buttons-container button {
          }
          .add-question-container {
            flex-direction: row !important;
            flex-wrap: wrap !important;
            justify-content: flex-end !important;
          }
          .add-question-container button {
          }
          .question-section > div:first-child {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .question-section > div:first-child button {
            align-self: flex-end !important;
            width: auto !important;
            max-width: 100% !important;
            flex: 0 1 auto !important;
          }
          .submit-buttons {
            flex-direction: column;
            gap: 10px;
          }
          .submit-buttons button {
            width: 100%;
          }
          .answer-option-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
          }
          .answer-option-row > div:first-child {
            align-self: flex-start !important;
          }
          .answer-option-row input {
            width: 100% !important;
          }
          .answer-option-row > div:last-child {
            width: 100% !important;
            display: flex !important;
            gap: 8px !important;
          }
          .answer-option-row > div:last-child button {
            flex: 1 !important;
            padding: 10px 12px !important;
            font-size: 0.85rem !important;
          }
          .answer-input-row {
            align-items: flex-end !important;
            flex-direction: column !important;
            gap: 8px !important;
          }
          .answer-input-row > div:first-child {
            width: 100% !important;
          }
          .answer-input-row input {
            width: 100% !important;
          }
          .answer-buttons {
            margin-top: 0 !important;
            width: 100% !important;
            display: flex !important;
            gap: 8px !important;
          }
          .answer-buttons button {
            flex: 1 !important;
            padding: 10px 12px !important;
            font-size: 0.85rem !important;
          }
          button[onclick*="addQuestion"] {
            width: 100% !important;
            padding: 12px 16px !important;
          }
          button[onclick*="removeQuestion"] {
            width: 100% !important;
            padding: 10px 16px !important;
            margin-top: 8px !important;
          }
          .question-section > div:first-child {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
        }
        @media (max-width: 480px) {
          .page-wrapper {
            padding: 5px !important;
          }
          .page-content {
            margin: 10px auto !important;
            padding: 5px !important;
          }
          .form-container {
            padding: 12px !important;
          }
          .question-section {
            padding: 16px !important;
            margin-bottom: 20px !important;
          }
          .question-label, .answer-label {
            font-size: 0.9rem;
          }
          input[type="text"], textarea, select {
            font-size: 0.9rem !important;
            padding: 10px 12px !important;
          }
          .upload-image-label {
            font-size: 0.85rem !important;
            padding: 10px 20px !important;
          }
          .correct-answer-radio label {
            padding: 6px !important;
            font-size: 0.9rem;
          }
          .correct-answer-radio span {
            font-size: 0.85rem;
          }
          .answer-option-row > div:last-child button {
            padding: 8px 10px !important;
            font-size: 0.8rem !important;
          }
          .image-buttons-container button {
          }
          .answer-buttons button {
            padding: 8px 10px !important;
            font-size: 0.8rem !important;
          }
          button[onclick*="addQuestion"] {
            padding: 10px 14px !important;
            font-size: 0.9rem !important;
          }
          button[onclick*="removeQuestion"] {
            padding: 8px 14px !important;
            font-size: 0.85rem !important;
          }
        }
        @media (max-width: 360px) {
          .form-container {
            padding: 10px !important;
          }
          .question-section {
            padding: 12px !important;
          }
          input[type="text"], textarea, select {
            font-size: 0.85rem !important;
            padding: 8px 10px !important;
          }
          .image-buttons-container button {
            flex: 1 1 100% !important;
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}

