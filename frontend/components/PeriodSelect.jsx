import { useState } from 'react';

export default function PeriodSelect({ selectedPeriod, onPeriodChange, required = false, isOpen, onToggle, onClose, compact = false }) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const actualIsOpen = isOpen !== undefined ? isOpen : internalIsOpen;
  const actualOnToggle = onToggle || (() => setInternalIsOpen(!internalIsOpen));
  const actualOnClose = onClose || (() => setInternalIsOpen(false));

  const handlePeriodSelect = (period) => {
    onPeriodChange(period);
    actualOnClose();
  };

  const periods = ["AM", "PM"];

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          padding: compact ? '8px 8px' : '14px 16px',
          border: actualIsOpen ? '2px solid #1FA8DC' : '2px solid #e9ecef',
          borderRadius: compact ? '8px' : '10px',
          backgroundColor: selectedPeriod ? '#f0f8ff' : '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: compact ? '0.9rem' : '1rem',
          color: selectedPeriod ? '#1FA8DC' : '#adb5bd',
          fontWeight: selectedPeriod ? '600' : '400',
          transition: 'all 0.3s ease',
          boxShadow: actualIsOpen ? '0 0 0 3px rgba(31, 168, 220, 0.1)' : 'none',
          minHeight: compact ? '37px' : 'auto',
          boxSizing: 'border-box'
        }}
        onClick={actualOnToggle}
        onBlur={() => setTimeout(actualOnClose, 200)}
      >
        <span>{selectedPeriod || (compact ? 'AM/PM' : 'Select Period')}</span>
      </div>
      
      {actualIsOpen && (
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
          marginTop: '4px',
          minWidth: compact ? '80px' : 'auto'
        }}>
          {selectedPeriod && (
            <div
              key="cancel"
              style={{
                padding: compact ? '8px 10px' : '12px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #f8f9fa',
                transition: 'background-color 0.2s ease',
                color: '#dc3545',
                backgroundColor: '#ffffff',
                fontWeight: '500',
                textAlign: 'center',
                fontSize: compact ? '0.85rem' : '1rem'
              }}
              onClick={() => handlePeriodSelect('')}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#fff5f5'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
            >
              Cancel
            </div>
          )}
          {periods.map((period) => (
            <div
              key={period}
              style={{
                padding: compact ? '8px 10px' : '12px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #f8f9fa',
                transition: 'background-color 0.2s ease',
                color: selectedPeriod === period ? '#1FA8DC' : '#000000',
                backgroundColor: selectedPeriod === period ? '#f0f8ff' : '#ffffff',
                fontWeight: selectedPeriod === period ? '600' : '400',
                textAlign: 'center',
                fontSize: compact ? '0.9rem' : '1rem'
              }}
              onClick={() => handlePeriodSelect(period)}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
            >
              {period}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



