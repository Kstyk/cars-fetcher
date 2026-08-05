export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly code: string = 'app_error',
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Nieprawidłowe żądanie', details?: unknown) {
    super(400, message, 'bad_request', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Wymagane uwierzytelnienie') {
    super(401, message, 'unauthorized');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Brak uprawnień') {
    super(403, message, 'forbidden');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Nie znaleziono zasobu') {
    super(404, message, 'not_found');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Zasób już istnieje', details?: unknown) {
    super(409, message, 'conflict', details);
  }
}

export class UpstreamError extends AppError {
  constructor(message = 'Błąd zewnętrznego dostawcy', details?: unknown) {
    super(502, message, 'upstream_error', details);
  }
}
