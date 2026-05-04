import { useEffect, useState } from 'react';
import Image from 'next/image';
import PeriodSelect from './PeriodSelect';
import { formatDeadlineTimeFromParts, parseDeadlineTime } from '../lib/deadlineTimeEgypt';

/**
 * Centers-style row: hours (1–12) : minutes (0–59) + AM/PM + clear (trash).
 * value / onChange: stored string "04:30 AM" or null.
 */
export default function DeadlineTimeRow({ value, onChange, disabled, error }) {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [period, setPeriod] = useState('PM');
  const [periodOpen, setPeriodOpen] = useState(false);

  useEffect(() => {
    const p = parseDeadlineTime(value);
    if (p) {
      setHours(String(p.hour12));
      // Do not zero-pad minutes here: padded sync fights onChange while typing (e.g. "4" → "04" before "45").
      setMinutes(String(p.minute));
      setPeriod(p.period);
    }
    // When value is null/incomplete, keep local state (Cancel clears period only; trash clears via handler).
  }, [value]);

  const push = (h, m, per) => {
    onChange(formatDeadlineTimeFromParts(h, m, per));
  };

  const handleClear = () => {
    setHours('');
    setMinutes('');
    setPeriod('PM');
    setPeriodOpen(false);
    onChange(null);
  };

  return (
    <div className="dl-time-wrap">
      <label className="dl-time-main-label">Deadline time</label>
      <div className="dl-time-row">
        <div className="dl-time-field dl-time-time-col">
          <span className="dl-time-sublabel">Time</span>
          <div className="dl-time-inputs">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              disabled={disabled}
              value={hours}
              placeholder="HH"
              className="dl-time-h dl-time-inp"
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
                setHours(raw);
                push(raw, minutes, period);
              }}
              onBlur={() => {
                if (!hours || String(hours).trim() === '') {
                  setHours('');
                  push('', minutes, period);
                  return;
                }
                const n = parseInt(hours, 10);
                if (Number.isNaN(n)) {
                  setHours('');
                  push('', minutes, period);
                  return;
                }
                const clamped = Math.min(12, Math.max(1, n));
                const nh = String(clamped);
                setHours(nh);
                push(nh, minutes, period);
              }}
            />
            <span className="dl-time-colon">:</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              disabled={disabled}
              value={minutes}
              placeholder="MM"
              className="dl-time-m dl-time-inp"
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
                setMinutes(raw);
                push(hours, raw, period);
              }}
              onBlur={() => {
                if (!minutes || String(minutes).trim() === '') {
                  setMinutes('');
                  push(hours, '', period);
                  return;
                }
                const n = parseInt(minutes, 10);
                if (Number.isNaN(n)) {
                  setMinutes('');
                  push(hours, '', period);
                  return;
                }
                const clamped = Math.min(59, Math.max(0, n));
                const nm = String(clamped).padStart(2, '0');
                setMinutes(nm);
                push(hours, nm, period);
              }}
            />
          </div>
        </div>
        <div className="dl-time-field dl-time-period-col">
          <span className="dl-time-sublabel">Period</span>
          <div className="dl-period-container">
            <div className="dl-period-select-slot">
              <PeriodSelect
                selectedPeriod={period}
                onPeriodChange={(per) => {
                  if (per === '') {
                    setPeriod('');
                    push(hours, minutes, '');
                    return;
                  }
                  if (per === 'AM' || per === 'PM') {
                    setPeriod(per);
                    push(hours, minutes, per);
                  }
                }}
                isOpen={periodOpen}
                onToggle={() => setPeriodOpen((o) => !o)}
                onClose={() => setPeriodOpen(false)}
                compact
              />
            </div>
            <button
              type="button"
              className="dl-remove-timing-btn"
              title="Clear deadline time"
              disabled={disabled}
              onClick={handleClear}
            >
              <Image src="/trash2.svg" alt="Clear" width={18} height={18} />
            </button>
          </div>
        </div>
      </div>
      {error && <div className="dl-time-err">{error}</div>}
      <style jsx>{`
        .dl-time-wrap {
          margin-top: 12px;
          width: 100%;
        }
        .dl-time-main-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          text-align: left;
          font-size: 0.95rem;
        }
        .dl-time-row {
          display: flex;
          flex-direction: row;
          align-items: flex-end;
          gap: 12px;
          width: 100%;
          box-sizing: border-box;
        }
        .dl-time-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }
        .dl-time-time-col {
          flex: 0 0 auto;
        }
        .dl-time-period-col {
          flex: 1 1 0;
          min-width: 0;
        }
        .dl-time-sublabel {
          font-size: 0.88rem;
          font-weight: 600;
          color: #333;
          text-align: left;
        }
        .dl-time-inputs {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .dl-time-inp {
          width: 58px;
          max-width: 100%;
          padding: 10px 6px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 1rem;
          text-align: center;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .dl-time-inp:focus {
          border-color: #1fa8dc;
        }
        .dl-time-colon {
          font-size: 1.15rem;
          font-weight: 600;
          color: #333;
          padding: 0 2px;
          flex-shrink: 0;
        }
        .dl-period-container {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }
        .dl-period-select-slot {
          flex: 1 1 0;
          min-width: 0;
        }
        .dl-remove-timing-btn {
          flex: 0 0 auto;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 12px;
          cursor: pointer;
          font-size: 1rem;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 44px;
          height: 44px;
          box-sizing: border-box;
        }
        .dl-remove-timing-btn:hover:not(:disabled) {
          background: #c82333;
        }
        .dl-remove-timing-btn:active:not(:disabled) {
          transform: scale(0.95);
        }
        .dl-remove-timing-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .dl-time-err {
          color: #dc3545;
          font-size: 0.875rem;
          margin-top: 6px;
        }
        @media (max-width: 520px) {
          .dl-time-row {
            flex-wrap: nowrap;
            gap: 8px;
            align-items: flex-end;
          }
          /* Period column grows so the row is full width; select stretches up to the trash btn */
          .dl-time-period-col {
            flex: 1 1 0;
            min-width: 0;
          }
          .dl-time-inp {
            width: 48px;
            padding: 8px 4px;
            font-size: 0.95rem;
          }
          .dl-time-colon {
            font-size: 1rem;
            padding: 0 1px;
          }
          .dl-period-container {
            width: 100%;
            gap: 8px;
          }
          .dl-period-select-slot {
            flex: 1 1 0;
            min-width: 0;
            width: auto;
            max-width: none;
          }
          .dl-remove-timing-btn {
            min-width: 44px;
            height: 44px;
            padding: 8px 10px;
          }
          .dl-time-sublabel {
            font-size: 0.82rem;
          }
        }
      `}</style>
    </div>
  );
}
