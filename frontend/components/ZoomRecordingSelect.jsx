import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const fetchRecordings = (token) => {
  const url = token?.trim()
    ? `/api/zoom/recordings?next_page_token=${encodeURIComponent(token.trim())}`
    : '/api/zoom/recordings';

  return axios.get(url);
};

export default function ZoomRecordingSelect({ selectedValue, onSelect }) {
  const [tokenHistory, setTokenHistory] = useState(['']);
  const [isOpen, setIsOpen] = useState(false);
  const currentToken = tokenHistory[tokenHistory.length - 1];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['zoom-recordings', currentToken],
    queryFn: async () => {
      const response = await fetchRecordings(currentToken);
      return response.data;
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    enabled: isOpen,
  });

  const meetings = useMemo(() => data?.meetings || [], [data]);
  const nextPageToken = String(data?.next_page_token || '');
  const hasPrev = tokenHistory.length > 1;
  const hasNext = Boolean(nextPageToken);

  const handlePrev = () => {
    if (!hasPrev) return;
    setTokenHistory((prev) => prev.slice(0, -1));
  };

  const handleNext = () => {
    if (!hasNext) return;
    setTokenHistory((prev) => [...prev, nextPageToken]);
  };

  const showPagination = hasPrev || hasNext;
  const selectedMeeting = meetings.find((meeting) => selectedValue === meeting.uuid);
  const triggerLabel = selectedMeeting
    ? `Date : ${selectedMeeting.created_at_formated || '-'}, Duration : ${selectedMeeting.duration_furmated || '-'}`
    : 'Select Zoom recording';

  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ marginBottom: '8px', color: '#333', fontWeight: '600', fontSize: '0.95rem' }}>
        Zoom Recordings Select
      </div>
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          padding: '12px 14px',
          border: isOpen ? '2px solid #1FA8DC' : '1px solid #dfe6ee',
          borderRadius: '10px',
          background: isOpen ? '#eef8ff' : '#fff',
          cursor: 'pointer',
          fontWeight: selectedValue ? 600 : 500,
          color: selectedValue ? '#1fa8dc' : '#777',
          marginBottom: isOpen ? '8px' : '0',
          transition: 'all 0.2s ease',
        }}
      >
        {triggerLabel}
      </div>

      {isOpen && (
        <>
          <div
            style={{
              border: '1px solid #dfe6ee',
              borderRadius: '12px',
              background: 'linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #edf2f7',
                color: '#dc3545',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                background: '#fff',
              }}
              onClick={() => {
                onSelect('');
                setIsOpen(false);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fff5f5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fff';
              }}
            >
              ✕ Cancel selection
            </div>
            <div style={{ maxHeight: '260px', overflowY: 'auto', background: '#fff' }}>
              {isLoading || isFetching ? (
                <div
                  style={{
                    padding: '18px 16px',
                    color: '#4b5563',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    fontWeight: 500,
                  }}
                >
                  <span
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #cbd5e1',
                      borderTopColor: '#1FA8DC',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'zoomSelectSpin 0.8s linear infinite',
                    }}
                  />
                  Loading Zoom recordings...
                </div>
              ) : meetings.length === 0 ? (
                <div style={{ padding: '14px 16px', color: '#6b7280', textAlign: 'center', fontWeight: 500 }}>
                  No recordings found
                </div>
              ) : (
                meetings.map((meeting) => {
                  const isSelected = selectedValue === meeting.uuid;
                  return (
                    <div
                      key={meeting.uuid || String(meeting.id)}
                      onClick={() => {
                        onSelect(meeting.uuid);
                        setIsOpen(false);
                      }}
                      style={{
                        padding: '13px 16px',
                        borderBottom: '1px solid #f3f6f9',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#eef8ff' : '#fff',
                        color: isSelected ? '#1fa8dc' : '#111827',
                        fontWeight: isSelected ? 600 : 500,
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fbff';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = '#fff';
                      }}
                    >
                      Date : {meeting.created_at_formated || '-'}, Duration : {meeting.duration_furmated || '-'}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {showPagination && (
            <div className="zoom-pagination" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', gap: '8px' }}>
              <button
                type="button"
                onClick={handlePrev}
                disabled={!hasPrev}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: hasPrev ? '1px solid #d5e3ef' : '1px solid #e5e7eb',
                  background: hasPrev ? '#ffffff' : '#f3f4f6',
                  color: hasPrev ? '#1f2937' : '#9ca3af',
                  cursor: hasPrev ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (hasPrev) e.currentTarget.style.background = '#f8fbff';
                }}
                onMouseLeave={(e) => {
                  if (hasPrev) e.currentTarget.style.background = '#ffffff';
                }}
              >
                Previous 50
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!hasNext}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: hasNext ? '1px solid #d5e3ef' : '1px solid #e5e7eb',
                  background: hasNext ? '#ffffff' : '#f3f4f6',
                  color: hasNext ? '#1f2937' : '#9ca3af',
                  cursor: hasNext ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (hasNext) e.currentTarget.style.background = '#f8fbff';
                }}
                onMouseLeave={(e) => {
                  if (hasNext) e.currentTarget.style.background = '#ffffff';
                }}
              >
                Next 50
              </button>
            </div>
          )}
        </>
      )}
      <style jsx>{`
        @keyframes zoomSelectSpin {
          to {
            transform: rotate(360deg);
          }
        }
        @media (max-width: 768px) {
          .zoom-pagination {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
