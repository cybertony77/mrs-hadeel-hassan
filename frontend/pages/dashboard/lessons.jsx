import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import apiClient from '../../lib/axios';
import Title from '../../components/Title';
import CourseSelect from '../../components/CourseSelect';
import { InputWithButton } from './all_students';

function normalizeLessonCategory(value) {
  if (value == null || value === '' || String(value).trim() === '') {
    return null;
  }
  return String(value).trim();
}

// API functions
const lessonsAPI = {
  getLessons: async () => {
    const response = await apiClient.get('/api/lessons');
    return response.data.lessons;
  },

  createLesson: async (data) => {
    const response = await apiClient.post('/api/lessons', data);
    return response.data;
  },

  updateLesson: async (id, data) => {
    const response = await apiClient.put(`/api/lessons/${id}`, data);
    return response.data;
  },

  deleteLesson: async (id) => {
    const response = await apiClient.delete(`/api/lessons/${id}`);
    return response.data;
  }
};

export default function Lessons() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLessonName, setNewLessonName] = useState('');
  const [newLessonCategory, setNewLessonCategory] = useState('');
  const [editingLesson, setEditingLesson] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [lessonToDelete, setLessonToDelete] = useState(null);
  const [showAddSuccess, setShowAddSuccess] = useState(false);
  const [showEditSuccess, setShowEditSuccess] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Fetch lessons
  const { data: lessons = [], isLoading, error: fetchError } = useQuery({
    queryKey: ['lessons'],
    queryFn: () => lessonsAPI.getLessons(),
    retry: 3,
    retryDelay: 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
    onError: (error) => {
      console.error('❌ Lessons fetch error:', error);
    }
  });

  // Create lesson mutation
  const createMutation = useMutation({
    mutationFn: (data) => lessonsAPI.createLesson(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      setShowAddSuccess(true);
      setError('');
      setTimeout(() => {
        setShowAddForm(false);
        setNewLessonName('');
        setNewLessonCategory('');
        setShowAddSuccess(false);
      }, 2000);
    },
    onError: (error) => {
      setError(error.response?.data?.error || 'Failed to create lesson');
    }
  });

  // Update lesson mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => lessonsAPI.updateLesson(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      setShowEditSuccess(true);
      setError('');
      setTimeout(() => {
        setEditingLesson(null);
        setEditName('');
        setEditCategory('');
        setShowEditSuccess(false);
      }, 2000);
    },
    onError: (error) => {
      setError(error.response?.data?.error || 'Failed to update lesson');
    }
  });

  // Delete lesson mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => lessonsAPI.deleteLesson(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      setError('');
    },
    onError: (error) => {
      setError(error.response?.data?.error || 'Failed to delete lesson');
    }
  });

  // Auto-hide error message after 6 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Auto-hide success messages
  useEffect(() => {
    if (showAddSuccess) {
      const timer = setTimeout(() => {
        setShowAddSuccess(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [showAddSuccess]);

  useEffect(() => {
    if (showEditSuccess) {
      const timer = setTimeout(() => {
        setShowEditSuccess(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [showEditSuccess]);

  useEffect(() => {
    if (searchInput.trim() === '' && searchTerm !== '') {
      setSearchTerm('');
    }
  }, [searchInput, searchTerm]);

  const handleSearch = () => {
    setSearchTerm(searchInput.trim());
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const filteredLessons = useMemo(() => {
    let list = lessons;
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((l) => (l.name || '').toLowerCase().includes(q));
    }
    const fc = (filterCategory || '').trim();
    if (fc) {
      list = list.filter((l) => (l.category || '') === fc);
    }
    return list;
  }, [lessons, searchTerm, filterCategory]);

  const handleAddLesson = () => {
    if (!newLessonName.trim()) {
      setError('Lesson name is required');
      return;
    }
    
    createMutation.mutate({
      name: newLessonName.trim(),
      category: normalizeLessonCategory(newLessonCategory),
    });
  };

  const handleEditLesson = (lesson) => {
    setEditingLesson(lesson);
    setEditName(lesson.name);
    setEditCategory(lesson.category != null && lesson.category !== '' ? lesson.category : '');
    setError('');
  };

  const handleUpdateLesson = () => {
    if (!editName.trim()) {
      setError('Lesson name is required');
      return;
    }
    
    updateMutation.mutate({
      id: editingLesson.id,
      data: {
        name: editName.trim(),
        category: normalizeLessonCategory(editCategory),
      },
    });
  };

  const handleDeleteLesson = (lesson) => {
    setLessonToDelete(lesson);
    setShowConfirm(true);
  };

  const confirmDelete = () => {
    if (lessonToDelete) {
      deleteMutation.mutate(lessonToDelete.id);
      setShowConfirm(false);
      setLessonToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowConfirm(false);
    setLessonToDelete(null);
  };

  const cancelEdit = () => {
    setEditingLesson(null);
    setEditName('');
    setEditCategory('');
    setError('');
  };

  const cancelAdd = () => {
    setShowAddForm(false);
    setNewLessonName('');
    setNewLessonCategory('');
    setError('');
  };

  if (fetchError) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Error Loading Lessons</h1>
        <p style={{ color: '#dc3545' }}>
          {typeof fetchError.response?.data?.error === 'string' 
            ? fetchError.response.data.error 
            : typeof fetchError.message === 'string'
            ? fetchError.message
            : 'Failed to load lessons'}
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

  return (
    <div className="lessons-page-container" style={{ 
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      maxWidth: "800px",
      margin: "40px auto",
      padding: "20px 15px 20px 15px" 
    }}>
      <Title style={{ justifyContent: 'space-between', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Image src="/books.svg" alt="Lessons" width={32} height={32} />
          Lessons Management
        </div>
      </Title>

      <div
        style={{
          maxWidth: 800,
          margin: '0 auto 16px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <InputWithButton
          placeholder="Search by lesson name"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={handleSearchKeyPress}
          onButtonClick={handleSearch}
        />
      </div>
      <div
        style={{
          maxWidth: 800,
          margin: '0 auto 24px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div className="filters-container">
          <div className="filter-row">
            <div className="filter-group">
              <label className="filter-label">Filter by category</label>
              <CourseSelect
                selectedGrade={filterCategory}
                onGradeChange={setFilterCategory}
                required={false}
                showAllOption={true}
              />
            </div>
          </div>
        </div>
      </div>

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
              Lessons
            </h2>
            <p style={{ 
              margin: '8px 0 0 0', 
              color: '#666',
              fontSize: '1rem'
            }}>
              Manage all lessons
            </p>
          </div>
          
          <button
            className="add-lesson-btn"
            onClick={() => setShowAddForm(true)}
            style={{
              padding: '12px 20px',
              backgroundColor: '#28a745',
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
          >
            <Image src="/plus.svg" alt="Add" width={20} height={20} />
            Add Lesson
          </button>
        </div>

        {/* Lessons List */}
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
                borderTop: '2px solid #007bff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              Loading lessons...
            </div>
          </div>
        ) : lessons.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h3 style={{ color: '#666', margin: '0 0 16px 0' }}>No Lessons Found</h3>
            <p style={{ color: '#999', margin: 0 }}>
              Click "Add Lesson" to create your first lesson.
            </p>
          </div>
        ) : filteredLessons.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h3 style={{ color: '#666', margin: '0 0 16px 0' }}>No lessons match</h3>
            <p style={{ color: '#999', margin: 0 }}>
              Try a different search or category filter.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {filteredLessons.map((lesson) => (
              <div
                key={lesson.id}
                className="lesson-card"
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
                <div className="lesson-info" style={{ 
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
                    {lesson.name}
                  </h4>
                  <p style={{
                    margin: '0 0 6px 0',
                    color: '#495057',
                    fontSize: '0.95rem'
                  }}>
                    <strong>Category:</strong>{' '}
                    {lesson.category != null && lesson.category !== '' ? (
                      <span style={{ color: '#1FA8DC', fontWeight: 600 }}>{lesson.category}</span>
                    ) : (
                      <span style={{ color: '#6c757d' }}>Not Categorized</span>
                    )}
                  </p>
                  <p style={{ 
                    margin: 0, 
                    color: '#666',
                    fontSize: '0.9rem'
                  }}>
                    Created: {lesson.createdAt ? new Date(lesson.createdAt).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div className="lesson-actions" style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleEditLesson(lesson)}
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
                    onClick={() => handleDeleteLesson(lesson)}
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
            ❌ {typeof error === 'string' ? error : JSON.stringify(error)}
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
            ✅ Lesson created successfully!
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
            ✅ Lesson updated successfully!
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
            <p>Are you sure you want to delete lesson <strong>{lessonToDelete?.name}</strong>?</p>
            <p><strong>This action cannot be undone!</strong></p>
            <div className="confirm-buttons">
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="confirm-delete-btn"
              >
                {deleteMutation.isPending ? "Deleting..." : "Yes, Delete Lesson"}
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

      {/* Add Lesson Modal */}
      {showAddForm && (
        <div 
          className="add-lesson-modal"
          onClick={(e) => {
            if (e.target.classList.contains('add-lesson-modal')) {
              cancelAdd();
            }
          }}
        >
          <div className="add-lesson-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Image src="/plus.svg" alt="Add" width={24} height={24} />
                Add New Lesson
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
            <div className="add-lesson-form">
              <div className="form-field">
                <label>Lesson Name <span className="required-star">*</span></label>
                <input
                  type="text"
                  value={newLessonName}
                  onChange={(e) => setNewLessonName(e.target.value)}
                  placeholder="Enter lesson name"
                  className="add-lesson-input"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddLesson()}
                  autoFocus
                  required
                />
              </div>

              <div className="form-field">
                <label>Category</label>
                <CourseSelect
                  selectedGrade={newLessonCategory}
                  onGradeChange={setNewLessonCategory}
                  required={false}
                  showAllOption={true}
                />
              </div>

              <div className="add-lesson-buttons">
                <button
                  onClick={handleAddLesson}
                  disabled={createMutation.isPending}
                  className="add-lesson-btn"
                >
                  {createMutation.isPending ? 'Saving...' : 'Add Lesson'}
                </button>
                <button
                  onClick={cancelAdd}
                  disabled={createMutation.isPending}
                  className="cancel-add-btn"
                >
                  Cancel
                </button>
              </div>
              
              {/* Error and Success Messages - at bottom */}
              {error && (
                <div className="error-message-popup">
                  {typeof error === 'string' ? error : JSON.stringify(error)}
                </div>
              )}
              {showAddSuccess && (
                <div className="success-message-popup">
                  ✅ Lesson created successfully!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Lesson Modal */}
      {editingLesson && (
        <div 
          className="edit-lesson-modal"
          onClick={(e) => {
            if (e.target.classList.contains('edit-lesson-modal')) {
              cancelEdit();
            }
          }}
        >
          <div className="edit-lesson-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Image src="/edit.svg" alt="Edit" width={24} height={24} />
                Edit Lesson
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
            <div className="edit-lesson-form">
              <div className="form-field">
                <label>Lesson Name <span className="required-star">*</span></label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter lesson name"
                  className="edit-lesson-input"
                  onKeyPress={(e) => e.key === 'Enter' && handleUpdateLesson()}
                  autoFocus
                  required
                />
              </div>

              <div className="form-field">
                <label>Category</label>
                <CourseSelect
                  selectedGrade={editCategory}
                  onGradeChange={setEditCategory}
                  required={false}
                  showAllOption={true}
                />
              </div>

              <div className="edit-lesson-buttons">
                <button
                  onClick={handleUpdateLesson}
                  disabled={updateMutation.isPending}
                  className="edit-lesson-btn"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={updateMutation.isPending}
                  className="cancel-edit-btn"
                >
                  Cancel
                </button>
              </div>
              
              {/* Error and Success Messages - at bottom */}
              {error && (
                <div className="error-message-popup">
                  {typeof error === 'string' ? error : JSON.stringify(error)}
                </div>
              )}
              {showEditSuccess && !error && (
                <div className="success-message-popup">
                  ✅ Lesson updated successfully!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .filters-container {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .filter-row {
          display: flex;
          gap: 12px;
          margin-bottom: 0;
          flex-wrap: wrap;
        }
        .filter-group {
          flex: 1;
          min-width: 180px;
        }
        .filter-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #495057;
          font-size: 0.95rem;
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
        
        .add-lesson-modal, .edit-lesson-modal {
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
        .add-lesson-content, .edit-lesson-content {
          background: #fff;
          border-radius: 12px;
          padding: 32px 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
          max-width: 500px;
          width: 100%;
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
        }
        .close-modal-btn:hover {
          background: #c82333;
          transform: scale(1.1);
        }
        .add-lesson-form, .edit-lesson-form {
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
        }
        .error-message-popup {
          background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
          color: white;
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 20px;
          text-align: center;
          font-weight: 600;
        }
        .success-message-popup {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 20px;
          text-align: center;
          font-weight: 600;
        }
        .add-lesson-input, .edit-lesson-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 1rem;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .add-lesson-input:focus, .edit-lesson-input:focus {
          border-color: #007bff;
        }
        .add-lesson-buttons, .edit-lesson-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .add-lesson-btn, .edit-lesson-btn {
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
        .add-lesson-btn:disabled, .edit-lesson-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .cancel-add-btn, .cancel-edit-btn {
          background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
        }
        
        @media (max-width: 768px) {
          .filters-container {
            padding: 16px;
          }
          .filter-row {
            flex-direction: column;
            gap: 8px;
          }
          .filter-group {
            min-width: auto;
          }
          .lessons-page-container {
            margin: 20px auto !important;
            padding: 15px 10px !important;
          }
          .container-header {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .add-lesson-btn {
            width: 100% !important;
            justify-content: center !important;
          }
          .lesson-card {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .lesson-actions {
            justify-content: center !important;
          }
          .add-lesson-content, .edit-lesson-content {
            margin: 10px !important;
            padding: 20px 16px !important;
          }
          .add-lesson-buttons, .edit-lesson-buttons {
            flex-direction: column !important;
          }
          .add-lesson-buttons button, .edit-lesson-buttons button {
            width: 100% !important;
          }
        }

        @media (max-width: 480px) {
          .filters-container {
            padding: 12px;
          }
        }
      `}</style>
    </div>
  );
}
