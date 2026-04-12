import { HttpError } from './http-error';

export class BadRequestException extends HttpError {
  constructor(message = 'Bad Request') {
    super(400, 'Bad Request', message);
  }
}

export class UnAuthorizedException extends HttpError {
  constructor(message = 'Unauthorized') {
    super(401, 'Unauthorized', message);
  }
}

export class ForbiddenException extends HttpError {
  constructor(message = 'Forbidden') {
    super(403, 'Forbidden', message);
  }
}

export class ResourceNotFoundException extends HttpError {
  constructor(message = 'Resource Not Found') {
    super(404, 'Resource Not Found', message);
  }
}

export class MethodNotAllowedException extends HttpError {
  constructor(message = 'Method Not Allowed') {
    super(405, 'Method Not Allowed', message);
  }
}

export class ConflictException extends HttpError {
  constructor(message = 'Conflict') {
    super(409, 'Conflict', message);
  }
}

export class InternalServerException extends HttpError {
  constructor(message = 'Internal Server Error') {
    super(500, 'Internal Server Error', message);
  }
}

export { HttpError };
