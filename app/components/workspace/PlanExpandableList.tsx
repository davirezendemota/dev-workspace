'use client';

import { useState } from 'react';
import { formatPlanBody, type Plan } from '@/app/lib/plans';
import { cn } from '@/app/lib/utils';

function formatGeneratedAt(value: string): string {
  const date = Date.parse(value);
  if (Number.isNaN(date)) return value;
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type PlanExpandableListProps = {
  plans: Plan[];
  milestoneTitleById?: Map<string, string>;
  emptyMessage?: string;
};

export default function PlanExpandableList({
  plans,
  milestoneTitleById,
  emptyMessage = 'Nenhum plano registrado.',
}: PlanExpandableListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (planId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  };

  if (plans.length === 0) {
    return (
      <p
        className="text-[12px] italic"
        style={{ color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="flex list-none flex-col gap-1.5 p-0">
      {plans.map((plan) => {
        const expanded = expandedIds.has(plan.id);
        const body = formatPlanBody(plan);
        const milestoneTitle = milestoneTitleById?.get(plan.milestoneId);

        return (
          <li
            key={plan.id}
            className="rounded border border-[var(--color-divider)] bg-[var(--color-bg)]"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[13px] font-medium"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {plan.title}
                </p>
                <p
                  className="text-[11px]"
                  style={{ color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}
                >
                  {milestoneTitle ? `${milestoneTitle} · ` : ''}
                  {formatGeneratedAt(plan.generatedAt)}
                </p>
              </div>
              <button
                type="button"
                className="btn shrink-0 text-[12px]"
                onClick={() => toggleExpanded(plan.id)}
                aria-expanded={expanded}
              >
                {expanded ? 'Recolher' : 'Expandir'}
              </button>
            </div>
            {expanded ? (
              <div className={cn('border-t border-[var(--color-divider)] px-3 py-2.5')}>
                <pre
                  className="m-0 whitespace-pre-wrap break-words text-[12px] leading-relaxed"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'color-mix(in srgb, var(--color-text) 80%, transparent)',
                  }}
                >
                  {body}
                </pre>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
