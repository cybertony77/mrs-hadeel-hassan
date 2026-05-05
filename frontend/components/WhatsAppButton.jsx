import React, { useState } from 'react';
import Image from 'next/image';
import { useUpdateMessageState } from '../lib/api/students';
import { generatePublicStudentLink } from '../lib/generatePublicLink';
import { useSystemConfig } from '../lib/api/system';
import apiClient from '../lib/axios';

const WhatsAppButton = ({ student, onMessageSent, onScoreUpdate }) => {
  const { data: systemConfig } = useSystemConfig();
  const systemName = systemConfig?.name || 'Demo Attendance System';
  const isScoringEnabled = systemConfig?.scoring_system === true || systemConfig?.scoring_system === 'true';
  const [message, setMessage] = useState('');
  const updateMessageStateMutation = useUpdateMessageState();

  const handleWhatsAppClick = () => {
    setMessage('');

    try {
      // Get phone number from DB (should already include country code, e.g., "201211172756")
      let parentNumber = student.parents_phone ? student.parents_phone.replace(/[^0-9]/g, '') : null;
      
      // Validate phone number exists
      if (!parentNumber || parentNumber.length < 3) {
        setMessage('Missing or invalid parent phone number');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        const lessonName = student.attendanceLesson || student.currentLesson || (student.lessons && Object.keys(student.lessons).length > 0 ? Object.keys(student.lessons)[0] : 'N/A');
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, lesson: lessonName });
        return;
      }
      
      // Auto-convert only local Egyptian mobile numbers; keep other international numbers as-is.
      const startsWithEgyptLocalMobile =
        parentNumber.startsWith('010') ||
        parentNumber.startsWith('011') ||
        parentNumber.startsWith('012') ||
        parentNumber.startsWith('015');

      if (startsWithEgyptLocalMobile) {
        parentNumber = `20${parentNumber.substring(1)}`;
      }

      // Validate student data
      if (!student.name) {
        setMessage('Student data incomplete - missing name');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        const lessonName = student.attendanceLesson || student.currentLesson || (student.lessons && Object.keys(student.lessons).length > 0 ? Object.keys(student.lessons)[0] : 'N/A');
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, lesson: lessonName });
        return;
      }

      // Get current lesson data - check attendanceLesson, currentLesson, then fallback to first lesson key
      const currentLessonName = student.attendanceLesson || student.currentLesson || (student.lessons && Object.keys(student.lessons).length > 0 ? Object.keys(student.lessons)[0] : null);
      const lessonName = currentLessonName || 'N/A'; // Use for API calls
      const lessonData = currentLessonName && student.lessons && typeof student.lessons === 'object' ? student.lessons[currentLessonName] : null;
      const currentLesson = {
        attended: student.attended_the_session || (lessonData ? lessonData.attended : false) || false,
        lastAttendance: student.lastAttendance || (lessonData ? lessonData.lastAttendance : null) || 'N/A',
        hwDone: student.hwDone || (lessonData ? lessonData.hwDone : false) || false,
        hwDegree: student.hwDegree || (lessonData ? lessonData.homework_degree : null) || null,
        quizDegree: (student.quizDegree || (lessonData ? lessonData.quizDegree : null)) ?? null
      };


      // Get previous lesson data (the lesson before the current one)
      const lessonKeys = Object.keys(student.lessons || {});
      const currentIndex = lessonKeys.findIndex(
        key => key.trim().toLowerCase() === lessonName.trim().toLowerCase()
      );

      let previousLesson = null;
      if (currentIndex > 0) {
        const prevLessonName = lessonKeys[currentIndex - 1];
        previousLesson = student.lessons[prevLessonName];
        console.log(`Previous lesson found: ${prevLessonName}`, previousLesson);
      } else {
        console.log(`No previous lesson found for ${lessonName}`);
      }

      // Compute previous homework and quiz from previous lesson
      let previousAssignment = null;
      let previousQuizDegree = null;

      if (previousLesson) {
        if (previousLesson.hwDone === true) {
          if (
            previousLesson.homework_degree !== null &&
            previousLesson.homework_degree !== undefined &&
            String(previousLesson.homework_degree).trim() !== ''
          ) {
            previousAssignment = `Done (${previousLesson.homework_degree})`;
          } else {
            previousAssignment = 'Done';
          }
        } else if (previousLesson.hwDone === false) {
          previousAssignment = 'Not Done';
        } else if (previousLesson.hwDone === 'No Homework') {
          previousAssignment = 'No Homework';
        } else if (previousLesson.hwDone === 'Not Completed') {
          previousAssignment = 'Not Completed';
        } else {
          previousAssignment = 'Not Done';
        }

        if (
          previousLesson.quizDegree !== null &&
          previousLesson.quizDegree !== undefined &&
          String(previousLesson.quizDegree).trim() !== ''
        ) {
          previousQuizDegree = previousLesson.quizDegree;
        }

        console.log(`Previous assignment: ${previousAssignment}, Previous quiz: ${previousQuizDegree}`);
      }

      // Create the message using the specified format
      // Extract first name from full name
      const firstName = student.name ? student.name.split(' ')[0] : 'Student';
      let whatsappMessage = `Follow up Message:

Dear, ${firstName}'s Parent
We want to inform you that we are in:

  • Lesson: ${lessonName}
  • Attendance Info: ${currentLesson.attended ? `${currentLesson.lastAttendance}` : 'Absent'}`;

      // Add previous lesson homework and quiz if available
  //     if (previousAssignment || previousQuizDegree) {
  //       if (previousAssignment) {
  //         whatsappMessage += `
  // • Previous Assignment: ${previousAssignment}`;
  //       }
  //       if (previousQuizDegree) {
  //         whatsappMessage += `
  // • Previous Quiz Degree: ${previousQuizDegree}`;
  //       }
  //     }
      
      // Add comment if it exists and is not null/undefined
      // Get comment from the current lesson data (reuse variables from above)
      const lessonComment = lessonData ? lessonData.comment : null;
      
      if (lessonComment && lessonComment.trim() !== '' && lessonComment !== 'undefined') {
        whatsappMessage += `
  • Comment: ${lessonComment}`;
      }

      // Generate public link with HMAC
      const publicLink = generatePublicStudentLink(student.id.toString());

      const isPaymentSystemEnabled = systemConfig?.payment_system === true || systemConfig?.payment_system === 'true';

      whatsappMessage += `

Please visit the following link to check ${firstName}'s grades and progress: ⬇️

🖇️ ${publicLink}

Note :-
  • ${firstName}'s ID: ${student.id}${isPaymentSystemEnabled ? `
  • Number of Remaining Sessions: ${student.payment?.numberOfSessions ?? 0}${(student.payment?.numberOfSessions ?? 0) <= 2 ? `

*Please renew to continue your sessions without interruption.*` : ''}` : ''}

We wish ${firstName} gets high scores 😊❤

– ${systemName}`;

      // Create WhatsApp URL with the formatted message
      const whatsappUrl = `https://wa.me/${parentNumber}?text=${encodeURIComponent(whatsappMessage)}`;
      
      // Log the final phone number for debugging
      console.log('Attempting to send WhatsApp to:', parentNumber, 'Original:', student.parents_phone);
      
      // Try to open WhatsApp in a new tab/window
      const whatsappWindow = window.open(whatsappUrl, '_blank');
      
      // Check if window was blocked or failed to open
      if (!whatsappWindow || whatsappWindow.closed || typeof whatsappWindow.closed == 'undefined') {
        setMessage('Popup blocked - please allow popups and try again');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, lesson: lessonName });
        return;
      }
      
      // Additional check: if the window opened but immediately closed, it might be an invalid number
      setTimeout(() => {
        if (whatsappWindow.closed) {
          console.log('WhatsApp window closed immediately - possibly invalid number');
          // Note: We can't reliably detect this, so we'll rely on user feedback
        }
      }, 1000);
      
      // If we reach here, everything was successful
      setMessage('WhatsApp opened successfully!');
      
      // Update message state in database
      console.log('Updating message state in database for student:', student.id, 'lesson:', lessonName);
      console.log('Student data:', { id: student.id, attendanceLesson: student.attendanceLesson, name: student.name });
      console.log('Student lessons data:', student.lessons);
      
      // Find previous lesson name for scoring context
      const prevLessonName = currentIndex > 0 ? lessonKeys[currentIndex - 1] : null;

      // Run message_state update and scoring in parallel (don't block on mutation)
      // 1. Update message_state in database
      updateMessageStateMutation.mutate(
        { id: student.id, message_state: true, lesson: lessonName },
        {
          onSuccess: () => {
            console.log('Message state updated successfully in database for lesson:', lessonName);
            if (onMessageSent) {
              onMessageSent(student.id, true);
            }
          },
          onError: (error) => {
            console.error('Failed to update message state in database:', error);
            console.error('Error details:', error.response?.data || error.message);
            setMessage('WhatsApp sent but failed to update status');
            setTimeout(() => setMessage(''), 3000);
          }
        }
      );

      // 2. Apply scoring rules (async, fire-and-forget)
      // IMPORTANT: Check scoring_system_history first to prevent duplicate scoring on multiple clicks
      if (isScoringEnabled) {
        (async () => {
          try {
            let scoreUpdated = false;

            // === ATTENDANCE: Apply absent scoring on CURRENT lesson (attend=false) ===
            if (!currentLesson.attended) {
              try {
                // Check if absent scoring was already applied for this student+lesson
                const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
                  studentId: student.id,
                  type: 'attendance',
                  lesson: lessonName
                });

                const alreadyApplied = historyResponse.data.found && 
                  historyResponse.data.history?.data?.status === 'absent';

                if (alreadyApplied) {
                  console.log(`[SCORING] Absent scoring already applied for student ${student.id}, lesson "${lessonName}" — skipping to prevent duplicate`);
                } else {
                  // Get previous status for proper score calculation
                  const previousStatus = historyResponse.data.found 
                    ? historyResponse.data.history?.data?.status 
                    : null;

                  await apiClient.post('/api/scoring/calculate', {
                    studentId: student.id,
                    type: 'attendance',
                    lesson: lessonName,
                    data: {
                      status: 'absent',
                      previousStatus: previousStatus
                    }
                  });
                  console.log(`[SCORING] Absent score applied for student ${student.id}, lesson "${lessonName}"`);
                  scoreUpdated = true;
                }
              } catch (err) {
                console.error('Error calculating absent score:', err);
              }
            }

            // === HOMEWORK: Apply hwDone=false scoring on PREVIOUS lesson ===
            if (previousLesson && previousLesson.hwDone === false && prevLessonName) {
              try {
                // Check if homework "Not Done" scoring was already applied for this student+prevLesson
                const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
                  studentId: student.id,
                  type: 'homework',
                  lesson: prevLessonName
                });

                const alreadyApplied = historyResponse.data.found && 
                  historyResponse.data.history?.data?.hwDone === false;

                if (alreadyApplied) {
                  console.log(`[SCORING] Homework "Not Done" scoring already applied for student ${student.id}, previous lesson "${prevLessonName}" — skipping to prevent duplicate`);
                } else {
                  // Get previous hwDone state for proper score calculation
                  const previousHwDone = historyResponse.data.found 
                    ? (historyResponse.data.history?.data?.hwDone !== undefined ? historyResponse.data.history.data.hwDone : null)
                    : null;

                  await apiClient.post('/api/scoring/calculate', {
                    studentId: student.id,
                    type: 'homework',
                    lesson: prevLessonName,
                    data: {
                      hwDone: false,
                      previousHwDone: previousHwDone
                    }
                  });
                  console.log(`[SCORING] Homework "Not Done" score applied for student ${student.id}, previous lesson "${prevLessonName}"`);
                  scoreUpdated = true;
                }
              } catch (err) {
                console.error('Error calculating homework "Not Done" score:', err);
              }
            }

            if (scoreUpdated && onScoreUpdate) {
              onScoreUpdate();
            }
          } catch (err) {
            console.error('Error in scoring calculations:', err);
          }
        })();
      }
      
      setTimeout(() => setMessage(''), 3000);

    } catch (error) {
      // Handle any unexpected errors
      console.error('WhatsApp sending error:', error);
      setMessage('Error occurred while opening WhatsApp');
      setTimeout(() => setMessage(''), 3000);
      // Update database to mark as failed
      const lessonName = student.attendanceLesson || student.currentLesson || (student.lessons && Object.keys(student.lessons).length > 0 ? Object.keys(student.lessons)[0] : 'N/A');
      updateMessageStateMutation.mutate({ id: student.id, message_state: false, lesson: lessonName });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <button
        onClick={handleWhatsAppClick}
        style={{
          backgroundColor: '#25D366',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          padding: '6px 12px',
          fontSize: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: '500',
          transition: 'all 0.3s ease',
          boxShadow: '0 2px 4px rgba(37, 211, 102, 0.2)'
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = '#25D366';
          e.target.style.transform = 'translateY(-1px)';
          e.target.style.boxShadow = '0 4px 8px rgba(37, 211, 102, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = '#25D366';
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = '0 2px 4px rgba(37, 211, 102, 0.2)';
        }}
      >
        <Image src="/whatsapp.svg" alt="WhatsApp" width={30} height={30} />
        Send
      </button>
      
      {message && (
        <div style={{
          fontSize: '10px',
          color: message.includes('success') ? '#28a745' : '#dc3545',
          textAlign: 'center'
        }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default WhatsAppButton; 