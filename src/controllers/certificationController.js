import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";
import { Certification } from "../models/Certification.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sanitizeFilename, scanForViruses } from "../utils/fileValidation.js";

const PNG_MIME = "image/png";
const PNG_EXT = ".png";

function isPngMime(mime) {
  return mime === PNG_MIME;
}

function isPngExt(filename) {
  return String(filename || "").toLowerCase().endsWith(PNG_EXT);
}

function isValidPng(buf) {
  return (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  );
}

export const certificationImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!isPngMime(file.mimetype) || !isPngExt(file.originalname)) {
      return cb(new ApiError(422, "Only PNG image files are allowed for certifications"));
    }
    return cb(null, true);
  },
});

async function uploadCertificationImage(file) {
  if (!isValidPng(file.buffer)) {
    throw new ApiError(422, `"${sanitizeFilename(file.originalname)}" is not a valid PNG file`);
  }
  await scanForViruses(file);

  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    throw new ApiError(500, "Cloudinary is not configured");
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "akshar-realestate/certifications",
        resource_type: "image",
        format: "png",
        transformation: [{ quality: "auto" }, { width: 1200, crop: "limit" }],
      },
      (error, result) => {
        if (error) return reject(new ApiError(502, "Certification image upload failed. Please try again."));
        return resolve(result);
      }
    );
    stream.end(file.buffer);
  });
}

async function destroyCertificationImage(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch {
    // non-fatal — Cloudinary cleanup failure shouldn't break the request
  }
}

export const listPublicCertifications = asyncHandler(async (_req, res) => {
  const certifications = await Certification.find({ isActive: true })
    .sort({ displayOrder: 1, createdAt: -1 })
    .select("title description image displayOrder createdAt");
  res.json({ success: true, data: certifications });
});

export const listAdminCertifications = asyncHandler(async (_req, res) => {
  const certifications = await Certification.find()
    .sort({ displayOrder: 1, createdAt: -1 });
  res.json({ success: true, data: certifications });
});

export const uploadCertificationImageHandler = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(422, "Please upload a PNG image");
  const result = await uploadCertificationImage(req.file);
  res.status(201).json({
    success: true,
    data: {
      url: result.secure_url,
      publicId: result.public_id,
    },
  });
});

export const createCertification = asyncHandler(async (req, res) => {
  const { title = "", description = "", image, publicId = "", displayOrder = 0, isActive = true } = req.body;

  if (!image || typeof image !== "string" || !image.trim()) {
    throw new ApiError(422, "Certification image is required");
  }

  const cert = await Certification.create({
    title: String(title).trim(),
    description: String(description).trim(),
    image: image.trim(),
    publicId: String(publicId).trim(),
    displayOrder: Number(displayOrder) || 0,
    isActive: Boolean(isActive),
  });

  res.status(201).json({ success: true, data: cert });
});

export const updateCertification = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const cert = await Certification.findById(id);
  if (!cert) throw new ApiError(404, "Certification not found");

  const { title, description, image, publicId, displayOrder, isActive } = req.body;

  const oldPublicId = cert.publicId;
  const newPublicId = publicId !== undefined ? String(publicId).trim() : cert.publicId;
  const newImage = image !== undefined ? String(image).trim() : cert.image;

  if (title !== undefined) cert.title = String(title).trim();
  if (description !== undefined) cert.description = String(description).trim();
  if (image !== undefined) cert.image = newImage;
  if (publicId !== undefined) cert.publicId = newPublicId;
  if (displayOrder !== undefined) cert.displayOrder = Number(displayOrder) || 0;
  if (isActive !== undefined) cert.isActive = Boolean(isActive);

  await cert.save();

  if (oldPublicId && newPublicId && oldPublicId !== newPublicId) {
    await destroyCertificationImage(oldPublicId);
  }

  res.json({ success: true, data: cert });
});

export const deleteCertification = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const cert = await Certification.findById(id);
  if (!cert) throw new ApiError(404, "Certification not found");

  const { publicId } = cert;
  await cert.deleteOne();

  await destroyCertificationImage(publicId);

  res.json({ success: true, data: { id } });
});
