'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/app/lib/utils';

export type SelectOption = {
  value: string;
  label: string;
};

type CustomSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn(
        'shrink-0 transition-transform duration-150',
        open && 'rotate-180',
      )}
      style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function CustomSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Selecione…',
  disabled = false,
  className,
}: CustomSelectProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const selected = options.find((option) => option.value === value);
  const displayLabel = selected?.label ?? placeholder;
  const isPlaceholder = !selected;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setHighlightedIndex(-1);
      return;
    }

    const currentIndex = options.findIndex((option) => option.value === value);
    setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
  }, [open, options, value]);

  const selectOption = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        setHighlightedIndex((index) => Math.min(index + 1, options.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        setHighlightedIndex((index) => Math.max(index - 1, 0));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (highlightedIndex >= 0 && options[highlightedIndex]) {
          selectOption(options[highlightedIndex].value);
        }
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        className={cn(
          'input flex w-full items-center justify-between gap-3 text-left',
          disabled && 'cursor-not-allowed opacity-60',
        )}
        style={{
          fontFamily: 'var(--font-body)',
          color: isPlaceholder
            ? 'color-mix(in srgb, var(--color-text) 48%, transparent)'
            : 'var(--color-text)',
        }}
      >
        <span className="truncate">{displayLabel}</span>
        <IconChevron open={open} />
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-labelledby={id}
          className="anim-fade-in absolute z-20 mt-1.5 max-h-[280px] w-full overflow-y-auto border border-[var(--color-divider)] bg-[var(--color-bg)] py-1 shadow-[var(--shadow-md)]"
        >
          {options.map((option, index) => {
            const selectedOption = option.value === value;
            const highlighted = index === highlightedIndex;

            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedOption}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => selectOption(option.value)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[14px] transition-colors duration-150"
                  style={{
                    fontFamily: 'var(--font-body)',
                    background:
                      selectedOption || highlighted
                        ? 'var(--color-accent-100)'
                        : 'transparent',
                    color: selectedOption
                      ? 'var(--color-accent-800)'
                      : 'var(--color-text)',
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {selectedOption ? (
                    <span
                      aria-hidden
                      className="text-[12px]"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      ✓
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
