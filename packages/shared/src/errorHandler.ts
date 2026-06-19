import type { ErrorRequestHandler } from 'express';
import { AppError, baseApiResponse } from './errors.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(baseApiResponse(err.status, err.message));
    return;
  }

  if (err?.name === 'ZodError') {
    const message =
      err.issues?.[0]?.message ?? 'Invalid request';
    res.status(400).json(baseApiResponse('BAD_REQUEST', message));
    return;
  }

  console.error(err);
  res.status(500).json(baseApiResponse('INTERNAL_ERROR', 'Unexpected server error'));
};
