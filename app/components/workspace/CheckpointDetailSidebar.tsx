'use client';

import {
  checkpointExpandedDescription,
  getCheckpointDisplayDateTime,
  type Checkpoint,
} from '@/app/lib/checkpoints';
import Markdown from './Markdown';

type CheckpointDetailSidebarProps = {
  checkpoint: Checkpoint;
  date: string;
  onClose: () => void;
};

function IconClose() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export default function CheckpointDetailSidebar({
  checkpoint,
  date,
  onClose,
}: CheckpointDetailSidebarProps) {
  const title = checkpoint.title.trim() || 'Checkpoint sem título';
  const description = checkpointExpandedDescription(checkpoint);
  const { date: displayDate, time: displayTime } = getCheckpointDisplayDateTime({
    date: date || checkpoint.date,
  });

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer border-0 bg-[color-mix(in_srgb,var(--color-text)_20%,transparent)] backdrop-blur-[2px]"
        aria-label="Fechar detalhes do checkpoint"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes: ${title}`}
        className="anim-fade-up relative z-[1] flex h-full w-[min(100%,440px)] flex-col border-l border-[var(--color-divider)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)]"
      >
        <header className="flex flex-none items-start justify-between gap-3 border-b border-[var(--color-divider)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2
              className="text-[1.125rem] font-semibold leading-snug"
              style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
            >
              {title}
            </h2>
            {displayDate ? (
              <div className="mt-1 flex items-baseline gap-2">
                <time
                  className="block text-[12px]"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                  }}
                  dateTime={date || checkpoint.date || undefined}
                >
                  {displayDate}
                </time>
                {displayTime ? (
                  <span
                    className="num text-[11px] leading-none"
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
                    }}
                  >
                    {displayTime}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="btn flex-none"
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar"
          >
            <IconClose />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
          {checkpoint.atas.length > 0 ? (
            <section className="flex flex-col gap-4" aria-label="Atas">
              {checkpoint.atas.map((ata, index) => {
                const ataTitle = ata.title.trim() || `Ata ${index + 1}`;
                const ataKey = `${ataTitle}-${ata.content.slice(0, 24)}`;

                return (
                  <article
                    key={ataKey}
                    className="flex flex-col gap-2 border border-[var(--color-divider)] bg-[color-mix(in_srgb,var(--color-text)_3%,transparent)] px-4 py-3"
                  >
                    <h3
                      className="text-[13px] font-medium"
                      style={{ fontFamily: 'var(--font-heading)' }}
                    >
                      {ataTitle}
                    </h3>
                    {ata.content.trim() ? (
                      <Markdown className="text-[13px]">{ata.content}</Markdown>
                    ) : (
                      <p
                        className="text-[13px] italic"
                        style={{
                          fontFamily: 'var(--font-body)',
                          color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
                        }}
                      >
                        Sem conteúdo
                      </p>
                    )}
                  </article>
                );
              })}
            </section>
          ) : null}

          {description ? (
            <section className="flex min-w-0 flex-col gap-2" aria-label="Descrição">
              <h3
                className="text-[12px] font-medium uppercase tracking-wide"
                style={{
                  fontFamily: 'var(--font-heading)',
                  color: 'color-mix(in srgb, var(--color-text) 50%, transparent)',
                }}
              >
                Descrição
              </h3>
              <Markdown>{description}</Markdown>
            </section>
          ) : (
            <p
              className="text-[13px] italic"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
              }}
            >
              Sem descrição registrada.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
