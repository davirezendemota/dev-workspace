export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ detail: error.message }, { status: error.status });
  }

  console.error(error);
  return Response.json({ detail: 'Internal server error' }, { status: 500 });
}
