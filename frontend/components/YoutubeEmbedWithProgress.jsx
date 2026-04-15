import { useEffect, useRef, useId } from "react";

/**
 * YouTube embed using IFrame API so we can detect when the user has watched
 * at least a fraction of the video (default 10%). Fires onThresholdReached once.
 */
export default function YoutubeEmbedWithProgress({
  youtubeVideoId,
  onThresholdReached,
  thresholdFraction = 0.1,
  style,
  className,
}) {
  const cbRef = useRef(onThresholdReached);
  cbRef.current = onThresholdReached;

  const playerRef = useRef(null);
  const intervalRef = useRef(null);
  const thresholdDoneRef = useRef(false);
  const reactId = useId().replace(/:/g, "");
  const playerDivId = `yt-prog-${reactId}`;

  useEffect(() => {
    thresholdDoneRef.current = false;
  }, [youtubeVideoId]);

  useEffect(() => {
    if (!youtubeVideoId || typeof window === "undefined") return;

    let destroyed = false;

    const checkProgress = (player) => {
      if (thresholdDoneRef.current || destroyed) return;
      try {
        const dur = player.getDuration();
        const cur = player.getCurrentTime();
        if (dur > 0 && cur / dur >= thresholdFraction) {
          thresholdDoneRef.current = true;
          cbRef.current?.();
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch {
        // ignore
      }
    };

    const initPlayer = () => {
      if (destroyed || !window.YT?.Player) return;
      playerRef.current = new window.YT.Player(playerDivId, {
        videoId: youtubeVideoId,
        width: "100%",
        height: "100%",
        playerVars: {
          controls: 1,
          rel: 0,
          modestbranding: 1,
          disablekb: 1,
          fs: 1,
        },
        events: {
          onReady: (e) => {
            if (destroyed) return;
            intervalRef.current = setInterval(() => checkProgress(e.target), 500);
          },
        },
      });
    };

    const pollTimer = setInterval(() => {
      if (destroyed) {
        clearInterval(pollTimer);
        return;
      }
      if (window.YT?.Player) {
        clearInterval(pollTimer);
        initPlayer();
      }
    }, 100);

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }

    return () => {
      destroyed = true;
      clearInterval(pollTimer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      try {
        playerRef.current?.destroy?.();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
  }, [youtubeVideoId, playerDivId, thresholdFraction]);

  if (!youtubeVideoId) {
    return null;
  }

  return (
    <div
      id={playerDivId}
      className={className}
      style={{
        width: "100%",
        aspectRatio: "16 / 9",
        maxHeight: "100vh",
        backgroundColor: "#000",
        ...style,
      }}
    />
  );
}
