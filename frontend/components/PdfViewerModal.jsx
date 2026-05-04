import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function PdfViewerModal({ isOpen, onClose, fileUrl, fileName }) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [containerWidth, setContainerWidth] = useState(900);
  const scrollBodyRef = useRef(null);
  const pageInputRef = useRef(null);
  const [pageInputFocused, setPageInputFocused] = useState(false);
  const [pageInputDraft, setPageInputDraft] = useState('');
  const [documentRetryKey, setDocumentRetryKey] = useState(0);

  const normalizedFileUrl = typeof fileUrl === 'string' && fileUrl.trim() ? fileUrl.trim() : null;

  const bumpDocumentRetry = useCallback(() => {
    setDocumentRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    setDocumentRetryKey(0);
  }, [normalizedFileUrl]);

  const commitPageFromInput = () => {
    const raw = pageInputDraft.trim();
    setPageInputFocused(false);
    if (raw === '') return;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return;
    setCurrentPage(clamp(n, 1, Math.max(numPages, 1)));
  };

  const pageInputValue = pageInputFocused ? (pageInputDraft === '' ? '' : pageInputDraft) : currentPage;

  useEffect(() => {
    if (!isOpen || numPages < 1) return undefined;
    const scrollToPage = () => {
      const root = scrollBodyRef.current;
      const el = root?.querySelector(`#pdf-page-${currentPage}`) ?? document.getElementById(`pdf-page-${currentPage}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(scrollToPage);
    });
    return () => cancelAnimationFrame(frame);
  }, [currentPage, isOpen, numPages]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const update = () => {
      const viewport = typeof window !== 'undefined' ? window.innerWidth : 1200;
      if (viewport <= 480) {
        setContainerWidth(Math.max(viewport - 20, 220));
      } else if (viewport <= 768) {
        setContainerWidth(Math.max(viewport - 70, 320));
      } else {
        setContainerWidth(Math.min(980, viewport - 180));
      }
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setNumPages(0);
      setCurrentPage(1);
      setZoom(1);
      setRotation(0);
      setPageInputFocused(false);
      setPageInputDraft('');
      setDocumentRetryKey(0);
    }
  }, [isOpen]);

  const pages = useMemo(() => Array.from({ length: numPages }, (_, idx) => idx + 1), [numPages]);

  if (!isOpen) return null;

  return (
    <div className="pdf-viewer-overlay" onClick={onClose}>
      <div className="pdf-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pdf-viewer-header">
          <div className="pdf-viewer-header-left">
            <Image src="/pdf.svg" alt="PDF" width={24} height={24} />
            <div>
              <div className="pdf-viewer-title">PDF Viewer</div>
              <div className="pdf-viewer-subtitle">{fileName || 'Document'}</div>
            </div>
          </div>
          <button type="button" className="pdf-viewer-close" onClick={onClose} aria-label="Close PDF viewer">
            ✕
          </button>
        </div>

        <div className="pdf-viewer-toolbar">
          <div className="pdf-toolbar-group pdf-toolbar-zoom">
            <button type="button" className="pdf-btn-icon" aria-label="Zoom out" onClick={() => setZoom((prev) => clamp(prev - 0.1, 0.6, 2.5))}>
              −
            </button>
            <span className="pdf-toolbar-zoom-label">{Math.round(zoom * 100)}%</span>
            <button type="button" className="pdf-btn-icon" aria-label="Zoom in" onClick={() => setZoom((prev) => clamp(prev + 0.1, 0.6, 2.5))}>
              +
            </button>
            <button type="button" className="pdf-btn-text" onClick={() => setZoom(1)}>
              Reset
            </button>
          </div>

          <div className="pdf-toolbar-group pdf-toolbar-pages">
            <button
              type="button"
              className="pdf-btn-nav"
              disabled={currentPage <= 1}
              onClick={() => {
                pageInputRef.current?.blur();
                setCurrentPage((prev) => Math.max(prev - 1, 1));
              }}
            >
              Prev
            </button>
            <div className="pdf-toolbar-page-meta">
              <span className="pdf-page-label-text">Page</span>
              <input
                ref={pageInputRef}
                type="number"
                min={1}
                max={Math.max(numPages, 1)}
                step={1}
                autoComplete="off"
                aria-label="Page number"
                disabled={numPages === 0}
                value={pageInputValue}
                onFocus={() => {
                  setPageInputFocused(true);
                  setPageInputDraft(String(currentPage));
                }}
                onChange={(e) => {
                  setPageInputDraft(e.target.value.replace(/\D/g, ''));
                }}
                onBlur={commitPageFromInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    pageInputRef.current?.blur();
                  }
                }}
              />
              <span className="pdf-page-total">/ {numPages || '−'}</span>
            </div>
            <button
              type="button"
              className="pdf-btn-nav"
              disabled={numPages === 0 || currentPage >= numPages}
              onClick={() => {
                pageInputRef.current?.blur();
                setCurrentPage((prev) => Math.min(prev + 1, numPages));
              }}
            >
              Next
            </button>
          </div>

          <div className="pdf-toolbar-group pdf-toolbar-rotate">
            <button
              type="button"
              title="Rotate counter-clockwise 90°"
              aria-label="Rotate counter-clockwise 90 degrees"
              onClick={() => setRotation((prev) => (prev + 270) % 360)}
            >
              <span className="pdf-rotate-long">Rotate −90°</span>
              <span className="pdf-rotate-short">−90°</span>
            </button>
            <button
              type="button"
              title="Rotate clockwise 90°"
              aria-label="Rotate clockwise 90 degrees"
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
            >
              <span className="pdf-rotate-long">Rotate +90°</span>
              <span className="pdf-rotate-short">+90°</span>
            </button>
          </div>
        </div>

        <div className="pdf-viewer-body" ref={scrollBodyRef}>
          <Document
            key={`${normalizedFileUrl ?? 'none'}-${documentRetryKey}`}
            file={normalizedFileUrl}
            loading={
              <div className="pdf-state-card pdf-state-card--loading" role="status" aria-live="polite">
                <div className="pdf-state-spinner" aria-hidden="true" />
                <p className="pdf-state-title">Loading PDF…</p>
                <p className="pdf-state-hint">Please wait while the document loads.</p>
              </div>
            }
            noData={
              <div className="pdf-state-card pdf-state-card--empty" role="status">
                <div className="pdf-state-icon pdf-state-icon--empty" aria-hidden="true">
                  <svg viewBox="0 0 64 64" width="56" height="56" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 8h24l12 12v36a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="2.5" />
                    <path d="M38 8v12h12" stroke="currentColor" strokeWidth="2.5" />
                  </svg>
                </div>
                <p className="pdf-state-title">No PDF to show</p>
                <p className="pdf-state-hint">This item does not have a document link yet.</p>
                <button type="button" className="pdf-state-btn pdf-state-btn-secondary" onClick={onClose}>
                  Close
                </button>
              </div>
            }
            error={
              <div className="pdf-state-card pdf-state-card--error" role="alert">
                <div className="pdf-state-icon pdf-state-icon--error" aria-hidden="true">
                  <svg viewBox="0 0 64 64" width="56" height="56" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 8h24l12 12v36a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="2.5" />
                    <path d="M38 8v12h12" stroke="currentColor" strokeWidth="2.5" />
                    <path d="M22 40l20-20M42 40 22 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="pdf-state-title">Couldn’t open this PDF</p>
                <p className="pdf-state-hint">
                  The file may be missing, the link may have expired, or the server blocked access. Check the link or try again.
                </p>
                <div className="pdf-state-actions">
                  <button type="button" className="pdf-state-btn pdf-state-btn-primary" onClick={bumpDocumentRetry}>
                    Try again
                  </button>
                  <button type="button" className="pdf-state-btn pdf-state-btn-secondary" onClick={onClose}>
                    Close
                  </button>
                </div>
              </div>
            }
            onLoadSuccess={({ numPages: loadedPages }) => {
              setNumPages(loadedPages);
              setCurrentPage(1);
            }}
            onLoadError={() => {
              setNumPages(0);
            }}
          >
            <div className="pdf-pages-wrap">
              {pages.map((pageNumber) => {
                const isActive = pageNumber === currentPage;
                return (
                <div
                  key={pageNumber}
                  id={`pdf-page-${pageNumber}`}
                  className={`pdf-page-card ${isActive ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNumber)}
                >
                  <div className="pdf-page-label">Page {pageNumber}</div>
                  <Page
                    pageNumber={pageNumber}
                    width={Math.floor(containerWidth * (isActive ? zoom : 1))}
                    rotate={isActive ? rotation : 0}
                    renderAnnotationLayer={isActive}
                    renderTextLayer={isActive}
                  />
                </div>
                );
              })}
            </div>
          </Document>
        </div>
      </div>

      <style jsx>{`
        .pdf-viewer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10, 25, 42, 0.72);
          backdrop-filter: blur(7px);
          z-index: 10000;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pdf-viewer-modal {
          width: min(1100px, 100%);
          height: min(90vh, 920px);
          max-height: min(90vh, 920px);
          min-height: 0;
          background: linear-gradient(145deg, #ffffff, #f5f9ff);
          border: 1px solid #dbe9ff;
          border-radius: 18px;
          box-shadow: 0 24px 60px rgba(2, 22, 64, 0.35);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .pdf-viewer-header {
          background: linear-gradient(135deg, #0f8ec2, #1f6fd7);
          color: #fff;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .pdf-viewer-header-left {
          display: flex;
          gap: 10px;
          align-items: center;
          min-width: 0;
        }
        .pdf-viewer-title {
          font-weight: 700;
          font-size: 1.02rem;
          line-height: 1.2;
        }
        .pdf-viewer-subtitle {
          font-size: 0.85rem;
          opacity: 0.95;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 68vw;
        }
        .pdf-viewer-close {
          border: none;
          border-radius: 999px;
          width: 32px;
          height: 32px;
          cursor: pointer;
          font-size: 17px;
          color: #fff;
          background: rgba(220, 53, 69, 0.94);
        }
        .pdf-viewer-toolbar {
          padding: 12px 14px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px 12px;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fbff;
          flex-shrink: 0;
        }
        .pdf-toolbar-group {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .pdf-toolbar-group button {
          border: 1px solid #c7d8f5;
          background: #fff;
          color: #2c3e63;
          border-radius: 8px;
          padding: 8px 12px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.9rem;
          min-height: 40px;
          box-sizing: border-box;
        }
        .pdf-toolbar-group button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .pdf-btn-icon {
          min-width: 44px;
          padding-left: 0;
          padding-right: 0;
          font-size: 1.15rem;
          line-height: 1;
        }
        .pdf-toolbar-zoom-label {
          min-width: 3.25rem;
          text-align: center;
          font-weight: 700;
          font-size: 0.9rem;
          color: #2c3e63;
        }
        .pdf-toolbar-page-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .pdf-page-label-text {
          font-size: 0.88rem;
          font-weight: 600;
          color: #3d5a80;
        }
        .pdf-page-total {
          font-size: 0.88rem;
          font-weight: 600;
          color: #3d5a80;
          white-space: nowrap;
        }
        .pdf-toolbar-page-meta input {
          width: 56px;
          min-width: 48px;
          padding: 6px 8px;
          border: 1px solid #c7d8f5;
          border-radius: 6px;
          text-align: center;
          font-size: 0.95rem;
          font-weight: 600;
          box-sizing: border-box;
        }
        .pdf-toolbar-rotate .pdf-rotate-short {
          display: none;
        }
        .pdf-toolbar-rotate .pdf-rotate-long {
          display: inline;
        }
        .pdf-toolbar-rotate button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .pdf-viewer-body {
          flex: 1;
          min-height: 0;
          overflow: auto;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-x pan-y;
          overscroll-behavior: contain;
          background: radial-gradient(circle at top, #edf4ff, #e8f0ff);
        }
        .pdf-pages-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          padding: 16px;
          box-sizing: border-box;
          width: max-content;
          min-width: 100%;
        }
        .pdf-page-card {
          border: 2px solid #dbe7ff;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 6px 18px rgba(24, 56, 114, 0.13);
          overflow: visible;
          flex-shrink: 0;
          width: fit-content;
          max-width: none;
        }
        .pdf-page-card.active {
          border-color: #1f8edc;
          box-shadow: 0 10px 24px rgba(31, 142, 220, 0.2);
        }
        .pdf-page-label {
          font-size: 0.85rem;
          color: #1f4d76;
          background: #edf5ff;
          padding: 6px 10px;
          border-bottom: 1px solid #d6e6fb;
          font-weight: 600;
        }
        @media (max-width: 768px) {
          .pdf-viewer-overlay {
            padding: 8px;
            align-items: stretch;
          }
          .pdf-viewer-modal {
            width: 100%;
            height: min(94vh, 100dvh);
            max-height: 100dvh;
            min-height: 0;
            border-radius: 14px;
          }
          .pdf-viewer-header {
            padding: 10px 12px;
          }
          .pdf-viewer-title {
            font-size: 0.92rem;
          }
          .pdf-viewer-subtitle {
            max-width: min(58vw, 200px);
            font-size: 0.8rem;
          }
          .pdf-viewer-toolbar {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
            padding: 10px 10px;
          }
          .pdf-toolbar-zoom {
            display: grid;
            grid-template-columns: 48px 1fr 48px minmax(0, 1fr);
            gap: 8px;
            align-items: center;
            width: 100%;
          }
          .pdf-toolbar-zoom .pdf-btn-text {
            min-height: 44px;
          }
          .pdf-toolbar-pages {
            display: grid;
            grid-template-columns: minmax(72px, 1fr) minmax(0, auto) minmax(72px, 1fr);
            gap: 8px;
            align-items: center;
            width: 100%;
          }
          .pdf-btn-nav {
            min-height: 44px;
            width: 100%;
          }
          .pdf-toolbar-page-meta {
            flex-wrap: nowrap;
            justify-content: center;
            gap: 4px;
            min-width: 0;
          }
          .pdf-toolbar-page-meta input {
            width: 52px;
            min-width: 44px;
            margin: 0;
            flex-shrink: 0;
          }
          .pdf-page-label-text {
            font-size: 0.8rem;
          }
          .pdf-page-total {
            font-size: 0.8rem;
          }
          .pdf-toolbar-rotate {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            width: 100%;
          }
          .pdf-toolbar-rotate button {
            min-height: 44px;
            width: 100%;
            padding: 10px 8px;
          }
          .pdf-toolbar-rotate .pdf-rotate-long {
            display: none;
          }
          .pdf-toolbar-rotate .pdf-rotate-short {
            display: inline;
          }
          .pdf-pages-wrap {
            padding: 10px;
          }
        }

        @media (max-width: 480px) {
          .pdf-viewer-overlay {
            padding: 0;
          }
          .pdf-viewer-modal {
            width: 100%;
            height: 100%;
            max-height: 100dvh;
            border-radius: 0;
            border-left: none;
            border-right: none;
          }
          .pdf-viewer-header {
            padding: 10px 12px;
            flex-shrink: 0;
          }
          .pdf-viewer-close {
            min-width: 44px;
            min-height: 44px;
          }
          .pdf-viewer-body {
            min-height: 0;
          }
        }
      `}</style>
      <style jsx global>{`
        /* Let scroll/drag pass through text layer when zoomed (otherwise it steals panning). */
        .pdf-viewer-body .react-pdf__Page__textContent {
          pointer-events: none !important;
          user-select: none;
        }
        .pdf-viewer-body .react-pdf__Page {
          max-width: none !important;
        }

        .pdf-viewer-body .react-pdf__message {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
          padding: 20px 16px;
          box-sizing: border-box;
        }

        .pdf-state-card {
          max-width: 380px;
          width: 100%;
          text-align: center;
          padding: 28px 24px 26px;
          border-radius: 16px;
          background: linear-gradient(165deg, #ffffff 0%, #f3f8ff 100%);
          border: 1px solid #d0e0f5;
          box-shadow: 0 10px 36px rgba(24, 56, 114, 0.12);
        }
        .pdf-state-card--error {
          border-color: #f1c0c7;
          background: linear-gradient(165deg, #fffbfb 0%, #fff5f6 100%);
        }
        .pdf-state-card--empty {
          border-color: #dce8f8;
        }
        .pdf-state-card--loading {
          border-color: #c8dcf5;
        }
        .pdf-state-icon {
          margin: 0 auto 14px;
          color: #5a7aad;
          display: flex;
          justify-content: center;
        }
        .pdf-state-icon--error {
          color: #c94a5a;
        }
        .pdf-state-icon--empty {
          color: #6b8cbe;
        }
        .pdf-state-title {
          margin: 0 0 8px;
          font-size: 1.12rem;
          font-weight: 700;
          color: #1a2f4d;
          line-height: 1.3;
        }
        .pdf-state-hint {
          margin: 0 0 20px;
          font-size: 0.9rem;
          line-height: 1.5;
          color: #4a6488;
        }
        .pdf-state-card--error .pdf-state-hint {
          color: #6b4a52;
        }
        .pdf-state-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
        }
        .pdf-state-btn {
          border-radius: 10px;
          padding: 10px 18px;
          font-size: 0.92rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          min-height: 44px;
        }
        .pdf-state-btn-primary {
          background: linear-gradient(135deg, #0f8ec2, #1f6fd7);
          color: #fff;
          border-color: #1a6bc4;
        }
        .pdf-state-btn-primary:hover {
          filter: brightness(1.05);
        }
        .pdf-state-btn-secondary {
          background: #fff;
          color: #2c4a73;
          border-color: #b8cce8;
        }
        .pdf-state-btn-secondary:hover {
          background: #f0f6ff;
        }
        .pdf-state-spinner {
          width: 40px;
          height: 40px;
          margin: 0 auto 16px;
          border: 3px solid #d4e4fb;
          border-top-color: #1f6fd7;
          border-radius: 50%;
          animation: pdf-spin 0.75s linear infinite;
        }
        @keyframes pdf-spin {
          to {
            transform: rotate(360deg);
          }
        }
        .pdf-state-card--loading .pdf-state-title {
          margin-bottom: 6px;
        }
        .pdf-state-card--loading .pdf-state-hint {
          margin-bottom: 0;
        }
      `}</style>
    </div>
  );
}
