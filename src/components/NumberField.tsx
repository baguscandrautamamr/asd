import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  help?: string;
  /** Shown instead of the number when the value equals `autoValue`. */
  autoValue?: number;
  autoLabel?: string;
}

/**
 * A number input that does not fight the person typing.
 *
 * The previous form clamped on every keystroke, so clearing the box to retype
 * a value snapped it straight back to the minimum and typing "36" over "4"
 * was impossible. Here the field keeps the raw text while it has focus and
 * only parses and clamps on blur or Enter — plus steppers for quick nudges.
 */
export const NumberField: React.FC<NumberFieldProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  help,
  autoValue,
  autoLabel,
}) => {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep in sync when the value changes elsewhere (preset, loaded scenario),
  // but never while the field is being edited.
  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const commit = (raw: string) => {
    const parsed = parseFloat(raw.replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    const rounded = Math.round(clamped * 100) / 100;
    setDraft(String(rounded));
    if (rounded !== value) onChange(rounded);
  };

  const nudge = (delta: number) => {
    const next = Math.min(max, Math.max(min, Math.round((value + delta) * 100) / 100));
    setDraft(String(next));
    onChange(next);
  };

  const isAuto = autoValue !== undefined && value === autoValue && !focused;

  return (
    // field-cell spans the parent's three row tracks so label, control and
    // helper text line up with every other field on the row.
    <div className="field-cell">
      <label className="field-label">{label}</label>

      <div className="flex items-stretch gap-0.5">
        <button
          type="button"
          onClick={() => nudge(-step)}
          disabled={value <= min}
          aria-label={`${label} −${step}`}
          className="w-5 shrink-0 rounded-md border border-line-2 bg-surface-2 text-ink-2 hover:bg-surface-3 disabled:opacity-40 disabled:hover:bg-surface-2 flex items-center justify-center transition-colors"
        >
          <Minus className="w-2.5 h-2.5" />
        </button>

        <div className="relative flex-1 min-w-0">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={isAuto ? (autoLabel ?? draft) : draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => {
              setFocused(true);
              setDraft(String(value));
              // Select everything so typing replaces instead of appending.
              requestAnimationFrame(() => e.target.select());
            }}
            onBlur={() => {
              setFocused(false);
              commit(draft);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commit(draft);
                inputRef.current?.blur();
              } else if (e.key === 'Escape') {
                setDraft(String(value));
                inputRef.current?.blur();
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                nudge(step);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                nudge(-step);
              }
            }}
            className={`field font-mono text-center px-1 ${unit ? 'pr-6' : ''}`}
          />
          {unit && !isAuto && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-ink-3 pointer-events-none">
              {unit}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => nudge(step)}
          disabled={value >= max}
          aria-label={`${label} +${step}`}
          className="w-5 shrink-0 rounded-md border border-line-2 bg-surface-2 text-ink-2 hover:bg-surface-3 disabled:opacity-40 disabled:hover:bg-surface-2 flex items-center justify-center transition-colors"
        >
          <Plus className="w-2.5 h-2.5" />
        </button>
      </div>

      <p className="field-help">
        <span className="font-mono">
          {min}–{max}
        </span>
        {help ? ` · ${help}` : ''}
      </p>
    </div>
  );
};
