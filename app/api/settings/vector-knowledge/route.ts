import { errorResponse } from '@/app/lib/server/api-error';
import {
  getProjectKnowledgeStatus,
  syncProjectsKnowledge,
} from '@/app/lib/server/project-knowledge';

export async function GET() {
  try {
    return Response.json(await getProjectKnowledgeStatus());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST() {
  try {
    void syncProjectsKnowledge().catch((error) => {
      console.error('Falha ao reindexar conhecimento dos projetos:', error);
    });

    return Response.json({
      started: true,
      message: 'Reindexação iniciada em background.',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
