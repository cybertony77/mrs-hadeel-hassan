import { useMemo, useRef } from 'react';
import VideoWatermarkOverlay from './VideoWatermarkOverlay';

export default function ZoomVideoPlayer({
  meetingId,
  onMilestonePercent,
  onComplete,
  videoId,
  watermarkText,
}) {
  const hasMilestoneRef = useRef(false);
  const hasCompleteRef = useRef(false);
  const src = useMemo(() => {
    if (!meetingId) return '';
    return `/api/videos/zoom/${encodeURIComponent(String(meetingId).trim())}`;
  }, [meetingId]);

  const handleTimeUpdate = (event) => {
    const video = event.currentTarget;
    if (!video.duration) return;
    const percent = (video.currentTime / video.duration) * 100;

    if (!hasMilestoneRef.current && percent >= 10 && onMilestonePercent) {
      hasMilestoneRef.current = true;
      onMilestonePercent(videoId, percent);
    }

    if (!hasCompleteRef.current && percent >= 90 && onComplete) {
      hasCompleteRef.current = true;
      onComplete(videoId, percent);
    }
  };

  if (!meetingId) {
    return (
      <div style={{ color: '#fff', padding: '32px', textAlign: 'center' }}>
        No Zoom meeting ID provided
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        maxHeight: '100vh',
        position: 'relative',
        backgroundColor: '#000',
        overflow: 'hidden',
      }}
    >
      <video
        src={src}
        controls
        controlsList="nodownload"
        disablePictureInPicture
        playsInline
        style={{
          width: '100%',
          height: 'auto',
          maxHeight: '100vh',
          aspectRatio: '16 / 9',
          backgroundColor: '#000',
          outline: 'none',
          display: 'block',
        }}
        onTimeUpdate={handleTimeUpdate}
      />
      <VideoWatermarkOverlay text={watermarkText} />
    </div>
  );
}
