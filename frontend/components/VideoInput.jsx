import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ZoomRecordingSelect from './ZoomRecordingSelect';
import { useSystemConfig } from '../lib/api/system';

export default function VideoInput({
  index,
  video,
  onVideoNameChange,
  onYouTubeUrlChange,
  onZoomMeetingIdChange,
  onClearYouTubeUrl,
  onClearZoomMeetingId,
  onR2Upload,
  onClearR2Upload,
  onVideoSourceChange,
  onRemove,
  canRemove,
  errors,
  showUploadTab,
}) {
  const { data: systemConfig } = useSystemConfig();
  const showZoomTab =
    systemConfig?.zoom_integrations === true || systemConfig?.zoom_integrations === 'true';

  const initialTab = (() => {
    if (video.video_source === 'r2' && showUploadTab) return 'upload';
    if (video.video_source === 'zoom' && showZoomTab) return 'zoom';
    return 'youtube';
  })();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [uploadProgress, setUploadProgress] = useState(video.upload_progress || 0);
  /** 'sending' = bytes leaving browser; 'finishing' = bytes sent, waiting for HTTP OK (R2 or server→R2) */
  const [uploadPhase, setUploadPhase] = useState('idle');
  const [uploadStatus, setUploadStatus] = useState(video.upload_status || 'idle'); // idle | uploading | done | error
  const [uploadFileName, setUploadFileName] = useState(video.upload_file_name || '');
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);
  const xhrRef = useRef(null);

  // If Zoom integration is off but this video was saved as zoom, move off zoom tab and clear zoom fields
  useEffect(() => {
    if (systemConfig === undefined) return;
    if (!showZoomTab && video.video_source === 'zoom') {
      onVideoSourceChange(index, 'youtube');
      onClearZoomMeetingId(index);
      setActiveTab('youtube');
    }
  }, [systemConfig, showZoomTab, video.video_source, index, onVideoSourceChange, onClearZoomMeetingId]);

  // Sync activeTab when video data changes (e.g. edit page loads session data async)
  useEffect(() => {
    if (video.video_source === 'r2' && showUploadTab) {
      setActiveTab('upload');
      setUploadStatus(video.upload_status || (video.r2_key ? 'done' : 'idle'));
      setUploadProgress(video.upload_progress || (video.r2_key ? 100 : 0));
      setUploadFileName(video.upload_file_name || '');
    } else if (video.video_source === 'zoom' && showZoomTab) {
      setActiveTab('zoom');
    } else {
      setActiveTab('youtube');
    }
  }, [video.video_source, video.r2_key, showUploadTab, showZoomTab]);

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    onVideoSourceChange(index, tab === 'upload' ? 'r2' : tab === 'zoom' ? 'zoom' : 'youtube');
    // When switching tabs, clear the other tab's data
    if (tab === 'youtube') {
      onClearR2Upload(index);
      onClearZoomMeetingId(index);
    } else if (tab === 'upload') {
      onClearYouTubeUrl(index);
      onClearZoomMeetingId(index);
    } else if (tab === 'zoom') {
      onClearYouTubeUrl(index);
      onClearR2Upload(index);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('❌ Invalid file type. Please upload a video file (MP4, WebM, OGG, MOV, AVI, MKV).');
      return;
    }

    // Validate file size (max 5GB)
    if (file.size > 5 * 1024 * 1024 * 1024) {
      setUploadError('❌ File size exceeds 5GB limit.');
      return;
    }

    setUploadError('');
    setUploadFileName(file.name);
    setUploadStatus('uploading');
    setUploadProgress(0);
    setUploadPhase('sending');

    try {
      let corsSetupError = null;
      try {
        await axios.post('/api/upload/r2-setup-cors');
      } catch (setupErr) {
        corsSetupError =
          setupErr?.response?.data?.details ||
          setupErr?.response?.data?.error ||
          setupErr?.message ||
          'Unknown CORS setup error';
      }

      // Step 1: Key + presigned PUT URL from our API (also applies bucket CORS when possible)
      const { data } = await axios.post('/api/upload/r2-signed-url', {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
      });

      const { signedUrl, key, contentType: signedContentType, corsSetup } = data;
      const putContentType = signedContentType || file.type || 'application/octet-stream';

      const runXhr = (opts) =>
        new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrRef.current = xhr;
          // Large videos: avoid browser default timeout (often none, but some stacks cap)
          xhr.timeout = 0;

          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && event.total > 0) {
              const raw = (event.loaded / event.total) * 100;
              // Never show 100% until xhr 'load' — bytes may be sent but storage still confirming / server still pushing to R2
              const capped = Math.min(99, Math.round(raw));
              setUploadProgress(capped);
              setUploadPhase(event.loaded >= event.total ? 'finishing' : 'sending');
            }
          });

          xhr.addEventListener('loadstart', () => {
            setUploadPhase('sending');
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setUploadProgress(100);
              setUploadPhase('done');
              resolve();
            } else {
              reject(new Error(opts.label + xhr.status));
            }
          });

          xhr.addEventListener('error', () => reject(new Error(opts.label + 'network')));
          xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
          xhr.addEventListener('timeout', () => reject(new Error(opts.label + 'timeout')));

          opts.openSend(xhr);
        });

      // Step 2: Browser -> R2 direct PUT only (no server proxy uploads).
      try {
        await runXhr({
          label: 'direct:',
          openSend: (xhr) => {
            xhr.open('PUT', signedUrl);
            xhr.setRequestHeader('Content-Type', putContentType);
            xhr.send(file);
          },
        });
      } catch (directErr) {
        if (directErr.message === 'Upload cancelled') throw directErr;
        const corsDetails = corsSetupError || corsSetup?.error;
        throw new Error(
          corsDetails
            ? `Direct upload blocked by R2 CORS: ${corsDetails}`
            : 'Direct upload to storage failed. Please check R2 CORS and try again.'
        );
      }

      // Step 3: Success - save the R2 key
      setUploadStatus('done');
      onR2Upload(index, key, file.name);

    } catch (error) {
      setUploadPhase('idle');
      if (error.message === 'Upload cancelled') {
        setUploadStatus('idle');
        setUploadProgress(0);
        setUploadFileName('');
      } else {
        setUploadStatus('error');
        setUploadError(error.message || 'Upload failed. Please try again.');
      }
    }
  };

  const handleCancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
  };

  const handleRemoveUpload = () => {
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadPhase('idle');
    setUploadFileName('');
    setUploadError('');
    onR2Upload(index, '', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const tabStyle = (isActive) => ({
    flex: 1,
    padding: '10px 16px',
    border: 'none',
    borderBottom: isActive ? '3px solid #1FA8DC' : '3px solid transparent',
    backgroundColor: isActive ? '#f0f8ff' : 'transparent',
    color: isActive ? '#1FA8DC' : '#666',
    fontWeight: isActive ? '600' : '400',
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    borderRadius: '6px 6px 0 0',
  });

  return (
    <div style={{
      marginBottom: '24px',
      padding: '20px',
      border: '2px solid #e9ecef',
      borderRadius: '8px',
      backgroundColor: '#f8f9fa'
    }}>
      {/* Header with Video number and Remove button */}
      <div className="video-input-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h4 style={{ margin: 0, color: '#333' }}>Video {index + 1}</h4>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            ❌ Remove
          </button>
        )}
      </div>

      {/* Tabs */}
      {(
        <div className="video-input-tabs" style={{
          display: 'flex',
          borderBottom: '1px solid #e9ecef',
          marginBottom: '16px',
          gap: '4px',
        }}>
          <button
            type="button"
            onClick={() => handleTabSwitch('youtube')}
            style={tabStyle(activeTab === 'youtube')}
          >
            YouTube
          </button>
          {showUploadTab && (
            <button
              type="button"
              onClick={() => handleTabSwitch('upload')}
              style={tabStyle(activeTab === 'upload')}
            >
              Upload
            </button>
          )}
          {showZoomTab && (
            <button
              type="button"
              onClick={() => handleTabSwitch('zoom')}
              style={tabStyle(activeTab === 'zoom')}
            >
              Zoom
            </button>
          )}
        </div>
      )}

      {/* Video Name Input - shown in both tabs */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
          Video Name
        </label>
        <input
          type="text"
          value={video.video_name || ''}
          onChange={(e) => onVideoNameChange(index, e.target.value)}
          placeholder={`Video ${index + 1}`}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '1rem',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* YouTube Tab Content */}
      {activeTab === 'youtube' && (
        <div style={{ marginBottom: '0' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
            YouTube URL <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="text"
            value={video.youtube_url || ''}
            onChange={(e) => onYouTubeUrlChange(index, e.target.value)}
            placeholder="Enter YouTube Video URL"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: errors[`video_${index}_youtube_url`] ? '2px solid #dc3545' : '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
          />
          {errors[`video_${index}_youtube_url`] && (
            <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
              {errors[`video_${index}_youtube_url`]}
            </div>
          )}
        </div>
      )}

      {/* Upload Tab Content */}
      {activeTab === 'upload' && showUploadTab && (
        <div>
          <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
            Upload Video <span style={{ color: 'red' }}>*</span>
          </label>

          {/* Upload area */}
          {uploadStatus === 'idle' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: errors[`video_${index}_upload`] ? '2px dashed #dc3545' : '2px dashed #ccc',
                borderRadius: '8px',
                padding: '32px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: '#fff',
                transition: 'border-color 0.2s ease',
              }}
              onMouseOver={(e) => { if (!errors[`video_${index}_upload`]) e.currentTarget.style.borderColor = '#1FA8DC'; }}
              onMouseOut={(e) => { if (!errors[`video_${index}_upload`]) e.currentTarget.style.borderColor = '#ccc'; }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px', color: '#999' }}>
                +
              </div>
              <div style={{ color: '#666', fontSize: '0.95rem' }}>
                Click to select a video file
              </div>
              <div style={{ color: '#999', fontSize: '0.8rem', marginTop: '4px' }}>
                MP4, WebM, OGG, MOV, AVI, MKV (max 5GB)
              </div>
            </div>
          )}

          {/* Uploading state with progress bar */}
          {uploadStatus === 'uploading' && (
            <div style={{
              border: '2px solid #1FA8DC',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#333', fontSize: '0.9rem', fontWeight: '500' }}>
                  {uploadPhase === 'finishing'
                    ? 'Finishing'
                    : 'Uploading'}
                  : {uploadFileName}
                </span>
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  style={{
                    padding: '4px 10px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
              {/* Progress bar */}
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#e9ecef',
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${uploadProgress}%`,
                  height: '100%',
                  backgroundColor: '#1FA8DC',
                  borderRadius: '4px',
                  transition: uploadPhase === 'finishing' ? 'none' : 'width 0.2s ease-out',
                }} />
              </div>
              <div style={{ textAlign: 'right', marginTop: '6px', color: '#666', fontSize: '0.85rem' }}>
                {uploadProgress}%
              </div>
            </div>
          )}

          {/* Upload done state */}
          {uploadStatus === 'done' && (
            <div style={{
              border: '2px solid #28a745',
              borderRadius: '8px',
              padding: '16px 20px',
              backgroundColor: '#f0fff4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ color: '#28a745', fontWeight: '600', fontSize: '0.9rem' }}>
                  ✅ Uploaded successfully
                </div>
                <div style={{ color: '#666', fontSize: '0.85rem', marginTop: '2px' }}>
                  {uploadFileName}
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveUpload}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                ❌ Remove
              </button>
            </div>
          )}

          {/* Upload error state */}
          {uploadStatus === 'error' && (
            <div style={{
              border: '2px solid #dc3545',
              borderRadius: '8px',
              padding: '16px 20px',
              backgroundColor: '#fff5f5',
            }}>
              <div style={{ color: '#dc3545', fontWeight: '500', fontSize: '0.9rem', marginBottom: '8px' }}>
                ❌ Upload failed: {uploadError}
              </div>
              <button
                type="button"
                onClick={() => {
                  setUploadStatus('idle');
                  setUploadProgress(0);
                  setUploadPhase('idle');
                  setUploadFileName('');
                  setUploadError('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#1FA8DC',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {errors[`video_${index}_upload`] && (
            <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
              {errors[`video_${index}_upload`]}
            </div>
          )}
        </div>
      )}

      {/* Zoom Tab Content */}
      {showZoomTab && activeTab === 'zoom' && (
        <div className="zoom-tab-content" style={{ marginBottom: '0' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
            Zoom Meeting ID (or UUID) <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="text"
            value={video.zoom_meeting_id || ''}
            onChange={(e) => onZoomMeetingIdChange(index, e.target.value)}
            placeholder="Enter Zoom Meeting ID"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: errors[`video_${index}_zoom_meeting_id`] ? '2px solid #dc3545' : '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
          />
          {errors[`video_${index}_zoom_meeting_id`] && (
            <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
              {errors[`video_${index}_zoom_meeting_id`]}
            </div>
          )}

          <ZoomRecordingSelect
            selectedValue={video.zoom_meeting_id || ''}
            onSelect={(value) => onZoomMeetingIdChange(index, value)}
          />
        </div>
      )}

      <style jsx>{`
        @media (max-width: 768px) {
          .video-input-header {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 10px;
          }
          .video-input-tabs {
            flex-wrap: wrap;
            gap: 6px !important;
          }
          .video-input-tabs button {
            min-width: 100px;
            flex: 1 1 calc(50% - 6px);
          }
          .zoom-tab-content {
            margin-top: 4px;
          }
        }
        @media (max-width: 480px) {
          .video-input-tabs button {
            flex: 1 1 100%;
          }
        }
      `}</style>
    </div>
  );
}
