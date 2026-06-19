export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly status: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(400, 'BAD_REQUEST', message);
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function baseApiResponse(status: string, message: string) {
  return { status, message, timestamp: nowIso() };
}
