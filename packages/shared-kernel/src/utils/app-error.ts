export class AppError extends Error {
  public statusCode: number

  constructor(statusCode: number = 500, message: string, stack = '') {
    super(message)
    this.statusCode = statusCode
    this.name = this.constructor.name

    if (stack) {
      this.stack = stack
    } else {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}
