import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import apiClient from '../../lib/axios';
import Title from '../../components/Title';
import CourseSelect from '../../components/CourseSelect';
import CourseTypeSelect from '../../components/CourseTypeSelect';
import PeriodSelect from '../../components/PeriodSelect';
import AttendancelessonSelect from '../../components/AttendancelessonSelect';

// Time Input component (hours, minutes, AM/PM using PeriodSelect)
function TimeInput({ value, onChange, label, accentColor = '#2d8cff' }) {
  const hours = value?.hours || '';
  const minutes = value?.minutes || '';
  const period = value?.period || '';
  const hasValue = hours || minutes || period;

  const handleChange = (field, val) => {
    // Limit to max 2 digits for hours and minutes
    if (field === 'hours' || field === 'minutes') {
      const cleaned = val.replace(/\D/g, '').slice(0, 2);
      const newValue = { ...value, [field]: cleaned };
      onChange(newValue);
    } else {
      const newValue = { ...value, [field]: val };
      onChange(newValue);
    }
  };

  const inputStyle = {
    width: '60px',
    height: '40px',
    padding: '0',
    border: '1.5px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: '600',
    textAlign: 'center',
    outline: 'none',
    background: '#fff',
    color: '#1f2937',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box'
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      background: hasValue ? '#fafbff' : '#fff',
      border: `1.5px solid ${hasValue ? accentColor + '40' : '#e9ecef'}`,
      borderRadius: '12px',
      padding: '10px 14px',
      transition: 'all 0.25s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '0.6rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hour</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={2}
            placeholder="HH"
            value={hours}
            onChange={(e) => handleChange('hours', e.target.value)}
            style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = accentColor; e.target.style.boxShadow = `0 0 0 3px ${accentColor}15`; }}
            onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
          />
        </div>
        <span style={{ fontSize: '1.2rem', fontWeight: '700', color: accentColor, marginBottom: '8px' }}>:</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '0.6rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Min</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={2}
            placeholder="MM"
            value={minutes}
            onChange={(e) => handleChange('minutes', e.target.value)}
            style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = accentColor; e.target.style.boxShadow = `0 0 0 3px ${accentColor}15`; }}
            onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
          <span style={{ fontSize: '0.6rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Period</span>
          <div style={{ width: '60px' }}>
            <PeriodSelect
              selectedPeriod={period}
              onPeriodChange={(val) => handleChange('period', val)}
              compact={true}
            />
          </div>
        </div>
      </div>
      {hasValue && (
        <button
          type="button"
          onClick={() => onChange({})}
          title="Clear all"
          style={{
            background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
            border: '1.5px solid #fca5a5',
            borderRadius: '8px',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            flexShrink: 0,
            padding: 0,
            fontWeight: '700'
          }}
          onMouseEnter={(e) => { e.target.style.background = 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)'; e.target.style.borderColor = '#f87171'; e.target.style.transform = 'scale(1.08)'; }}
          onMouseLeave={(e) => { e.target.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'; e.target.style.borderColor = '#fca5a5'; e.target.style.transform = 'scale(1)'; }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

// Format time object for display
function formatTime(timeObj) {
  if (!timeObj || !timeObj.hours || !timeObj.minutes || !timeObj.period) return null;
  return `${timeObj.hours}:${String(timeObj.minutes).padStart(2, '0')} ${timeObj.period}`;
}

// API functions
const zoomMeetingAPI = {
  getMeetings: async () => {
    const response = await apiClient.get('/api/join-zoom-meeting');
    return response.data.meetings;
  },

  createMeeting: async (data) => {
    const response = await apiClient.post('/api/join-zoom-meeting', data);
    return response.data;
  },

  updateMeeting: async (id, data) => {
    const response = await apiClient.put('/api/join-zoom-meeting', { id, ...data });
    return response.data;
  },

  deleteMeeting: async (id) => {
    const response = await apiClient.delete('/api/join-zoom-meeting', { data: { id } });
    return response.data;
  }
};

export default function JoinZoomMeeting() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCourse, setNewCourse] = useState('');
  const [newCourseType, setNewCourseType] = useState('');
  const [newLesson, setNewLesson] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newDeadline, setNewDeadline] = useState({});
  const [newDateOfStart, setNewDateOfStart] = useState({});
  const [newDateOfEnd, setNewDateOfEnd] = useState({});
  const [newCourseOpen, setNewCourseOpen] = useState(false);
  const [newCourseTypeOpen, setNewCourseTypeOpen] = useState(false);
  const [newLessonOpen, setNewLessonOpen] = useState(false);
  
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [editCourse, setEditCourse] = useState('');
  const [editCourseType, setEditCourseType] = useState('');
  const [editLesson, setEditLesson] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editDeadline, setEditDeadline] = useState({});
  const [editDateOfStart, setEditDateOfStart] = useState({});
  const [editDateOfEnd, setEditDateOfEnd] = useState({});
  const [editCourseOpen, setEditCourseOpen] = useState(false);
  const [editCourseTypeOpen, setEditCourseTypeOpen] = useState(false);
  const [editLessonOpen, setEditLessonOpen] = useState(false);
  
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState(null);
  const [showAddSuccess, setShowAddSuccess] = useState(false);
  const [showEditSuccess, setShowEditSuccess] = useState(false);

  // Fetch meetings
  const { data: meetings = [], isLoading, error: fetchError } = useQuery({
    queryKey: ['zoom-meetings'],
    queryFn: () => zoomMeetingAPI.getMeetings(),
    retry: 3,
    retryDelay: 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Fetch lessons for the lesson select dropdown
  const { data: lessonsData = [] } = useQuery({
    queryKey: ['lessons'],
    queryFn: async () => {
      const response = await apiClient.get('/api/lessons');
      return response.data.lessons || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const availableLessons = lessonsData.map(l => l.name || l.lesson || l);

  // Create meeting mutation
  const createMutation = useMutation({
    mutationFn: (data) => zoomMeetingAPI.createMeeting(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zoom-meetings'] });
      setShowAddSuccess(true);
      setError('');
      setTimeout(() => {
        setShowAddForm(false);
        resetAddForm();
        setShowAddSuccess(false);
      }, 2000);
    },
    onError: (error) => {
      setError(error.response?.data?.error || 'Failed to create meeting');
    }
  });

  // Update meeting mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => zoomMeetingAPI.updateMeeting(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zoom-meetings'] });
      setShowEditSuccess(true);
      setError('');
      setTimeout(() => {
        setEditingMeeting(null);
        resetEditForm();
        setShowEditSuccess(false);
      }, 2000);
    },
    onError: (error) => {
      setError(error.response?.data?.error || 'Failed to update meeting');
    }
  });

  // Delete meeting mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => zoomMeetingAPI.deleteMeeting(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zoom-meetings'] });
      setError('');
    },
    onError: (error) => {
      setError(error.response?.data?.error || 'Failed to delete meeting');
    }
  });

  // Auto-hide error message
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (showAddSuccess) {
      const timer = setTimeout(() => setShowAddSuccess(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [showAddSuccess]);

  useEffect(() => {
    if (showEditSuccess) {
      const timer = setTimeout(() => setShowEditSuccess(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [showEditSuccess]);

  const resetAddForm = () => {
    setNewCourse('');
    setNewCourseType('');
    setNewLesson('');
    setNewLink('');
    setNewDeadline({});
    setNewDateOfStart({});
    setNewDateOfEnd({});
  };

  const resetEditForm = () => {
    setEditCourse('');
    setEditCourseType('');
    setEditLesson('');
    setEditLink('');
    setEditDeadline({});
    setEditDateOfStart({});
    setEditDateOfEnd({});
  };

  // Clean time object - only include if all three fields are filled
  const cleanTime = (timeObj) => {
    if (timeObj && timeObj.hours && timeObj.minutes && timeObj.period) {
      return timeObj;
    }
    return null;
  };

  const handleAddMeeting = () => {
    if (!newCourse || !newLesson || !newLink.trim()) {
      setError('Course, Lesson and Zoom Link are required');
      return;
    }
    
    if (!newLink.trim().includes('zoom.us/j/')) {
      setError('Zoom link must contain "zoom.us/j/"');
      return;
    }
    
    createMutation.mutate({
      course: newCourse,
      courseType: newCourseType || null,
      lesson: newLesson,
      link: newLink.trim(),
      deadline: cleanTime(newDeadline),
      dateOfStart: cleanTime(newDateOfStart),
      dateOfEnd: cleanTime(newDateOfEnd)
    });
  };

  const handleEditMeeting = (meeting) => {
    setEditingMeeting(meeting);
    setEditCourse(meeting.course || '');
    setEditCourseType(meeting.courseType || '');
    setEditLesson(meeting.lesson || '');
    setEditLink(meeting.link || '');
    setEditDeadline(meeting.deadline || {});
    setEditDateOfStart(meeting.dateOfStart || {});
    setEditDateOfEnd(meeting.dateOfEnd || {});
    setError('');
  };

  const handleUpdateMeeting = () => {
    if (!editCourse || !editLesson || !editLink.trim()) {
      setError('Course, Lesson and Zoom Link are required');
      return;
    }
    
    if (!editLink.trim().includes('zoom.us/j/')) {
      setError('Zoom link must contain "zoom.us/j/"');
      return;
    }
    
    updateMutation.mutate({ 
      id: editingMeeting._id, 
      data: {
        course: editCourse,
        courseType: editCourseType || null,
        lesson: editLesson,
        link: editLink.trim(),
        deadline: cleanTime(editDeadline),
        dateOfStart: cleanTime(editDateOfStart),
        dateOfEnd: cleanTime(editDateOfEnd)
      }
    });
  };

  const handleDeleteMeeting = (meeting) => {
    setMeetingToDelete(meeting);
    setShowConfirm(true);
  };

  const confirmDelete = () => {
    if (meetingToDelete) {
      deleteMutation.mutate(meetingToDelete._id);
      setShowConfirm(false);
      setMeetingToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowConfirm(false);
    setMeetingToDelete(null);
  };

  const cancelEdit = () => {
    setEditingMeeting(null);
    resetEditForm();
    setError('');
  };

  const cancelAdd = () => {
    setShowAddForm(false);
    resetAddForm();
    setError('');
  };

  if (fetchError) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Error Loading Zoom Meeting</h1>
        <p style={{ color: '#dc3545' }}>
          {fetchError.response?.data?.error || fetchError.message || 'Failed to load meeting'}
        </p>
        <button 
          onClick={() => router.push('/dashboard')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#1FA8DC',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const hasExistingMeeting = meetings.length > 0;

  return (
    <div className="zoom-meeting-page-container" style={{ 
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      maxWidth: "800px",
      margin: "40px auto",
      padding: "20px 15px 20px 15px" 
    }}>
      <Title style={{ justifyContent: 'space-between', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Image src="/zoom.svg" alt="Zoom" width={30} height={30} />
          Join Zoom Meeting
        </div>
      </Title>
      
      {/* Main Container */}
      <div className="main-container" style={{ 
        maxWidth: '800px', 
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '30px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        width: '100%'
      }}>
        {/* Container Header with Add Button */}
        <div className="container-header" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '30px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h2 style={{ 
              margin: 0, 
              color: '#333',
              fontSize: '1.8rem',
              fontWeight: 'bold'
            }}>
              Zoom Meeting
            </h2>
            <p style={{ 
              margin: '8px 0 0 0', 
              color: '#666',
              fontSize: '1rem'
            }}>
              Manage Zoom meeting link for students
            </p>
          </div>
          
          {!hasExistingMeeting && (
            <button
              className="add-meeting-btn"
              onClick={() => setShowAddForm(true)}
              style={{
                padding: '12px 20px',
                backgroundColor: '#2d8cff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#1a6fdb'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#2d8cff'}
            >
              <Image src="/plus.svg" alt="Add" width={20} height={20} />
              Add Meeting
            </button>
          )}
        </div>

        {/* Meetings List */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ 
              fontSize: '1.2rem', 
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid #f3f3f3',
                borderTop: '2px solid #2d8cff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              Loading meeting...
            </div>
          </div>
        ) : meetings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h3 style={{ color: '#666', margin: '0 0 16px 0' }}>No Meeting Found</h3>
            <p style={{ color: '#999', margin: 0 }}>
              Click &quot;Add Meeting&quot; to create a Zoom meeting.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {meetings.map((meeting) => (
              <div
                key={meeting._id}
                className="meeting-card"
                style={{
                  backgroundColor: '#f8f9fa',
                  padding: '20px',
                  borderRadius: '8px',
                  border: '1px solid #dee2e6',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div className="meeting-info" style={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column',
                  width: '100%'
                }}>
                  <h4 style={{ 
                    margin: '0 0 8px 0', 
                    color: '#333',
                    fontSize: '1.3rem'
                  }}>
                    Zoom Meeting
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                    <span style={{ color: '#666', fontSize: '0.9rem' }}>
                      <strong>Course:</strong> {meeting.course || 'N/A'}
                    </span>
                    {meeting.courseType && (
                      <span style={{ color: '#666', fontSize: '0.9rem' }}>
                        <strong>Course Type:</strong> {meeting.courseType}
                      </span>
                    )}
                    {meeting.lesson && (
                      <span style={{ color: '#666', fontSize: '0.9rem' }}>
                        <strong>Lesson:</strong> {meeting.lesson}
                      </span>
                    )}
                    {(formatTime(meeting.deadline) || formatTime(meeting.dateOfStart) || formatTime(meeting.dateOfEnd)) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                        {formatTime(meeting.deadline) && (
                          <span className="time-badge time-badge-deadline">
                            <span className="time-badge-dot" style={{ background: '#f59e0b' }}></span>
                            Deadline: {formatTime(meeting.deadline)}
                          </span>
                        )}
                        {formatTime(meeting.dateOfStart) && (
                          <span className="time-badge time-badge-start">
                            <span className="time-badge-dot" style={{ background: '#10b981' }}></span>
                            Start: {formatTime(meeting.dateOfStart)}
                          </span>
                        )}
                        {formatTime(meeting.dateOfEnd) && (
                          <span className="time-badge time-badge-end">
                            <span className="time-badge-dot" style={{ background: '#ef4444' }}></span>
                            End: {formatTime(meeting.dateOfEnd)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {meeting.link && (
                    <a
                      href={meeting.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#2d8cff',
                        textDecoration: 'none',
                        fontWeight: '600',
                        fontSize: '0.95rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#1a6fdb';
                        e.target.style.backgroundColor = '#e9ecef';
                        e.target.style.textDecoration = 'underline';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = '#2d8cff';
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.textDecoration = 'none';
                      }}
                    >
                      Join Meeting
                    </a>
                  )}
                </div>
                <div className="meeting-actions" style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleEditMeeting(meeting)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Image src="/edit.svg" alt="Edit" width={18} height={18} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteMeeting(meeting)}
                    disabled={deleteMutation.isPending}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: deleteMutation.isPending ? 'not-allowed' : 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: deleteMutation.isPending ? 0.6 : 1
                    }}
                  >
                    <Image src="/trash2.svg" alt="Delete" width={18} height={18} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error and Success Messages */}
        {error && (
          <div style={{
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '12px 16px',
            borderRadius: '8px',
            marginTop: '20px',
            border: '1px solid #f5c6cb',
            textAlign: 'center',
            fontWeight: '600'
          }}>
            {typeof error === 'string' ? error : JSON.stringify(error)}
          </div>
        )}
        {showAddSuccess && (
          <div style={{
            background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
            color: 'white',
            borderRadius: '10px',
            padding: '16px',
            marginTop: '20px',
            textAlign: 'center',
            fontWeight: '600',
            boxShadow: '0 4px 16px rgba(40, 167, 69, 0.3)'
          }}>
            Meeting created successfully!
          </div>
        )}
        {showEditSuccess && (
          <div style={{
            background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
            color: 'white',
            borderRadius: '10px',
            padding: '16px',
            marginTop: '20px',
            textAlign: 'center',
            fontWeight: '600',
            boxShadow: '0 4px 16px rgba(40, 167, 69, 0.3)'
          }}>
            Meeting updated successfully!
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div 
          className="confirm-modal"
          onClick={(e) => {
            if (e.target.classList.contains('confirm-modal')) {
              cancelDelete();
            }
          }}
        >
          <div className="confirm-content" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this Zoom meeting?</p>
            <p><strong>This action cannot be undone!</strong></p>
            <div className="confirm-buttons">
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="confirm-delete-btn"
              >
                {deleteMutation.isPending ? "Deleting..." : "Yes, Delete Meeting"}
              </button>
              <button
                onClick={cancelDelete}
                disabled={deleteMutation.isPending}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Meeting Modal */}
      {showAddForm && (
        <div 
          className="add-meeting-modal"
          onClick={(e) => {
            if (e.target.classList.contains('add-meeting-modal')) {
              cancelAdd();
            }
          }}
        >
          <div className="add-meeting-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Image src="/plus.svg" alt="Add" width={24} height={24} />
                Add New Zoom Meeting
              </h3>
              <button
                type="button"
                onClick={cancelAdd}
                className="close-modal-btn"
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className="add-meeting-form">
              <div className="form-field">
                <label>Course <span className="required-star">*</span></label>
                <CourseSelect
                  selectedGrade={newCourse}
                  onGradeChange={(course) => {
                    setNewCourse(course);
                    setNewCourseOpen(false);
                  }}
                  showAllOption={true}
                  isOpen={newCourseOpen}
                  onToggle={() => {
                    setNewCourseOpen(!newCourseOpen);
                    setNewCourseTypeOpen(false);
                  }}
                  onClose={() => setNewCourseOpen(false)}
                />
              </div>
              
              <div className="form-field">
                <label>Course Type</label>
                <CourseTypeSelect
                  selectedCourseType={newCourseType}
                  onCourseTypeChange={(courseType) => {
                    setNewCourseType(courseType);
                    setNewCourseTypeOpen(false);
                  }}
                  isOpen={newCourseTypeOpen}
                  onToggle={() => {
                    setNewCourseTypeOpen(!newCourseTypeOpen);
                    setNewCourseOpen(false);
                  }}
                  onClose={() => setNewCourseTypeOpen(false)}
                />
              </div>
              
              <div className="form-field">
                <label>Lesson <span className="required-star">*</span></label>
                <AttendancelessonSelect
                  selectedLesson={newLesson}
                  onLessonChange={(lesson) => {
                    setNewLesson(lesson);
                    setNewLessonOpen(false);
                  }}
                  required
                  isOpen={newLessonOpen}
                  onToggle={() => {
                    setNewLessonOpen(!newLessonOpen);
                    setNewCourseOpen(false);
                    setNewCourseTypeOpen(false);
                  }}
                  onClose={() => setNewLessonOpen(false)}
                  placeholder="Select Attendance Lesson"
                />
              </div>

              <div className="form-field">
                <label>Zoom Meeting Link <span className="required-star">*</span></label>
                <input
                  type="url"
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  placeholder="https://zoom.us/j/..."
                  className="form-input"
                  autoFocus
                  required
                />
              </div>

              <div className="schedule-section">
                <div className="schedule-section-header">
                  <div className="schedule-section-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d8cff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div>
                    <div className="schedule-section-title">Meeting Settings</div>
                    <div className="schedule-section-desc">Optional time restrictions for this meeting</div>
                  </div>
                </div>

                <div className="schedule-item">
                  <div className="schedule-item-label">
                    <span className="schedule-dot" style={{ background: '#f59e0b' }}></span>
                    Deadline for Joining
                  </div>
                  <TimeInput value={newDeadline} onChange={setNewDeadline} label="Deadline" accentColor="#f59e0b" />
                </div>

                <div className="schedule-item">
                  <div className="schedule-item-label">
                    <span className="schedule-dot" style={{ background: '#10b981' }}></span>
                    Date of Start
                  </div>
                  <TimeInput value={newDateOfStart} onChange={setNewDateOfStart} label="Start" accentColor="#10b981" />
                </div>

                <div className="schedule-item">
                  <div className="schedule-item-label">
                    <span className="schedule-dot" style={{ background: '#ef4444' }}></span>
                    Date of End
                  </div>
                  <TimeInput value={newDateOfEnd} onChange={setNewDateOfEnd} label="End" accentColor="#ef4444" />
                </div>
              </div>

              {error && (
                <div className="error-message-popup">
                  {typeof error === 'string' ? error : JSON.stringify(error)}
                </div>
              )}
              {showAddSuccess && (
                <div className="success-message-popup">
                  Meeting created successfully!
                </div>
              )}

              <div className="form-buttons">
                <button
                  onClick={handleAddMeeting}
                  disabled={createMutation.isPending}
                  className="save-btn"
                >
                  {createMutation.isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={cancelAdd}
                  disabled={createMutation.isPending}
                  className="cancel-form-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Meeting Modal */}
      {editingMeeting && (
        <div 
          className="edit-meeting-modal"
          onClick={(e) => {
            if (e.target.classList.contains('edit-meeting-modal')) {
              cancelEdit();
            }
          }}
        >
          <div className="edit-meeting-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Image src="/edit.svg" alt="Edit" width={24} height={24} />
                Edit Zoom Meeting
              </h3>
              <button
                type="button"
                onClick={cancelEdit}
                className="close-modal-btn"
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className="edit-meeting-form">
              <div className="form-field">
                <label>Course <span className="required-star">*</span></label>
                <CourseSelect
                  selectedGrade={editCourse}
                  onGradeChange={(course) => {
                    setEditCourse(course);
                    setEditCourseOpen(false);
                  }}
                  showAllOption={true}
                  isOpen={editCourseOpen}
                  onToggle={() => {
                    setEditCourseOpen(!editCourseOpen);
                    setEditCourseTypeOpen(false);
                  }}
                  onClose={() => setEditCourseOpen(false)}
                />
              </div>
              
              <div className="form-field">
                <label>Course Type</label>
                <CourseTypeSelect
                  selectedCourseType={editCourseType}
                  onCourseTypeChange={(courseType) => {
                    setEditCourseType(courseType);
                    setEditCourseTypeOpen(false);
                  }}
                  isOpen={editCourseTypeOpen}
                  onToggle={() => {
                    setEditCourseTypeOpen(!editCourseTypeOpen);
                    setEditCourseOpen(false);
                  }}
                  onClose={() => setEditCourseTypeOpen(false)}
                />
              </div>
              
              <div className="form-field">
                <label>Lesson <span className="required-star">*</span></label>
                <AttendancelessonSelect
                  selectedLesson={editLesson}
                  onLessonChange={(lesson) => {
                    setEditLesson(lesson);
                    setEditLessonOpen(false);
                  }}
                  required
                  isOpen={editLessonOpen}
                  onToggle={() => {
                    setEditLessonOpen(!editLessonOpen);
                    setEditCourseOpen(false);
                    setEditCourseTypeOpen(false);
                  }}
                  onClose={() => setEditLessonOpen(false)}
                  placeholder="Select Attendance Lesson"
                />
              </div>

              <div className="form-field">
                <label>Zoom Meeting Link <span className="required-star">*</span></label>
                <input
                  type="url"
                  value={editLink}
                  onChange={(e) => setEditLink(e.target.value)}
                  placeholder="https://zoom.us/j/..."
                  className="form-input"
                  autoFocus
                  required
                />
              </div>

              <div className="schedule-section">
                <div className="schedule-section-header">
                  <div className="schedule-section-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d8cff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div>
                    <div className="schedule-section-title">Meeting Settings</div>
                    <div className="schedule-section-desc">Optional time restrictions for this meeting</div>
                  </div>
                </div>

                <div className="schedule-item">
                  <div className="schedule-item-label">
                    <span className="schedule-dot" style={{ background: '#f59e0b' }}></span>
                    Deadline for Joining
                  </div>
                  <TimeInput value={editDeadline} onChange={setEditDeadline} label="Deadline" accentColor="#f59e0b" />
                </div>

                <div className="schedule-item">
                  <div className="schedule-item-label">
                    <span className="schedule-dot" style={{ background: '#10b981' }}></span>
                    Date of Start
                  </div>
                  <TimeInput value={editDateOfStart} onChange={setEditDateOfStart} label="Start" accentColor="#10b981" />
                </div>

                <div className="schedule-item">
                  <div className="schedule-item-label">
                    <span className="schedule-dot" style={{ background: '#ef4444' }}></span>
                    Date of End
                  </div>
                  <TimeInput value={editDateOfEnd} onChange={setEditDateOfEnd} label="End" accentColor="#ef4444" />
                </div>
              </div>

              {error && (
                <div className="error-message-popup">
                  {typeof error === 'string' ? error : JSON.stringify(error)}
                </div>
              )}
              {showEditSuccess && !error && (
                <div className="success-message-popup">
                  Meeting updated successfully!
                </div>
              )}

              <div className="form-buttons">
                <button
                  onClick={handleUpdateMeeting}
                  disabled={updateMutation.isPending}
                  className="save-btn"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={updateMutation.isPending}
                  className="cancel-form-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .confirm-modal {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.25);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .confirm-content {
          background: #fff;
          border-radius: 12px;
          padding: 32px 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
          max-width: 400px;
          width: 100%;
          text-align: center;
        }
        .confirm-buttons {
          display: flex;
          gap: 16px;
          margin-top: 24px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .confirm-delete-btn {
          background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .confirm-delete-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .cancel-btn {
          background: #03a9f4;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .add-meeting-modal, .edit-meeting-modal {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.25);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .add-meeting-content, .edit-meeting-content {
          background: #fff;
          border-radius: 12px;
          padding: 32px 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
          max-width: 500px;
          width: 100%;
          max-height: 95vh;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .modal-header h3 {
          margin: 0;
          color: #333;
          font-size: 1.5rem;
          font-weight: 600;
          text-align: left;
        }
        .close-modal-btn {
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          cursor: pointer;
          font-size: 18px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          padding: 0;
          line-height: 1;
          flex-shrink: 0;
        }
        .close-modal-btn:hover {
          background: #c82333;
          transform: scale(1.1);
        }
        .add-meeting-form, .edit-meeting-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .form-field {
          margin-bottom: 16px;
        }
        .form-field label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #333;
          font-size: 0.9rem;
        }
        .required-star {
          color: #dc3545 !important;
          font-weight: 700;
          font-size: 1.1rem;
        }

        /* Schedule Section */
        .schedule-section {
          background: linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%);
          border: 1.5px solid #e0e8f5;
          border-radius: 14px;
          padding: 20px;
        }
        .schedule-section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          padding-bottom: 14px;
          border-bottom: 1.5px solid #e0e8f5;
        }
        .schedule-section-icon {
          width: 36px;
          height: 36px;
          background: #fff;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(45, 140, 255, 0.12);
          flex-shrink: 0;
        }
        .schedule-section-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #1e3a5f;
        }
        .schedule-section-desc {
          font-size: 0.75rem;
          color: #8899ab;
          margin-top: 1px;
        }
        .schedule-item {
          margin-bottom: 14px;
        }
        .schedule-item:last-child {
          margin-bottom: 0;
        }
        .schedule-item-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.82rem;
          font-weight: 600;
          color: #475569;
          margin-bottom: 8px;
        }
        .schedule-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
          display: inline-block;
        }

        /* Time Badges on Card */
        .time-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 20px;
          padding: 4px 12px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .time-badge-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
          display: inline-block;
        }
        .time-badge-deadline {
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #92400e;
        }
        .time-badge-start {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
        }
        .time-badge-end {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }
        .error-message-popup {
          background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
          color: white;
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 20px;
          text-align: center;
          font-weight: 600;
          box-shadow: 0 4px 16px rgba(220, 53, 69, 0.3);
        }
        .success-message-popup {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 20px;
          text-align: center;
          font-weight: 600;
          box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
        }
        .form-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 1rem;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .form-input:focus {
          border-color: #007bff;
        }
        .form-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .save-btn {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .save-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .cancel-form-btn {
          background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        @media (max-width: 768px) {
          .zoom-meeting-page-container {
            margin: 15px auto !important;
            padding: 12px 8px !important;
            max-width: 100% !important;
          }
          .main-container {
            margin: 0 auto !important;
            padding: 18px 14px !important;
            max-width: 100% !important;
            border-radius: 12px !important;
            box-shadow: 0 4px 16px rgba(0,0,0,0.12) !important;
          }
          .container-header {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 14px !important;
          }
          .container-header h2 {
            font-size: 1.4rem !important;
            text-align: center !important;
          }
          .container-header p {
            text-align: center !important;
            font-size: 0.9rem !important;
          }
          .add-meeting-btn {
            width: 100% !important;
            justify-content: center !important;
          }
          .meeting-card {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 14px !important;
            padding: 16px !important;
          }
          .meeting-info {
            text-align: center !important;
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            align-items: center !important;
          }
          .meeting-info h4 {
            font-size: 1.1rem !important;
          }
          .meeting-actions {
            display: flex !important;
            gap: 8px !important;
            justify-content: center !important;
            width: 100% !important;
          }
          .meeting-actions button {
            flex: 1 !important;
            min-width: 0 !important;
            justify-content: center !important;
            text-align: center !important;
          }
          .time-badge {
            font-size: 0.75rem !important;
            padding: 3px 10px !important;
          }
          .confirm-content {
            margin: 15px;
            padding: 22px 16px;
          }
          .confirm-buttons {
            flex-direction: column !important;
            gap: 10px !important;
          }
          .confirm-buttons button {
            width: 100% !important;
          }
          .add-meeting-modal, .edit-meeting-modal {
            padding: 10px !important;
            align-items: flex-start !important;
            overflow-y: auto !important;
          }
          .add-meeting-content, .edit-meeting-content {
            margin: 0 !important;
            padding: 18px 14px !important;
            max-width: 100% !important;
            border-radius: 12px !important;
            max-height: none !important;
          }
          .modal-header {
            margin-bottom: 18px !important;
          }
          .modal-header h3 {
            font-size: 1.2rem !important;
          }
          .schedule-section {
            padding: 12px !important;
            border-radius: 10px !important;
          }
          .schedule-section-header {
            gap: 10px !important;
            margin-bottom: 12px !important;
            padding-bottom: 10px !important;
          }
          .schedule-section-icon {
            width: 32px !important;
            height: 32px !important;
          }
          .schedule-section-title {
            font-size: 0.88rem !important;
          }
          .schedule-section-desc {
            font-size: 0.7rem !important;
          }
          .schedule-item {
            margin-bottom: 12px !important;
          }
          .schedule-item-label {
            font-size: 0.78rem !important;
            margin-bottom: 6px !important;
          }
          .add-meeting-form, .edit-meeting-form {
            gap: 14px !important;
          }
          .form-field {
            margin-bottom: 10px !important;
          }
          .form-buttons {
            flex-direction: column !important;
            gap: 10px !important;
          }
          .form-buttons button {
            width: 100% !important;
          }
        }
        
        @media (max-width: 480px) {
          .zoom-meeting-page-container {
            margin: 8px auto !important;
            padding: 8px 4px !important;
          }
          .main-container {
            padding: 14px 10px !important;
            border-radius: 10px !important;
          }
          .container-header h2 {
            font-size: 1.2rem !important;
          }
          .container-header p {
            font-size: 0.85rem !important;
          }
          .meeting-card {
            padding: 12px !important;
            border-radius: 8px !important;
          }
          .meeting-actions {
            flex-direction: column !important;
            gap: 8px !important;
          }
          .meeting-actions button {
            width: 100% !important;
          }
          .add-meeting-content, .edit-meeting-content {
            padding: 14px 10px !important;
          }
          .modal-header h3 {
            font-size: 1.05rem !important;
            gap: 6px !important;
          }
          .schedule-section {
            padding: 10px !important;
          }
          .schedule-section-header {
            gap: 8px !important;
            margin-bottom: 10px !important;
            padding-bottom: 8px !important;
          }
          .schedule-section-icon {
            width: 28px !important;
            height: 28px !important;
            border-radius: 8px !important;
          }
          .schedule-section-title {
            font-size: 0.82rem !important;
          }
          .time-badge {
            font-size: 0.7rem !important;
            padding: 3px 8px !important;
            gap: 4px !important;
          }
          .time-badge-dot {
            width: 5px !important;
            height: 5px !important;
          }
        }
      `}</style>
    </div>
  );
}
