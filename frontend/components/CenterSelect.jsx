import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/axios';

/** Same cache entry as dashboard/centers.jsx — must return full center objects, not only names. */
function centerRowKey(c) {
  if (c == null) return '';
  return String(c.id ?? c._id ?? c.name ?? '');
}

function selectedCenterLabel(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof value.name === 'string') return value.name;
  return '';
}

export default function CenterSelect({ selectedCenter, onCenterChange, required = false, isOpen, onToggle, onClose }) {
  // Handle legacy props (value, onChange) for backward compatibility
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const actualIsOpen = isOpen !== undefined ? isOpen : internalIsOpen;
  const actualOnToggle = onToggle || (() => setInternalIsOpen(!internalIsOpen));
  const actualOnClose = onClose || (() => setInternalIsOpen(false));

  const selectedLabel = useMemo(() => selectedCenterLabel(selectedCenter), [selectedCenter]);

  // Authentication is now handled by _app.js with HTTP-only cookies

  // Fetch centers from API (same shape as pages/dashboard/centers.jsx — shared React Query cache)
  const { data: centers = [], isLoading, error } = useQuery({
    queryKey: ['centers'],
    queryFn: async () => {
      const response = await apiClient.get('/api/centers');
      return Array.isArray(response.data?.centers) ? response.data.centers : [];
    },
    retry: 3,
    retryDelay: 1000,
    staleTime: 0, // Always consider data stale for immediate updates
    gcTime: 10 * 60 * 1000 // 10 minutes
  });

  const handleCenterSelect = (centerName) => {
    onCenterChange(centerName);
    actualOnClose();
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          padding: '14px 16px',
          border: actualIsOpen ? '2px solid #1FA8DC' : '2px solid #e9ecef',
          borderRadius: '10px',
          backgroundColor: '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '1rem',
          color: selectedLabel ? '#1FA8DC' : '#adb5bd',
          backgroundColor: selectedLabel ? '#f0f8ff' : '#ffffff',
          fontWeight: selectedLabel ? '600' : '400',
          transition: 'all 0.3s ease',
          boxShadow: actualIsOpen ? '0 0 0 3px rgba(31, 168, 220, 0.1)' : 'none'
        }}
        onClick={actualOnToggle}
        onBlur={() => setTimeout(actualOnClose, 200)}
      >
        <span>
          {isLoading ? 'Loading centers...' : (selectedLabel || 'Select Center')}
        </span>
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
            onClick={() => handleCenterSelect('')}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#fff5f5'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
          >
            ✕ Clear selection
          </div>
          {error ? (
            <div
              style={{
                padding: '12px 16px',
                color: '#dc3545',
                fontSize: '0.9rem',
                textAlign: 'center'
              }}
            >
              Error loading centers
            </div>
          ) : isLoading ? (
            <div
              style={{
                padding: '12px 16px',
                color: '#666',
                fontSize: '0.9rem',
                textAlign: 'center'
              }}
            >
              Loading centers...
            </div>
          ) : centers.length === 0 ? (
            <div
              style={{
                padding: '12px 16px',
                color: '#666',
                fontSize: '0.9rem',
                textAlign: 'center'
              }}
            >
              No centers available
            </div>
          ) : centers.map((center) => {
            const name = center?.name != null ? String(center.name) : '';
            const rowKey = centerRowKey(center) || name;
            const isSelected = Boolean(name && selectedLabel === name);
            return (
            <div
              key={rowKey}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #f8f9fa',
                transition: 'background-color 0.2s ease',
                color: isSelected ? '#1FA8DC' : '#000000',
                backgroundColor: isSelected ? '#f0f8ff' : '#ffffff',
                fontWeight: isSelected ? '600' : '400'
              }}
              onClick={() => handleCenterSelect(name)}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isSelected ? '#f0f8ff' : '#ffffff';
              }}
            >
              {name || '(Unnamed center)'}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 