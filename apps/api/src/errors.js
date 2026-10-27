// HTTP-aware error. The app error handler renders these as { error } with status.
export class ApiError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
    }
}
