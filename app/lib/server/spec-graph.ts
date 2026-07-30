import {
  extractWikilinks,
  moduleFromSpecFile,
} from '@/app/lib/spec-links';
import {
  getProjectFeatureContent,
  getProjectSpecChecklist,
} from '@/app/lib/server/projects';

export type SpecGraphNode = {
  id: string;
  specId: string;
  title: string;
  specFile: string;
  module: string;
  linkCount: number;
  acDone: number;
  acTotal: number;
};

export type SpecGraphEdge = {
  source: string;
  target: string;
  count: number;
  anchors: string[];
};

export type SpecGraphBrokenLink = {
  fromSpecId: string;
  targetSpecId: string;
  raw: string;
  line?: number;
};

export type SpecGraphResponse = {
  nodes: SpecGraphNode[];
  edges: SpecGraphEdge[];
  brokenLinks: SpecGraphBrokenLink[];
};

type EdgeAgg = {
  source: string;
  target: string;
  count: number;
  anchors: Set<string>;
};

export async function buildProjectSpecGraph(
  projectId: string,
): Promise<SpecGraphResponse | null> {
  const checklist = await getProjectSpecChecklist(projectId);
  if (!checklist) {
    return null;
  }

  const knownIds = new Set(checklist.specs.map((s) => s.specId));
  const edgeMap = new Map<string, EdgeAgg>();
  const brokenLinks: SpecGraphBrokenLink[] = [];
  const degree = new Map<string, number>();

  for (const spec of checklist.specs) {
    degree.set(spec.specId, 0);
  }

  for (const spec of checklist.specs) {
    let content = '';
    try {
      const feature = await getProjectFeatureContent(projectId, spec.specId);
      content = feature?.content ?? '';
    } catch {
      content = '';
    }

    if (!content) continue;

    const links = extractWikilinks(content);
    for (const link of links) {
      if (link.specId === spec.specId) continue;

      if (!knownIds.has(link.specId)) {
        brokenLinks.push({
          fromSpecId: spec.specId,
          targetSpecId: link.specId,
          raw: link.raw,
          ...(link.line != null ? { line: link.line } : {}),
        });
        continue;
      }

      const key = `${spec.specId}->${link.specId}`;
      let agg = edgeMap.get(key);
      if (!agg) {
        agg = {
          source: spec.specId,
          target: link.specId,
          count: 0,
          anchors: new Set(),
        };
        edgeMap.set(key, agg);
      }
      agg.count += 1;
      if (link.anchor) agg.anchors.add(link.anchor);
    }
  }

  for (const agg of edgeMap.values()) {
    degree.set(agg.source, (degree.get(agg.source) ?? 0) + agg.count);
    degree.set(agg.target, (degree.get(agg.target) ?? 0) + agg.count);
  }

  const nodes: SpecGraphNode[] = checklist.specs.map((spec) => {
    const acTotal = spec.checklist.length;
    const acDone = spec.checklist.filter((item) => item.status === 'done').length;
    return {
      id: spec.specId,
      specId: spec.specId,
      title: spec.title,
      specFile: spec.specFile,
      module: moduleFromSpecFile(spec.specFile),
      linkCount: degree.get(spec.specId) ?? 0,
      acDone,
      acTotal,
    };
  });

  const edges: SpecGraphEdge[] = [...edgeMap.values()].map((agg) => ({
    source: agg.source,
    target: agg.target,
    count: agg.count,
    anchors: [...agg.anchors].sort(),
  }));

  return { nodes, edges, brokenLinks };
}
