import { errorResponse } from '@/app/lib/server/api-error';
import { getSettings, updateSettings } from '@/app/lib/server/settings';

export async function GET() {
  try {
    return Response.json(getSettings());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    return Response.json(
      updateSettings({
        projects_folder: body.projects_folder,
        agents_folder: body.agents_folder,
        ai_provider: body.ai_provider,
        ai_model: body.ai_model,
        ai_api_token: body.ai_api_token,
        ai_project_summary_prompt: body.ai_project_summary_prompt,
        ui_theme: body.ui_theme,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
