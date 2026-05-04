import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import dynamic from 'next/dynamic';
import Title from '../../../components/Title';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../lib/axios';
import { useProfile } from '../../../lib/api/auth';
import { useSystemConfig } from '../../../lib/api/system';
import NeedHelp from '../../../components/NeedHelp';
import MockExamPerformanceChart from '../../../components/MockExamPerformanceChart';
const PdfViewerModal = dynamic(() => import('../../../components/PdfViewerModal'), { ssr: false });
import MockExamSelect from '../../../components/MockExamSelect';
import { TextInput, ActionIcon, useMantineTheme } from '@mantine/core';
import { IconSearch, IconArrowRight } from '@tabler/icons-react';
import { clientItemVisibleByCenter } from '../../../lib/studentCenterMatch';
import { formatDeadlineCardLabel, isDeadlinePassedEgypt } from '../../../lib/deadlineTimeEgypt';

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

export default function MyMockExams() {
  const { data: systemConfig } = useSystemConfig();
  const isScoringEnabled = systemConfig?.scoring_system === true || systemConfig?.scoring_system === 'true';
  const isMockExamsEnabled = systemConfig?.mock_exams === true || systemConfig?.mock_exams === 'true';
  
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Redirect if feature is disabled
  useEffect(() => {
    if (systemConfig && !isMockExamsEnabled) {
      router.push('/student_dashboard');
    }
  }, [systemConfig, isMockExamsEnabled, router]);
  
  // Don't render if feature is disabled
  if (systemConfig && !isMockExamsEnabled) {
    return null;
  }
  const { data: profile } = useProfile();
  const [completedMockExams, setCompletedMockExams] = useState(new Set());
  const [errorMessage, setErrorMessage] = useState('');
  const [onlineMockExams, setOnlineMockExams] = useState([]);
  const [pdfViewer, setPdfViewer] = useState({ isOpen: false, url: '', name: '' });
  const [, setDeadlineClockTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setDeadlineClockTick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);

  // Check for error message in URL query
  useEffect(() => {
    if (router.query.error) {
      setErrorMessage(router.query.error);
      // Clear error from URL
      router.replace('/student_dashboard/my_mock_exams', undefined, { shallow: true });
    }
  }, [router.query.error]);

  // Fetch mock exams
  const { data: mockExamsData, isLoading } = useQuery({
    queryKey: ['online-mock-exams-student'],
    queryFn: async () => {
      const response = await apiClient.get('/api/online_mock_exams/student');
      return response.data;
    },
    // No auto refetch interval here; fetch on mount/reconnect only (no window focus to prevent auto-refresh)
    refetchOnWindowFocus: false, // Disabled to prevent auto-refresh on window focus
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const mockExams = mockExamsData?.mockExams || [];

  const centerFilteredMockExams = useMemo(
    () =>
      mockExams
        .filter((mockExam) => (mockExam.state || mockExam.account_state || 'Activated') !== 'Deactivated')
        .filter((me) => clientItemVisibleByCenter(me.center, profile?.main_center)),
    [mockExams, profile?.main_center]
  );

  // Search and filter states
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMockExam, setFilterMockExam] = useState('');
  const [notePopup, setNotePopup] = useState(null);

  // Get available mock exam options from mock exams
  // The mock exams are already filtered by course/courseType from the API
  // Just extract unique lesson names to show in the filter dropdown
  const getAvailableLessons = () => {
    const lessonSet = new Set();
    centerFilteredMockExams.forEach(mockExam => {
      if (mockExam.lesson && mockExam.lesson.trim()) {
        lessonSet.add(mockExam.lesson);
      }
    });
    // Sort by exam number (Exam 1, Exam 2, ..., Exam 50)
    return Array.from(lessonSet).sort((a, b) => {
      const numA = parseInt((a.match(/\d+/) || [0])[0], 10);
      const numB = parseInt((b.match(/\d+/) || [0])[0], 10);
      if (numA && numB) return numA - numB;
      return a.localeCompare(b);
    });
  };

  const availableLessons = getAvailableLessons();

  // Filter mock exams based on search and filters
  const filteredMockExams = centerFilteredMockExams.filter(mockExam => {
    // Search filter (by lesson name - case-insensitive)
    if (searchTerm.trim()) {
      const lessonName = mockExam.lesson_name || '';
      if (!lessonName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
    }

    // Mock Exam filter
    if (filterMockExam) {
      if (mockExam.lesson !== filterMockExam) {
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

  // Fetch mock exam performance chart data - always fetch even if no mock exams
  const { data: performanceData, isLoading: isChartLoading, refetch: refetchChart } = useQuery({
    queryKey: ['mock-exam-performance', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return { chartData: [] };
      try {
        const response = await apiClient.get(`/api/students/${profile.id}/mock-exam-performance`);
        return response.data || { chartData: [] };
      } catch (error) {
        console.error('Error fetching mock exam performance:', error);
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

  // Only show chart lessons that have at least one Activated mock exam
  const activeMockExamLessons = new Set(
    centerFilteredMockExams
      .filter(exam => exam.lesson)
      .map(exam => exam.lesson)
  );

  const filteredChartData = Array.isArray(chartData)
    ? chartData.filter(item => {
        const label = (item.lesson_name || item.lesson || '').toString().toLowerCase();
        if (!label) return false;
        if (activeMockExamLessons.size === 0) return true;
        return Array.from(activeMockExamLessons).some(lesson =>
          label.includes(String(lesson).toLowerCase()) || String(lesson).toLowerCase().includes(label)
        );
      })
    : [];

  // Refetch chart data when returning to this page
  useEffect(() => {
    const handleRouteChange = () => {
      // Invalidate and refetch chart data when route changes
      if (profile?.id) {
        queryClient.invalidateQueries({ queryKey: ['mock-exam-performance', profile.id] });
        queryClient.invalidateQueries({ queryKey: ['online-mock-exams-student'] });
        fetchStudentData(); // Refetch student data to update completion status
      }
    };

    const handleVisibilityChange = () => {
      // Refetch when page becomes visible
      if (document.visibilityState === 'visible' && profile?.id) {
        refetchChart();
        queryClient.invalidateQueries({ queryKey: ['online-mock-exams-student'] });
        fetchStudentData(); // Refetch student data to update completion status
      }
    };

    // Refetch when component mounts (user returns to page)
    if (profile?.id) {
      queryClient.invalidateQueries({ queryKey: ['mock-exam-performance', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['online-mock-exams-student'] });
      fetchStudentData(); // Refetch student data to update completion status
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

  // Fetch student's data and online_mock_exams to check completion
  const fetchStudentData = async () => {
    if (!profile?.id) return;
    try {
      const response = await apiClient.get(`/api/students/${profile.id}`);
      if (response.data) {
        if (Array.isArray(response.data.online_mock_exams)) {
          setOnlineMockExams(response.data.online_mock_exams);
        }
      }
    } catch (err) {
      console.error('Error fetching student data:', err);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [profile?.id]);

  // Check which mock exams exist in online_mock_exams array
  useEffect(() => {
    if (!profile?.id || centerFilteredMockExams.length === 0 || !Array.isArray(onlineMockExams)) return;

    const checkCompletions = () => {
      const completed = new Set();
      for (const mockExam of centerFilteredMockExams) {
        // Check if mock exam exists in online_mock_exams array
        const exists = onlineMockExams.some(ome => {
          const meId = ome.mock_exam_id?.toString();
          const targetId = mockExam._id?.toString();
          return meId === targetId;
        });
        if (exists) {
          completed.add(mockExam._id);
        }
      }
      setCompletedMockExams(completed);
    };

    checkCompletions();
  }, [profile?.id, centerFilteredMockExams, onlineMockExams]);

  // Helper function to get mock exam result for a given mock_exam_id
  const getMockExamResult = (mockExamId = null) => {
    if (mockExamId && Array.isArray(onlineMockExams)) {
      const mockExamResult = onlineMockExams.find(me => {
        const meId = me.mock_exam_id?.toString();
        const targetId = mockExamId.toString();
        return meId === targetId;
      });
      
      if (mockExamResult?.result) {
        return mockExamResult.result; // Format: "1 / 1" or "8 / 10"
      }
    }
    
    return null;
  };

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px"
      }}>
        <div style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
          <Title backText="Back" href="/student_dashboard">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Image src="/exam.svg" alt="Mock Exams" width={32} height={32} />
              My Mock Exams
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
          <div className="mock-exams-container" style={{
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
            <p style={{ color: "#6c757d", fontSize: "1rem" }}>Loading mock exams...</p>
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
            <Image src="/exam.svg" alt="Mock Exams" width={32} height={32} />
            My Mock Exams
          </div>
        </Title>

        {/* Mock Exam Performance Chart - Outside container, under Title */}
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
            Mock Exam Performance by Lesson
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
            <MockExamPerformanceChart chartData={filteredChartData} height={400} />
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
        {centerFilteredMockExams.length > 0 && (
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
                  Filter by Mock Exam
                </label>
                <MockExamSelect
                  selectedMockExam={filterMockExam}
                  onSelectMockExam={(exam) => {
                    setFilterMockExam(exam);
                  }}
                  placeholder="Select Mock Exam"
                  options={availableLessons}
                />
              </div>
            </div>
          </div>
        )}

        {/* White Background Container */}
        <div className="mock-exams-container" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          {/* Mock Exams List */}
          {filteredMockExams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
              {centerFilteredMockExams.length === 0 ? '❌ No mock exams available.' : '❌ No mock exams match your filters.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredMockExams.map((mockExam) => (
                <div
                  key={mockExam._id}
                  className="mock-exam-item"
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
                      {[mockExam.lesson, mockExam.lesson_name].filter(Boolean).join(' • ')}
                    </div>
                    {mockExam.mock_exam_type === 'pdf' ? (
                      <div style={{ padding: '12px 16px', backgroundColor: '#ffffff', border: '2px solid #e9ecef', borderRadius: '8px', fontSize: '0.95rem', color: '#495057', textAlign: 'left', display: 'inline-block', maxWidth: '350px' }}>
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                          {`File Name : ${mockExam.pdf_file_name || 'file'}.pdf`}
                        </div>
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
                        <span>{mockExam.questions?.length || 0} Question{(mockExam.questions?.length || 0) !== 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Image src="/clock.svg" alt="Timer" width={18} height={18} />
                          {mockExam.timer ? `Timer ${mockExam.timer} minute${mockExam.timer !== 1 ? 's' : ''}` : 'No Timer'}
                        </span>
                        {mockExam.deadline_type === 'with_deadline' && mockExam.deadline_date && (
                          <>
                            <span>•</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Image src="/clock.svg" alt="Deadline" width={18} height={18} />
                              {formatDeadlineCardLabel(mockExam.deadline_date, mockExam.deadline_time)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    )}
                  </div>
                  <div className="mock-exam-buttons" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {mockExam.mock_exam_type === 'pdf' && mockExam.pdf_url && (
                      <button onClick={(e) => { e.stopPropagation(); fetch(mockExam.pdf_url).then(r => r.blob()).then(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${mockExam.pdf_file_name || 'file'}.pdf`; a.click(); URL.revokeObjectURL(a.href); }); }} className="me-action-btn"
                        style={{ padding: '8px 16px', backgroundColor: '#32b750', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Image src="/pdf.svg" alt="PDF" width={18} height={18} style={{ display: 'inline-block' }} />
                        Download PDF
                      </button>
                    )}
                    {mockExam.mock_exam_type === 'pdf' && mockExam.pdf_url && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPdfViewer({ isOpen: true, url: mockExam.pdf_url, name: `${mockExam.pdf_file_name || 'file'}.pdf` });
                        }}
                        className="me-action-btn"
                        style={{ padding: '8px 16px', backgroundColor: '#0d6efd', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <Image src="/external-link.svg" alt="Open PDF" width={18} height={18} style={{ display: 'inline-block' }} />
                        Open PDF
                      </button>
                    )}
                    {mockExam.comment && (
                      <button onClick={(e) => { e.stopPropagation(); setNotePopup(mockExam.comment); }} className="me-action-btn"
                        style={{ padding: '8px 16px', backgroundColor: '#1FA8DC', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Image src="/notes4.svg" alt="Notes" width={18} height={18} style={{ display: 'inline-block' }} />
                        Notes
                      </button>
                    )}
                    {(() => {
                      if (mockExam.mock_exam_type === 'pdf') return null;
                      // If mock exam is completed, show Details and Done buttons
                      if (completedMockExams.has(mockExam._id)) {
                        return (
                          <>
                            {(mockExam.show_details_after_submitting === true || mockExam.show_details_after_submitting === 'true') && (
                              <button
                                onClick={() => router.push(`/student_dashboard/my_mock_exams/details?id=${mockExam._id}`)}
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
                              ✅ Done{getMockExamResult(mockExam._id) ? ` (${getMockExamResult(mockExam._id)})` : ''}
                            </button>
                          </>
                        );
                      }
                      
                      // Check if deadline has passed and mock exam not submitted
                      if (mockExam.deadline_type === 'with_deadline' && 
                          mockExam.deadline_date && 
                          isDeadlinePassedEgypt(mockExam.deadline_date, mockExam.deadline_time)) {
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
                      
                      // Default: show Start button
                      return (
                        <button
                          onClick={() => router.push(`/student_dashboard/my_mock_exams/start?id=${mockExam._id}`)}
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
          .mock-exams-container {
            padding: 16px;
          }
          .mock-exam-item {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px;
          }
          .mock-exam-buttons {
            width: 100%;
            flex-direction: column;
          }
          .mock-exam-buttons button {
            width: 100%;
          }
          .mock-exam-buttons button,
          .mock-exam-buttons a,
          .mock-exam-buttons .me-action-btn {
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
          .mock-exams-container {
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
          .mock-exams-container {
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
      <PdfViewerModal
        isOpen={pdfViewer.isOpen}
        fileUrl={pdfViewer.url}
        fileName={pdfViewer.name}
        onClose={() => setPdfViewer({ isOpen: false, url: '', name: '' })}
      />
    </div>
  );
}
