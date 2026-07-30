'use client';

import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/app/lib/utils';
import type { Project } from './data';

type ForceGraphHandle = {
  centerAt: (x: number, y: number, ms?: number) => void;
  zoom: (k: number, ms?: number) => void;
  d3Force: (name: string, force: null) => void;
};

type FgObject = Record<string, unknown> & {
  id?: string | number;
  x?: number;
  y?: number;
  source?: string | number | FgObject;
  target?: string | number | FgObject;
  count?: number;
};

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <p
        className="text-[14px] italic"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
        }}
      >
        Carregando grafo…
      </p>
    </div>
  ),
});

type SpecGraphNode = {
  id: string;
  specId: string;
  title: string;
  specFile: string;
  module: string;
  linkCount: number;
  acDone: number;
  acTotal: number;
};

type SpecGraphEdge = {
  source: string;
  target: string;
  count: number;
  anchors: string[];
};

type SpecGraphData = {
  nodes: SpecGraphNode[];
  edges: SpecGraphEdge[];
  brokenLinks: Array<{
    fromSpecId: string;
    targetSpecId: string;
    raw: string;
    line?: number;
  }>;
};

type GraphNode = SpecGraphNode & {
  val: number;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
};

type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
  count: number;
  anchors: string[];
};

type ProjectSpecGraphProps = {
  project: Project;
  onOpenSpec: (specId: string) => void;
};

const NODE_GRAY = '#8a8a8a';
const NODE_GRAY_DIM = 'rgba(138, 138, 138, 0.28)';
const NODE_BLUE = '#3b82f6';
const NODE_BLUE_SOFT = 'rgba(59, 130, 246, 0.42)';
const LINK_GRAY = 'rgba(138, 138, 138, 0.35)';
const LINK_BLUE = '#3b82f6';

function nodeId(ref: string | number | { id?: string | number } | undefined): string {
  if (ref == null) return '';
  if (typeof ref === 'string' || typeof ref === 'number') return String(ref);
  return String(ref.id ?? '');
}

function nodeRadius(val: number): number {
  return Math.max(4, Math.sqrt(val) * 3.2);
}

function truncateNodeTitle(title: string): string {
  return title.length > 28 ? `${title.slice(0, 26)}…` : title;
}

let measureCtx: CanvasRenderingContext2D | null = null;

function measureTitleWidth(title: string): number {
  if (typeof document === 'undefined') return title.length * 5;
  if (!measureCtx) {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
  }
  if (!measureCtx) return title.length * 5;
  measureCtx.font = '9px sans-serif';
  return measureCtx.measureText(title).width;
}

function nodeVisualBBox(node: GraphNode) {
  const r = nodeRadius(node.val);
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const title = truncateNodeTitle(node.title);
  const titleWidth = measureTitleWidth(title);
  const titleCenterY = y + r + 9 + 1;

  return {
    minX: Math.min(x - r, x - titleWidth / 2),
    maxX: Math.max(x + r, x + titleWidth / 2),
    minY: y - r,
    maxY: titleCenterY + 4.5,
  };
}

function visibleNodesForCenter(
  nodes: GraphNode[],
  depthVisible: Set<string> | null,
  searchMatchIds: Set<string> | null,
): GraphNode[] {
  return nodes.filter((n) => {
    const id = String(n.id);
    if (n.x == null || n.y == null) return false;
    if (depthVisible && !depthVisible.has(id)) return false;
    if (searchMatchIds && !searchMatchIds.has(id)) return false;
    return true;
  });
}

function zoomToFitWithLabels(
  fg: {
    centerAt: (x: number, y: number, ms?: number) => void;
    zoom: (k: number, ms?: number) => void;
  },
  nodes: GraphNode[],
  width: number,
  height: number,
  padding: number,
  durationMs: number,
) {
  if (nodes.length === 0) return;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    const b = nodeVisualBBox(n);
    minX = Math.min(minX, b.minX);
    maxX = Math.max(maxX, b.maxX);
    minY = Math.min(minY, b.minY);
    maxY = Math.max(maxY, b.maxY);
  }

  if (!Number.isFinite(minX)) return;

  const bboxW = Math.max(maxX - minX, 1);
  const bboxH = Math.max(maxY - minY, 1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const zoomK = Math.max(
    1e-12,
    Math.min(1e12, (width - padding * 2) / bboxW, (height - padding * 2) / bboxH),
  );

  fg.centerAt(cx, cy, durationMs);
  fg.zoom(zoomK, durationMs);
}

function bfsVisible(
  rootId: string | null,
  depth: number,
  nodes: GraphNode[],
  links: GraphLink[],
): Set<string> | null {
  if (!rootId || depth <= 0) return null;

  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const l of links) {
    const s = nodeId(l.source);
    const t = nodeId(l.target);
    adj.get(s)?.add(t);
    adj.get(t)?.add(s);
  }

  const visible = new Set<string>([rootId]);
  let frontier = [rootId];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const nb of adj.get(id) ?? []) {
        if (!visible.has(nb)) {
          visible.add(nb);
          next.push(nb);
        }
      }
    }
    frontier = next;
  }
  return visible;
}

function placeOnRing(
  nodes: GraphNode[],
  radius: number,
  placed: Map<string, GraphNode>,
) {
  if (nodes.length === 0) return;
  if (nodes.length === 1 && radius === 0) {
    const only = nodes[0];
    placed.set(only.id, { ...only, x: 0, y: 0, fx: 0, fy: 0 });
    return;
  }
  nodes.forEach((node, index) => {
    const angle = (index / nodes.length) * 2 * Math.PI - Math.PI / 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    placed.set(node.id, { ...node, x, y, fx: x, fy: y });
  });
}

function layoutNodesInCircle(nodes: GraphNode[]): GraphNode[] {
  const sorted = [...nodes].sort((a, b) => a.specId.localeCompare(b.specId));
  const count = sorted.length;
  if (count === 0) return sorted;
  if (count === 1) {
    const only = sorted[0];
    return [{ ...only, x: 0, y: 0, fx: 0, fy: 0 }];
  }

  const minSpacing = 88;
  const byDegree = [...sorted].sort(
    (a, b) => b.linkCount - a.linkCount || a.specId.localeCompare(b.specId),
  );
  const connectedCount = byDegree.filter((n) => n.linkCount > 0).length;

  let centerCount = connectedCount > 0
    ? Math.min(
        Math.max(1, Math.round(count * 0.2)),
        count - 1,
        connectedCount,
      )
    : Math.min(Math.max(1, Math.round(count * 0.15)), count - 1);

  if (count <= 3) centerCount = 1;

  const centerNodes = byDegree.slice(0, centerCount);
  const centerIds = new Set(centerNodes.map((n) => n.id));
  const ringNodes = sorted.filter((n) => !centerIds.has(n.id));

  const placed = new Map<string, GraphNode>();
  const outerRadius = Math.max(
    140,
    (Math.max(ringNodes.length, 1) * minSpacing) / (2 * Math.PI),
  );

  if (centerNodes.length === 1) {
    placeOnRing(centerNodes, 0, placed);
  } else {
    const innerRadius = Math.max(48, (centerNodes.length * 56) / (2 * Math.PI));
    placeOnRing(centerNodes, innerRadius, placed);
  }

  placeOnRing(ringNodes, outerRadius, placed);

  return sorted.map((n) => placed.get(n.id)!);
}

export default function ProjectSpecGraph({ project, onOpenSpec }: ProjectSpecGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphHandle | undefined>(undefined);

  const [data, setData] = useState<SpecGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 600, height: 400 });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedId(null);
    setSearchQuery('');
    setDepth(0);

    async function load() {
      try {
        const response = await fetch(`/api/projects/${project.id}/spec-graph`);
        if (!response.ok) {
          let detail = `Erro ${response.status}`;
          try {
            const body = await response.json();
            if (typeof body?.detail === 'string') detail = body.detail;
          } catch {
            /* ignore */
          }
          throw new Error(detail);
        }
        const body: SpecGraphData = await response.json();
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(
            err instanceof Error ? err.message : 'Não foi possível carregar o grafo.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({
        width: Math.max(200, Math.floor(rect.width)),
        height: Math.max(200, Math.floor(rect.height)),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, error, data]);

  const graphData = useMemo(() => {
    if (!data) return { nodes: [] as GraphNode[], links: [] as GraphLink[] };
    const nodes = layoutNodesInCircle(
      data.nodes.map((n) => ({
        ...n,
        val: Math.max(1, Math.sqrt(n.linkCount + 1) * 2),
      })),
    );
    const links: GraphLink[] = data.edges.map((e) => ({
      source: e.source,
      target: e.target,
      count: e.count,
      anchors: e.anchors,
    }));
    return { nodes, links };
  }, [data]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force('link', null);
    fg.d3Force('charge', null);
    fg.d3Force('center', null);
  }, [graphData]);

  const searchMatchIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null as Set<string> | null;
    const ids = new Set<string>();
    for (const n of graphData.nodes) {
      if (
        n.specId.includes(q) ||
        n.title.toLowerCase().includes(q) ||
        n.specFile.toLowerCase().includes(q) ||
        n.module.toLowerCase().includes(q)
      ) {
        ids.add(n.id);
      }
    }
    return ids;
  }, [graphData.nodes, searchQuery]);

  const depthVisible = useMemo(
    () => bfsVisible(selectedId, depth, graphData.nodes, graphData.links),
    [selectedId, depth, graphData.nodes, graphData.links],
  );

  const hoverNeighborIds = useMemo(() => {
    if (!hoverId) return null as Set<string> | null;
    const set = new Set<string>([hoverId]);
    for (const l of graphData.links) {
      const s = nodeId(l.source);
      const t = nodeId(l.target);
      if (s === hoverId) set.add(t);
      if (t === hoverId) set.add(s);
    }
    return set;
  }, [hoverId, graphData.links]);

  const paintNode = useCallback(
    (node: FgObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode;
      const id = String(n.id);
      const inDepth = !depthVisible || depthVisible.has(id);
      const inSearch = !searchMatchIds || searchMatchIds.has(id);
      const filterDimmed = !inDepth || !inSearch;
      const hoverDimmed =
        hoverId != null && hoverNeighborIds != null && !hoverNeighborIds.has(id);

      let fillColor = NODE_GRAY;
      if (filterDimmed || hoverDimmed) {
        fillColor = NODE_GRAY_DIM;
      } else if (hoverId === id) {
        fillColor = NODE_BLUE;
      } else if (hoverId && hoverNeighborIds?.has(id)) {
        fillColor = NODE_BLUE_SOFT;
      }

      const r = nodeRadius(n.val);
      const label = `${n.specId}`;
      const fontSize = Math.max(10 / globalScale, 2.5);
      const x = n.x ?? 0;
      const y = n.y ?? 0;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = fillColor;
      ctx.fill();

      if (selectedId === id) {
        ctx.strokeStyle = NODE_BLUE;
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelMuted = filterDimmed || hoverDimmed;
      ctx.fillStyle = labelMuted ? 'rgba(255,255,255,0.35)' : '#fff';
      ctx.fillText(label, x, y);

      if (globalScale > 0.85 && !filterDimmed && !hoverDimmed) {
        const titleSize = Math.max(9 / globalScale, 2);
        ctx.font = `${titleSize}px sans-serif`;
        ctx.fillStyle =
          hoverId && hoverNeighborIds?.has(id)
            ? 'rgba(59, 130, 246, 0.85)'
            : 'rgba(120, 120, 120, 0.9)';
        ctx.fillText(
          truncateNodeTitle(n.title),
          x,
          y + r + titleSize + 1,
        );
      }
    },
    [depthVisible, searchMatchIds, hoverId, hoverNeighborIds, selectedId],
  );

  const handleCenter = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;

    const visible = visibleNodesForCenter(
      graphData.nodes,
      depthVisible,
      searchMatchIds,
    );
    const targets =
      visible.length > 0
        ? visible
        : graphData.nodes.filter((n) => n.x != null && n.y != null);

    zoomToFitWithLabels(fg, targets, size.width, size.height, 40, 400);
  }, [graphData.nodes, depthVisible, searchMatchIds, size.width, size.height]);

  useEffect(() => {
    if (!loading && data && data.nodes.length > 0) {
      const t = window.setTimeout(() => handleCenter(), 300);
      return () => window.clearTimeout(t);
    }
  }, [loading, data, handleCenter]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] flex-1 items-center justify-center">
        <p
          className="text-[14px] italic"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          Carregando grafo…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="border border-[var(--color-accent)] px-4 py-3 text-[13px]"
        style={{
          background: 'var(--color-accent-100)',
          color: 'var(--color-accent-800)',
          fontFamily: 'var(--font-body)',
        }}
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div
        className="py-16 text-center text-sm"
        style={{
          color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          fontFamily: 'var(--font-body)',
        }}
      >
        <p>Nenhuma spec encontrada para montar o grafo.</p>
        <p className="mt-1 text-xs">
          Adicione wikilinks <code className="text-[var(--color-text)]">[[002]]</code> nos
          Markdowns das specs para criar arestas.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-hidden border border-[var(--color-divider)]"
        style={{ background: 'color-mix(in srgb, var(--color-text) 3%, var(--color-bg))' }}
      >
        <div
          className="absolute bottom-3 left-1/2 z-10 flex w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center gap-2 border border-[var(--color-divider)] bg-[var(--color-bg)]/90 px-3 py-2 shadow-[var(--shadow-lg)] backdrop-blur-md sm:flex-nowrap"
          role="toolbar"
          aria-label="Controles do grafo"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar spec…"
            className="w-[min(12rem,40vw)] shrink-0 border border-[var(--color-divider)] bg-[var(--color-bg)] px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent)] sm:w-44"
            style={{ fontFamily: 'var(--font-body)' }}
            aria-label="Buscar no grafo"
          />
          <label
            className="flex shrink-0 items-center gap-2 text-[12px]"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
            }}
          >
            Profundidade
            <input
              type="range"
              min={0}
              max={3}
              step={1}
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              disabled={!selectedId}
              title={
                selectedId
                  ? '0 = todos; 1–3 = hops a partir do nó selecionado'
                  : 'Selecione um nó para filtrar por profundidade'
              }
              className="w-20 accent-[var(--color-accent)]"
            />
            <span className="tabular-nums w-4">{depth}</span>
          </label>
          <button type="button" className="btn shrink-0 text-[12px]" onClick={handleCenter}>
            Centralizar
          </button>
        </div>

        <div
          className="absolute top-3 right-3 z-10 border border-[var(--color-divider)] bg-[var(--color-bg)]/90 px-2.5 py-1 text-[11px] tabular-nums shadow-[var(--shadow-lg)] backdrop-blur-md"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 65%, transparent)',
          }}
          aria-live="polite"
        >
          {data.nodes.length} nós · {data.edges.length} arestas
          {data.brokenLinks.length > 0
            ? ` · ${data.brokenLinks.length} quebrado(s)`
            : ''}
        </div>

        <ForceGraph2D
          ref={fgRef as never}
          width={size.width}
          height={size.height}
          graphData={graphData}
          backgroundColor="rgba(0,0,0,0)"
          nodeId="id"
          nodeVal="val"
          nodeLabel={(n) => {
            const node = n as GraphNode;
            return `${node.specId} — ${node.title}\n${node.linkCount} conexões · ${node.acDone}/${node.acTotal} ACs`;
          }}
          linkWidth={(l) => {
            const link = l as GraphLink;
            return Math.min(6, 0.8 + (link.count ?? 1));
          }}
          linkColor={(l) => {
            const link = l as GraphLink;
            if (!hoverId || !hoverNeighborIds) return LINK_GRAY;
            const s = nodeId(link.source);
            const t = nodeId(link.target);
            return hoverNeighborIds.has(s) && hoverNeighborIds.has(t)
              ? LINK_BLUE
              : LINK_GRAY;
          }}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          linkVisibility={(l) => {
            const link = l as GraphLink;
            const s = nodeId(link.source);
            const t = nodeId(link.target);
            if (depthVisible && (!depthVisible.has(s) || !depthVisible.has(t))) {
              return false;
            }
            if (searchMatchIds && !searchMatchIds.has(s) && !searchMatchIds.has(t)) {
              return false;
            }
            if (hoverId && hoverNeighborIds) {
              return hoverNeighborIds.has(s) && hoverNeighborIds.has(t);
            }
            return true;
          }}
          nodeCanvasObject={paintNode}
          nodeCanvasObjectMode={() => 'replace'}
          onNodeHover={(node) => {
            setHoverId(node ? String((node as GraphNode).id) : null);
          }}
          onNodeClick={(node) => {
            const id = String((node as GraphNode).id);
            setSelectedId(id);
            onOpenSpec(id);
          }}
          onBackgroundClick={() => {
            setSelectedId(null);
            setHoverId(null);
          }}
          enableNodeDrag={false}
          warmupTicks={0}
          cooldownTicks={0}
          onEngineStop={() => {
            const fg = fgRef.current;
            if (!fg) return;
            fg.d3Force('link', null);
            fg.d3Force('charge', null);
            fg.d3Force('center', null);
          }}
        />
      </div>

      {selectedId ? (
        <p
          className={cn('flex-none text-[12px]')}
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          Selecionado: <strong className="text-[var(--color-text)]">{selectedId}</strong>
          {' — '}
          abrindo Features com a spec.
        </p>
      ) : null}
    </div>
  );
}
