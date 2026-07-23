import { ZodError } from "zod";
import { env } from "../config/env.js";

export function notFound(req, _res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function zodFieldErrors(error) {
  return error.issues.reduce((acc, issue) => {
    const path = issue.path.filter((part) => part !== "body" && part !== "params" && part !== "query").join(".") || "request";
    if (!acc[path]) acc[path] = issue.message;
    return acc;
  }, {});
}

export function errorHandler(error, req, res, _next) {
  if (error.name === "CastError") {
    error.statusCode = 400;
    error.message = "Invalid ID format";
  }
  if (error.code === 11000) {
    error.statusCode = 409;
    const field = Object.keys(error.keyValue || {})[0] || "field";
    error.message = `A record with this ${field} already exists`;
  }

  const statusCode = error.statusCode || (error.name === "ZodError" || error.name === "ValidationError" ? 422 : error.code === "LIMIT_FILE_SIZE" || error.type === "entity.too.large" ? 413 : 500);

  const payload = {
    success: false,
    message: error instanceof ZodError && req.originalUrl?.includes("/api/admin/properties") ? "Property validation failed" : error instanceof ZodError ? "Validation failed" : error.code === "LIMIT_FILE_SIZE" ? "Image is too large. Maximum allowed size is 15MB per image." : error.type === "entity.too.large" ? "Request is too large. Please upload images through the image uploader." : error.message || "Internal server error",
  };

  if (error instanceof ZodError) {
    payload.errors = zodFieldErrors(error);
    payload.details = error.flatten();
  } else if (error.details) {
    payload.details = error.details;
    if (typeof error.details === "object" && !Array.isArray(error.details)) {
      payload.errors = error.details;
    }
  }

  if (env.nodeEnv !== "production") {
    payload.stack = error.stack;
  }

  res.status(statusCode).json(payload);
}
