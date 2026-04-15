import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/axios';
import styles from './AttendancelessonSelect.module.css';

/** Display order: SAT → EST → ACT → any other categories (A–Z) → All (last). */
const PRIMARY_ORDER = ['SAT', 'EST', 'ACT'];

function sortCategoryKeys(keys) {
  const rank = (k) => {
    if (k === 'All') return { group: 2, sub: 0 };
    const pi = PRIMARY_ORDER.indexOf(k);
    if (pi !== -1) return { group: 0, sub: pi };
    return { group: 1, sub: k };
  };

  return [...keys].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra.group !== rb.group) return ra.group - rb.group;
    if (ra.group === 0) return ra.sub - rb.sub;
    if (ra.group === 1) {
      return String(ra.sub).localeCompare(String(rb.sub), undefined, {
        sensitivity: 'base',
      });
    }
    return 0;
  });
}

function groupLessonsByCategory(lessonRecords) {
  const byCat = new Map();
  const uncategorized = [];

  for (const lesson of lessonRecords) {
    const name = lesson?.name;
    if (!name) continue;
    const c = lesson.category;
    const key =
      c == null || String(c).trim() === '' ? null : String(c).trim();
    if (key === null) {
      uncategorized.push(name);
    } else {
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key).push(name);
    }
  }

  for (const arr of byCat.values()) {
    arr.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }
  uncategorized.sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  const orderedKeys = sortCategoryKeys([...byCat.keys()]);
  return { orderedKeys, byCat, uncategorized };
}

export default function AttendanceLessonSelect({
  selectedLesson,
  onLessonChange,
  required: _required = false,
  isOpen,
  onToggle,
  onClose,
  placeholder = 'Select Attendance Lesson',
  includeAllOption = false,
}) {
  const { data: lessonsResponse, isLoading: lessonsLoading } = useQuery({
    queryKey: ['lessons'],
    queryFn: async () => {
      const response = await apiClient.get('/api/lessons');
      return response.data.lessons || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const lessonRecords = lessonsResponse || [];
  const { orderedKeys, byCat, uncategorized } = useMemo(
    () => groupLessonsByCategory(lessonRecords),
    [lessonRecords]
  );

  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const actualIsOpen = isOpen !== undefined ? isOpen : internalIsOpen;
  const actualOnToggle = onToggle || (() => setInternalIsOpen(!internalIsOpen));
  const actualOnClose = onClose || (() => setInternalIsOpen(false));

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        actualOnClose();
      }
    };

    if (actualIsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [actualIsOpen, actualOnClose]);

  const handleLessonSelect = (lesson) => {
    onLessonChange(lesson);
    actualOnClose();
  };

  const triggerLabel =
    selectedLesson && selectedLesson !== 'n/a' ? selectedLesson : placeholder;
  const hasSelection = Boolean(
    selectedLesson && selectedLesson !== 'n/a' && selectedLesson !== ''
  );

  const lessonButton = (lessonName) => {
    const isSelected = selectedLesson === lessonName;
    return (
      <button
        key={lessonName}
        type="button"
        className={`${styles.lessonRow} ${isSelected ? styles.lessonRowSelected : ''}`}
        onClick={() => handleLessonSelect(lessonName)}
      >
        {lessonName}
      </button>
    );
  };

  const categorySection = (label, muted, lessonNames) => (
    <>
      <div
        className={`${styles.categoryLabel} ${muted ? styles.categoryLabelMuted : ''}`}
      >
        {label}
      </div>
      <div className={styles.lessonList}>{lessonNames.map((n) => lessonButton(n))}</div>
    </>
  );

  const hasTree = orderedKeys.length > 0 || uncategorized.length > 0;

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={actualIsOpen}
        aria-haspopup="listbox"
        className={`${styles.trigger} ${actualIsOpen ? styles.triggerOpen : ''} ${hasSelection ? styles.triggerHasValue : ''}`}
        onClick={actualOnToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            actualOnToggle();
          }
        }}
      >
        <span>{triggerLabel}</span>
      </div>

      {actualIsOpen && (
        <div className={styles.panel}>
          <button
            type="button"
            className={`${styles.topActionBtn} ${styles.topAction} ${styles.topActionClear}`}
            onClick={() => handleLessonSelect('')}
          >
            ✕ Clear selection
          </button>

          {includeAllOption && (
            <button
              type="button"
              className={`${styles.topActionBtn} ${styles.topAction} ${styles.topActionAll} ${selectedLesson === 'All' ? styles.topActionAllSelected : ''}`}
              onClick={() => handleLessonSelect('All')}
            >
              All
            </button>
          )}

          <div className={styles.panelDivider} />

          {lessonsLoading ? (
            <div className={styles.emptyState}>Loading lessons…</div>
          ) : !hasTree ? (
            <div className={`${styles.emptyState} ${styles.emptyStateMuted}`}>
              No lessons available
            </div>
          ) : (
            <>
              {orderedKeys.map((catKey, idx) => (
                <div
                  key={catKey}
                  className={`${styles.categoryBlock} ${idx > 0 ? styles.categoryBlockSpaced : ''}`}
                >
                  {categorySection(catKey, false, byCat.get(catKey))}
                </div>
              ))}

              {uncategorized.length > 0 && (
                <div
                  className={`${styles.categoryBlock} ${orderedKeys.length > 0 ? styles.categoryBlockSpaced : ''}`}
                >
                  {categorySection('Not Categorized', true, uncategorized)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
