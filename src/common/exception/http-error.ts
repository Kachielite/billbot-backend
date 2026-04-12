export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly error: string;

  constructor(statusCode: number, error: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.error = error;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ErrorResponseDTO {
  statusCode: number;
  error: string;
  message: string;
}
