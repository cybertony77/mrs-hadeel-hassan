import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconZoomIn, IconZoomOut, IconX } from '@tabler/icons-react';
import { Image } from '@mantine/core';

/** Toolbar on teal gradient — not the same as carousel arrow styling */
const TEAL = '#1fa8dc';
const TEAL_MUTED = 'rgba(31, 168, 220, 0.35)';
const TEAL_SOFT_BG = 'rgba(31, 168, 220, 0.1)';
const TEAL_BORDER = 'rgba(31, 168, 220, 0.5)';

const zoomBtnEnabled = (disabled) => ({
  padding: '10px 14px',
  border: `1px solid ${disabled ? 'transparent' : TEAL_BORDER}`,
  background: disabled ? TEAL_SOFT_BG : 'rgba(255, 255, 255, 0.95)',
  color: disabled ? TEAL_MUTED : TEAL,
  borderRadius: '8px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease',
  fontWeight: '600',
  boxShadow: disabled ? 'none' : '0 2px 4px rgba(31, 168, 220, 0.12)',
});

const resetZoomBtnStyle = {
  padding: '10px 14px',
  border: '1px solid rgba(220, 53, 69, 0.35)',
  background: 'rgba(255, 255, 255, 0.95)',
  color: '#dc3545',
  borderRadius: '8px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease',
  fontWeight: '600',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
};

export default function ZoomableImage({ src, alt = 'Question Image', style = {}, onImageLoad }) {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  // Removed draggable controls - now using fixed bar above image
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const controlsRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  const minZoom = 0.5;
  const maxZoom = 3;
  const zoomStep = 0.25;

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + zoomStep, maxZoom));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - zoomStep, minZoom));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (!isFullscreen) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      // Controls are now fixed bar, no position reset needed
    }
  };

  const handleMouseDown = (e) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  // Removed handleControlsMouseDown - controls are now fixed bar, no dragging needed

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging && zoom > 1) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        setPosition({
          x: newX,
          y: newY
        });
      }
      // Removed dragging controls logic - controls are now fixed bar
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleTouchMove = (e) => {
      // Removed touch dragging controls logic - controls are now fixed bar
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      // Removed setIsDraggingControls - controls are now fixed bar
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, dragStart, zoom]);

  // Reset position when zoom resets
  useEffect(() => {
    if (zoom === 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [zoom]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return;
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isFullscreen, mounted]);

  if (!src) return null;

  return (
    <>
      <div 
        ref={containerRef}
        className="zoomable-image-container"
        style={{
          position: 'relative',
          marginBottom: '24px',
          textAlign: 'center',
          ...style
        }}
      >
        {/* Fixed Control Bar - Positioned Before Image */}
        <div 
          ref={controlsRef}
          className="zoom-controls-bar" 
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #1FA8DC 0%, #0d5a7a 100%)',
            borderRadius: '12px 12px 0 0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            marginBottom: '0',
            zIndex: 10,
            userSelect: 'none',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleZoomOut();
            }}
            disabled={zoom <= minZoom}
            onMouseDown={(e) => e.stopPropagation()}
            style={zoomBtnEnabled(zoom <= minZoom)}
            title="Zoom Out"
          >
            <IconZoomOut size={20} />
          </button>
          
          <div style={{
            padding: '8px 16px',
            fontSize: '1rem',
            fontWeight: '700',
            color: 'white',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            minWidth: '70px',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(10px)'
          }}>
            {Math.round(zoom * 100)}%
          </div>
          
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleZoomIn();
            }}
            disabled={zoom >= maxZoom}
            onMouseDown={(e) => e.stopPropagation()}
            style={zoomBtnEnabled(zoom >= maxZoom)}
            title="Zoom In"
          >
            <IconZoomIn size={20} />
          </button>
          
          {zoom !== 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleResetZoom();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              style={resetZoomBtnStyle}
              title="Reset Zoom"
            >
              <IconX size={20} />
            </button>
          )}
          
          <div style={{
            width: '1px',
            height: '30px',
            background: 'rgba(255, 255, 255, 0.3)',
            margin: '0 4px'
          }}></div>
          
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFullscreen();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            style={zoomBtnEnabled(false)}
            title="Fullscreen"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>

        {/* Image Container */}
        <div
          ref={imageRef}
          className="image-container"
          style={{
            overflow: 'hidden',
            borderRadius: '0 0 12px 12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            position: 'relative',
            maxWidth: '100%',
            maxHeight: '1200px',
            display: 'block',
            touchAction: 'none',
            width: '100%'
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={(e) => {
            if (zoom > 1 && e.touches.length === 1) {
              const touch = e.touches[0];
              setIsDragging(true);
              setDragStart({
                x: touch.clientX - position.x,
                y: touch.clientY - position.y
              });
            }
          }}
          onTouchMove={(e) => {
            if (isDragging && zoom > 1 && e.touches.length === 1) {
              e.preventDefault();
              const touch = e.touches[0];
              const newX = touch.clientX - dragStart.x;
              const newY = touch.clientY - dragStart.y;
              setPosition({ x: newX, y: newY });
            }
          }}
          onTouchEnd={() => {
            setIsDragging(false);
          }}
        >
          <Image
            src={src}
            alt={alt}
            className="zoomable-image"
            fit="contain"
            style={{
              maxWidth: '100%',
              maxHeight: '1200px',
              borderRadius: '0 0 12px 12px',
              transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
              transformOrigin: 'center center',
              transition: zoom === 1 ? 'transform 0.3s ease' : 'none',
              userSelect: 'none',
              display: 'block',
              touchAction: 'none',
              width: '100%',
              height: 'auto'
            }}
            draggable={false}
            onLoad={onImageLoad}
          />
        </div>
      </div>

      {/* Fullscreen: portal to body; pan area is flex-filled with overflow:hidden like inline mode */}
      {mounted &&
        isFullscreen &&
        createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.95)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
          }}
          onClick={toggleFullscreen}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="fullscreen-controls"
              style={{
                position: 'fixed',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '12px',
                zIndex: 10001,
                userSelect: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #1FA8DC 0%, #0d5a7a 100%)',
                borderRadius: '12px',
                padding: '12px 20px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                flexWrap: 'wrap',
                maxWidth: '90%',
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleZoomOut();
                }}
                disabled={zoom <= minZoom}
                onMouseDown={(e) => e.stopPropagation()}
                style={zoomBtnEnabled(zoom <= minZoom)}
              >
                <IconZoomOut size={22} />
              </button>

              <div
                style={{
                  padding: '8px 16px',
                  fontSize: '1rem',
                  fontWeight: '700',
                  color: 'white',
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  minWidth: '70px',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)',
                }}
              >
                {Math.round(zoom * 100)}%
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleZoomIn();
                }}
                disabled={zoom >= maxZoom}
                onMouseDown={(e) => e.stopPropagation()}
                style={zoomBtnEnabled(zoom >= maxZoom)}
              >
                <IconZoomIn size={22} />
              </button>

              {zoom !== 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleResetZoom();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={resetZoomBtnStyle}
                >
                  <IconX size={22} />
                </button>
              )}

              <div
                style={{
                  width: '1px',
                  height: '30px',
                  background: 'rgba(255, 255, 255, 0.3)',
                  margin: '0 4px',
                }}
              />

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                style={zoomBtnEnabled(false)}
                title="Exit fullscreen"
              >
                <IconX size={22} />
              </button>
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '88px 16px 24px',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  overflow: 'hidden',
                  width: '100%',
                  height: '100%',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  touchAction: 'none',
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={(e) => {
                  if (zoom > 1 && e.touches.length === 1) {
                    const touch = e.touches[0];
                    setIsDragging(true);
                    setDragStart({
                      x: touch.clientX - position.x,
                      y: touch.clientY - position.y,
                    });
                  }
                }}
                onTouchMove={(e) => {
                  if (isDragging && zoom > 1 && e.touches.length === 1) {
                    e.preventDefault();
                    const touch = e.touches[0];
                    setPosition({
                      x: touch.clientX - dragStart.x,
                      y: touch.clientY - dragStart.y,
                    });
                  }
                }}
                onTouchEnd={() => setIsDragging(false)}
              >
                <Image
                  src={src}
                  alt={alt}
                  radius="md"
                  fit="contain"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: 'auto',
                    height: 'auto',
                    transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                    transformOrigin: 'center center',
                    transition: zoom === 1 ? 'transform 0.3s ease' : 'none',
                    userSelect: 'none',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                    display: 'block',
                  }}
                  draggable={false}
                />
              </div>
            </div>
          </div>
        </div>,
        document.body
        )}

      <style jsx>{`
        .zoom-controls-bar button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15) !important;
        }
        
        .image-container {
          width: 100%;
        }
        
        .zoomable-image {
          width: 100%;
          height: auto;
          object-fit: contain;
        }
        
        @media (max-width: 768px) {
          .zoomable-image-container {
            margin-bottom: 16px !important;
          }
          
          .image-container {
            max-height: 1200px !important;
          }
          
          .zoomable-image {
            max-height: 1200px !important;
          }
          
          .zoom-controls-bar {
            padding: 8px 10px !important;
            gap: 6px !important;
            justify-content: center !important;
          }
          
          .zoom-controls-bar button {
            padding: 6px 8px !important;
            flex: 0 0 auto !important;
            min-width: 36px !important;
            min-height: 36px !important;
          }
          
          .zoom-controls-bar button svg {
            width: 16px !important;
            height: 16px !important;
          }
          
          .zoom-controls-bar > div:nth-child(2) {
            padding: 4px 10px !important;
            font-size: 0.85rem !important;
            min-width: 55px !important;
            flex: 0 0 auto !important;
          }
          
          .zoom-controls-bar > div:nth-child(5) {
            display: none !important;
          }
        }
        
        @media (max-width: 480px) {
          .zoomable-image-container {
            margin-bottom: 12px !important;
          }
          
          .image-container {
            max-height: 1200px !important;
          }
          
          .zoomable-image {
            max-height: 1200px !important;
          }
          
          .zoom-controls-bar {
            padding: 6px 8px !important;
            gap: 4px !important;
            flex-wrap: wrap !important;
            justify-content: center !important;
          }
          
          .zoom-controls-bar button {
            padding: 5px 7px !important;
            flex: 0 0 auto !important;
            min-width: 32px !important;
            min-height: 32px !important;
          }
          
          .zoom-controls-bar button svg {
            width: 14px !important;
            height: 14px !important;
          }
          
          .zoom-controls-bar > div:nth-child(2) {
            padding: 4px 8px !important;
            font-size: 0.75rem !important;
            min-width: 48px !important;
            flex: 0 0 auto !important;
          }
          
          .zoom-controls-bar > div:nth-child(5) {
            display: none !important;
          }
        }
        
        @media (max-width: 360px) {
          .image-container {
            max-height: 1200px !important;
          }
          
          .zoomable-image {
            max-height: 1200px !important;
          }
          
          .zoom-controls-bar {
            padding: 5px 6px !important;
            gap: 3px !important;
            justify-content: center !important;
          }
          
          .zoom-controls-bar button {
            padding: 4px 6px !important;
            flex: 0 0 auto !important;
            min-width: 28px !important;
            min-height: 28px !important;
          }
          
          .zoom-controls-bar button svg {
            width: 12px !important;
            height: 12px !important;
          }
          
          .zoom-controls-bar > div:nth-child(2) {
            padding: 3px 6px !important;
            font-size: 0.7rem !important;
            min-width: 42px !important;
            flex: 0 0 auto !important;
          }
          
          .zoom-controls-bar > div:nth-child(5) {
            display: none !important;
          }
        }
        
        /* Fullscreen mobile styles */
        @media (max-width: 768px) {
          :global(.fullscreen-controls) {
            top: 10px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            right: auto !important;
            padding: 8px 10px !important;
            gap: 6px !important;
            max-width: calc(100% - 20px) !important;
          }
          
          :global(.fullscreen-controls) button {
            padding: 6px 8px !important;
            flex: 0 0 auto !important;
            min-width: 36px !important;
            min-height: 36px !important;
          }
          
          :global(.fullscreen-controls) button svg {
            width: 16px !important;
            height: 16px !important;
          }
          
          :global(.fullscreen-controls) > div:nth-child(2) {
            padding: 4px 10px !important;
            font-size: 0.85rem !important;
            min-width: 55px !important;
            flex: 0 0 auto !important;
          }
          
          :global(.fullscreen-controls) > div:nth-child(5) {
            display: none !important;
          }
        }
        
        @media (max-width: 480px) {
          :global(.fullscreen-controls) {
            top: 10px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            right: auto !important;
            padding: 6px 8px !important;
            gap: 4px !important;
            flex-wrap: wrap !important;
            justify-content: center !important;
            max-width: calc(100% - 20px) !important;
          }
          
          :global(.fullscreen-controls) button {
            padding: 5px 7px !important;
            flex: 0 0 auto !important;
            min-width: 32px !important;
            min-height: 32px !important;
          }
          
          :global(.fullscreen-controls) button svg {
            width: 14px !important;
            height: 14px !important;
          }
          
          :global(.fullscreen-controls) > div:nth-child(2) {
            padding: 4px 8px !important;
            font-size: 0.75rem !important;
            min-width: 48px !important;
            flex: 0 0 auto !important;
          }
          
          :global(.fullscreen-controls) > div:nth-child(5) {
            display: none !important;
          }
        }
        
        @media (max-width: 360px) {
          :global(.fullscreen-controls) {
            padding: 5px 6px !important;
            gap: 3px !important;
          }
          
          :global(.fullscreen-controls) button {
            padding: 4px 6px !important;
            min-width: 28px !important;
            min-height: 28px !important;
          }
          
          :global(.fullscreen-controls) button svg {
            width: 12px !important;
            height: 12px !important;
          }
          
          :global(.fullscreen-controls) > div:nth-child(2) {
            padding: 3px 6px !important;
            font-size: 0.7rem !important;
            min-width: 42px !important;
          }
        }
      `}</style>
    </>
  );
}

