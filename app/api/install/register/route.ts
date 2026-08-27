import { requireInstallAuth } from '@/app/lib/server/api-install-auth';
import { errorResponse } from '@/app/lib/server/api-error';
import {
  findProjectIdByLocalPath,
  registerLocalRepoProject,
} from '@/app/lib/server/projects';

type RegisterBody = {
  local_path?: string;
  name?: string | null;
  local_repo_branch?: string | null;
};

export async function POST(request: Request) {
  try {
    requireInstallAuth(request);
    const body = (await request.json()) as RegisterBody;
    const localPath = typeof body.local_path === 'string' ? body.local_path.trim() : '';
    if (!localPath) {
      return Response.json({ detail: 'local_path is required.' }, { status: 400 });
    }

    const existed = findProjectIdByLocalPath(localPath) !== null;
    const connection = await registerLocalRepoProject({
      local_path: localPath,
      name: body.name,
      local_repo_branch: body.local_repo_branch,
    });

    return Response.json(connection, { status: existed ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
