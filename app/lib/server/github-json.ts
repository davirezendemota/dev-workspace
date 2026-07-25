const REPO_RE =
  /(?:https?:\/\/)?(?:www\.)?github\.com[/:]([^/]+)\/([^/#?\s]+)/i;

export function parseGithubRepo(repoUrl: string): [string, string] {
  let cleaned = repoUrl.trim().replace(/\/$/, '');
  if (cleaned.endsWith('.git')) {
    cleaned = cleaned.slice(0, -4);
  }

  const match = REPO_RE.exec(cleaned);
  if (match?.[1] && match[2]) {
    return [match[1], match[2].replace(/\.git$/, '')];
  }

  const parts = cleaned.split('/');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return [parts[0], parts[1]];
  }

  throw new Error(
    'URL do repositório inválida. Use https://github.com/owner/repo ou owner/repo.',
  );
}

export async function fetchGithubCommitDate(options: {
  repoUrl: string;
  pat: string;
  commit: string;
}): Promise<string> {
  const [owner, repo] = parseGithubRepo(options.repoUrl);
  const commit = options.commit.trim().toLowerCase();
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(commit)) {
    throw new Error('Hash de commit inválido.');
  }

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(commit)}`;
  const response = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${options.pat.trim()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'workspace-project-sync',
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar commit no GitHub (${response.status}).`);
  }

  const payload = (await response.json()) as {
    commit?: {
      committer?: { date?: string | null } | null;
      author?: { date?: string | null } | null;
    };
  };
  const committedAt = payload.commit?.committer?.date ?? payload.commit?.author?.date;
  if (!committedAt) {
    throw new Error('Data do commit não encontrada no GitHub.');
  }
  return committedAt;
}

export async function fetchGithubJsonFile(options: {
  repoUrl: string;
  pat: string;
  branch: string;
  filePath: string;
}): Promise<Record<string, unknown>> {
  const raw = await fetchGithubTextFile(options);
  let data: unknown;
  try {
    data = JSON.parse(raw.content);
  } catch {
    throw new Error('Arquivo não é um JSON válido.');
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('O JSON do projeto deve ser um objeto (não array/primitivo).');
  }

  return data as Record<string, unknown>;
}

export type GithubTextFile = {
  content: string;
  sha: string | null;
};

export async function fetchGithubTextFile(options: {
  repoUrl: string;
  pat: string;
  branch: string;
  filePath: string;
}): Promise<GithubTextFile> {
  const [owner, repo] = parseGithubRepo(options.repoUrl);
  const filePath = options.filePath.trim().replace(/^\//, '');
  const encodedPath = filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(options.branch.trim())}`;

  const response = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${options.pat.trim()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'workspace-project-sync',
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401) {
      throw new Error('PAT inválido ou sem permissão para o repositório.');
    }
    if (response.status === 404) {
      throw new Error(
        'Arquivo, branch ou repositório não encontrado. Verifique o link, a branch e o caminho do arquivo.',
      );
    }
    throw new Error(`Erro ao buscar arquivo no GitHub (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as {
    encoding?: string;
    content?: string;
    sha?: string;
  };

  if (Array.isArray(payload)) {
    throw new Error('O caminho aponta para um diretório, não para um arquivo.');
  }

  let content: string;
  if (payload.encoding === 'base64' && typeof payload.content === 'string') {
    content = Buffer.from(payload.content, 'base64').toString('utf-8');
  } else if (typeof payload.content === 'string') {
    content = payload.content;
  } else {
    content = await fetchRawGithubFile(owner, repo, filePath, options.branch, options.pat);
  }

  return {
    content,
    sha: typeof payload.sha === 'string' ? payload.sha : null,
  };
}

async function fetchRawGithubFile(
  owner: string,
  repo: string,
  filePath: string,
  branch: string,
  pat: string,
): Promise<string> {
  const encodedPath = filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch.trim())}`;

  const response = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github.raw+json',
      Authorization: `Bearer ${pat.trim()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'workspace-project-sync',
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar arquivo no GitHub (${response.status}).`);
  }

  return response.text();
}

export async function putGithubTextFile(options: {
  repoUrl: string;
  pat: string;
  branch: string;
  filePath: string;
  content: string;
  sha?: string | null;
  message?: string;
}): Promise<{ sha: string | null }> {
  const [owner, repo] = parseGithubRepo(options.repoUrl);
  const filePath = options.filePath.trim().replace(/^\//, '');
  const encodedPath = filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

  const body: Record<string, string> = {
    message: options.message ?? `Update ${filePath}`,
    content: Buffer.from(options.content, 'utf-8').toString('base64'),
    branch: options.branch.trim(),
  };
  if (options.sha) {
    body.sha = options.sha;
  }

  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${options.pat.trim()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'workspace-project-sync',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401) {
      throw new Error('PAT inválido ou sem permissão para gravar no repositório.');
    }
    throw new Error(`Erro ao gravar arquivo no GitHub (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as {
    content?: { sha?: string | null } | null;
  };
  const sha = payload.content?.sha;
  return { sha: typeof sha === 'string' ? sha : null };
}
