import jwt from "jsonwebtoken";
import { DEFAULT_SUPERVISOR_PERMISSIONS } from "../config/permissions.js";
import { env } from "../config/env.js";
import { Staff } from "../models/Staff.js";
import { User } from "../models/User.js";
import { Property } from "../models/Property.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { publicPropertyView, sanitizeWishlistProperty } from "../utils/publicProperty.js";

function signToken(staff) {
  return jwt.sign({ sub: staff._id.toString(), role: staff.role, kind: "staff", version: staff.tokenVersion || 0 }, env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: env.jwtExpiresIn,
  });
}

function signUserToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role, kind: "user", version: user.tokenVersion || 0 }, env.jwtSecret, {
    algorithm: "HS256",
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
    companyName: staff.companyName,
    avatar: staff.avatar,
    coverImage: staff.coverImage,
    permissions: staff.role === "admin" ? [] : staff.permissions?.length ? staff.permissions : DEFAULT_SUPERVISOR_PERMISSIONS,
    propertiesManaged: staff.propertiesManaged,
  };
}

function userPayload(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    avatar: user.avatar,
    authProvider: user.authProvider || "local",
    savedProperties: (user.savedProperties || []).map(sanitizeWishlistProperty),
  };
}

function savedKey(property) {
  return `${property.source || "property"}-${property._id || property.id}`;
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

export const updateProfile = asyncHandler(async (req, res) => {
  const body = { ...req.validated.body };
  const staff = await Staff.findById(req.user._id);
  if (!staff) throw new ApiError(404, "Staff account not found");

  if (body.email && body.email.toLowerCase() !== staff.email) {
    const exists = await Staff.exists({ email: body.email.toLowerCase(), _id: { $ne: staff._id } });
    if (exists) throw new ApiError(409, "This email is already used by another staff account");
    body.email = body.email.toLowerCase();
  }

  Object.assign(staff, body);
  await staff.save();

  res.json({ success: true, user: staffPayload(staff) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.validated.body;
  const staff = await Staff.findById(req.user._id).select("+passwordHash");
  if (!staff || !(await staff.comparePassword(currentPassword))) {
    throw new ApiError(401, "Current password is incorrect");
  }

  staff.passwordHash = await Staff.hashPassword(newPassword);
  staff.tokenVersion = (staff.tokenVersion || 0) + 1;
  await staff.save();

  res.json({ success: true, message: "Password updated. Please sign in again." });
});

export const staffLogout = asyncHandler(async (req, res) => {
  await Staff.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  res.json({ success: true, message: "Logged out" });
});

export const userRegister = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.validated.body;
  const normalizedEmail = email.toLowerCase();
  const exists = await User.exists({ email: normalizedEmail });
  if (exists) throw new ApiError(409, "An account with this email already exists");

  const user = await User.create({
    name,
    email: normalizedEmail,
    phone,
    role: "owner",
    passwordHash: await User.hashPassword(password),
    lastLoginAt: new Date(),
  });

  res.status(201).json({ success: true, token: signUserToken(user), user: userPayload(user) });
});

export const userLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password");
  }
  if (user.status !== "active") throw new ApiError(403, "This account is disabled");

  user.lastLoginAt = new Date();
  await user.save();

  res.json({ success: true, token: signUserToken(user), user: userPayload(user) });
});

async function verifyGoogleCredential(credential) {
  if (!env.googleClientId) {
    throw new ApiError(503, "Google login is not configured");
  }

  let response;
  try {
    response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  } catch {
    throw new ApiError(502, "Unable to verify Google login right now");
  }

  const profile = await response.json().catch(() => null);
  if (!response.ok || !profile) {
    throw new ApiError(401, profile?.error_description || "Invalid Google credential");
  }

  if (profile.aud !== env.googleClientId) {
    throw new ApiError(401, "Google credential was not issued for this application");
  }

  if (profile.email_verified !== "true" && profile.email_verified !== true) {
    throw new ApiError(401, "Google email is not verified");
  }

  if (!profile.email) {
    throw new ApiError(401, "Google account email is required");
  }

  return {
    googleId: profile.sub,
    email: profile.email.toLowerCase(),
    name: profile.name || profile.email.split("@")[0],
    avatar: profile.picture || "",
  };
}

export const userGoogleAuth = asyncHandler(async (req, res) => {
  const profile = await verifyGoogleCredential(req.validated.body.credential);
  let user = await User.findOne({ email: profile.email });

  if (user) {
    if (user.status !== "active") throw new ApiError(403, "This account is disabled");
    user.googleId = user.googleId || profile.googleId;
    user.avatar = user.avatar || profile.avatar;
    user.lastLoginAt = new Date();
    await user.save();
  } else {
    user = await User.create({
      name: profile.name,
      email: profile.email,
      avatar: profile.avatar,
      googleId: profile.googleId,
      authProvider: "google",
      role: "owner",
      lastLoginAt: new Date(),
    });
  }

  res.json({ success: true, token: signUserToken(user), user: userPayload(user) });
});

export const userMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: userPayload(req.ownerUser) });
});

export const userLogout = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.ownerUser._id }, { $inc: { tokenVersion: 1 } });
  res.json({ success: true, message: "Logged out" });
});

export const listUserWishlist = asyncHandler(async (req, res) => {
  res.json({ success: true, data: (req.ownerUser.savedProperties || []).map(sanitizeWishlistProperty) });
});

export const saveUserWishlistProperty = asyncHandler(async (req, res) => {
  const user = await User.findById(req.ownerUser._id);
  if (!user) throw new ApiError(404, "User account not found");

  const requestedProperty = {
    ...req.validated.body,
    source: req.validated.body.source || "property",
  };
  const dbProperty = /^[a-f\d]{24}$/i.test(requestedProperty._id || "")
    ? await Property.findById(requestedProperty._id)
      .populate("assignedTo", "name phone designation companyName avatar role")
      .populate("createdBy", "name phone designation companyName avatar role")
    : null;
  const property = dbProperty
    ? { ...publicPropertyView(dbProperty), source: requestedProperty.source }
    : sanitizeWishlistProperty(requestedProperty);
  const key = savedKey(property);
  const current = (user.savedProperties || []).map(sanitizeWishlistProperty);
  const exists = current.some((item) => savedKey(item) === key);

  if (!exists) {
    user.savedProperties = [property, ...current].slice(0, 100);
    await user.save();
  }

  res.json({ success: true, data: (user.savedProperties || []).map(sanitizeWishlistProperty), saved: true });
});

export const removeUserWishlistProperty = asyncHandler(async (req, res) => {
  const user = await User.findById(req.ownerUser._id);
  if (!user) throw new ApiError(404, "User account not found");

  const key = decodeURIComponent(req.params.key || "");
  user.savedProperties = (user.savedProperties || []).filter((item) => savedKey(item) !== key);
  await user.save();

  res.json({ success: true, data: (user.savedProperties || []).map(sanitizeWishlistProperty), saved: false });
});
