import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  let problem = error;
  if (error instanceof ZodError) {
    problem = new HttpError(400, 'INVALID_INPUT', error.issues[0].message);
  } else if (error.type === 'entity.parse.failed') {
    problem = new HttpError(400, 'INVALID_JSON', 'Тіло запиту має бути коректним JSON.');
  } else if (error.type === 'entity.too.large') {
    problem = new HttpError(413, 'BODY_TOO_LARGE', 'Тіло запиту завелике.');
  } else if (error instanceof URIError || error.status === 400 || error.status === 415) {
    problem = new HttpError(error.status === 415 ? 415 : 400, 'INVALID_REQUEST', 'Некоректний формат запиту.');
  } else {
    console.error(req.method, error.name, error.code ?? '');
    const unavailable = ['MongoNetworkError', 'MongoServerSelectionError', 'MongoNotConnectedError',
      'MongoTopologyClosedError', 'MongoOperationTimeoutError'].includes(error.name);
    problem = unavailable
      ? new HttpError(503, 'DB_UNAVAILABLE', 'База даних тимчасово недоступна. Спробуй ще раз.')
      : new HttpError(500, 'INTERNAL_ERROR', 'Сервер не зміг виконати запит. Спробуй ще раз.');
  }
  res.status(problem.status).json({ error: { code: problem.code, message: problem.message } });
}
