'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Milestone } from '@/app/lib/milestones';
import { plansByMilestoneId, sortPlansByGeneratedAt, type Plan } from '@/app/lib/plans';
import type { Project } from './data';
import PlanExpandableList from './PlanExpandableList';

type PlansDocument = {
  version: 1;
  items: Plan[];
  updated_at?: string | null;
};

type MilestonesDocument = {
  version: 1;
  items: Milestone[];
};

type ProjectPlansProps = {
  project: Project;
};

export default function ProjectPlans({ project }: ProjectPlansProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupByMilestone, setGroupByMilestone] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansRes, milestonesRes] = await Promise.all([
        fetch(`/api/projects/${project.id}/plans`, { cache: 'no-store' }),
        fetch(`/api/projects/${project.id}/milestones`, { cache: 'no-store' }),
      ]);

      if (!plansRes.ok) {
        let detail = `Erro ${plansRes.status}`;
        try {
          const body = await plansRes.json();
          if (typeof body?.detail === 'string') detail = body.detail;
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }

      const plansData = (await plansRes.json()) as PlansDocument;
      setPlans(Array.isArray(plansData.items) ? plansData.items : []);

      if (milestonesRes.ok) {
        const milestonesData = (await milestonesRes.json()) as MilestonesDocument;
        setMilestones(Array.isArray(milestonesData.items) ? milestonesData.items : []);
      } else {
        setMilestones([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar planos.');
      setPlans([]);
      setMilestones([]);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const milestoneTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const milestone of milestones) map.set(milestone.id, milestone.title);
    return map;
  }, [milestones]);

  const sortedPlans = useMemo(() => sortPlansByGeneratedAt(plans), [plans]);

  const milestoneGroups = useMemo(() => {
    const withPlans = milestones
      .map((milestone) => ({
        milestone,
        plans: plansByMilestoneId(plans, milestone.id),
      }))
      .filter((group) => group.plans.length > 0);

    return withPlans.sort(
      (a, b) =>
        Date.parse(b.plans[0].generatedAt) - Date.parse(a.plans[0].generatedAt),
    );
  }, [milestones, plans]);

  const orphanPlans = useMemo(() => {
    const knownIds = new Set(milestones.map((m) => m.id));
    return sortPlansByGeneratedAt(plans.filter((plan) => !knownIds.has(plan.milestoneId)));
  }, [milestones, plans]);

  if (loading) {
    return (
      <p
        className="text-[13px]"
        style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}
      >
        Carregando planos…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[18px] font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            Planos
          </h3>
          <p
            className="mt-1 text-[13px]"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
            }}
          >
            Planos de ação vinculados a milestones — do mais recente ao mais antigo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`btn text-[12px] ${groupByMilestone ? 'btn-primary' : ''}`}
            onClick={() => setGroupByMilestone(true)}
          >
            Por milestone
          </button>
          <button
            type="button"
            className={`btn text-[12px] ${!groupByMilestone ? 'btn-primary' : ''}`}
            onClick={() => setGroupByMilestone(false)}
          >
            Lista única
          </button>
          <span
            className="text-[12px] uppercase tracking-wider"
            style={{
              fontFamily: 'var(--font-heading)',
              color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
            }}
          >
            {plans.length} plano{plans.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {error ? (
        <p className="text-[13px] text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {plans.length === 0 ? (
        <div
          className="rounded border border-dashed border-[var(--color-divider)] px-6 py-10 text-center"
          style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}
        >
          <p className="text-[15px] font-medium" style={{ fontFamily: 'var(--font-heading)' }}>
            Nenhum plano registrado
          </p>
          <p className="mt-2 text-[13px]">
            Planos são criados via API ou agente e vinculados a uma milestone.
          </p>
        </div>
      ) : groupByMilestone ? (
        <div className="flex flex-col gap-6">
          {milestoneGroups.map(({ milestone, plans: groupPlans }) => (
            <section key={milestone.id} className="flex flex-col gap-4">
              <h4
                className="text-[14px] font-semibold"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {milestone.title}
              </h4>
              <PlanExpandableList plans={groupPlans} />
            </section>
          ))}
          {orphanPlans.length > 0 ? (
            <section className="flex flex-col gap-4">
              <h4
                className="text-[14px] font-semibold"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Sem milestone
              </h4>
              <PlanExpandableList plans={orphanPlans} />
            </section>
          ) : null}
        </div>
      ) : (
        <PlanExpandableList plans={sortedPlans} milestoneTitleById={milestoneTitleById} />
      )}
    </div>
  );
}
