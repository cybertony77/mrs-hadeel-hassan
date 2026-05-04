import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Title from '../../../../components/Title';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../../lib/axios';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import CourseSelect from '../../../../components/CourseSelect';
import CourseTypeSelect from '../../../../components/CourseTypeSelect';
import CenterSelect from '../../../../components/CenterSelect';
import MockExamSelect from '../../../../components/MockExamSelect';
import TimerSelect from '../../../../components/TimerSelect';
import AccountStateSelect from '../../../../components/AccountStateSelect';
import { useSystemConfig } from '../../../../lib/api/system';
import { TextInput, ActionIcon, useMantineTheme } from '@mantine/core';
import { IconSearch, IconArrowRight } from '@tabler/icons-react';
import HomeworkAnalyticsChart from '../../../../components/HomeworkAnalyticsChart';
import { formatDeadlineCardLabel } from '../../../../lib/deadlineTimeEgypt';
const PdfViewerModal = dynamic(() => import('../../../../components/PdfViewerModal'), { ssr: false });

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

export default function MockExams() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: systemConfig } = useSystemConfig();
  const isMockExamsEnabled = systemConfig?.mock_exams === true || systemConfig?.mock_exams === 'true';
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [notePopup, setNotePopup] = useState(null);
  const [pdfViewer, setPdfViewer] = useState({ isOpen: false, url: '', name: '' });
  
  // Redirect if feature is disabled
  useEffect(() => {
    if (systemConfig && !isMockExamsEnabled) {
      router.push('/dashboard/manage_online_system');
    }
  }, [systemConfig, isMockExamsEnabled, router]);
  
  // Don't render if feature is disabled
  if (systemConfig && !isMockExamsEnabled) {
    return null;
  }
  const [selectedMockExam, setSelectedMockExam] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const successTimeoutRef = useRef(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [selectedMockExamForAnalytics, setSelectedMockExamForAnalytics] = useState(null);

  // Search and filter states
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterCourseType, setFilterCourseType] = useState('');
  const [filterCenter, setFilterCenter] = useState('');
  const [filterMockExam, setFilterMockExam] = useState('');
  const [filterTimer, setFilterTimer] = useState('');
  const [filterAccountState, setFilterAccountState] = useState('');
  const [filterCourseDropdownOpen, setFilterCourseDropdownOpen] = useState(false);
  const [filterCourseTypeDropdownOpen, setFilterCourseTypeDropdownOpen] = useState(false);
  const [filterCenterDropdownOpen, setFilterCenterDropdownOpen] = useState(false);
  const [filterTimerDropdownOpen, setFilterTimerDropdownOpen] = useState(false);

  // Fetch mock exams
  const { data: mockExamsData, isLoading } = useQuery({
    queryKey: ['online_mock_exams'],
    queryFn: async () => {
      const response = await apiClient.get('/api/online_mock_exams');
      return response.data;
    },
    refetchInterval: 15 * 60 * 1000, // Auto-refresh every 15 minutes
    refetchIntervalInBackground: true, // refetch when tab is not active
    refetchOnWindowFocus: true, // Refetch on window focus
    refetchOnMount: true, // Refetch on mount
    refetchOnReconnect: true, // Refetch on reconnect
  });

  const mockExams = mockExamsData?.mockExams || [];

  // Filter mock exams based on search and filters
  const filteredMockExams = mockExams.filter(mockExam => {
    // Search filter (contains, case-insensitive)
    if (searchTerm.trim()) {
      const lessonName = mockExam.lesson_name || '';
      if (!lessonName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
    }

    // Course filter
    if (filterCourse) {
      if (mockExam.course !== filterCourse) {
        return false;
      }
    }

    // CourseType filter
    if (filterCourseType) {
      const mockExamCourseType = (mockExam.courseType || '').trim();
      const filterCourseTypeTrimmed = filterCourseType.trim();
      if (mockExamCourseType.toLowerCase() !== filterCourseTypeTrimmed.toLowerCase()) {
        return false;
      }
    }

    // Center filter
    if (filterCenter) {
      const meCenter = (mockExam.center || '').trim();
      const filterCenterTrimmed = filterCenter.trim();
      if (meCenter.toLowerCase() !== filterCenterTrimmed.toLowerCase()) {
        return false;
      }
    }

    // Mock Exam filter
    if (filterMockExam) {
      if (mockExam.lesson !== filterMockExam) {
        return false;
      }
    }

    // Timer filter
    if (filterTimer) {
      if (filterTimer === 'with timer') {
        if (!mockExam.timer || mockExam.timer === 0 || mockExam.timer === null) {
          return false;
        }
      } else if (filterTimer === 'no timer') {
        if (mockExam.timer && mockExam.timer !== 0 && mockExam.timer !== null) {
          return false;
        }
      }
    }

    // Account state filter
    if (filterAccountState) {
      const state = mockExam.state || mockExam.account_state || 'Activated';
      if (state !== filterAccountState) {
        return false;
      }
    }

    return true;
  });

  // Automatically reset search when search input is cleared
  useEffect(() => {
    if (searchInput.trim() === "" && searchTerm !== "") {
      // If input is cleared but search term still has value, automatically clear search
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

  // Delete mock exam mutation
  const deleteMockExamMutation = useMutation({
    mutationFn: async (id) => {
      const response = await apiClient.delete(`/api/online_mock_exams?id=${id}`);
      return response.data;
    },
    onSuccess: () => {
      setSuccessMessage('✅ Mock exam deleted successfully!');
      setConfirmDeleteOpen(false);
      setSelectedMockExam(null);
      queryClient.invalidateQueries(['online_mock_exams']);
      
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setSuccessMessage('');
      }, 6000);
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.error || 'Failed to delete mock exam';
      setSuccessMessage(errorMsg.startsWith('❌') ? errorMsg : `❌ ${errorMsg}`);
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setSuccessMessage('');
      }, 6000);
    },
  });

  const openConfirmDeleteModal = (mockExam) => {
    setSelectedMockExam(mockExam);
    setConfirmDeleteOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedMockExam) {
      deleteMockExamMutation.mutate(selectedMockExam._id);
    }
  };

  const handleDeleteCancel = () => {
    setConfirmDeleteOpen(false);
    setSelectedMockExam(null);
  };

  // Fetch analytics data
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['mock-exam-analytics', selectedMockExamForAnalytics?._id],
    queryFn: async () => {
      if (!selectedMockExamForAnalytics?._id) return null;
      const response = await apiClient.get(`/api/online_mock_exams/${selectedMockExamForAnalytics._id}/analytics`);
      return response.data;
    },
    enabled: !!selectedMockExamForAnalytics?._id && analyticsOpen,
  });

  const openAnalytics = (mockExam) => {
    setSelectedMockExamForAnalytics(mockExam);
    setAnalyticsOpen(true);
  };

  const closeAnalytics = () => {
    setAnalyticsOpen(false);
    setSelectedMockExamForAnalytics(null);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px"
      }}>
        <div style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
          <Title backText="Back" href="/dashboard/manage_online_system">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Image src="/exam.svg" alt="Mock Exams" width={32} height={32} />
              Online Mock Exams
            </div>
          </Title>
          
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
            <style jsx global>{`
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
        <Title backText="Back" href="/dashboard/manage_online_system">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/exam.svg" alt="Mock Exams" width={32} height={32} />
            Online Mock Exams
          </div>
        </Title>

        {/* Search Bar */}
        <div className="search-bar-container" style={{ marginBottom: 20, width: '100%' }}>
          <InputWithButton
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyPress}
            onButtonClick={handleSearch}
          />
        </div>

        {/* Filters */}
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
            marginBottom: 16,
            flexWrap: 'wrap'
          }}>
            <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#495057', fontSize: '0.95rem' }}>
                Filter by Course
              </label>
              <CourseSelect
                selectedGrade={filterCourse}
                onGradeChange={(course) => {
                  setFilterCourse(course);
                }}
                isOpen={filterCourseDropdownOpen}
                onToggle={() => {
                  setFilterCourseDropdownOpen(!filterCourseDropdownOpen);
                  setFilterCourseTypeDropdownOpen(false);
                  setFilterCenterDropdownOpen(false);
                  setFilterTimerDropdownOpen(false);
                }}
                onClose={() => setFilterCourseDropdownOpen(false)}
                showAllOption={true}
              />
            </div>
            <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#495057', fontSize: '0.95rem' }}>
                Filter by Course Type
              </label>
              <CourseTypeSelect
                selectedCourseType={filterCourseType}
                onCourseTypeChange={(courseType) => {
                  setFilterCourseType(courseType);
                }}
                isOpen={filterCourseTypeDropdownOpen}
                onToggle={() => {
                  setFilterCourseTypeDropdownOpen(!filterCourseTypeDropdownOpen);
                  setFilterCourseDropdownOpen(false);
                  setFilterCenterDropdownOpen(false);
                  setFilterTimerDropdownOpen(false);
                }}
                onClose={() => setFilterCourseTypeDropdownOpen(false)}
              />
            </div>
            <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#495057', fontSize: '0.95rem' }}>
                Filter by Center
              </label>
              <CenterSelect
                selectedCenter={filterCenter}
                onCenterChange={setFilterCenter}
                required={false}
                isOpen={filterCenterDropdownOpen}
                onToggle={() => {
                  setFilterCenterDropdownOpen(!filterCenterDropdownOpen);
                  setFilterCourseDropdownOpen(false);
                  setFilterCourseTypeDropdownOpen(false);
                  setFilterTimerDropdownOpen(false);
                }}
                onClose={() => setFilterCenterDropdownOpen(false)}
              />
            </div>
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
              />
            </div>
            <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#495057', fontSize: '0.95rem' }}>
                Filter by Timer
              </label>
              <TimerSelect
                value={filterTimer || null}
                onChange={(timer) => {
                  setFilterTimer(timer || '');
                }}
                placeholder="Select Timer"
                style={{ marginBottom: 0, hideLabel: true }}
                isOpen={filterTimerDropdownOpen}
                onToggle={() => {
                  setFilterTimerDropdownOpen(!filterTimerDropdownOpen);
                  setFilterCourseDropdownOpen(false);
                  setFilterCourseTypeDropdownOpen(false);
                  setFilterCenterDropdownOpen(false);
                }}
                onClose={() => setFilterTimerDropdownOpen(false)}
              />
            </div>
            <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#495057', fontSize: '0.95rem' }}>
                Filter by Mock Exam State
              </label>
              <AccountStateSelect
                label="Mock Exam State"
                value={filterAccountState || null}
                onChange={(state) => {
                  setFilterAccountState(state || '');
                }}
                placeholder="Select Mock Exam State"
                style={{ marginBottom: 0, hideLabel: true }}
              />
            </div>
          </div>
        </div>

        {/* White Background Container */}
        <div className="mock-exams-container" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          {/* Add Button */}
          <div className="add-btn-container" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
            <button
              onClick={() => router.push('/dashboard/manage_online_system/online_mock_exams/add')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#1FA8DC',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(31, 168, 220, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Image src="/plus.svg" alt="Add" width={23} height={23} style={{ marginRight: '6px', display: 'inline-block' }} />
              Add Mock Exam
            </button>
          </div>

          {/* Mock Exams List */}
          {filteredMockExams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
              {mockExams.length === 0 ? '❌ No mock exams found. Click "Add Mock Exam" to create one.' : '❌ No mock exams match your filters.'}
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
                      {[mockExam.course, mockExam.courseType, mockExam.center, mockExam.lesson, mockExam.lesson_name].filter(Boolean).join(' • ')}
                    </div>
                    <div style={{ color: '#6c757d', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {mockExam.mock_exam_type === 'pdf' ? (
                        <div style={{ padding: '12px 16px', backgroundColor: '#ffffff', border: '2px solid #e9ecef', borderRadius: '8px', fontSize: '0.95rem', color: '#495057', textAlign: 'left', display: 'inline-block', maxWidth: '100%' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', maxWidth: '100%' }}>
                            {(() => {
                              const itemState = mockExam.state || mockExam.account_state || 'Activated';
                              const stateColor = itemState === 'Activated' ? '#28a745' : '#dc3545';
                              return (
                                <>
                                  <span style={{ color: stateColor, fontWeight: '600', flexShrink: 0 }}>
                                    {itemState}
                                  </span>
                                  <span style={{ flexShrink: 0 }}>•</span>
                                  <span style={{ fontWeight: '600', minWidth: 0 }}>
                                    {`File Name : ${mockExam.pdf_file_name || 'file'}.pdf`}
                                  </span>
                                </>
                              );
                            })()}
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
                          {(() => {
                            const itemState = mockExam.state || mockExam.account_state || 'Activated';
                            const stateColor = itemState === 'Activated' ? '#28a745' : '#dc3545';
                            return (
                              <>
                                <span style={{ color: stateColor, fontWeight: '600' }}>
                                  {itemState}
                                </span>
                                <span>•</span>
                              </>
                            );
                          })()}
                          <span>{mockExam.questions?.length || 0} Question{mockExam.questions?.length !== 1 ? 's' : ''}</span>
                          <span>•</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Image src="/clock.svg" alt="Timer" width={18} height={18} />
                            {mockExam.timer ? `Timer ${mockExam.timer} minute${mockExam.timer !== 1 ? 's' : ''}` : 'No Timer'}
                          </span>
                          <span>•</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Image src="/clock.svg" alt="Deadline" width={18} height={18} />
                            {mockExam.deadline_type === 'with_deadline' && mockExam.deadline_date
                              ? formatDeadlineCardLabel(mockExam.deadline_date, mockExam.deadline_time)
                              : 'With no deadline date'}
                          </span>
                        </div>
                      </div>
                      )}
                    </div>
                  </div>
                  <div className="mock-exam-buttons" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {mockExam.mock_exam_type !== 'pdf' && (
                    <button onClick={() => openAnalytics(mockExam)} className="me-action-btn"
                      style={{ padding: '8px 16px', backgroundColor: '#1FA8DC', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Image src="/chart2.svg" alt="Analytics" width={18} height={18} style={{ display: 'inline-block' }} />
                      Analytics
                    </button>
                    )}
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
                    <button onClick={() => router.push(`/dashboard/manage_online_system/online_mock_exams/edit?id=${mockExam._id}`)} className="me-action-btn"
                      style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Image src="/edit.svg" alt="Edit" width={18} height={18} style={{ display: 'inline-block' }} />
                      Edit
                    </button>
                    <button onClick={() => openConfirmDeleteModal(mockExam)} className="me-action-btn"
                      style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <Image src="/trash2.svg" alt="Delete" width={18} height={18} style={{ display: 'inline-block' }} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div style={{
              background: successMessage.startsWith('❌') ? '#fee2e2' : '#d4edda',
              color: successMessage.startsWith('❌') ? '#991b1b' : '#155724',
              borderRadius: 10,
              padding: 16,
              marginTop: 24,
              textAlign: 'center',
              fontWeight: 600,
              border: successMessage.startsWith('❌') ? '1.5px solid #fca5a5' : '1.5px solid #c3e6cb',
              fontSize: '1.1rem',
              boxShadow: successMessage.startsWith('❌') ? '0 4px 16px rgba(220, 53, 69, 0.08)' : '0 4px 16px rgba(40, 167, 69, 0.08)'
            }}>
              {successMessage}
            </div>
          )}
        </div>

        {/* Analytics Modal */}
        {analyticsOpen && (
          <div 
            className="analytics-modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeAnalytics();
              }
            }}
          >
            <div
              className="analytics-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button 
                className="analytics-close-btn" 
                onClick={closeAnalytics} 
                aria-label="Close"
              >
                <Image src="/close-cross.svg" alt="Close" width={35} height={35} />
              </button>

              <div className="analytics-header">
                <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <Image src="/chart2.svg" alt="Analytics" width={32} height={32} />
                  Mock Exam Analytics
                </h2>
                {selectedMockExamForAnalytics && (
                  <p className="analytics-subtitle">
                    {[selectedMockExamForAnalytics.course, selectedMockExamForAnalytics.courseType, selectedMockExamForAnalytics.center, selectedMockExamForAnalytics.lesson, selectedMockExamForAnalytics.lesson_name].filter(Boolean).join(' • ')}
                  </p>
                )}
              </div>
            
              {analyticsLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{
                    width: "50px",
                    height: "50px",
                    border: "4px solid rgba(31, 168, 220, 0.2)",
                    borderTop: "4px solid #1FA8DC",
                    borderRadius: "50%",
                    margin: "0 auto 20px",
                    animation: "spin 1s linear infinite"
                  }} />
                  <p style={{ color: "#6c757d", fontSize: "1rem" }}>Loading analytics...</p>
                </div>
              ) : analyticsData?.analytics ? (
                <div style={{ marginBottom: '-25px' }}>
                  <HomeworkAnalyticsChart analyticsData={analyticsData.analytics} />
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6c757d' }}>
                  No analytics data available
                </div>
              )}

              {/* Statistics Grid - At the End */}
              {analyticsData?.analytics && !analyticsLoading && (
                <div className="analytics-stats-grid">
                  <div className="analytics-stat-item">
                    <div className="analytics-stat-value" style={{ color: '#a71e2a' }}>
                      {analyticsData.analytics.notAnswered}
                    </div>
                    <div className="analytics-stat-label">Not Answered</div>
                  </div>
                  <div className="analytics-stat-item">
                    <div className="analytics-stat-value" style={{ color: '#dc3545' }}>
                      {analyticsData.analytics.lessThan50}
                    </div>
                    <div className="analytics-stat-label">&lt; 50%</div>
                  </div>
                  <div className="analytics-stat-item">
                    <div className="analytics-stat-value" style={{ color: '#17a2b8' }}>
                      {analyticsData.analytics.between50And100}
                    </div>
                    <div className="analytics-stat-label">50-99%</div>
                  </div>
                  <div className="analytics-stat-item">
                    <div className="analytics-stat-value" style={{ color: '#28a745' }}>
                      {analyticsData.analytics.exactly100}
                    </div>
                    <div className="analytics-stat-label">100%</div>
                  </div>
                  <div className="analytics-stat-item">
                    <div className="analytics-stat-value" style={{ color: '#212529' }}>
                      {analyticsData.analytics.totalStudents}
                    </div>
                    <div className="analytics-stat-label">Total Students</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {confirmDeleteOpen && (
          <div className="confirm-modal" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleDeleteCancel();
            }
          }}
          >
            <div
              className="confirm-content"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '16px',
                padding: '32px',
                maxWidth: '400px',
                width: '100%',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: '16px', textAlign: 'center' }}>
                Confirm Delete
              </h3>
              <p style={{ textAlign: 'center', marginBottom: '24px', color: '#6c757d' }}>
                Are you sure you want to delete "{selectedMockExam?.lesson_name}"? This action cannot be undone.
              </p>
              <div className="confirm-buttons" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteMockExamMutation.isLoading}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: deleteMockExamMutation.isLoading ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    opacity: deleteMockExamMutation.isLoading ? 0.7 : 1
                  }}
                >
                  {deleteMockExamMutation.isLoading ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={handleDeleteCancel}
                  disabled={deleteMockExamMutation.isLoading}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: deleteMockExamMutation.isLoading ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    opacity: deleteMockExamMutation.isLoading ? 0.7 : 1
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .analytics-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease;
          padding: 20px;
        }
        .analytics-modal-content {
          position: relative;
          background: white;
          border-radius: 20px;
          padding: 40px;
          max-width: 900px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
          z-index: 10000;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .analytics-close-btn {
          position: absolute;
          top: 20px;
          right: 20px;
          border: none;
          font-size: 20px;
          color: white;
          cursor: pointer;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
          padding: 0;
          line-height: 1;
        }
        .analytics-close-btn:hover {
          transform: scale(1.1);
        }
        .analytics-close-btn:active {
          transform: scale(0.95);
        }
        .analytics-header {
          text-align: center;
          margin-bottom: 16px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e9ecef;
        }
        .analytics-header h2 {
          margin: 0 0 12px 0;
          font-size: 2rem;
          font-weight: 700;
          color: #1FA8DC;
          letter-spacing: -0.5px;
        }
        .analytics-subtitle {
          margin: 0;
          color: #6c757d;
          font-size: 1rem;
          font-weight: 500;
        }
        .analytics-stats-grid {
          padding: 24px;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 16px;
          display: flex;
          flex-direction: row;
          gap: 20px;
          box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.05);
          flex-wrap: wrap;
          justify-content: center;
        }
        .analytics-stat-item {
          text-align: center;
          padding: 16px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          transition: all 0.2s ease;
        }
        .analytics-stat-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        }
        .analytics-stat-value {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 8px;
          line-height: 1;
        }
        .analytics-stat-label {
          font-size: 0.875rem;
          color: #6c757d;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(30px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (max-width: 768px) {
          .analytics-modal-overlay {
            padding: 10px;
            align-items: center;
            justify-content: center;
          }
          .analytics-modal-content {
            padding: 30px 20px;
            border-radius: 16px;
            max-width: 100%;
            width: 100%;
            max-height: 95vh;
            margin: 0;
          }
          .analytics-close-btn {
            top: 15px;
            right: 15px;
            width: 32px;
            height: 32px;
            font-size: 18px;
          }
          .analytics-header {
            padding-bottom: 16px;
            margin-bottom: 12px;
          }
          .analytics-header h2 {
            font-size: 1.5rem;
            margin-bottom: 8px;
          }
          .analytics-subtitle {
            font-size: 0.9rem;
          }
          .analytics-stats-grid {
            gap: 12px;
            padding: 16px;
            flex-wrap: wrap;
          }
          .analytics-stat-item {
            padding: 12px;
            flex: 1 1 calc(50% - 6px);
            min-width: calc(50% - 6px);
            max-width: calc(50% - 6px);
          }
          .analytics-stat-value {
            font-size: 1.5rem;
          }
          .analytics-stat-label {
            font-size: 0.8rem;
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
          .page-wrapper {
            padding: 10px 5px;
          }
          .page-content {
            padding: 8px;
            margin: 20px auto;
          }
          .filters-container {
            padding: 16px !important;
          }
          .filter-group {
            flex: 1 1 100% !important;
            min-width: 100% !important;
          }
          .homeworks-container {
            padding: 16px;
          }
          .homework-item {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px;
          }
          .homework-buttons,
          .mock-exam-buttons {
            width: 100%;
            flex-direction: column;
          }
          .homework-buttons button,
          .homework-buttons a,
          .mock-exam-buttons button,
          .mock-exam-buttons a,
          .mock-exam-buttons .me-action-btn {
            width: 100%;
          }
        }
        @media (max-width: 480px) {
          .analytics-modal-overlay {
            padding: 5px;
            align-items: center;
            justify-content: center;
          }
          .analytics-modal-content {
            padding: 24px 16px;
            max-height: 95vh;
            border-radius: 12px;
          }
          .analytics-close-btn {
            top: 10px;
            right: 10px;
            width: 28px;
            height: 28px;
            font-size: 16px;
          }
          .analytics-header {
            padding-bottom: 12px;
            margin-bottom: 10px;
          }
          .analytics-header h2 {
            font-size: 1.3rem;
            margin-bottom: 6px;
          }
          .analytics-subtitle {
            font-size: 0.85rem;
          }
          .analytics-stats-grid {
            gap: 10px;
            padding: 12px;
            flex-wrap: wrap;
            border-radius: 12px;
          }
          .analytics-stat-item {
            padding: 10px;
            flex: 1 1 calc(50% - 5px);
            min-width: calc(50% - 5px);
            max-width: calc(50% - 5px);
          }
          .analytics-stat-value {
            font-size: 1.3rem;
          }
          .analytics-stat-label {
            font-size: 0.75rem;
          }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .filter-group {
            flex: 1 1 calc(50% - 6px) !important;
            min-width: calc(50% - 6px) !important;
          }
        }
        @media (max-width: 480px) {
          .page-wrapper {
            padding: 5px;
          }
          .page-content {
            padding: 5px;
            margin: 10px auto;
          }
          .homeworks-container {
            padding: 12px;
          }
          .add-btn-container button {
            width: 100%;
            font-size: 0.9rem;
            padding: 10px 20px;
          }
          .confirm-modal {
            padding: 10px !important;
          }
          
          .confirm-content {
            margin: 5px;
          }
          
          .confirm-content h3 {
            font-size: 1.1rem !important;
            margin-bottom: 12px !important;
          }
          
          .confirm-content p {
            font-size: 0.9rem !important;
            margin-bottom: 20px !important;
          }
          
          .confirm-content button {
            padding: 8px 16px !important;
            font-size: 0.9rem !important;
          }
        }
        @media (max-width: 360px) {
          .analytics-modal-overlay {
            padding: 5px;
            align-items: center;
            justify-content: center;
          }
          .analytics-modal-content {
            padding: 20px 12px;
            border-radius: 10px;
          }
          .analytics-close-btn {
            top: 8px;
            right: 8px;
            width: 24px;
            height: 24px;
            font-size: 14px;
          }
          .analytics-header h2 {
            font-size: 1.1rem;
          }
          .analytics-subtitle {
            font-size: 0.8rem;
          }
          .analytics-stats-grid {
            gap: 8px;
            padding: 10px;
          }
          .analytics-stat-item {
            padding: 8px;
            flex: 1 1 100%;
            min-width: 100%;
            max-width: 100%;
          }
          .analytics-stat-value {
            font-size: 1.1rem;
          }
          .analytics-stat-label {
            font-size: 0.7rem;
          }
          .homeworks-container {
            padding: 10px;
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

