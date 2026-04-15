import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import styles from './ImportExistingOnlineItemModal.module.css';

const LOAD_OVERLAY_MIN_MS = 3000;

/**
 * Picker modal with CenterSelect-style dropdown + Load / Close.
 * Dropdown list is rendered fixed below the trigger (outside dialog DOM) so it is never clipped by overflow.
 */
export default function ImportExistingOnlineItemModal({
  open,
  onClose,
  title,
  description,
  options,
  selectedValue,
  onSelectedValueChange,
  onApply,
  applyLabel = 'Load',
  emptyMessage = 'No items available.',
  applyLoading = false,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [fullPageLoading, setFullPageLoading] = useState(false);
  const triggerRef = useRef(null);
  const [menuRect, setMenuRect] = useState(null);
  const loadStartedAtRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setDropdownOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!fullPageLoading) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullPageLoading]);

  useEffect(() => {
    if (!fullPageLoading) return;
    if (applyLoading) return;
    const started = loadStartedAtRef.current ?? Date.now();
    const elapsed = Date.now() - started;
    const remaining = Math.max(0, LOAD_OVERLAY_MIN_MS - elapsed);
    const id = window.setTimeout(() => setFullPageLoading(false), remaining);
    return () => window.clearTimeout(id);
  }, [applyLoading, fullPageLoading]);

  const handleApplyClick = () => {
    loadStartedAtRef.current = Date.now();
    setFullPageLoading(true);
    onClose();
    onApply();
  };

  const updateMenuPosition = () => {
    if (!dropdownOpen || !triggerRef.current) {
      setMenuRect(null);
      return;
    }
    const r = triggerRef.current.getBoundingClientRect();
    setMenuRect({
      top: r.bottom + 4,
      left: r.left,
      width: r.width,
    });
  };

  useLayoutEffect(() => {
    updateMenuPosition();
  }, [dropdownOpen, open, selectedValue]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = () => updateMenuPosition();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [dropdownOpen]);

  if (!open && !fullPageLoading) return null;

  const hasOptions = Array.isArray(options) && options.length > 0;
  const selectedOption = options?.find((o) => o.value === selectedValue);
  const displayLabel = selectedOption?.label || 'Select…';
  const accent = '#1FA8DC';
  const accentSoft = '#f0f8ff';

  const handlePick = (value) => {
    onSelectedValueChange(value);
    setDropdownOpen(false);
  };

  const loadingOverlay =
    fullPageLoading && typeof document !== 'undefined'
      ? createPortal(
          <div
            className={styles.overlay}
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Loading import"
          >
            <div className={styles.card}>
              <div className={styles.spinnerWrap} aria-hidden>
                <div className={styles.spinner} />
                <div className={styles.spinnerInner} />
              </div>
              <p className={styles.label}>
                <span className={styles.loadingText}>
                  Loading
                  <span className={styles.ellipsis}>
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </span>
              </p>
              <p className={styles.sub}>Preparing your import. This may take a moment.</p>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {open ? (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '16px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-existing-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(148, 163, 184, 0.12)',
          maxWidth: '520px',
          width: '100%',
          maxHeight: 'min(92vh, 640px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '20px 20px 12px',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2
              id="import-existing-title"
              style={{
                margin: 0,
                fontSize: 'clamp(1.15rem, 4vw, 1.35rem)',
                fontWeight: 700,
                color: '#0f172a',
                lineHeight: 1.3,
              }}
            >
              {title}
            </h2>
            {description ? (
              <p style={{ margin: '8px 0 0', fontSize: '0.88rem', color: '#64748b', lineHeight: 1.45 }}>
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0,
              width: 44,
              height: 44,
              border: '2px solid #e9ecef',
              borderRadius: '12px',
              background: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#fecaca';
              e.currentTarget.style.background = 'linear-gradient(145deg, #fef2f2 0%, #fee2e2 100%)';
              e.currentTarget.style.boxShadow = '0 2px 10px rgba(220, 38, 38, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e9ecef';
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Image src="/close-cross.svg" alt="" width={28} height={28} />
          </button>
        </div>

        <div
          style={{
            padding: '16px 20px',
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
              border: '1.5px solid #e0e7ff',
              borderRadius: '14px',
              padding: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '12px',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(31, 168, 220, 0.15)',
                }}
              >
                <Image src="/books.svg" alt="" width={22} height={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1e293b' }}>Choose source</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                  Select an item, then tap Load — nothing is saved until you submit the form.
                </div>
              </div>
            </div>

            {hasOptions ? (
              <div style={{ position: 'relative', width: '100%' }}>
                <div
                  ref={triggerRef}
                  style={{
                    padding: '14px 16px',
                    border: dropdownOpen ? `2px solid ${accent}` : '2px solid #e9ecef',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '1rem',
                    color: selectedValue ? accent : '#adb5bd',
                    backgroundColor: selectedValue ? accentSoft : '#ffffff',
                    fontWeight: selectedValue ? '600' : '400',
                    transition: 'all 0.3s ease',
                    boxShadow: dropdownOpen ? `0 0 0 3px rgba(31, 168, 220, 0.1)` : 'none',
                    minHeight: '52px',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen(!dropdownOpen);
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textAlign: 'left',
                      lineHeight: 1.35,
                      flex: 1,
                      minWidth: 0,
                      paddingRight: '8px',
                    }}
                    title={displayLabel}
                  >
                    {displayLabel}
                  </span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '0.95rem',
                  background: '#fff',
                  borderRadius: '10px',
                  border: '1px dashed #cbd5e1',
                }}
              >
                {emptyMessage}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '14px 20px 18px',
            borderTop: '1px solid #e2e8f0',
            background: '#fafafa',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <button
              type="button"
              disabled={!hasOptions || !selectedValue || applyLoading}
              onClick={handleApplyClick}
              style={{
                padding: '12px 22px',
                borderRadius: '10px',
                border: 'none',
                background:
                  !hasOptions || !selectedValue || applyLoading
                    ? '#94a3b8'
                    : `linear-gradient(135deg, ${accent} 0%, #0d8bc7 100%)`,
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: !hasOptions || !selectedValue || applyLoading ? 'not-allowed' : 'pointer',
                minWidth: '120px',
                boxShadow:
                  !hasOptions || !selectedValue || applyLoading ? 'none' : '0 4px 14px rgba(31, 168, 220, 0.35)',
              }}
            >
              {applyLoading ? 'Loading…' : applyLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '12px 20px',
                borderRadius: '10px',
                border: '2px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: 'pointer',
                minWidth: '100px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.background = 'linear-gradient(145deg, #fef2f2 0%, #fee2e2 100%)';
                e.currentTarget.style.color = '#b91c1c';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.color = '#475569';
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Fixed menu: sibling of dialog, not inside overflow stack — fully visible above page/modal */}
      {dropdownOpen && hasOptions && menuRect && (
        <div
          role="listbox"
          style={{
            position: 'fixed',
            top: menuRect.top,
            left: menuRect.left,
            width: menuRect.width,
            zIndex: 10050,
            backgroundColor: '#ffffff',
            border: '2px solid #e9ecef',
            borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            maxHeight: 'min(280px, 45vh)',
            overflowY: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              borderBottom: '1px solid #f8f9fa',
              transition: 'background-color 0.2s ease',
              color: '#dc3545',
              fontWeight: '500',
            }}
            onClick={() => handlePick('')}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#fff5f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
          >
            ✕ Clear selection
          </div>
          {options.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={selectedValue === opt.value}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #f8f9fa',
                transition: 'background-color 0.2s ease',
                color: selectedValue === opt.value ? accent : '#000000',
                backgroundColor: selectedValue === opt.value ? accentSoft : '#ffffff',
                fontWeight: selectedValue === opt.value ? '600' : '400',
                fontSize: '0.9rem',
                lineHeight: 1.4,
                wordBreak: 'break-word',
              }}
              onClick={() => handlePick(opt.value)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  selectedValue === opt.value ? '#e0f2fe' : '#f8f9fa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  selectedValue === opt.value ? accentSoft : '#ffffff';
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
      ) : null}
      {loadingOverlay}
    </>
  );
}
