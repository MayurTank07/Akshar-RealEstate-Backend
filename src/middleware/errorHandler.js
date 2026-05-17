import { ZodError } from "zod";
import { env } from "../config/env.js";

export function notFound(req, _res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || (error.name === "ZodError" || error.name === "ValidationError" ? 422 : error.code === "LIMIT_FILE_SIZE" || error.type === "entity.too.large" ? 413 : 500);

  const payload = {
    success: false,
    message: error instanceof ZodError ? "Validation failed" : error.code === "LIMIT_FILE_SIZE" ? "Image is too large. Maximum allowed size is 15MB per image." : error.type === "entity.too.large" ? "Request is too large. Please upload images through the image uploader." : error.message || "Internal server error",
  };

  if (error instanceof ZodError) {
    payload.details = error.flatten();
  } else if (error.details) {
    payload.details = error.details;
  }

  if (env.nodeEnv !== "production") {
    payload.stack = error.stack;
  }

  res.status(statusCode).json(payload);
}
