import jwt from "jsonwebtoken";
import { DEFAULT_SUPERVISOR_PERMISSIONS } from "../config/permissions.js";
import { env } from "../config/env.js";
import { Staff } from "../models/Staff.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, "Authentication required");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
  } catch {
    throw new ApiError(401, "Invalid or expired session");
  }

  if (decoded.kind !== "staff") {
    throw new ApiError(401, "Invalid staff session");
  }

  const staff = await Staff.findById(decoded.sub).select("-passwordHash");
  if (!staff || staff.status !== "active") {
    throw new ApiError(401, "Staff account is inactive or no longer exists");
  }

  if ((decoded.version ?? 0) !== (staff.tokenVersion ?? 0)) {
    throw new ApiError(401, "Session has been signed out");
  }

  req.user = staff;
  next();
});

export const authenticateUser = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, "Authentication required");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
  } catch {
    throw new ApiError(401, "Invalid or expired session");
  }

  if (decoded.kind !== "user") {
    throw new ApiError(401, "Invalid user session");
  }

  const user = await User.findById(decoded.sub).select("-passwordHash");
  if (!user || user.status !== "active") {
    throw new ApiError(401, "User account is inactive or no longer exists");
  }

  if ((decoded.version ?? 0) !== (user.tokenVersion ?? 0)) {
    throw new ApiError(401, "Session has been signed out");
  }

  req.ownerUser = user;
  next();
});

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ApiError(403, "You do not have permission to access this resource"));
  }

  next();
};

export const requirePermission = (...permissions) => (req, _res, next) => {
  if (!req.user) {
    return next(new ApiError(401, "Authentication required"));
  }

  if (req.user.role === "admin") {
    return next();
  }

  const granted = new Set(req.user.permissions?.length ? req.user.permissions : DEFAULT_SUPERVISOR_PERMISSIONS);
  const allowed = permissions.some((permission) => granted.has(permission));
  if (!allowed) {
    return next(new ApiError(403, "Your supervisor account does not have access to this action"));
  }

  return next();
};
