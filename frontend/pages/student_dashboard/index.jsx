import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { useProfile } from '../../lib/api/auth';
import { useStudent } from '../../lib/api/students';
import { useSystemConfig } from '../../lib/api/system';
import apiClient from '../../lib/axios';

// Join WhatsApp Group Popup Component (separate from button)
function JoinWhatsAppGroupPopups({ showPopup, setShowPopup, showMessagePopup, setShowMessagePopup, messagePopupContent, groups, handleJoinGroup }) {
  return (
    <>

      {/* Multiple Groups Popup */}
      {showPopup && groups && groups.length > 1 && (
        <div 
          className="whatsapp-groups-popup"
          onClick={(e) => {
            if (e.target.classList.contains('whatsapp-groups-popup')) {
              setShowPopup(false);
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div 
            className="whatsapp-groups-popup-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '32px 24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '2px solid #e9ecef'
            }}>
              <h3 style={{
                margin: 0,
                color: '#333',
                fontSize: '1.5rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Image src="/whatsapp2.svg" alt="WhatsApp" width={30} height={30} />
                Join WhatsApp Group
              </h3>
              <button
                type="button"
                onClick={() => setShowPopup(false)}
                style={{
                  background: 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  padding: 0,
                  lineHeight: 1,
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(220, 53, 69, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#c82333';
                  e.target.style.transform = 'scale(1.1)';
                  e.target.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)';
                  e.target.style.transform = 'scale(1)';
                  e.target.style.boxShadow = '0 2px 8px rgba(220, 53, 69, 0.3)';
                }}
              >
                ✕
              </button>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {groups.map((group) => (
                <div
                  key={group._id}
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 249, 250, 0.95) 100%)',
                    border: '2px solid rgba(37, 211, 102, 0.2)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '100px',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(37, 211, 102, 0.3)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = 'rgba(37, 211, 102, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'rgba(37, 211, 102, 0.2)';
                  }}
                >
                  <h4 style={{
                    margin: 0,
                    color: '#333',
                    fontSize: '1rem',
                    fontWeight: '600',
                    flex: 1
                  }}>
                    {group.title}
                  </h4>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '130px',
                    flex: '0 0 auto'
                  }}>
                    <Image src="/arrow-right.svg" alt="Arrow" width={20} height={20} style={{ flexShrink: 0 }} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJoinGroup(group.link);
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 20px',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.boxShadow = '0 4px 12px rgba(37, 211, 102, 0.4)';
                        e.target.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.boxShadow = '0 2px 8px rgba(37, 211, 102, 0.3)';
                        e.target.style.transform = 'translateY(0)';
                      }}
                    >
                      Join
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Message Popup (for errors and info) */}
      {showMessagePopup && (
        <div 
          className="whatsapp-message-popup"
          onClick={(e) => {
            if (e.target.classList.contains('whatsapp-message-popup')) {
              setShowMessagePopup(false);
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div 
            className="whatsapp-message-popup-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: messagePopupContent.type === 'error' 
                ? 'linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%)'
                : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              border: messagePopupContent.type === 'error'
                ? '2px solid #dc3545'
                : '2px solid #1FA8DC',
              borderRadius: '16px',
              padding: '32px 24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              maxWidth: '400px',
              width: '100%',
              textAlign: 'center'
            }}
          >
            <div style={{
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              {messagePopupContent.type === 'error' ? (
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(220, 53, 69, 0.3)'
                }}>
                  <Image src="/alert-triangle.svg" alt="Alert" width={32} height={32} />
                </div>
              ) : (
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(31, 168, 220, 0.3)'
                }}>
                  <Image src="/alert-triangle.svg" alt="Info" width={32} height={32} style={{ filter: 'brightness(0) invert(1)' }} />
                </div>
              )}
            </div>
            
            <h3 style={{
              margin: '0 0 16px 0',
              color: messagePopupContent.type === 'error' ? '#dc3545' : '#1FA8DC',
              fontSize: '1.3rem',
              fontWeight: '600'
            }}>
              {messagePopupContent.type === 'error' ? 'Error' : 'Information'}
            </h3>
            
            <p style={{
              margin: '0 0 24px 0',
              color: '#495057',
              fontSize: '1rem',
              lineHeight: '1.6'
            }}>
              {messagePopupContent.message}
            </p>
            
            <button
              onClick={() => setShowMessagePopup(false)}
              style={{
                background: messagePopupContent.type === 'error'
                  ? 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)'
                  : 'linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 32px',
                fontWeight: '600',
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function StudentDashboard() {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: systemConfig } = useSystemConfig();
  const isScoringEnabled = systemConfig?.scoring_system === true || systemConfig?.scoring_system === 'true';
  const isWhatsAppJoinGroupEnabled = systemConfig?.whatsapp_join_group_btn === true || systemConfig?.whatsapp_join_group_btn === 'true';
  const isOnlineVideosEnabled = systemConfig?.online_videos === true || systemConfig?.online_videos === 'true';
  const isHomeworksVideosEnabled = systemConfig?.homeworks_videos === true || systemConfig?.homeworks_videos === 'true';
  const isHomeworksEnabled = systemConfig?.homeworks === true || systemConfig?.homeworks === 'true';
  const isMaterialEnabled = systemConfig?.material === true || systemConfig?.material === 'true';
  const isQuizzesEnabled = systemConfig?.quizzes === true || systemConfig?.quizzes === 'true';
  const isMockExamsEnabled = systemConfig?.mock_exams === true || systemConfig?.mock_exams === 'true';
  const isZoomJoinMeetingEnabled = systemConfig?.zoom_join_meeting === true || systemConfig?.zoom_join_meeting === 'true';
  const isPaymentSystemEnabled = systemConfig?.payment_system === true || systemConfig?.payment_system === 'true';
  
  // Get student ID from profile and fetch student data
  const studentId = profile?.id ? profile.id.toString() : null;
  const { data: studentData, isLoading: studentLoading } = useStudent(studentId, { 
    enabled: !!studentId,
    refetchInterval: 10000, // Auto-refetch every 10 seconds for live sessions/score updates
    refetchIntervalInBackground: true, // Continue refetching even when tab is in background
  });
  
  // Fetch centers data
  const { data: centers = [], isLoading: centersLoading } = useQuery({
    queryKey: ['centers'],
    queryFn: async () => {
      const response = await apiClient.get('/api/centers');
      return response.data.centers || [];
    },
    enabled: !!studentData?.main_center,
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Extract first name from student name
  const getFirstName = (fullName) => {
    if (!fullName) return 'Student';
    const nameParts = fullName.trim().split(/\s+/);
    return nameParts[0] || 'Student';
  };
  
  const firstName = studentData?.name ? getFirstName(studentData.name) : (profile?.name ? getFirstName(profile.name) : 'Student');
  const remainingSessions = studentData?.payment?.numberOfSessions || 0;
  const isLoading = profileLoading || studentLoading;

  // WhatsApp Groups state
  const [showWhatsAppPopup, setShowWhatsAppPopup] = useState(false);
  const [showWhatsAppMessagePopup, setShowWhatsAppMessagePopup] = useState(false);
  const [whatsAppMessageContent, setWhatsAppMessageContent] = useState({ type: '', message: '' });
  const [whatsAppGroups, setWhatsAppGroups] = useState([]);
  const [whatsappGroupsLoading, setWhatsappGroupsLoading] = useState(false);
  const [hasAvailableGroups, setHasAvailableGroups] = useState(false);

  // Zoom Meeting state
  const [zoomMeeting, setZoomMeeting] = useState(null);
  const [zoomMeetingLoading, setZoomMeetingLoading] = useState(false);

  // Check for available groups on mount and when student data changes
  // This is NOT related to SYSTEM_WHATSAPP_JOIN_GROUP - check regardless of that setting
  useEffect(() => {
    const checkAvailableGroups = async () => {
      if (!studentId) {
        setHasAvailableGroups(false);
        return;
      }
      
      try {
        const response = await apiClient.get('/api/join-whatsapp-group/student');
        const matchingGroups = response.data.groups || [];
        setHasAvailableGroups(matchingGroups.length > 0);
      } catch (error) {
        console.error('Error checking available groups:', error);
        setHasAvailableGroups(false);
      }
    };
    
    checkAvailableGroups();
  }, [studentId]);

  // Check for available zoom meeting on mount and when student data changes
  useEffect(() => {
    const checkZoomMeeting = async () => {
      if (!studentId) {
        setZoomMeeting(null);
        return;
      }
      
      try {
        const response = await apiClient.get('/api/join-zoom-meeting/student');
        setZoomMeeting(response.data.meeting || null);
      } catch (error) {
        console.error('Error checking zoom meeting:', error);
        setZoomMeeting(null);
      }
    };
    
    checkZoomMeeting();
    
    // Re-check every 30 seconds to handle time-based visibility
    const interval = setInterval(checkZoomMeeting, 30000);
    return () => clearInterval(interval);
  }, [studentId]);

  const handleJoinZoomMeeting = () => {
    if (!zoomMeeting || !zoomMeeting.link) return;

    // Open the link immediately in the synchronous click context
    // so the browser doesn't block the popup
    window.open(zoomMeeting.link, '_blank', 'noopener,noreferrer');

    // Record attendance asynchronously (fire-and-forget)
    if (zoomMeeting.lesson && studentId) {
      apiClient.post('/api/join-zoom-meeting/attend', {
        lesson: zoomMeeting.lesson
      }).catch(err => {
        console.error('Failed to record zoom attendance:', err);
      });
    }
  };

  const handleJoinWhatsAppGroup = async () => {
    if (!studentId) return;
    
    // Open a blank window immediately in the synchronous click context
    // so the browser doesn't block the popup
    const newWindow = window.open('about:blank', '_blank');

    setWhatsappGroupsLoading(true);
    try {
      const response = await apiClient.get('/api/join-whatsapp-group/student');
      const matchingGroups = response.data.groups || [];
      console.log('Matching groups:', matchingGroups);
      setWhatsAppGroups(matchingGroups);
      
      // If only one group, redirect the already-opened window
      if (matchingGroups.length === 1) {
        if (newWindow) {
          newWindow.location.href = matchingGroups[0].link;
        } else {
          window.open(matchingGroups[0].link, '_blank', 'noopener,noreferrer');
        }
      } else if (matchingGroups.length > 1) {
        // Multiple groups: close the blank window, show popup for user to choose
        if (newWindow) newWindow.close();
        console.log('Showing popup for', matchingGroups.length, 'groups');
        setShowWhatsAppPopup(true);
      } else {
        // No matching groups: close the blank window, show info
        if (newWindow) newWindow.close();
        setWhatsAppMessageContent({
          type: 'info',
          message: 'No WhatsApp groups available for your course' + (studentData?.main_center ? ', center, and gender' : ' and gender') + '.'
        });
        setShowWhatsAppMessagePopup(true);
      }
    } catch (error) {
      // Close the blank window on error
      if (newWindow) newWindow.close();
      console.error('Error fetching WhatsApp groups:', error);
      setWhatsAppMessageContent({
        type: 'error',
        message: 'Failed to load WhatsApp groups. Please try again later.'
      });
      setShowWhatsAppMessagePopup(true);
    } finally {
      setWhatsappGroupsLoading(false);
    }
  };

  const handleJoinGroup = (link) => {
    window.open(link, '_blank', 'noopener,noreferrer');
  };
  
  // Calculate next session
  const nextSession = useMemo(() => {
    if (!studentData?.main_center || !studentData?.course || !centers || centers.length === 0) {
      return null;
    }
    
    // Find the student's center
    const studentCenter = centers.find(c => 
      c.name && studentData.main_center && 
      c.name.toLowerCase().trim() === studentData.main_center.toLowerCase().trim()
    );
    
    if (!studentCenter || !studentCenter.grades || studentCenter.grades.length === 0) {
      return null;
    }
    
    // Find matching grade data by course and courseType
    const studentCourse = (studentData.course || '').trim();
    const studentCourseType = (studentData.courseType || '').trim();
    
    // Find grade data that matches course (or "All") and optionally courseType
    const gradeData = studentCenter.grades.find(g => {
      const centerCourse = (g.course || g.grade || '').trim(); // Support both course and grade for backward compatibility
      const centerCourseType = (g.courseType || '').trim();
      
      // Check if course matches (either exact match or center has "All")
      const courseMatch = centerCourse.toLowerCase() === 'all' || 
                         centerCourse.toLowerCase() === studentCourse.toLowerCase();
      
      // If courseType exists in center, it must match student's courseType
      // If courseType doesn't exist in center, it matches any student
      const courseTypeMatch = !centerCourseType || 
                             centerCourseType === '' || 
                             centerCourseType.toLowerCase() === studentCourseType.toLowerCase();
      
      return courseMatch && courseTypeMatch;
    });
    
    if (!gradeData || !gradeData.timings || gradeData.timings.length === 0) {
      return null;
    }
    
    // Day names mapping
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Get current date and time
    const now = new Date();
    const currentDayIndex = now.getDay();
    const currentDayName = dayNames[currentDayIndex];
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight
    
    // Helper function to parse time (e.g., "2:30 PM" or "14:30")
    const parseTime = (timeStr, period) => {
      if (!timeStr || timeStr.trim() === '') return null;
      
      const [hours, minutes] = timeStr.split(':').map(s => parseInt(s.trim(), 10));
      if (isNaN(hours) || isNaN(minutes)) return null;
      
      let totalMinutes = hours * 60 + minutes;
      
      // Handle AM/PM period
      if (period) {
        const periodUpper = period.toUpperCase();
        if (periodUpper === 'PM' && hours !== 12) {
          totalMinutes += 12 * 60;
        } else if (periodUpper === 'AM' && hours === 12) {
          totalMinutes -= 12 * 60;
        }
      }
      
      return totalMinutes;
    };
    
    // Helper function to get day index from day name
    const getDayIndex = (dayName) => {
      const normalized = dayName.trim().toLowerCase();
      for (let i = 0; i < dayNames.length; i++) {
        if (dayNames[i].toLowerCase() === normalized || dayNamesShort[i].toLowerCase() === normalized) {
          return i;
        }
      }
      return -1;
    };
    
    // Sort timings by day and time for easier comparison
    const validTimings = gradeData.timings
      .filter(t => t.day && t.day.trim() !== '' && t.time && t.time.trim() !== '')
      .map(t => ({
        ...t,
        dayIndex: getDayIndex(t.day),
        timeMinutes: parseTime(t.time, t.period)
      }))
      .filter(t => t.dayIndex !== -1 && t.timeMinutes !== null)
      .sort((a, b) => {
        if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
        return a.timeMinutes - b.timeMinutes;
      });
    
    if (validTimings.length === 0) {
      return null;
    }
    
    // Find the next session
    let nextSessionDate = null;
    let nextTiming = null;

    validTimings.forEach((timing) => {
      const daysUntilSession = (timing.dayIndex - currentDayIndex + 7) % 7;
      const sessionTime = timing.timeMinutes;
      
      let candidateDate = new Date(now);

      candidateDate.setDate(now.getDate() + daysUntilSession);
      candidateDate.setHours(Math.floor(sessionTime / 60), sessionTime % 60, 0, 0);
    
      // if session today but already passed → move to next week
      if (daysUntilSession === 0 && sessionTime < currentTime) {
        candidateDate.setDate(candidateDate.getDate() + 7);
      }

      if (!nextSessionDate || candidateDate < nextSessionDate) {
        nextSessionDate = candidateDate;
        nextTiming = timing;
    }
    });
    
    if (!nextSessionDate || !nextTiming) {
      return null;
    }
    
    // Format the date
    const isToday = nextSessionDate.toDateString() === now.toDateString();
    const isTomorrow = nextSessionDate.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
    
    let dateDisplay = '';
    if (isToday) {
      dateDisplay = 'Today';
    } else if (isTomorrow) {
      dateDisplay = 'Tomorrow';
    } else {
      const dayName = dayNames[nextSessionDate.getDay()];
      const dateStr = nextSessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateDisplay = `${dayName}, ${dateStr}`;
    }
    
    // Format time
    const timeStr = nextTiming.time;
    const period = nextTiming.period || '';
    const timeDisplay = `${timeStr} ${period}`.trim();
    
    return {
      center: studentCenter.name,
      location: studentCenter.location || null,
      day: nextTiming.day,
      time: timeDisplay,
      date: dateDisplay,
      dateObj: nextSessionDate
    };
  }, [studentData, centers]);

  return (
    <div className="student-dashboard-wrapper" style={{ 
      padding: "35px 35px 20px 35px",
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto'
    }}>
      <div className="main-container" style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            gap: "16px",
            marginBottom: "15px"
          }}>
          </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .welcome-message {
            width: 450px;
            max-width: 100%;
          }
          
          .sessions-reminder {
            width: 450px;
            max-width: 100%;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
          }
          .sessions-reminder:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12) !important;
          }
          
          .score-section {
            width: 450px;
            max-width: 100%;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
          }
          
          .score-section:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15) !important;
          }
          
          .dashboard-btn {
            width: 100%;
            margin-bottom: 16px;
            padding: 16px 0;
            background: linear-gradient(90deg, #87CEEB 0%, #B0E0E6 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 1.1rem;
            font-weight: 700;
            letter-spacing: 1px;
            box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3);
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          .dashboard-btn:hover:not(:disabled) {
            background: linear-gradient(90deg, #5F9EA0 0%, #87CEEB 100%);
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(31, 168, 220, 0.4);
          }
          .dashboard-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          .dashboard-btn.whatsapp-btn {
            background: linear-gradient(90deg, #25D366 0%, #128C7E 100%);
            box-shadow: 0 4px 16px rgba(37, 211, 102, 0.3);
          }
          .dashboard-btn.whatsapp-btn:hover:not(:disabled) {
            background: linear-gradient(90deg, #128C7E 0%, #25D366 100%);
            box-shadow: 0 8px 25px rgba(37, 211, 102, 0.4);
          }
          .dashboard-btn.zoom-btn {
            background: linear-gradient(90deg, #2d8cff 0%, #1a6fdb 100%);
            box-shadow: 0 4px 16px rgba(45, 140, 255, 0.3);
          }
          .dashboard-btn.zoom-btn:hover:not(:disabled) {
            background: linear-gradient(90deg, #1a6fdb 0%, #2d8cff 100%);
            box-shadow: 0 8px 25px rgba(45, 140, 255, 0.4);
          }
          
          @media (max-width: 768px) {
            .welcome-message {
              width: 100%;
              max-width: 100%;
            }
            .sessions-reminder {
              width: 100%;
              max-width: 100%;
            }
            .score-section {
              width: 100%;
              max-width: 100%;
              padding: 20px !important;
            }
            .score-section > div {
              font-size: 0.9rem !important;
            }
            .next-session-reminder {
              max-width: 100% !important;
            }
            .main-container {
              max-width: 100% !important;
              padding: 0 10px !important;
              margin: 0 !important;
            }
            .dashboard-btn {
              padding: 16px 0;
              font-size: 1.1rem;
            }
            h1 {
              font-size: 1.8rem !important;
            }
          }
          
          @media (max-width: 480px) {
            .welcome-message {
              width: 100%;
              max-width: 100%;
              padding: 16px;
              margin-left: 0 !important;
              margin-right: 0 !important;
            }
            .sessions-reminder {
              width: 100%;
              max-width: 100%;
              padding: 12px 14px !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
            }
            .score-section {
              width: 100%;
              max-width: 100%;
              padding: 18px !important;
            }
            .score-section > div {
              font-size: 0.85rem !important;
              gap: 6px !important;
            }
            .next-session-reminder {
              padding: 14px !important;
              max-width: 100% !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
            }
            .next-session-reminder > div:first-child {
              gap: 10px !important;
              margin-bottom: 10px !important;
            }
            .next-session-reminder > div:first-child > div:first-child > span {
              font-size: 16px !important;
            }
            .next-session-reminder > div:first-child > div:last-child > div:first-child {
              font-size: 0.7rem !important;
            }
            .next-session-reminder > div:first-child > div:last-child > div:last-child {
              font-size: 0.9rem !important;
            }
            .next-session-reminder > div:last-child {
              font-size: 0.85rem !important;
              gap: 6px !important;
              padding-top: 10px !important;
            }
            .main-container {
              max-width: 100%;
              margin: 0 !important;
              padding: 0 5px;
              text-align: center;
            }
            .dashboard-btn {
              padding: 14px 0;
              font-size: 1.1rem;
              margin-bottom: 18px;
            }
            h1 {
              font-size: 1.5rem !important;
            }
            .student-dashboard-wrapper {
              padding: 15px 5px 10px 5px !important;
            }
          }
          
          @media (max-width: 768px) {
            .student-dashboard-wrapper {
              padding: 20px 20px 15px 20px !important;
            }
          }
        `}</style>
        
        <div style={{ marginTop: 30, marginBottom: 20 }}>
          {isLoading ? (
            <div style={{
              minHeight: "50vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px"
            }}>
              <div style={{
                background: "rgba(255, 255, 255, 0.95)",
                borderRadius: "16px",
                padding: "40px",
                textAlign: "center",
                boxShadow: "0 8px 32px rgba(0,0,0,0.1)"
              }}>
                <p style={{ color: "#666", fontSize: "1rem", marginBottom: "20px" }}>Loading...</p>
                <div style={{
                  width: "50px",
                  height: "50px",
                  border: "4px solid rgba(31, 168, 220, 0.2)",
                  borderTop: "4px solid #1FA8DC",
                  borderRadius: "50%",
                  margin: "0 auto",
                  animation: "spin 1s linear infinite"
                }} />
              </div>
            </div>
          ) : (
            <>
              <div className="welcome-message" style={{
                background: "rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                padding: "20px",
                marginBottom: "20px",
                color: "#ffffff",
                margin: "0 auto 20px auto",
              }}>
                <h2 style={{ margin: 0, fontSize: "1.3rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  Welcome, {firstName}!
                  <Image src="/waving-hand.svg" alt="Waving Hand" width={24} height={24} />
                </h2>
              </div>

              {/* Sessions Remaining Reminder - only show when payment system is enabled and <= 3 */}
              {isPaymentSystemEnabled && studentData && remainingSessions <= 3 && (
                <div className="sessions-reminder" style={{
                  background: "rgba(255, 255, 255, 0.95)",
                  borderRadius: "12px",
                  padding: "14px 18px",
                  margin: "0 auto 20px auto",
                  maxWidth: "450px",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  borderLeft: `4px solid ${remainingSessions === 0 ? '#dc3545' : remainingSessions <= 2 ? '#f59e0b' : '#10b981'}`,
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
                }}>
                  <div style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: remainingSessions === 0 ? 'linear-gradient(135deg, #fef2f2, #fee2e2)' : remainingSessions <= 2 ? 'linear-gradient(135deg, #fffbeb, #fef3c7)' : 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={remainingSessions === 0 ? '#dc3545' : remainingSessions <= 2 ? '#f59e0b' : '#10b981'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: "0.8rem",
                      fontWeight: "600",
                      color: remainingSessions === 0 ? '#dc3545' : remainingSessions <= 2 ? '#b45309' : '#047857',
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      marginBottom: "2px",
                    }}>
                      {remainingSessions === 0 ? 'Action Required' : 'Sessions Remaining'}
                    </div>
                    <div style={{
                      fontSize: "0.85rem",
                      color: "#4b5563",
                      lineHeight: "1.4",
                    }}>
                      {remainingSessions === 0 ? (
                        <>You have <span style={{ fontWeight: "800", color: "#dc3545" }}>0</span> sessions remaining. Please renew now to continue.</>
                      ) : (
                        <>You have only <span style={{ fontWeight: "800", color: remainingSessions <= 2 ? '#b45309' : '#047857' }}>{remainingSessions}</span> session{remainingSessions !== 1 ? 's' : ''} remaining. Please renew to continue your sessions without interruption.</>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Score Section - Only show if scoring system is enabled */}
              {isScoringEnabled && (
                <div className="score-section" style={{
                  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 249, 250, 0.95) 100%)",
                  borderRadius: "16px",
                  padding: "20px",
                  marginBottom: "20px",
                  margin: "0 auto 20px auto",
                  maxWidth: "450px",
                  width: "100%",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
                  border: "2px solid rgba(31, 168, 220, 0.2)",
                  textAlign: "center"
                }}>
                  <div style={{
                    fontSize: "1rem",
                    color: "#495057",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                    marginBottom: "8px"
                  }}>
                    <span style={{ color: "#6c757d" }}>Your Score :</span>
                    <span style={{
                      fontWeight: "700",
                      background: "linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text"
                    }}>
                      {studentData?.score !== null && studentData?.score !== undefined ? studentData.score : 0}
                    </span>
                  </div>
                  <div style={{
                    fontSize: "0.9rem",
                    color: "#6c757d",
                    fontWeight: "500",
                    textAlign: "center"
                  }}>
                    Nice progress, keep going! 🚀✨
                  </div>
                </div>
              )}

              {/* Next Session Reminder */}
              {nextSession && (
                <div className="next-session-reminder" style={{
                  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 249, 250, 0.95) 100%)",
                  borderRadius: "12px",
                  padding: "16px",
                  marginBottom: "20px",
                  margin: "0 auto 20px auto",
                  maxWidth: "450px",
                  width: "100%",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.3)"
                }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "12px"
                  }}>
                    <div style={{
                      width: "35px",
                      height: "35px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 2px 8px rgba(31, 168, 220, 0.3)"
                    }}>
                      <Image src="/calendar3.svg" alt="Calendar" width={24} height={24} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: "0.75rem",
                        color: "#484a4f",
                        fontWeight: "600",
                        marginBottom: "2px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px"
                      }}>
                        Next Session
                      </div>
                      <div style={{
                        fontSize: "1rem",
                        color: "#333",
                        fontWeight: "700",
                        wordBreak: "break-word"
                      }}>
                        {nextSession.date} • {nextSession.time}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    fontSize: "0.9rem",
                    color: "#495057",
                    paddingTop: "12px",
                    borderTop: "1px solid rgba(0, 0, 0, 0.08)",
                    flexWrap: "wrap"
                  }}>
                    <Image 
                      src={nextSession.center && nextSession.center.toLowerCase() === 'online' ? "/online.svg" : "/center.svg"} 
                      alt="Center" 
                      width={18} 
                      height={18} 
                      style={{ flexShrink: 0 }} 
                    />
                    <span style={{ fontWeight: "500" }}>{nextSession.center}</span>
                    {nextSession.location && nextSession.location.trim() !== '' && nextSession.location !== null && (
                      <>
                        <span style={{ color: "#47494f", margin: "0 4px" }}>•</span>
                        <a
                          href={nextSession.location}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "#1FA8DC",
                            textDecoration: "none",
                            fontWeight: "500",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            cursor: "pointer",
                            transition: "color 0.2s ease",
                            wordBreak: "break-word"
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.color = "#17a2b8";
                            e.target.style.textDecoration = "underline";
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.color = "#1FA8DC";
                            e.target.style.textDecoration = "none";
                          }}
                        >
                          <Image src="/maps.svg" alt="Location" width={16} height={16} style={{ flexShrink: 0 }} />
                          <span>Location</span>
                        </a>
                      </>
                    )}
                  </div>
                  <div style={{
                    marginTop: "12px",
                    paddingTop: "12px",
                    borderTop: "1px solid rgba(0, 0, 0, 0.08)",
                    textAlign: "center"
                  }}>
                    <p style={{
                      fontSize: "0.8rem",
                      color: "#6c757d",
                      margin: 0,
                      fontStyle: "italic",
                      lineHeight: "1.4"
                    }}>
                      Please make sure you have completed your homework and quiz of the last session.
                    </p>
                  </div>
                </div>
              )}

              <button 
                className="dashboard-btn"
                onClick={() => router.push("/student_dashboard/my_info")}
              >
                <Image src="/user-circle3.svg" alt="User" width={20} height={20} />
                My Information
              </button>

              {isScoringEnabled && (
                <button
                  className="dashboard-btn"
                  onClick={() => router.push("/student_dashboard/scoring_rules_and_ranking")}
                >
                  <Image src="/stars.svg" alt="Scoring Rules" width={20} height={20} />
                  Scoring Rules and Ranking
                </button>
              )}

              {isZoomJoinMeetingEnabled && zoomMeeting && (!isPaymentSystemEnabled || (studentData?.payment?.numberOfSessions || 0) >= 1 || (zoomMeeting.lesson && studentData?.lessons?.[zoomMeeting.lesson]?.attended === true)) && (
                <button
                  className="dashboard-btn zoom-btn"
                  onClick={handleJoinZoomMeeting}
                  disabled={!studentId}
                >
                  <Image src="/zoom.svg" alt="Zoom" width={20} height={20} />
                  Join Zoom Meeting
                </button>
              )}

              {isOnlineVideosEnabled && (
                <button
                  className="dashboard-btn"
                  onClick={() => router.push("/student_dashboard/online_sessions")}
                >
                  <Image src="/video.svg" alt="Videos" width={23} height={23} />
                  Recorded Sessions
                </button>
              )}

              {isHomeworksVideosEnabled && (
                <button
                  className="dashboard-btn"
                  onClick={() => router.push("/student_dashboard/homeworks_videos")}
                >
                  <Image src="/play-pause.svg" alt="Play Pause" width={20} height={20} />
                  Homeworks Videos
                </button>
              )}

              {isMaterialEnabled && (
                <button
                  className="dashboard-btn"
                  onClick={() => router.push("/student_dashboard/my_material")}
                >
                  <Image src="/notes4.svg" alt="Material" width={20} height={20} />
                  My Material
                </button>
              )}

              {isHomeworksEnabled && (
                <button
                  className="dashboard-btn"
                  onClick={() => router.push("/student_dashboard/my_homeworks")}
                >
                  <Image src="/books.svg" alt="Books" width={20} height={20} />
                  My Homeworks
                </button>
              )}

              {isQuizzesEnabled && (
                <button
                  className="dashboard-btn"
                  onClick={() => router.push("/student_dashboard/my_quizzes")}
                >
                  <Image src="/notepad.svg" alt="Notepad" width={20} height={20} />
                  My Quizzes
                </button>
              )}

              {isMockExamsEnabled && (
                <button
                  className="dashboard-btn"
                  onClick={() => router.push("/student_dashboard/my_mock_exams")}
                  style={{ background: "linear-gradient(90deg, #6f42c1 0%, #8e44ad 100%)" }}
                >
                  <Image src="/exam.svg" alt="Mock Exams" width={20} height={20} />
                  My Mock Exams
                </button>
              )}

              <button
                className="dashboard-btn"
                onClick={() => router.push("/student_dashboard/centers-schedule")}
              >
                <Image src="/center.svg" alt="Centers" width={20} height={20} />
                Centers Schedule
              </button>
              <button
                className="dashboard-btn"
                onClick={() => router.push("/contact_assistants")}
              >
                <Image src="/message.svg" alt="Phone" width={20} height={20} />
                Contact Assistants
              </button>
              {hasAvailableGroups && (
                <button
                  className="dashboard-btn whatsapp-btn"
                  onClick={handleJoinWhatsAppGroup}
                  disabled={whatsappGroupsLoading || !studentId}
                >
                  <Image src="/whatsapp2.svg" alt="WhatsApp" width={20} height={20} />
                  {whatsappGroupsLoading ? 'Loading...' : 'Join WhatsApp Group'}
                </button>
              )}
            </>
          )}

          {/* WhatsApp Groups Popups */}
          <JoinWhatsAppGroupPopups 
            showPopup={showWhatsAppPopup}
            setShowPopup={setShowWhatsAppPopup}
            showMessagePopup={showWhatsAppMessagePopup}
            setShowMessagePopup={setShowWhatsAppMessagePopup}
            messagePopupContent={whatsAppMessageContent}
            groups={whatsAppGroups}
            handleJoinGroup={handleJoinGroup}
          />
        </div>
      </div>
    </div>
  );
}

