import jwt from "jsonwebtoken";
import { DEFAULT_SUPERVISOR_PERMISSIONS } from "../config/permissions.js";
import { env } from "../config/env.js";
import { Staff } from "../models/Staff.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function signToken(staff) {
  return jwt.sign({ sub: staff._id.toString(), role: staff.role, version: staff.tokenVersion || 0 }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

function staffPayload(staff) {
  return {
    id: staff._id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    status: staff.status,
    phone: staff.phone,
    designation: staff.designation,
    avatar: staff.avatar,
    permissions: staff.role === "admin" ? [] : staff.permissions?.length ? staff.permissions : DEFAULT_SUPERVISOR_PERMISSIONS,
    propertiesManaged: staff.propertiesManaged,
  };
}

export const staffLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body;
  const staff = await Staff.findOne({ email: email.toLowerCase() }).select("+passwordHash");

  if (!staff || !(await staff.comparePassword(password))) {
    throw new ApiError(401, "Invalid staff credentials");
  }

  if (staff.status !== "active") {
    throw new ApiError(403, "This staff account is disabled");
  }

  staff.lastLoginAt = new Date();
  await staff.save();

  res.json({
    success: true,
    token: signToken(staff),
    user: staffPayload(staff),
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: staffPayload(req.user) });
});

export const staffLogout = asyncHandler(async (req, res) => {
  await Staff.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  res.json({ success: true, message: "Logged out" });
});
