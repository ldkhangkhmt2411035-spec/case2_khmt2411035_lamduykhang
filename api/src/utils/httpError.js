// Loi co ma trang thai HTTP: nem ra tu controller/service, errorMiddleware se doi thanh phan hoi JSON.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

module.exports = HttpError;
