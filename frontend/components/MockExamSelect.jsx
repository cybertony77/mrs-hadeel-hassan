import { useState, useRef, useEffect } from 'react';

export default function MockExamSelect({ selectedMockExam, onSelectMockExam, placeholder = 'Select Mock Exam', options }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Exam options for dropdown - use provided options or default (Exam 1 to Exam 50)
  const examOptions = options && Array.isArray(options) && options.length > 0
    ? options
    : Array.from({ length: 50 }, (_, i) => `Exam ${i + 1}`);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleSelect = (exam) => {
    onSelectMockExam(exam);
    setIsDropdownOpen(false);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }} ref={dropdownRef}>
      <div
        style={{
          padding: '14px 16px',
          border: isDropdownOpen ? '2px solid #1FA8DC' : '2px solid #e9ecef',
          borderRadius: '10px',
          backgroundColor: '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '1rem',
          color: selectedMockExam ? '#1FA8DC' : '#adb5bd',
          backgroundColor: selectedMockExam ? '#f0f8ff' : '#ffffff',
          fontWeight: selectedMockExam ? '600' : '400',
          transition: 'all 0.3s ease',
          boxShadow: isDropdownOpen ? '0 0 0 3px rgba(31, 168, 220, 0.1)' : 'none'
        }}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <span>{selectedMockExam || placeholder}</span>
      </div>
      
      {isDropdownOpen && (
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
            onClick={() => handleSelect('')}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#fff5f5'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
          >
            ✕ Clear selection
          </div>
          {examOptions.map((exam) => (
            <div
              key={exam}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #f8f9fa',
                transition: 'background-color 0.2s ease',
                color: selectedMockExam === exam ? '#1FA8DC' : '#000000',
                backgroundColor: selectedMockExam === exam ? '#f0f8ff' : '#ffffff',
                fontWeight: selectedMockExam === exam ? '600' : '400'
              }}
              onClick={() => handleSelect(exam)}
              onMouseEnter={(e) => {
                if (selectedMockExam !== exam) {
                  e.target.style.backgroundColor = '#f8f9fa';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedMockExam !== exam) {
                  e.target.style.backgroundColor = '#ffffff';
                }
              }}
            >
              {exam}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
