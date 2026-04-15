import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import Title from '../../components/Title';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/axios';
import { useProfile } from '../../lib/api/auth';
import { useStudent } from '../../lib/api/students';
import { useSystemConfig } from '../../lib/api/system';
import StudentLessonSelect from '../../components/StudentLessonSelect';
import NeedHelp from '../../components/NeedHelp';
import R2VideoPlayer from '../../components/R2VideoPlayer';
import YoutubeEmbedWithProgress from '../../components/YoutubeEmbedWithProgress';
import { TextInput, ActionIcon, useMantineTheme } from '@mantine/core';
import { IconSearch, IconArrowRight } from '@tabler/icons-react';

// Input with Button Component (matching manage online system style)
function InputWithButton(props) {
  const theme = useMantineTheme();
  return (
    <TextInput
      radius="xl"
      size="md"
      placeholder="Search by lesson name..."
      rightSectionWidth={42}
      leftSection={<IconSearch size={18} stroke={1.5} />}
      rightSection={
        <ActionIcon size={32} radius="xl" color={theme.primaryColor} variant="filled" onClick={props.onButtonClick}>
          <IconArrowRight size={18} stroke={1.5} />
        </ActionIcon>
      }
      {...props}
    />
  );
}


// Build embed URL
function buildEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}?controls=1&rel=0&modestbranding=1&disablekb=1&fs=1`;
}


export default function HomeworksVideos() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: systemConfig } = useSystemConfig();
  const isHomeworksVideosEnabled = systemConfig?.homeworks_videos === true || systemConfig?.homeworks_videos === 'true';
  const [expandedSessions, setExpandedSessions] = useState(new Set());
  
  // Redirect if feature is disabled
  useEffect(() => {
    if (systemConfig && !isHomeworksVideosEnabled) {
      router.push('/student_dashboard');
    }
  }, [systemConfig, isHomeworksVideosEnabled, router]);
  
  // Don't render if feature is disabled
  if (systemConfig && !isHomeworksVideosEnabled) {
    return null;
  }
  const [videoPopupOpen, setVideoPopupOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const videoContainerRef = useRef(null);
  const videoStartTimeRef = useRef(null); // Track when video was opened
  const isClosingVideoRef = useRef(false); // Prevent multiple close calls
  const r2CompletedRef = useRef(false); // R2: >= 90% watched
  const selectedVideoRef = useRef(null);
  const vhcViewsDecrementDoneRef = useRef(false);
  const [vhcPopupOpen, setVhcPopupOpen] = useState(false);
  const [vhc, setVhc] = useState('');
  const [vhcError, setVhcError] = useState('');
  const [isCheckingVhc, setIsCheckingVhc] = useState(false);
  const [pendingVideo, setPendingVideo] = useState(null); // Store video info while waiting for VHC
  const [unlockedSessions, setUnlockedSessions] = useState(new Map()); // Store unlocked sessions with VHC info

  // Fetch student data to check attendance
  const studentId = profile?.id ? profile.id.toString() : null;
  const { data: studentData } = useStudent(studentId, { enabled: !!studentId });

  // Fetch homeworks videos
  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['homeworks_videos-student'],
    queryFn: async () => {
      const response = await apiClient.get('/api/homeworks_videos/student');
      return response.data;
    },
    refetchInterval: 10 * 60 * 1000, // Auto-refresh every 10 minutes
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
    refetchOnWindowFocus: true, // Refetch on window focus
    refetchOnMount: true, // Refetch on mount
    refetchOnReconnect: true, // Refetch on reconnect
  });

  const sessions = sessionsData?.sessions || [];

  // Hide deactivated homework videos from students
  const visibleSessions = sessions.filter(
    (session) => (session.account_state || 'Activated') !== 'Deactivated'
  );

  // Restore unlocked sessions from student's homeworks_videos on page load
  useEffect(() => {
    const restoreUnlockedSessions = async () => {
      console.log('[RESTORE VHC] studentData:', studentData);
      if (!studentData?.homeworks_videos || !Array.isArray(studentData.homeworks_videos)) {
        console.log('[RESTORE VHC] No homeworks_videos found in studentData');
        return;
      }

      console.log('[RESTORE VHC] Starting restore process, found', studentData.homeworks_videos.length, 'homeworks_videos');
      const newUnlocked = new Map();
      
      // Process each homeworks_video entry
      for (const homeworkVideo of studentData.homeworks_videos) {
        if (!homeworkVideo.vhc_id || !homeworkVideo.video_id) {
          console.log('[RESTORE VHC] Skipping entry - missing vhc_id or video_id:', homeworkVideo);
          continue;
        }

        try {
          console.log('[RESTORE VHC] Fetching VHC details for video_id:', homeworkVideo.video_id, 'vhc_id:', homeworkVideo.vhc_id);
          // Fetch VHC details by ID
          const response = await apiClient.post('/api/vhc/get-by-id', {
            vhc_id: homeworkVideo.vhc_id
          });

          console.log('[RESTORE VHC] VHC response:', response.data);
          if (response.data.success && response.data.valid) {
            // Add to unlocked sessions Map
            const videoId = typeof homeworkVideo.video_id === 'string' 
              ? homeworkVideo.video_id 
              : homeworkVideo.video_id.toString();
            
            console.log('[RESTORE VHC] Adding to unlocked sessions - videoId:', videoId, 'vhc_id:', response.data.vhc_id);
            newUnlocked.set(videoId, {
              vhc_id: response.data.vhc_id,
              code_settings: response.data.code_settings || 'number_of_views',
              number_of_views: response.data.number_of_views || null,
              deadline_date: response.data.deadline_date || null
            });
          } else {
            console.log('[RESTORE VHC] VHC not valid:', response.data);
          }
        } catch (err) {
          console.error('[RESTORE VHC] Failed to restore VHC for video:', homeworkVideo.video_id, err);
          // Continue with other entries even if one fails
        }
      }

      // Update unlocked sessions state
      console.log('[RESTORE VHC] Restored', newUnlocked.size, 'unlocked sessions');
      if (newUnlocked.size > 0) {
        setUnlockedSessions(newUnlocked);
      }
    };

    restoreUnlockedSessions();
  }, [studentData]);

  // Helper function to check if student attended a specific lesson
  const checkLessonAttendance = (lessonName) => {
    if (!studentData || !studentData.lessons || !lessonName) return false;
    const lessonData = studentData.lessons[lessonName];
    return lessonData && lessonData.attended === true;
  };

  /** Unlock when lessons[lessonName].hwDone exists and is not false (needs VHC otherwise). */
  const checkLessonHomeworkDoneForVideo = (lessonName) => {
    if (!studentData?.lessons || !lessonName) return false;
    const lessonData = studentData.lessons[lessonName];
    if (!lessonData || typeof lessonData !== 'object') return false;
    if (!Object.prototype.hasOwnProperty.call(lessonData, 'hwDone')) return false;
    if (lessonData.hwDone === false) return false;
    return true;
  };

  // Helper function to check if video is unlocked
  const isVideoUnlocked = (session) => {
    if (session.payment_state === 'free') {
      return true; // Free videos are always unlocked
    } else if (session.payment_state === 'free_if_homework_done') {
      if (session._isFreeIfHomeworkDone !== undefined) {
        return session._hwDoneUnlocks === true;
      }
      const lessonName = session.lesson;
      return checkLessonHomeworkDoneForVideo(lessonName);
    } else if (session.payment_state === 'free_if_attended') {
      // Check if student attended this lesson
      // Use API flag if available, otherwise check student data
      if (session._isFreeIfAttended !== undefined) {
        return session._attended === true;
      }
      const lessonName = session.lesson;
      return checkLessonAttendance(lessonName);
    } else if (session.payment_state === 'paid') {
      // Check if session is in unlockedSessions
      const sessionId = session._id?.toString() || session._id;
      const unlockedInfo = unlockedSessions.get(sessionId);
      
      console.log('[UNLOCK CHECK VHC] Session ID:', sessionId, 'Unlocked info:', unlockedInfo, 'All unlocked keys:', Array.from(unlockedSessions.keys()));
      
      if (!unlockedInfo) {
        return false; // Not unlocked yet
      }
      
      // Check deadline date if code_settings is 'deadline_date'
      if (unlockedInfo.code_settings === 'deadline_date' && unlockedInfo.deadline_date) {
        const deadlineDate = new Date(unlockedInfo.deadline_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        deadlineDate.setHours(0, 0, 0, 0);
        
        if (deadlineDate <= today) {
          // Expired - remove from unlocked sessions
          const newUnlocked = new Map(unlockedSessions);
          newUnlocked.delete(sessionId);
          setUnlockedSessions(newUnlocked);
          return false;
        }
      } else if (unlockedInfo.code_settings === 'number_of_views') {
        // Check if views are remaining
        if (unlockedInfo.number_of_views <= 0) {
          // No views remaining - remove from unlocked sessions
          const newUnlocked = new Map(unlockedSessions);
          newUnlocked.delete(sessionId);
          setUnlockedSessions(newUnlocked);
          return false;
        }
      }
      
      return true; // Unlocked and valid
    }
    return false; // Default to locked
  };

  // Search and filter states
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLesson, setFilterLesson] = useState('');
  const [filterLessonDropdownOpen, setFilterLessonDropdownOpen] = useState(false);

  // Get available lessons from sessions (only lessons that exist in sessions, are Activated, and match student's course/courseType)
  const getAvailableLessons = () => {
    const lessonSet = new Set();
    const studentCourse = (studentData?.course || '').trim();
    const studentCourseType = (studentData?.courseType || '').trim();
    
    sessions.forEach(session => {
      const effectiveState = session.state || session.account_state || 'Activated';
      if (effectiveState === 'Deactivated') return;
      if (session.lesson && session.lesson.trim()) {
        // Check if session matches student's course and courseType
        const sessionCourse = (session.course || '').trim();
        const sessionCourseType = (session.courseType || '').trim();
        
        // Course match: if session course is "All", it matches any student course
        const courseMatch = sessionCourse.toLowerCase() === 'all' || 
                           sessionCourse.toLowerCase() === studentCourse.toLowerCase();
        
        // CourseType match: if session has no courseType, it matches any student courseType
        // If session has courseType, it must match student's courseType (case-insensitive)
        const courseTypeMatch = !sessionCourseType || 
                               !studentCourseType ||
                               sessionCourseType.toLowerCase() === studentCourseType.toLowerCase();
        
        if (courseMatch && courseTypeMatch) {
          lessonSet.add(session.lesson);
        }
      }
    });
    return Array.from(lessonSet).sort();
  };

  const availableLessons = getAvailableLessons();

  // Filter sessions based on search and filters
  const filteredSessions = visibleSessions.filter(session => {
    // Search filter (by lesson name - case-insensitive)
    if (searchTerm.trim()) {
      const lessonName = session.name || '';
      if (!lessonName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
    }

    // Lesson filter
    if (filterLesson) {
      if (session.lesson !== filterLesson) {
        return false;
      }
    }

    return true;
  });

  // Automatically reset search when search input is cleared
  useEffect(() => {
    if (searchInput.trim() === "" && searchTerm !== "") {
      setSearchTerm("");
    }
  }, [searchInput, searchTerm]);

  useEffect(() => {
    selectedVideoRef.current = selectedVideo;
  }, [selectedVideo]);

  useEffect(() => {
    if (videoPopupOpen) {
      vhcViewsDecrementDoneRef.current = false;
    }
  }, [videoPopupOpen, selectedVideo?._id]);

  // Handle search
  const handleSearch = () => {
    const trimmedSearch = searchInput.trim();
    setSearchTerm(trimmedSearch);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };


  // Toggle session expansion (only one can be open at a time)
  const toggleSession = (sessionId) => {
    if (expandedSessions.has(sessionId)) {
      // If clicking on an already expanded session, close it
      setExpandedSessions(new Set());
    } else {
      // If opening a new session, close all others and open only this one
      setExpandedSessions(new Set([sessionId]));
    }
  };

  const tryDecrementVhcViewsOnWatchProgress = useCallback(async () => {
    if (vhcViewsDecrementDoneRef.current) return;
    const v = selectedVideoRef.current;
    if (!v?.vhc_id || v.code_settings !== 'number_of_views') return;
    vhcViewsDecrementDoneRef.current = true;
    try {
      const decrementResponse = await apiClient.post('/api/vhc/decrement-views', {
        vhc_id: v.vhc_id
      });
      if (decrementResponse.data.success) {
        const sessionId = typeof v._id === 'string' ? v._id : v._id.toString();
        setUnlockedSessions((prev) => {
          const updatedUnlocked = new Map(prev);
          const sessionInfo = updatedUnlocked.get(sessionId);
          if (sessionInfo) {
            sessionInfo.number_of_views = decrementResponse.data.number_of_views;
            if (sessionInfo.number_of_views <= 0) {
              updatedUnlocked.delete(sessionId);
            } else {
              updatedUnlocked.set(sessionId, sessionInfo);
            }
          }
          return updatedUnlocked;
        });
      } else {
        vhcViewsDecrementDoneRef.current = false;
      }
    } catch (err) {
      console.error('Failed to decrement VHC views:', err);
      vhcViewsDecrementDoneRef.current = false;
      if (err.response?.data?.error?.includes('no views remaining')) {
        const sessionId = typeof v._id === 'string' ? v._id : v._id.toString();
        setUnlockedSessions((prev) => {
          const next = new Map(prev);
          next.delete(sessionId);
          return next;
        });
        setVhcError('❌ Sorry, This code has no views remaining');
      }
    }
  }, []);

  const handleR2VideoCompleteHomework = useCallback(() => {
    r2CompletedRef.current = true;
  }, []);

  // Open video popup
  const openVideoPopup = async (session, videoId, videoIndex) => {
    // Get video type, default to 'youtube' for backward compatibility
    const videoType = session[`video_type_${videoIndex}`] || 'youtube';
    
    // Check if video is unlocked
    if (isVideoUnlocked(session)) {
      // Video is unlocked - check deadline date (views decrement after >=10% watch via player)
      const sessionId = session._id?.toString() || session._id;
      const unlockedInfo = unlockedSessions.get(sessionId);
      
      if (unlockedInfo) {
        // Check deadline date expiration
        if (unlockedInfo.code_settings === 'deadline_date' && unlockedInfo.deadline_date) {
          const deadlineDate = new Date(unlockedInfo.deadline_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          deadlineDate.setHours(0, 0, 0, 0);
          
          if (deadlineDate <= today) {
            // Expired
            setVhcError('❌ Sorry, This code is expired');
            const newUnlocked = new Map(unlockedSessions);
            newUnlocked.delete(sessionId);
            setUnlockedSessions(newUnlocked);
            return;
          }
        }
      }
      
      // Video is unlocked - open directly
      setSelectedVideo({ 
        ...session, 
        video_ID: videoId, 
        video_type: videoType,
        vhc_id: unlockedInfo?.vhc_id,
        code_settings: unlockedInfo?.code_settings,
        number_of_views: unlockedInfo?.number_of_views,
        deadline_date: unlockedInfo?.deadline_date
      });
      setVideoPopupOpen(true);
      videoStartTimeRef.current = Date.now();
      r2CompletedRef.current = false;
    } else {
      // Video is locked - require VHC
      setPendingVideo({ session, videoId, videoIndex, videoType });
      setVhcPopupOpen(true);
      setVhc('');
      setVhcError('');
    }
  };

  // Handle VHC submission
  const handleVHCSubmit = async () => {
    if (!vhc || vhc.length !== 9) {
      setVhcError('❌ VHC code must be 9 characters');
      return;
    }

    if (!pendingVideo) {
      setVhcError('❌ No video pending');
      return;
    }

    setIsCheckingVhc(true);
    setVhcError('');

    try {
      const sessionId = typeof pendingVideo.session._id === 'string' 
        ? pendingVideo.session._id 
        : pendingVideo.session._id.toString();

      const response = await apiClient.post('/api/vhc/check', {
        VHC: vhc,
        session_id: sessionId,
        lesson: pendingVideo.session.lesson || ''
      });

      if (response.data.valid) {
        // VHC is valid - unlock video
        const sessionId = typeof pendingVideo.session._id === 'string' 
          ? pendingVideo.session._id 
          : pendingVideo.session._id.toString();
        
        // Store unlocked session info
        const newUnlocked = new Map(unlockedSessions);
        newUnlocked.set(sessionId, {
          vhc_id: response.data.vhc_id,
          code_settings: response.data.code_settings || 'number_of_views',
          number_of_views: response.data.number_of_views || null,
          deadline_date: response.data.deadline_date || null
        });
        setUnlockedSessions(newUnlocked);
        
        setVhcPopupOpen(false);
        setSelectedVideo({ 
          ...pendingVideo.session, 
          video_ID: pendingVideo.videoId, 
          video_type: pendingVideo.videoType,
          vhc_id: response.data.vhc_id,
          code_settings: response.data.code_settings || 'number_of_views',
          number_of_views: response.data.number_of_views || null,
          deadline_date: response.data.deadline_date || null
        });
        setVideoPopupOpen(true);
        videoStartTimeRef.current = Date.now();
        r2CompletedRef.current = false;
        setPendingVideo(null);
        setVhc('');
      } else {
        setVhcError(response.data.error || '❌ Invalid VHC code');
      }
    } catch (err) {
      setVhcError(err.response?.data?.error || '❌ Failed to verify VHC code');
    } finally {
      setIsCheckingVhc(false);
    }
  };

  // Close VHC popup
  const closeVhcPopup = () => {
    setVhcPopupOpen(false);
    setPendingVideo(null);
    setVhc('');
    setVhcError('');
  };

  // Close video popup and mark view_homework_video
  const closeVideoPopup = async () => {
    // Prevent multiple calls
    if (isClosingVideoRef.current) {
      return;
    }
    
    // YouTube: at least 5 seconds; R2: >= 90% (completion callback)
    const minWatchTime = 5000; // 5 seconds in milliseconds
    const watchTime = videoStartTimeRef.current ? Date.now() - videoStartTimeRef.current : 0;
    
    // Close popup immediately (UI feedback)
    const currentVideo = selectedVideo;
    const isR2Video = currentVideo?.video_type === 'r2';
    const r2Completed = r2CompletedRef.current;
    setVideoPopupOpen(false);
    setSelectedVideo(null);
    videoStartTimeRef.current = null;
    r2CompletedRef.current = false;
    
    const videoWasWatched = isR2Video ? r2Completed : (watchTime >= minWatchTime);
    
    // Call watch-homework-video API to set view_homework_video=true and mark attendance
    if (currentVideo && profile?.id && currentVideo._id && videoWasWatched) {
      isClosingVideoRef.current = true;
      try {
        // Convert _id to string if it's an ObjectId
        const sessionId = typeof currentVideo._id === 'string' 
          ? currentVideo._id 
          : currentVideo._id.toString();
        
        await apiClient.post(`/api/students/${profile.id}/watch-homework-video`, {
          session_id: sessionId,
          action: 'finish',
          payment_state: currentVideo.payment_state, // Pass payment state to API
          lesson: currentVideo.lesson // Pass lesson name to mark attendance
        });
      } catch (err) {
        console.error('Failed to mark homework video as finished:', err);
      } finally {
        isClosingVideoRef.current = false;
      }
    }
  };


  return (
    <div className="page-wrapper" style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div className="page-content" style={{ maxWidth: 800, margin: "40px auto", padding: "12px" }}>
        <Title backText="Back" href="/student_dashboard">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/play-pause.svg" alt="Play Pause" width={32} height={32} />
            Homeworks Videos
          </div>
        </Title>

        {/* Search Bar */}
        <div className="search-bar-container" style={{ marginBottom: 20, width: '100%' }}>
          <InputWithButton
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyPress}
            onButtonClick={handleSearch}
          />
        </div>

        {/* Filters */}
        {sessions.length > 0 && (
          <div className="filters-container" style={{
            background: 'white',
            borderRadius: 16,
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            marginBottom: 24,
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div className="filter-row" style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap'
            }}>
              <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
                <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#495057', fontSize: '0.95rem' }}>
                  Filter by Lesson
                </label>
                <StudentLessonSelect
                  availableLessons={availableLessons}
                  selectedLesson={filterLesson}
                  onLessonChange={(lesson) => {
                    setFilterLesson(lesson);
                  }}
                  isOpen={filterLessonDropdownOpen}
                  onToggle={() => {
                    setFilterLessonDropdownOpen(!filterLessonDropdownOpen);
                  }}
                  onClose={() => setFilterLessonDropdownOpen(false)}
                  placeholder="Select Lesson"
                />
              </div>
            </div>
          </div>
        )}

        {/* White Background Container */}
        <div className="sessions-container" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>

          {/* Sessions List */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>Loading sessions...</div>
          ) : filteredSessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
              {sessions.length === 0 ? 'No sessions available.' : 'No sessions match your filters.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredSessions.map((session, index) => {
                const sessionId = session._id?.toString() || `${session.name}-${session.lesson}-${index}`;
                const isExpanded = expandedSessions.has(sessionId);
                return (
                <div
                  key={sessionId}
                  style={{
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); toggleSession(sessionId); }}>
                      <div style={{ fontWeight: '600', fontSize: '1.1rem', color: '#333', marginBottom: '4px' }}>
                        {[session.lesson, session.name].filter(Boolean).join(' • ')}
                      </div>
                      {session.description && (
                        <div style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '4px' }}>
                          {session.description}
                        </div>
                      )}
                      <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '8px' }}>
                        {session.date}
                      </div>
                    </div>
                    <div 
                      onClick={(e) => { e.stopPropagation(); toggleSession(sessionId); }}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        color: '#1FA8DC',
                        cursor: 'pointer',
                        marginLeft: '8px'
                      }}
                    >
                      {isExpanded ? (
                        <Image src="/chevron-down.svg" alt="Collapse" width={20} height={20} />
                      ) : (
                        <Image src="/chevron-right.svg" alt="Expand" width={20} height={20} />
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
                      {/* Get all video IDs from session */}
                      {(() => {
                        const videoIds = [];
                        let videoIndex = 1;
                        while (session[`video_ID_${videoIndex}`]) {
                          videoIds.push({
                            id: session[`video_ID_${videoIndex}`],
                            index: videoIndex,
                            name: session[`video_name_${videoIndex}`] || null
                          });
                          videoIndex++;
                        }
                        return videoIds.map((video, vidIndex) => {
                          // All videos are YouTube now
                          const videoType = 'youtube';
                          // Get video name, default to "Video {index}" if not set
                          const videoName = video.name || `Video ${video.index}`;
                          const isUnlocked = isVideoUnlocked(session);
                          return (
                            <div key={vidIndex} style={{ marginBottom: vidIndex < videoIds.length - 1 ? '12px' : '0' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                <div
                                  onClick={() => openVideoPopup(session, video.id, video.index)}
                                  style={{
                                    flex: 1,
                                    padding: '10px 15px',
                                    backgroundColor: isUnlocked ? '#28a745' : '#6c757d',
                                    color: 'white',
                                    borderRadius: '6px',
                                    textAlign: 'center',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = isUnlocked ? '#218838' : '#5a6268';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = isUnlocked ? '#28a745' : '#6c757d';
                                  }}
                                >
                                  <Image 
                                    src={isUnlocked ? "/unlock.svg" : "/lock.svg"} 
                                    alt={isUnlocked ? "Unlocked" : "Locked"} 
                                    width={20} 
                                    height={20} 
                                    style={{ display: 'inline-block' }} 
                                  />
                                  {videoName}
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}

          {/* Help Text */}
          <NeedHelp style={{ padding: "20px", borderTop: "1px solid #e9ecef" }} />
        </div>

        {/* VHC Popup */}
        {vhcPopupOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: '20px'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeVhcPopup();
              }
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                borderRadius: '20px',
                padding: '40px',
                maxWidth: '450px',
                width: '100%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.2)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ 
                margin: '0 0 12px 0', 
                fontSize: '1.75rem', 
                color: '#212529',
                fontWeight: '700',
                textAlign: 'center',
                letterSpacing: '-0.5px'
              }}>
                Enter VHC Code
              </h2>
              <p style={{ 
                margin: '0 0 28px 0', 
                color: '#6c757d', 
                fontSize: '1rem',
                textAlign: 'center',
                lineHeight: '1.5'
              }}>
                This video requires a VHC code. Please enter your 9-character code below.
              </p>
              <input
                type="text"
                value={vhc}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 9);
                  setVhc(value);
                  setVhcError('');
                }}
                placeholder="Enter VHC Code"
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '1.3rem',
                  textAlign: 'center',
                  letterSpacing: '6px',
                  border: vhcError ? '3px solid #dc3545' : '2px solid #dee2e6',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  fontFamily: 'monospace',
                  fontWeight: '600',
                  backgroundColor: '#ffffff',
                  transition: 'all 0.3s ease',
                  boxShadow: vhcError ? '0 0 0 4px rgba(220, 53, 69, 0.1)' : '0 2px 8px rgba(0,0,0,0.08)',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.border = '3px solid #1FA8DC';
                  e.target.style.boxShadow = '0 0 0 4px rgba(31, 168, 220, 0.15)';
                }}
                onBlur={(e) => {
                  if (!vhcError) {
                    e.target.style.border = '2px solid #dee2e6';
                    e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleVHCSubmit();
                  }
                }}
                autoFocus
              />
              {vhcError && (
                <div style={{ 
                  color: '#dc3545', 
                  fontSize: '0.95rem', 
                  marginBottom: '20px', 
                  textAlign: 'center',
                  fontWeight: '500',
                  padding: '8px',
                  backgroundColor: '#fff5f5',
                  borderRadius: '8px',
                  border: '1px solid #fecaca'
                }}>
                  {vhcError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', flexDirection: 'row-reverse' }}>
                <button
                  onClick={closeVhcPopup}
                  style={{
                    flex: 1,
                    padding: '14px 20px',
                    border: 'none',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 16px rgba(220, 53, 69, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.3)';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleVHCSubmit}
                  disabled={isCheckingVhc || !vhc || vhc.length !== 9}
                  style={{
                    flex: 1,
                    padding: '14px 20px',
                    border: 'none',
                    borderRadius: '10px',
                    background: isCheckingVhc || !vhc || vhc.length !== 9 
                      ? 'linear-gradient(135deg, #ccc 0%, #bbb 100%)' 
                      : 'linear-gradient(135deg, #28a745 0%, #218838 100%)',
                    color: 'white',
                    cursor: isCheckingVhc || !vhc || vhc.length !== 9 ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    transition: 'all 0.3s ease',
                    boxShadow: isCheckingVhc || !vhc || vhc.length !== 9 
                      ? 'none' 
                      : '0 4px 12px rgba(40, 167, 69, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isCheckingVhc && vhc && vhc.length === 9) {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 6px 16px rgba(40, 167, 69, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCheckingVhc && vhc && vhc.length === 9) {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.3)';
                    }
                  }}
                >
                  {isCheckingVhc ? 'Verifying...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Video Player Popup */}
        {videoPopupOpen && selectedVideo && (
          <div
            className="video-popup-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: '20px'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeVideoPopup();
              }
            }}
          >
            <div
              ref={videoContainerRef}
              className="video-player-container"
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '900px',
                backgroundColor: '#000',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                WebkitTouchCallout: 'none',
                WebkitTapHighlightColor: 'transparent'
              }}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
              onSelectStart={(e) => e.preventDefault()}
            >
              {/* Close Button */}
              <button
                onClick={closeVideoPopup}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  zIndex: 10,
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  fontSize: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  lineHeight: '1',
                  fontWeight: 'bold'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                }}
              >
                <Image src="/close-cross.svg" alt="Close" width={35} height={35} />
              </button>

              {/* Video Title */}
              <div style={{
                padding: '16px',
                backgroundColor: '#1a1a1a',
                color: 'white',
                borderBottom: '1px solid #333'
              }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{selectedVideo.name}</h3>
              </div>

              {/* Video Iframe */}
              <div 
                className="video-player-wrapper"
                style={{ 
                  position: 'relative', 
                  width: '100%',
                  height: 'auto',
                  maxHeight: '100vh',
                  overflow: 'hidden',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none',
                  pointerEvents: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
                onSelectStart={(e) => e.preventDefault()}
              >
                {selectedVideo.video_type === 'r2' ? (
                  <R2VideoPlayer
                    r2Key={selectedVideo.video_ID}
                    videoId={selectedVideo._id}
                    watermarkText={`${profile?.id || 'unknown'}`}
                    onComplete={handleR2VideoCompleteHomework}
                    onMilestonePercent={
                      selectedVideo.code_settings === 'number_of_views' && selectedVideo.vhc_id
                        ? tryDecrementVhcViewsOnWatchProgress
                        : undefined
                    }
                  />
                ) : selectedVideo.code_settings === 'number_of_views' && selectedVideo.vhc_id ? (
                  <YoutubeEmbedWithProgress
                    youtubeVideoId={selectedVideo.video_ID || selectedVideo.video_ID_1 || ''}
                    onThresholdReached={tryDecrementVhcViewsOnWatchProgress}
                  />
                ) : (
                  <iframe
                    src={buildEmbedUrl(selectedVideo.video_ID || selectedVideo.video_ID_1 || '')}
                    frameBorder="0"
                    allow="encrypted-media; autoplay; fullscreen; picture-in-picture"
                    allowFullScreen={true}
                    playsInline={true}
                    style={{
                      width: '100%',
                      height: 'auto',
                      maxHeight: '100vh',
                      aspectRatio: '16 / 9',
                      border: 'none',
                      outline: 'none'
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    onDragStart={(e) => e.preventDefault()}
                    onSelectStart={(e) => e.preventDefault()}
                    draggable={false}
                  />
                )}
              </div>

              {/* Video Description */}
              {selectedVideo.description && (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#1a1a1a',
                  color: '#ccc',
                  fontSize: '0.9rem',
                  lineHeight: '1.5'
                }}>
                  {selectedVideo.description}
                </div>
              )}
            </div>
          </div>
        )}

        <style jsx>{`
          .sessions-container {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            overflow-x: auto;
          }
          
          .video-player-wrapper {
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
            -webkit-touch-callout: none !important;
            -webkit-tap-highlight-color: transparent !important;
            pointer-events: auto;
          }
          
          .video-player-wrapper iframe {
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
          }
          
          .video-player-container {
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
            -webkit-touch-callout: none !important;
            -webkit-tap-highlight-color: transparent !important;
          }
          
          .video-player-container * {
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
            -webkit-touch-callout: none !important;
          }
          
          @media print {
            .video-player-container,
            .video-player-wrapper {
              display: none !important;
            }
          }
          
          @media (max-width: 768px) {
            .page-wrapper {
              padding: 10px 5px 10px 5px !important;
            }
            
            .page-content {
              margin: 20px auto !important;
            }
            
            .sessions-container {
              padding: 16px;
            }
            
            
            .video-popup-overlay {
              padding: 10px !important;
            }
            
            .video-player-container {
              max-width: 100% !important;
              border-radius: 8px !important;
            }
            
            .video-player-container h3 {
              font-size: 1rem !important;
              padding: 12px !important;
            }
            
            .video-player-container button {
              width: 32px !important;
              height: 32px !important;
              font-size: 18px !important;
              top: 8px !important;
              right: 8px !important;
            }
          }
          
          @media (max-width: 480px) {
            .page-wrapper {
              padding: 5px !important;
            }
            
            .page-content {
              margin: 10px auto !important;
            }
            
            .sessions-container {
              padding: 12px;
              border-radius: 12px !important;
            }
            
            
            .video-popup-overlay {
              padding: 5px !important;
            }
            
            .video-player-container {
              border-radius: 0 !important;
            }
            
            .video-player-container h3 {
              font-size: 0.9rem !important;
              padding: 10px !important;
            }
            
            .video-player-container button {
              width: 28px !important;
              height: 28px !important;
              font-size: 16px !important;
              top: 5px !important;
              right: 5px !important;
            }
          }
          
        `}</style>
      </div>
    </div>
  );
}

