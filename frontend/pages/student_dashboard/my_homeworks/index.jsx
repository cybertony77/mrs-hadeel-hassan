import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import Title from '../../../components/Title';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../lib/axios';
import { useProfile } from '../../../lib/api/auth';
import { useSystemConfig } from '../../../lib/api/system';
import NeedHelp from '../../../components/NeedHelp';
import HomeworkPerformanceChart from '../../../components/HomeworkPerformanceChart';
import StudentLessonSelect from '../../../components/StudentLessonSelect';
import { TextInput, ActionIcon, useMantineTheme } from '@mantine/core';
import { IconSearch, IconArrowRight } from '@tabler/icons-react';
import { clientItemVisibleByCenter } from '../../../lib/studentCenterMatch';

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

export default function MyHomeworks() {
  const { data: systemConfig } = useSystemConfig();
  const isScoringEnabled = systemConfig?.scoring_system === true || systemConfig?.scoring_system === 'true';
  const isHomeworksEnabled = systemConfig?.homeworks === true || systemConfig?.homeworks === 'true';
  
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Redirect if feature is disabled
  useEffect(() => {
    if (systemConfig && !isHomeworksEnabled) {
      router.push('/student_dashboard');
    }
  }, [systemConfig, isHomeworksEnabled, router]);
  
  // Don't render if feature is disabled
  if (systemConfig && !isHomeworksEnabled) {
    return null;
  }
  const { data: profile } = useProfile();
  const [completedHomeworks, setCompletedHomeworks] = useState(new Set());
  const [errorMessage, setErrorMessage] = useState('');
  const [onlineHomeworks, setOnlineHomeworks] = useState([]);
  const [notePopup, setNotePopup] = useState(null);
  
  // Check for error message in URL query
  useEffect(() => {
    if (router.query.error) {
      setErrorMessage(router.query.error);
      // Clear error from URL
      router.replace('/student_dashboard/my_homeworks', undefined, { shallow: true });
    }
  }, [router.query.error]);

  // Fetch homeworks
  const { data: homeworksData, isLoading } = useQuery({
    queryKey: ['homeworks-student'],
    queryFn: async () => {
      const response = await apiClient.get('/api/homeworks/student');
      return response.data;
    },
    // No auto refetch interval here; fetch on mount/reconnect only (no window focus to prevent auto-refresh)
    refetchOnWindowFocus: false, // Disabled to prevent auto-refresh on window focus
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const homeworks = homeworksData?.homeworks || [];

  const centerFilteredHomeworks = useMemo(
    () =>
      homeworks
        .filter((homework) => (homework.state || homework.account_state || 'Activated') !== 'Deactivated')
        .filter((hw) => clientItemVisibleByCenter(hw.center, profile?.main_center)),
    [homeworks, profile?.main_center]
  );

  // Search and filter states
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLesson, setFilterLesson] = useState('');
  const [filterLessonDropdownOpen, setFilterLessonDropdownOpen] = useState(false);

  // Get available lessons from homeworks (only lessons that exist in homeworks and match student's course/courseType)
  const getAvailableLessons = () => {
    const lessonSet = new Set();
    const studentCourse = (profile?.course || '').trim();
    const studentCourseType = (profile?.courseType || '').trim();
    
    centerFilteredHomeworks.forEach(homework => {
      if (homework.lesson && homework.lesson.trim()) {
        // Check if homework matches student's course and courseType
        const homeworkCourse = (homework.course || '').trim();
        const homeworkCourseType = (homework.courseType || '').trim();
        
        // Course match: if homework course is "All", it matches any student course
        const courseMatch = homeworkCourse.toLowerCase() === 'all' || 
                           homeworkCourse.toLowerCase() === studentCourse.toLowerCase();
        
        // CourseType match: if homework has no courseType, it matches any student courseType
        // If homework has courseType, it must match student's courseType (case-insensitive)
        const courseTypeMatch = !homeworkCourseType || 
                               !studentCourseType ||
                               homeworkCourseType.toLowerCase() === studentCourseType.toLowerCase();
        
        if (courseMatch && courseTypeMatch) {
          lessonSet.add(homework.lesson);
        }
      }
    });
    return Array.from(lessonSet).sort();
  };

  const availableLessons = getAvailableLessons();

  // Filter homeworks based on search and filters
  const filteredHomeworks = centerFilteredHomeworks.filter(homework => {
    // Search filter (by lesson name - case-insensitive)
    if (searchTerm.trim()) {
      const lessonName = homework.lesson_name || '';
      if (!lessonName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
    }

    // Lesson filter
    if (filterLesson) {
      if (homework.lesson !== filterLesson) {
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

  // Fetch homework performance chart data - always fetch even if no homeworks
  const { data: performanceData, isLoading: isChartLoading, refetch: refetchChart } = useQuery({
    queryKey: ['homework-performance', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return { chartData: [] };
      try {
        const response = await apiClient.get(`/api/students/${profile.id}/homework-performance`);
        return response.data || { chartData: [] };
      } catch (error) {
        console.error('Error fetching homework performance:', error);
        return { chartData: [] }; // Return empty array on error
      }
    },
    enabled: !!profile?.id,
    // No auto refetch interval; rely on mount/reconnect + manual invalidation (no window focus to prevent auto-refresh)
    refetchOnWindowFocus: false, // Disabled to prevent auto-refresh on window focus
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: 1, // Retry once on failure
  });

  const chartData = performanceData?.chartData || [];

  // Only show chart lessons that have at least one Activated homework
  const activeLessons = new Set(
    centerFilteredHomeworks
      .map(hw => hw.lesson)
      .filter(Boolean)
  );

  const filteredChartData = Array.isArray(chartData)
    ? chartData.filter(item => {
        const label = (item.lesson_name || item.lesson || '').toString().toLowerCase();
        if (!label) return false;
        if (activeLessons.size === 0) return true;
        return Array.from(activeLessons).some(lesson =>
          label.includes(String(lesson).toLowerCase()) || String(lesson).toLowerCase().includes(label)
        );
      })
    : [];

  // Refetch chart data when returning to this page
  useEffect(() => {
    const handleRouteChange = () => {
      // Invalidate and refetch chart data when route changes
      if (profile?.id) {
        queryClient.invalidateQueries({ queryKey: ['homework-performance', profile.id] });
        queryClient.invalidateQueries({ queryKey: ['homeworks-student'] });
      }
    };

    const handleVisibilityChange = () => {
      // Refetch when page becomes visible
      if (document.visibilityState === 'visible' && profile?.id) {
        refetchChart();
        queryClient.invalidateQueries({ queryKey: ['homeworks-student'] });
      }
    };

    // Refetch when component mounts (user returns to page)
    if (profile?.id) {
      queryClient.invalidateQueries({ queryKey: ['homework-performance', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['homeworks-student'] });
    }

    // Listen for route changes
    router.events.on('routeChangeComplete', handleRouteChange);
    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router, queryClient, profile?.id, refetchChart]);

  // Fetch student's weeks data and online_homeworks to check hwDone and degree
  useEffect(() => {
    if (!profile?.id) return;

    const fetchStudentData = async () => {
      try {
        const response = await apiClient.get(`/api/students/${profile.id}`);
        if (response.data) {
          if (Array.isArray(response.data.online_homeworks)) {
            setOnlineHomeworks(response.data.online_homeworks);
          }
        }
      } catch (err) {
        console.error('Error fetching student data:', err);
      }
    };

    fetchStudentData();
  }, [profile?.id]);

  // Check which homeworks exist in online_homeworks array
  useEffect(() => {
    if (!profile?.id || centerFilteredHomeworks.length === 0 || !Array.isArray(onlineHomeworks)) return;

    const checkCompletions = () => {
      const completed = new Set();
      for (const homework of centerFilteredHomeworks) {
        // Check if homework exists in online_homeworks array
        const exists = onlineHomeworks.some(ohw => {
          const hwId = ohw.homework_id?.toString();
          const targetId = homework._id?.toString();
          return hwId === targetId;
        });
        if (exists) {
          completed.add(homework._id);
        }
      }
      setCompletedHomeworks(completed);
    };

    checkCompletions();
  }, [profile?.id, centerFilteredHomeworks, onlineHomeworks]);

  // Helper function to check if hwDone indicates completion for a given lesson
  // Returns true if hwDone is true, "Not Completed", or "No Homework" (protected values)
  const isHwDone = (lessonName) => {
    if (!lessonName || !profile?.lessons) return false;
    const lessonData = profile.lessons[lessonName];
    if (!lessonData) return false;
    
    // Check for protected values that indicate some status (not just false)
    const protectedValues = [true, "Not Completed", "No Homework"];
    return protectedValues.includes(lessonData.hwDone);
  };

  // Helper function to get hwDone status text for display
  const getHwDoneStatus = (lessonName) => {
    if (!lessonName || !profile?.lessons) return null;
    const lessonData = profile.lessons[lessonName];
    if (!lessonData) return null;
    
    return lessonData.hwDone;
  };

  // Helper function to get hwDegree for a given lesson and homework_id
  const getHwDegree = (lessonName, homeworkId = null) => {
    // First, try to get from lessons object
    if (lessonName && profile?.lessons) {
      const lessonData = profile.lessons[lessonName];
      if (lessonData?.homework_degree) {
        return lessonData.homework_degree;
      }
    }
    
    // If not found in weeks, try online_homeworks
    if (homeworkId && Array.isArray(onlineHomeworks)) {
      const homeworkResult = onlineHomeworks.find(hw => {
        const hwId = hw.homework_id?.toString();
        const targetId = homeworkId.toString();
        return hwId === targetId;
      });
      
      if (homeworkResult?.result) {
        return homeworkResult.result; // Format: "1 / 1" or "8 / 10"
      }
    }
    
    return null;
  };

  // Helper function to check if deadline has passed
  const isDeadlinePassed = (deadlineDate) => {
    if (!deadlineDate) return false;
    
    try {
      // Parse date in local timezone to avoid timezone shift
      let deadline;
      if (typeof deadlineDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(deadlineDate)) {
        // If it's a string in YYYY-MM-DD format, parse it in local timezone
        const [year, month, day] = deadlineDate.split('-').map(Number);
        deadline = new Date(year, month - 1, day);
      } else if (deadlineDate instanceof Date) {
        deadline = new Date(deadlineDate);
      } else {
        deadline = new Date(deadlineDate);
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      deadline.setHours(0, 0, 0, 0);
      
      return deadline <= today; // Deadline passed if deadline <= today
    } catch (e) {
      return false;
    }
  };

  // Track if we've loaded student weeks data at least once
  // Track which homeworks have already had deadline penalties applied (to prevent duplicate scoring)
  const deadlinePenaltiesAppliedRef = useRef(new Set());
  
  /**
   * DEADLINE DB/SCORE LOGIC DISABLED:
   * The effect below was updating lessons in the DB and recalculating scores
   * when deadlines passed. It is now wrapped in a block comment so deadlines
   * only affect the UI, not the database or scoring.
   */
  /*
  // Check deadlines and update student lessons if needed (only for activated homeworks)
  useEffect(() => {
    if (!profile?.id || centerFilteredHomeworks.length === 0) return;
    // Allow the check to proceed even if lessons is undefined - we'll treat it as empty object
    // The API will create the lesson if it doesn't exist

    const checkDeadlines = async () => {
      for (const homework of centerFilteredHomeworks) {
        // Only check if homework has deadline and is not completed
        if (
          homework.deadline_type === 'with_deadline' &&
          homework.deadline_date &&
          !completedHomeworks.has(homework._id) &&
          homework.lesson &&
          homework.lesson.trim()
        ) {
          if (isDeadlinePassed(homework.deadline_date)) {
            const lessonName = homework.lesson.trim();
            // Check current lesson data to see if we need to update
            let lessonData = profile?.lessons?.[lessonName];
            
            // Protected values that should never be overwritten
            const protectedHwDoneValues = [true, "Not Completed", "No Homework"];
            
            // Create unique key for this homework deadline check
            const deadlineKey = `homework_${homework._id}_lesson_${lessonName}`;
            
            // Only update if:
            // 1. We haven't already applied deadline update for this homework (tracked in ref)
            // 2. hwDone is NOT already false (deadline already applied)
            // 3. Protected values (true, "Not Completed", "No Homework") should not be overwritten
            const shouldApplyDeadlineUpdate = !deadlinePenaltiesAppliedRef.current.has(deadlineKey) &&
                                              (!lessonData || 
                                               (!protectedHwDoneValues.includes(lessonData.hwDone) && 
                                                lessonData.hwDone !== false));
            
            if (shouldApplyDeadlineUpdate) {
              // Check ref FIRST to prevent duplicate calls - this is the primary guard
              if (deadlinePenaltiesAppliedRef.current.has(deadlineKey)) {
                console.log(`[DEADLINE] Already processing deadline penalty for homework ${homework._id}, lesson ${lessonName} - skipping`);
                continue;
              }
              
              // Mark as applied IMMEDIATELY to prevent duplicate calls
              deadlinePenaltiesAppliedRef.current.add(deadlineKey);
              
              try {
                console.log(`[DEADLINE] Processing deadline penalty for homework ${homework._id}, lesson ${lessonName}`);
                
                // Ensure lesson exists - if not, create it with default schema BEFORE applying penalty
                if (!lessonData) {
                  try {
                    console.log(`[DEADLINE] Creating lesson "${lessonName}" for student ${profile.id}`);
                    // Create lesson with default schema by calling the API
                    // The API will create the lesson if it doesn't exist
                    await apiClient.post(`/api/students/${profile.id}/hw`, {
                      lesson: lessonName,
                      hwDone: false
                    });
                    // Refresh profile to get the newly created lesson
                    const profileResponse = await apiClient.get('/api/auth/me');
                    if (profileResponse.data && profileResponse.data.lessons) {
                      lessonData = profileResponse.data.lessons[lessonName];
                      // Update profile state to reflect the new lesson
                      queryClient.setQueryData(['profile'], (old) => ({
                        ...old,
                        lessons: profileResponse.data.lessons
                      }));
                    }
                    console.log(`[DEADLINE] Lesson "${lessonName}" created successfully`);
                  } catch (createErr) {
                    console.error(`[DEADLINE] Error creating lesson ${lessonName}:`, createErr);
                    // Remove from ref if creation failed so it can be retried
                    deadlinePenaltiesAppliedRef.current.delete(deadlineKey);
                    continue;
                  }
                }
                
                console.log(`[DEADLINE] Setting hwDone to false for homework ${homework._id}, lesson ${lessonName}`);
                
                // Update hwDone to false (always apply this, regardless of scoring system)
                try {
                  console.log(`[DEADLINE] Calling API to update hwDone for lesson "${lessonName}"`);
                  const updateResponse = await apiClient.post(`/api/students/${profile.id}/hw`, {
                    lesson: lessonName,
                    hwDone: false
                  });
                  console.log(`[DEADLINE] API response:`, updateResponse.data);
                  
                  // Refresh profile after update
                  await queryClient.invalidateQueries(['profile']);
                  console.log(`[DEADLINE] Successfully updated hwDone in database for lesson "${lessonName}"`);
                } catch (updateErr) {
                  console.error(`[DEADLINE] Error updating hwDone for lesson ${lessonName}:`, updateErr);
                  // Remove from ref if update failed so it can be retried
                  deadlinePenaltiesAppliedRef.current.delete(deadlineKey);
                  continue;
                }
                
                // Recalculate score with hwDone: false rule (ONLY if scoring is enabled)
                if (isScoringEnabled) {
                  // Check history to see if deadline penalty was already applied
                  let alreadyApplied = false;
                  try {
                    const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
                      studentId: profile.id,
                      type: 'homework',
                      lesson: lessonName
                    });
                    
                    if (historyResponse.data.found && historyResponse.data.history) {
                      const lastHistory = historyResponse.data.history;
                      // Check if this is a deadline penalty (hwDone: false) for this lesson
                      if (lastHistory.data?.hwDone === false && lastHistory.process_lesson === lessonName) {
                        // Check if it was applied recently (within last 5 minutes) to avoid duplicates
                        const historyTime = new Date(lastHistory.timestamp);
                        const now = new Date();
                        const timeDiff = now - historyTime;
                        if (timeDiff < 300000) { // 5 minutes (reduced from 1 hour to catch rapid duplicates)
                          alreadyApplied = true;
                          console.log(`[DEADLINE] Deadline penalty already applied for homework ${homework._id}, lesson ${lessonName} (${Math.round(timeDiff/1000)}s ago)`);
                        }
                      }
                    }
                  } catch (historyErr) {
                    console.error('Error checking history for deadline penalty:', historyErr);
                  }
                  
                  // Only calculate scoring if not already applied
                  if (!alreadyApplied) {
                    // Get previous homework state from history
                    let previousHwDone = null;
                    try {
                      const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
                        studentId: profile.id,
                        type: 'homework',
                        lesson: lessonName
                      });
                      
                      if (historyResponse.data.found && historyResponse.data.history) {
                        const lastHistory = historyResponse.data.history;
                        if (lastHistory.data?.hwDone !== undefined) {
                          previousHwDone = lastHistory.data.hwDone;
                        }
                      }
                    } catch (historyErr) {
                      console.error('Error getting homework history for deadline:', historyErr);
                    }
                    
                    // Recalculate score with hwDone: false rule
                    try {
                      await apiClient.post('/api/scoring/calculate', {
                        studentId: profile.id,
                        type: 'homework',
                        lesson: lessonName,
                        data: { 
                          hwDone: false,
                          previousHwDone: previousHwDone
                        }
                      });
                      console.log(`[DEADLINE] Score recalculated for homework deadline penalty`);
                    } catch (scoreErr) {
                      console.error('Error calculating score for deadline penalty:', scoreErr);
                      // Remove from ref if scoring failed so it can be retried
                      deadlinePenaltiesAppliedRef.current.delete(deadlineKey);
                    }
                  } else {
                    console.log(`[DEADLINE] Skipping scoring calculation - already applied recently`);
                  }
                } else {
                  console.log(`[DEADLINE] Scoring system is disabled - skipping score calculation`);
                }
                
                // Refetch student data to update state
                queryClient.invalidateQueries(['profile']);
              } catch (err) {
                console.error('Error updating student lessons:', err);
                // Remove from ref if update failed so it can be retried
                deadlinePenaltiesAppliedRef.current.delete(deadlineKey);
              }
            }
          }
        }
      }
    };

    checkDeadlines();
  }, [profile?.id, profile?.lessons, homeworks, completedHomeworks, isScoringEnabled, queryClient]); // Updated deps for lessons
  */

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px"
      }}>
        <div style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
          <Title backText="Back" href="/student_dashboard">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Image src="/books.svg" alt="Books" width={32} height={32} />
              My Homeworks
            </div>
          </Title>
          
          {/* Error Message */}
          {errorMessage && (
            <div style={{
              background: '#f8d7da',
              color: '#721c24',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #f5c6cb',
              textAlign: 'center',
              fontWeight: '500'
            }}>
              {errorMessage}
            </div>
          )}
          
          {/* White Background Container */}
          <div className="homeworks-container" style={{
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
            <p style={{ color: "#6c757d", fontSize: "1rem" }}>Loading homeworks...</p>
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

  return (
    <div className="page-wrapper" style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div className="page-content" style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
        <Title backText="Back" href="/student_dashboard">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/books.svg" alt="Books" width={32} height={32} />
            My Homeworks
          </div>
        </Title>

        {/* Homework Performance Chart - Outside container, under Title */}
        <div style={{
          marginBottom: '24px',
          padding: '24px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            margin: '0 0 20px 0',
            fontSize: '1.3rem',
            fontWeight: '700',
            color: '#212529'
          }}>
            Homework Performance by Lesson
          </h2>
          {isChartLoading ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#6c757d',
              fontSize: '1.1rem',
              fontWeight: '500'
            }}>
              Loading chart data...
            </div>
          ) : (
            <HomeworkPerformanceChart chartData={filteredChartData} height={400} />
          )}
        </div>

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
        {centerFilteredHomeworks.length > 0 && (
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
        <div className="homeworks-container" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          {/* Homeworks List */}
          {filteredHomeworks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
              {centerFilteredHomeworks.length === 0 ? '❌ No homeworks available.' : '❌ No homeworks match your filters.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredHomeworks.map((homework) => (
                <div
                  key={homework._id}
                  className="homework-item"
                  style={{
                    border: '2px solid #e9ecef',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#1FA8DC';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(31, 168, 220, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e9ecef';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '8px' }}>
                      {[homework.lesson, homework.lesson_name].filter(Boolean).join(' • ')}
                    </div>
                    {homework.homework_type === 'pdf' ? (
                      <div style={{ padding: '12px 16px', backgroundColor: '#ffffff', border: '2px solid #e9ecef', borderRadius: '8px', fontSize: '0.95rem', color: '#495057', textAlign: 'left', display: 'inline-block', maxWidth: '350px' }}>
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                          {`File Name : ${homework.pdf_file_name || 'file'}.pdf`}
                        </div>
                      </div>
                    ) : homework.homework_type === 'pages_from_book' ? (
                      <div style={{
                        padding: '12px 16px',
                        backgroundColor: '#ffffff',
                        border: '2px solid #e9ecef',
                        borderRadius: '8px',
                        fontSize: '0.95rem',
                        color: '#495057',
                        textAlign: 'left',
                        display: 'inline-block',
                        maxWidth: '350px'
                      }}>
                        <strong>From page {homework.from_page} to page {homework.to_page} in {homework.book_name}</strong>
                      </div>
                    ) : (
                      <div style={{
                        padding: '12px 16px',
                        backgroundColor: '#ffffff',
                        border: '2px solid #e9ecef',
                        borderRadius: '8px',
                        fontSize: '0.95rem',
                        color: '#495057',
                        textAlign: 'left',
                        display: 'inline-block',
                        maxWidth: '350px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span>{homework.questions?.length || 0} Question{homework.questions?.length !== 1 ? 's' : ''}</span>
                          <span>•</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Image src="/clock.svg" alt="Timer" width={18} height={18} />
                            {homework.timer ? `Timer ${homework.timer} minute${homework.timer !== 1 ? 's' : ''}` : 'No Timer'}
                          </span>
                          {homework.deadline_type === 'with_deadline' && homework.deadline_date && (
                            <>
                              <span>•</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Image src="/clock.svg" alt="Deadline" width={18} height={18} />
                                {homework.deadline_date ? (() => {
                                  try {
                                    // Parse date in local timezone
                                    let deadline;
                                    if (typeof homework.deadline_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(homework.deadline_date)) {
                                      const [year, month, day] = homework.deadline_date.split('-').map(Number);
                                      deadline = new Date(year, month - 1, day);
                                    } else {
                                      deadline = new Date(homework.deadline_date);
                                    }
                                    return `With deadline date : ${deadline.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}`;
                                  } catch (e) {
                                    return `With deadline date : ${homework.deadline_date}`;
                                  }
                                })() : 'With no deadline date'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="homework-buttons" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {homework.homework_type === 'pdf' && homework.pdf_url && (
                      <button onClick={(e) => { e.stopPropagation(); fetch(homework.pdf_url).then(r => r.blob()).then(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${homework.pdf_file_name || 'file'}.pdf`; a.click(); URL.revokeObjectURL(a.href); }); }} className="hw-action-btn"
                        style={{ padding: '8px 16px', backgroundColor: '#32b750', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Image src="/pdf.svg" alt="PDF" width={18} height={18} style={{ display: 'inline-block' }} />
                        Download PDF
                      </button>
                    )}
                    {homework.comment && (
                      <button onClick={(e) => { e.stopPropagation(); setNotePopup(homework.comment); }} className="hw-action-btn"
                        style={{ padding: '8px 16px', backgroundColor: '#1FA8DC', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Image src="/notes4.svg" alt="Notes" width={18} height={18} style={{ display: 'inline-block' }} />
                        Notes
                      </button>
                    )}
                    {(() => {
                      // Get hwDone status from weeks database (for display purposes only)
                      const hwDoneStatus = getHwDoneStatus(homework.lesson);
                      
                      // IMPORTANT: Only hide Start button if homework exists in online_homeworks
                      // Don't hide Start button just because weeks array says hwDone is true
                      // If homework is in online_homeworks, show Details and Done buttons
                      if (completedHomeworks.has(homework._id)) {
                        return (
                          <>
                            {(homework.show_details_after_submitting === true || homework.show_details_after_submitting === 'true') && (
                              <button
                                onClick={() => router.push(`/student_dashboard/my_homeworks/details?id=${homework._id}`)}
                                style={{
                                  padding: '8px 16px',
                                  backgroundColor: '#1FA8DC',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '0.9rem',
                                  fontWeight: '600',
                                  transition: 'all 0.2s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.backgroundColor = '#0d5a7a';
                                  e.target.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.backgroundColor = '#1FA8DC';
                                  e.target.style.transform = 'translateY(0)';
                                }}
                              >
                                <Image src="/details.svg" alt="Details" width={18} height={18} />
                                Details
                              </button>
                            )}
                            <button
                              style={{
                                padding: '8px 16px',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '20px',
                                cursor: 'default',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              ✅ Done{getHwDegree(homework.lesson, homework._id) ? ` (${getHwDegree(homework.lesson, homework._id)})` : ''}
                            </button>
                          </>
                        );
                      }
                      
                      // If hwDone is "Not Completed" or "No Homework", show that status
                      // (but still allow Start button if not in online_homeworks)
                      if (hwDoneStatus === "Not Completed" || hwDoneStatus === "No Homework") {
                        return (
                          <button
                            style={{
                              padding: '8px 16px',
                              backgroundColor: hwDoneStatus === "No Homework" ? '#dc3545' : '#ffc107',
                              color: 'white',
                              border: 'none',
                              borderRadius: '20px',
                              cursor: 'default',
                              fontSize: '0.9rem',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            {hwDoneStatus === "No Homework" ? '🚫 No Homework' : '⚠️ Not Completed'}
                          </button>
                        );
                      }
                      
                      // Check if deadline has passed and homework not submitted
                      if (homework.deadline_type === 'with_deadline' && 
                          homework.deadline_date && 
                          isDeadlinePassed(homework.deadline_date)) {
                        return (
                          <button
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '20px',
                              cursor: 'default',
                              fontSize: '0.9rem',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            ❌ Not Done
                          </button>
                        );
                      }
                      
                      if (homework.homework_type === 'pdf') {
                        return null;
                      }
                      
                      if (homework.homework_type === 'pages_from_book') {
                        // For pages from book, hide state section (no Done/Not Done badge)
                        return null;
                      }
                      
                      // Show Start button for questions type
                      return (
                        <button
                          onClick={() => router.push(`/student_dashboard/my_homeworks/start?id=${homework._id}`)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#218838';
                            e.target.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#28a745';
                            e.target.style.transform = 'translateY(0)';
                          }}
                        >
                          <Image src="/play.svg" alt="Play" width={16} height={16} />
                          Start
                        </button>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Help Text */}
          <NeedHelp style={{ padding: "20px", borderTop: "1px solid #e9ecef" }} />
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .page-wrapper {
            padding: 10px 5px;
          }
          .page-content {
            margin: 20px auto;
            padding: 8px;
          }
          .homeworks-container {
            padding: 16px;
          }
          .homework-item {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px;
          }
          .homework-buttons {
            width: 100%;
            flex-direction: column;
          }
          .homework-buttons button,
          .homework-buttons a,
          .homework-buttons .hw-action-btn {
            width: 100%;
            justify-content: center;
          }
          /* Chart container responsive */
          .page-content > div:first-of-type {
            padding: 16px !important;
            margin-bottom: 16px !important;
          }
          .page-content > div:first-of-type h2 {
            font-size: 1.3rem !important;
            margin-bottom: 16px !important;
          }
        }
        @media (max-width: 480px) {
          .page-wrapper {
            padding: 5px;
          }
          .page-content {
            margin: 10px auto;
            padding: 5px;
          }
          .homeworks-container {
            padding: 12px;
          }
          /* Chart container responsive */
          .page-content > div:first-of-type {
            padding: 12px !important;
            margin-bottom: 12px !important;
          }
          .page-content > div:first-of-type h2 {
            font-size: 1.3rem !important;
            margin-bottom: 12px !important;
          }
        }
        @media (max-width: 360px) {
          .homeworks-container {
            padding: 10px;
          }
          /* Chart container responsive */
          .page-content > div:first-of-type {
            padding: 10px !important;
          }
          .page-content > div:first-of-type h2 {
            font-size: 1.3rem !important;
          }
        }
      `}</style>

      {/* Note Popup */}
      {notePopup && (
        <div onClick={() => setNotePopup(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)', borderRadius: '20px', padding: '0', maxWidth: '500px', width: '100%', position: 'relative', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', overflow: 'hidden', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: 'linear-gradient(135deg, #1FA8DC 0%, #17a2b8 100%)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Image src="/notes4.svg" alt="Notes" width={22} height={22} style={{ filter: 'brightness(0) invert(1)' }} />
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'white', fontWeight: '700' }}>Note</h3>
              </div>
              <button onClick={() => setNotePopup(null)} style={{ background: '#dc3545', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '18px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', padding: 0, lineHeight: 1 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#c82333'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#dc3545'; e.currentTarget.style.transform = 'scale(1)'; }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1.1)'}>✕</button>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              <div style={{ fontSize: '1rem', lineHeight: '1.8', color: '#495057', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{notePopup}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
