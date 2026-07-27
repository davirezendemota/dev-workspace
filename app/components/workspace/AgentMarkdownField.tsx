'use client';

import { useState } from 'react';
import { cn } from '@/app/lib/utils';
import Markdown from './Markdown';

type ViewMode = 'code' | 'preview';

function IconCode() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconPreview() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

type AgentMarkdownFieldProps = {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  heightClassName?: string;
};

export default function AgentMarkdownField({
  id,
  label,
  hint,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  heightClassName = 'h-[480px]',
}: AgentMarkdownFieldProps) {
  const [mode, setMode] = useState<ViewMode>(readOnly ? 'preview' : 'code');

  const renderToggle = (
    target: ViewMode,
    label: string,
    icon: React.ReactNode,
  ) => {
    const active = mode === target;
    return (
      <button
        type="button"
        className="fbtn"
        style={{
          background: active ? 'var(--color-accent-100)' : 'transparent',
          borderColor: active ? 'var(--color-accent)' : 'var(--color-divider)',
          color: active ? 'var(--color-accent-700)' : 'var(--color-text)',
          width: 34,
          minHeight: 34,
          padding: 0,
          justifyContent: 'center',
        }}
        onClick={() => setMode(target)}
        disabled={disabled}
        aria-pressed={active}
        aria-label={label}
        title={label}
      >
        {icon}
      </button>
    );
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className="block text-[12px] tracking-[0.08em] uppercase"
          style={{
            fontFamily: 'var(--font-heading)',
            color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
          }}
        >
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          {renderToggle('preview', 'Preview', <IconPreview />)}
          {renderToggle('code', 'Código', <IconCode />)}
        </div>
      </div>

      {mode === 'code' ? (
        readOnly ? (
          <pre
            id={id}
            className={cn(
              'input m-0 overflow-x-hidden overflow-y-auto whitespace-pre-wrap font-mono text-[13px] leading-relaxed',
              heightClassName,
            )}
            aria-label={`${label} código`}
          >
            {value || 'Sem conteúdo.'}
          </pre>
        ) : (
          <textarea
            id={id}
            className={cn(
              'input resize-none font-mono text-[13px] leading-relaxed',
              heightClassName,
            )}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        )
      ) : (
        <div
          className={cn('input min-w-0 overflow-x-hidden overflow-y-auto !p-4', heightClassName)}
          aria-label={`${label} preview`}
        >
          <Markdown preview className="text-[13px] leading-relaxed">
            {value.trim() || '*Sem conteúdo.*'}
          </Markdown>
        </div>
      )}

      {hint ? (
        <p
          className="mt-1.5 text-[12px] italic"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 48%, transparent)',
          }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
