import { useState, useRef, useEffect } from 'react';

export default function StudentLessonSelect({ 
  availableLessons = [],
  selectedLesson, 
  onLessonChange, 
  required = false, 
  isOpen, 
  onToggle, 
  onClose, 
  placeholder = 'Select Lesson' 
}) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleLessonSelect = (lesson) => {
    onLessonChange(lesson);
    onClose();
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          padding: '14px 16px',
          border: isOpen ? '2px solid #1FA8DC' : '2px solid #e9ecef',
          borderRadius: '10px',
          backgroundColor: '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '1rem',
          color: selectedLesson && selectedLesson !== 'n/a' ? '#1FA8DC' : '#adb5bd',
          backgroundColor: selectedLesson && selectedLesson !== 'n/a' ? '#f0f8ff' : '#ffffff',
          fontWeight: selectedLesson && selectedLesson !== 'n/a' ? '600' : '400',
          transition: 'all 0.3s ease',
          boxShadow: isOpen ? '0 0 0 3px rgba(31, 168, 220, 0.1)' : 'none'
        }}
        onClick={onToggle}
      >
        <span>{selectedLesson && selectedLesson !== 'n/a' ? selectedLesson : placeholder}</span>
      </div>
      
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: '#ffffff',
          border: '2px solid #e9ecef',
          borderRadius: '10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          zIndex: 1000,
          maxHeight: '200px',
          overflowY: 'auto',
          marginTop: '4px'
        }}>
          {/* Clear selection option */}
          <div
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              borderBottom: '1px solid #f8f9fa',
              transition: 'background-color 0.2s ease',
              color: '#dc3545',
              fontWeight: '500'
            }}
            onClick={() => handleLessonSelect('')}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#fff5f5'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
          >
            ✕ Clear selection
          </div>
          {availableLessons.length === 0 ? (
            <div style={{
              padding: '12px 16px',
              textAlign: 'center',
              color: '#999',
              fontSize: '0.9rem'
            }}>
              No lessons available
            </div>
          ) : (
            availableLessons.map((lesson) => (
              <div
                key={lesson}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f8f9fa',
                  transition: 'background-color 0.2s ease',
                  color: selectedLesson === lesson ? '#1FA8DC' : '#000000',
                  backgroundColor: selectedLesson === lesson ? '#f0f8ff' : '#ffffff',
                  fontWeight: selectedLesson === lesson ? '600' : '400'
                }}
                onClick={() => handleLessonSelect(lesson)}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
              >
                {lesson}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
