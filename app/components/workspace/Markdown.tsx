'use client';

import { Children, isValidElement, useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { copyTextToClipboard } from '@/app/lib/copy-to-clipboard';
import { cn } from '@/app/lib/utils';

function hastText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { type?: string; value?: string; children?: unknown[] };
  if (n.type === 'text') return n.value ?? '';
  if (Array.isArray(n.children)) return n.children.map(hastText).join('');
  return '';
}

const STATUS_TINTS: Array<{ emojis: string[]; className: string }> = [
  { emojis: ['🔴', '❌', '⛔', '🚫'], className: 'status-row-red' },
  { emojis: ['🟠'], className: 'status-row-orange' },
  { emojis: ['🟡', '🟨', '🚧', '📋', '📨', '⏳'], className: 'status-row-amber' },
  { emojis: ['🟢', '🟩', '✅', '✔️', '☑️', '☑'], className: 'status-row-green' },
  { emojis: ['⚪', '☐', '⬜'], className: 'status-row-neutral' },
];

function statusClass(text: string): string {
  for (const { emojis, className } of STATUS_TINTS) {
    if (emojis.some((e) => text.includes(e))) return className;
  }
  return '';
}

const WORD_TINTS: Array<{ pattern: RegExp; className: string }> = [
  { pattern: /\b(bloquead[ao]s?|blocked)\b/i, className: 'status-row-red' },
  {
    pattern: /\b(consolidad[ao]s?|conclu[íi]d[ao]s?|resolvid[ao]s?|entregues?|done|feit[ao]s?)\b/i,
    className: 'status-row-green',
  },
  {
    pattern: /\b(abert[ao]s?|pendentes?|em andamento|em an[áa]lise|parcial|aguardando)\b/i,
    className: 'status-row-amber',
  },
];

function rowStatusClass(text: string): string {
  const byEmoji = statusClass(text);
  if (byEmoji) return byEmoji;
  for (const { pattern, className } of WORD_TINTS) {
    if (pattern.test(text)) return className;
  }
  return '';
}

function getCodeText(children: ReactNode): string {
  const child = Children.toArray(children)[0];
  if (!isValidElement<{ children?: ReactNode }>(child)) return '';
  const codeChildren = child.props.children;
  if (typeof codeChildren === 'string') return codeChildren.replace(/\n$/, '');
  if (Array.isArray(codeChildren)) {
    return codeChildren.map((item) => String(item ?? '')).join('').replace(/\n$/, '');
  }
  return String(codeChildren ?? '').replace(/\n$/, '');
}

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CopyCodeBlock({
  children,
  ...props
}: React.ComponentPropsWithoutRef<'pre'>) {
  const [copied, setCopied] = useState(false);
  const code = getCodeText(children);

  const handleCopy = async () => {
    if (!code) return;

    const ok = await copyTextToClipboard(code);
    if (ok) {
      setCopied(true);
      toast.success('Código copiado');
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Não foi possível copiar');
    }
  };

  return (
    <div className="markdown-code-block">
      <button
        type="button"
        className="markdown-code-copy"
        onClick={() => void handleCopy()}
        aria-label={copied ? 'Código copiado' : 'Copiar código'}
        title={copied ? 'Copiado' : 'Copiar código'}
      >
        {copied ? <IconCheck /> : <IconCopy />}
      </button>
      <pre {...props}>{children}</pre>
    </div>
  );
}

function buildComponents(copyable: boolean): Components {
  return {
    tr({ node, children, ...props }) {
      const cls = rowStatusClass(hastText(node));
      return (
        <tr className={cls || undefined} {...props}>
          {children}
        </tr>
      );
    },
    li({ node, children, ...props }) {
      const cls = statusClass(hastText(node));
      return (
        <li className={cls || undefined} {...props}>
          {children}
        </li>
      );
    },
    pre({ children, ...props }) {
      if (!copyable) {
        return <pre {...props}>{children}</pre>;
      }

      return <CopyCodeBlock {...props}>{children}</CopyCodeBlock>;
    },
  };
}

export default function Markdown({
  children,
  className,
  preview = false,
}: {
  children: string;
  className?: string;
  preview?: boolean;
}) {
  const components = useMemo(() => buildComponents(preview), [preview]);

  return (
    <div className={cn('prose-spec min-w-0', preview && 'prose-spec-preview overflow-x-hidden', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
