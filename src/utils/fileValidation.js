import path from "path";
import { ApiError } from "./ApiError.js";

function matchBytes(buf, offset, expected) {
  if (buf.length < offset + expected.length) return false;
  return expected.every((byte, i) => buf[offset + i] === byte);
}

const FTYP_BOX = [0x66, 0x74, 0x79, 0x70]; // "ftyp" — used by MP4, MOV, HEIC, AVIF

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "mif1", "msf1", "avif", "avis", "heim", "heis", "hevm", "hevs"]);

function ftypBrand(buf) {
  if (buf.length < 12) return "";
  return buf.slice(8, 12).toString("ascii").toLowerCase().trim();
}

function isFtypHeic(buf) {
  return matchBytes(buf, 4, FTYP_BOX) && HEIC_BRANDS.has(ftypBrand(buf));
}

function isFtypVideo(buf) {
  return matchBytes(buf, 4, FTYP_BOX) && !HEIC_BRANDS.has(ftypBrand(buf));
}

function isValidImage(buf) {
  return (
    matchBytes(buf, 0, [0xFF, 0xD8, 0xFF]) || // JPEG
    matchBytes(buf, 0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) || // PNG
    matchBytes(buf, 0, [0x47, 0x49, 0x46, 0x38]) || // GIF
    (matchBytes(buf, 0, [0x52, 0x49, 0x46, 0x46]) && matchBytes(buf, 8, [0x57, 0x45, 0x42, 0x50])) || // WebP
    matchBytes(buf, 0, [0x42, 0x4D]) || // BMP
    matchBytes(buf, 0, [0x49, 0x49, 0x2A, 0x00]) || // TIFF little-endian
    matchBytes(buf, 0, [0x4D, 0x4D, 0x00, 0x2A]) || // TIFF big-endian
    isFtypHeic(buf) // HEIC / HEIF / AVIF
  );
}

function isValidVideo(buf) {
  return (
    matchBytes(buf, 0, [0x1A, 0x45, 0xDF, 0xA3]) || // WebM / MKV
    (matchBytes(buf, 0, [0x52, 0x49, 0x46, 0x46]) && matchBytes(buf, 8, [0x41, 0x56, 0x49, 0x20])) || // AVI
    isFtypVideo(buf) // MP4 / MOV / M4V / 3GPP
  );
}

function isValidPdf(buf) {
  return matchBytes(buf, 0, [0x25, 0x50, 0x44, 0x46]); // %PDF
}

export const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
  "image/heic",
  "image/heif",
  "image/avif",
]);

export const ALLOWED_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/webm",
  "video/3gpp",
  "video/3gpp2",
]);

const ALLOWED_IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif", ".heic", ".heif", ".avif"]);
const ALLOWED_VIDEO_EXT = new Set([".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".3gp"]);
const ALLOWED_DOC_EXT = new Set([".pdf"]);

function fileExt(filename) {
  return path.extname(String(filename || "")).toLowerCase();
}

export function isAllowedImageFile(mime, filename) {
  return ALLOWED_IMAGE_MIMES.has(mime) && ALLOWED_IMAGE_EXT.has(fileExt(filename));
}

export function isAllowedMediaFile(mime, filename) {
  const ext = fileExt(filename);
  if (ALLOWED_IMAGE_MIMES.has(mime)) return ALLOWED_IMAGE_EXT.has(ext);
  if (ALLOWED_VIDEO_MIMES.has(mime)) return ALLOWED_VIDEO_EXT.has(ext);
  if (mime === "application/pdf") return ALLOWED_DOC_EXT.has(ext);
  return false;
}

export function isAllowedProofFile(mime, filename) {
  const ext = fileExt(filename);
  if (ALLOWED_IMAGE_MIMES.has(mime)) return ALLOWED_IMAGE_EXT.has(ext);
  if (mime === "application/pdf") return ALLOWED_DOC_EXT.has(ext);
  return false;
}

export function sanitizeFilename(name) {
  return String(name || "upload")
    .replace(/\.\./g, "")
    .replace(/[/\\]/g, "")
    .replace(/[^\w.\- ]/g, "_")
    .slice(0, 200);
}

export function validateImageFile(file) {
  if (!isValidImage(file.buffer)) {
    throw new ApiError(422, `"${sanitizeFilename(file.originalname)}" is not a valid image file`);
  }
}

export function validateMediaFile(file) {
  const mime = file.mimetype || "";
  if (ALLOWED_IMAGE_MIMES.has(mime)) {
    if (!isValidImage(file.buffer)) {
      throw new ApiError(422, `"${sanitizeFilename(file.originalname)}" is not a valid image file`);
    }
  } else if (ALLOWED_VIDEO_MIMES.has(mime)) {
    if (!isValidVideo(file.buffer)) {
      throw new ApiError(422, `"${sanitizeFilename(file.originalname)}" is not a valid video file`);
    }
  } else if (mime === "application/pdf") {
    if (!isValidPdf(file.buffer)) {
      throw new ApiError(422, `"${sanitizeFilename(file.originalname)}" is not a valid PDF file`);
    }
  }
}

export function validateProofFile(file) {
  const mime = file.mimetype || "";
  if (ALLOWED_IMAGE_MIMES.has(mime)) {
    if (!isValidImage(file.buffer)) {
      throw new ApiError(422, `"${sanitizeFilename(file.originalname)}" is not a valid image file`);
    }
  } else if (mime === "application/pdf") {
    if (!isValidPdf(file.buffer)) {
      throw new ApiError(422, `"${sanitizeFilename(file.originalname)}" is not a valid PDF file`);
    }
  }
}

// TODO: Integrate a virus scanning service before deploying to production.
// Options: ClamAV (npm: clamscan), VirusTotal API, Cloudmersive, or OPSWAT MetaDefender.
// This function is intentionally async so the integration only requires filling in the
// scan call here — all upload handlers already await it.
export async function scanForViruses(_file) {
  // no-op placeholder
}
