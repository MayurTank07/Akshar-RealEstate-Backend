import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { ApiError } from "./ApiError.js";
import { sanitizeFilename } from "./fileValidation.js";

export const LOCAL_VIDEO_PUBLIC_PREFIX = "/uploads/videos/";
export const LOCAL_VIDEO_UPLOAD_ROOT = path.resolve(process.env.UPLOAD_ROOT || path.resolve(process.cwd(), "uploads"));
export const LOCAL_VIDEO_UPLOAD_DIR = path.join(LOCAL_VIDEO_UPLOAD_ROOT, "videos");
export const CMS_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const CMS_VIDEO_MAX_MB = CMS_VIDEO_MAX_BYTES / (1024 * 1024);

const CMS_VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".m4v"]);
const CMS_VIDEO_MIMES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export function isAllowedCmsVideoFile(mime, filename) {
  return CMS_VIDEO_MIMES.has(String(mime || "").toLowerCase()) && CMS_VIDEO_EXTENSIONS.has(path.extname(String(filename || "")).toLowerCase());
}

export async function ensureLocalVideoUploadDir() {
  await fs.mkdir(LOCAL_VIDEO_UPLOAD_DIR, { recursive: true });
}

function safeVideoFilename(originalName) {
  const sanitized = sanitizeFilename(originalName);
  const ext = path.extname(sanitized).toLowerCase();
  const base = path
    .basename(sanitized, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "video";
  return `${Date.now().toString(36)}-${crypto.randomUUID()}-${base}${ext}`;
}

export async function saveLocalVideoFile(file) {
  await ensureLocalVideoUploadDir();
  const filename = safeVideoFilename(file.originalname);
  const absolutePath = path.join(LOCAL_VIDEO_UPLOAD_DIR, filename);
  await fs.writeFile(absolutePath, file.buffer, { flag: "wx" });
  return {
    filename,
    filePath: `${LOCAL_VIDEO_PUBLIC_PREFIX}${filename}`,
    size: file.size,
    mimeType: file.mimetype,
    originalName: sanitizeFilename(file.originalname),
    storage: "local",
    videoType: "upload",
  };
}

export function localVideoPublicPath(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let pathname = raw;
  try {
    pathname = new URL(raw).pathname;
  } catch {
    pathname = raw;
  }
  if (!pathname.startsWith(LOCAL_VIDEO_PUBLIC_PREFIX)) return "";
  const filename = path.basename(pathname);
  if (!filename || pathname !== `${LOCAL_VIDEO_PUBLIC_PREFIX}${filename}`) return "";
  return `${LOCAL_VIDEO_PUBLIC_PREFIX}${filename}`;
}

export function localVideoAbsolutePath(value = "") {
  const publicPath = localVideoPublicPath(value);
  if (!publicPath) return "";
  const filename = path.basename(publicPath);
  const absolutePath = path.resolve(LOCAL_VIDEO_UPLOAD_DIR, filename);
  const uploadRoot = `${LOCAL_VIDEO_UPLOAD_DIR}${path.sep}`;
  if (!absolutePath.startsWith(uploadRoot)) {
    throw new ApiError(400, "Invalid uploaded video path");
  }
  return absolutePath;
}

export async function deleteLocalVideoFile(value = "") {
  const absolutePath = localVideoAbsolutePath(value);
  if (!absolutePath) return false;
  try {
    await fs.unlink(absolutePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export function absoluteUploadUrl(req, publicPath) {
  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol;
  return `${protocol}://${req.get("host")}${publicPath}`;
}
