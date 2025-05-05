class AppError extends Error {
  constructor(code = "INTERNAL_ERROR", status = 500, message = "Error") {
    super(message);
    this.code = code;
    this.status = status;
  }
}
module.exports = { AppError };
