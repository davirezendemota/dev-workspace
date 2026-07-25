export type AcStatus = 'todo' | 'in-progress' | 'blocked' | 'done';

export type SpecChecklistAc = {
  ac: string;
  description: string;
  status: AcStatus;
  completedCommit: string | null;
  completedAt: string | null;
  issues: number[];
  prs: number[];
};

export type SpecChecklistSpec = {
  specId: string;
  specFile: string;
  title: string;
  checklist: SpecChecklistAc[];
};

export type ProjectSpecChecklistData = {
  checklist_path: string;
  updated_at: string | null;
  global_updated_at: string | null;
  project_id: string | null;
  project_name: string | null;
  specs: SpecChecklistSpec[];
  source: 'local' | 'github' | null;
  stats: {
    total: number;
    done: number;
    in_progress: number;
    blocked: number;
    todo: number;
  };
};
