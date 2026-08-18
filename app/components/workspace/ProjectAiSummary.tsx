function IconSpark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="url(#workspace-icon-gradient)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1 1 3z" />
      <path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75L19 13z" />
    </svg>
  );
}

type ProjectAiSummaryProps = {
  summary: string;
};

export default function ProjectAiSummary({ summary }: ProjectAiSummaryProps) {
  return (
    <div>
      <div className="flex items-start gap-2">
        <IconSpark size={18} />

        <span
          className="line-clamp-5 min-w-0 flex-1 text-left text-[12px] italic leading-snug"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          {summary}
        </span>
      </div>

      <hr
        className="mt-4 border-0 border-t border-[var(--color-divider)]"
        aria-hidden
      />
    </div>
  );
}
