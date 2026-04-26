import { useEffect, useMemo, useRef, useState } from 'react';

export default function VideoWatermarkOverlay({ text }) {
  const containerRef = useRef(null);
  const markRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const resolvedText = useMemo(() => {
    const raw = typeof text === 'string' ? text.trim() : '';
    return raw || 'Protected Video';
  }, [text]);

  useEffect(() => {
    const containerEl = containerRef.current;
    const markEl = markRef.current;
    if (!containerEl || !markEl) return;

    let rafId = null;
    let lastTs = 0;
    let vx = 30;
    let vy = 20;
    let x = 20;
    let y = 16;

    const clamp = () => {
      const maxX = Math.max(0, containerEl.clientWidth - markEl.offsetWidth);
      const maxY = Math.max(0, containerEl.clientHeight - markEl.offsetHeight);
      x = Math.max(0, Math.min(x, maxX));
      y = Math.max(0, Math.min(y, maxY));
      setPos({ x, y });
      return { maxX, maxY };
    };

    const onResize = () => clamp();

    const tick = (ts) => {
      if (!lastTs) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;
      const { maxX, maxY } = clamp();

      x += vx * dt;
      y += vy * dt;

      if (x <= 0) {
        x = 0;
        vx = Math.abs(vx);
      } else if (x >= maxX) {
        x = maxX;
        vx = -Math.abs(vx);
      }

      if (y <= 0) {
        y = 0;
        vy = Math.abs(vy);
      } else if (y >= maxY) {
        y = maxY;
        vy = -Math.abs(vy);
      }

      setPos({ x, y });
      rafId = requestAnimationFrame(tick);
    };

    clamp();
    rafId = requestAnimationFrame(tick);
    window.addEventListener('resize', onResize);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }, [resolvedText]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 4,
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      aria-hidden
    >
      <span
        ref={markRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          color: 'rgba(255,255,255,0.30)',
          fontSize: 'clamp(11px, 1.4vw, 16px)',
          letterSpacing: '1.2px',
          fontWeight: 700,
          textTransform: 'uppercase',
          textShadow: '0 1px 2px rgba(0,0,0,0.45)',
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
          whiteSpace: 'nowrap',
          mixBlendMode: 'screen',
        }}
      >
        {resolvedText}
      </span>
    </div>
  );
}
