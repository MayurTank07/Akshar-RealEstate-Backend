import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";
import { Staff } from "../models/Staff.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isAllowedImageFile, isAllowedMediaFile, isAllowedProofFile, sanitizeFilename, scanForViruses, validateImageFile, validateMediaFile, validateProofFile } from "../utils/fileValidation.js";
import { OwnerApplication } from "../models/OwnerApplication.js";
import { checkUploadQuota } from "../utils/uploadQuota.js";

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
});

export const propertyImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 12,
  },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedImageFile(file.mimetype, file.originalname)) {
      return cb(new ApiError(422, "Only JPEG, PNG, GIF, WebP, BMP, TIFF, HEIC, and AVIF image files are allowed"));
    }
    return cb(null, true);
  },
});

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedImageFile(file.mimetype, file.originalname)) {
      return cb(new ApiError(422, "Only JPEG, PNG, GIF, WebP, BMP, TIFF, HEIC, and AVIF image files are allowed"));
    }
    return cb(null, true);
  },
});

export const ownerMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024,
    files: 16,
  },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedMediaFile(file.mimetype, file.originalname)) {
      return cb(new ApiError(422, "Only image (JPEG/PNG/WebP/HEIC), video (MP4/MOV/WebM), and PDF files are allowed"));
    }
    return cb(null, true);
  },
});

export const ownerProofUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedProofFile(file.mimetype, file.originalname)) {
      return cb(new ApiError(422, "Owner proofs must be JPEG, PNG, or PDF files"));
    }
    return cb(null, true);
  },
});

function uploadBuffer(
  file,
  folder = "akshar-realestate/properties",
  transformation = [
    { quality: "auto", fetch_format: "auto" },
    { width: 1600, crop: "limit" },
  ]
) {
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    throw new ApiError(500, "Cloudinary is not configured");
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation,
      },
      (error, result) => {
        if (error) return reject(new ApiError(502, "Image upload failed. Please try again."));
        return resolve(result);
      }
    );
    stream.end(file.buffer);
  });
}

function uploadOwnerBuffer(file) {
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    throw new ApiError(500, "Cloudinary is not configured");
  }

  const resourceType = file.mimetype?.startsWith("video/") ? "video" : file.mimetype === "application/pdf" ? "raw" : "image";
  const folder = resourceType === "video" ? "akshar-realestate/owner-submissions/videos" : resourceType === "raw" ? "akshar-realestate/owner-submissions/documents" : "akshar-realestate/owner-submissions/photos";

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        transformation: resourceType === "image" ? [{ quality: "auto", fetch_format: "auto" }, { width: 1800, crop: "limit" }] : undefined,
      },
      (error, result) => {
        if (error) return reject(new ApiError(502, "Media upload failed. Please try again."));
        return resolve({ ...result, resourceType });
      }
    );
    stream.end(file.buffer);
  });
}

function uploadOwnerProofBuffer(file) {
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    throw new ApiError(500, "Cloudinary is not configured");
  }

  const resourceType = file.mimetype === "application/pdf" ? "raw" : "image";
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "akshar-realestate/private/owner-proofs",
        resource_type: resourceType,
        type: "authenticated",
        access_mode: "authenticated",
        transformation: resourceType === "image" ? [{ quality: "auto", fetch_format: "auto" }, { width: 1800, crop: "limit" }] : undefined,
      },
      (error, result) => {
        if (error) return reject(new ApiError(502, "Owner proof upload failed. Please try again."));
        return resolve(result);
      }
    );
    stream.end(file.buffer);
  });
}

export const uploadPropertyImages = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    throw new ApiError(422, "Please upload at least one image");
  }

  for (const file of files) {
    validateImageFile(file);
    await scanForViruses(file);
  }

  checkUploadQuota(req.ip || "", files.reduce((s, f) => s + f.size, 0), 500 * 1024 * 1024);

  const settled = await Promise.allSettled(files.map((file) => uploadBuffer(file)));
  const succeeded = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
  const failed = settled.filter((r) => r.status === "rejected");
  if (failed.length) {
    await Promise.allSettled(succeeded.map((r) => cloudinary.uploader.destroy(r.public_id)));
    throw new ApiError(502, `${failed.length} image(s) failed to upload. Please try again.`);
  }

  const urls = succeeded.map((r) => r.secure_url);
  res.status(201).json({
    success: true,
    data: {
      urls,
      files: files.map((file, index) => ({
        originalName: sanitizeFilename(file.originalname),
        size: file.size,
        url: urls[index],
        publicId: succeeded[index].public_id,
      })),
    },
  });
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(422, "Please upload a profile image");
  }

  validateImageFile(req.file);
  await scanForViruses(req.file);

  const result = await uploadBuffer(req.file, "akshar-realestate/avatars", [
    { width: 512, height: 512, crop: "fill", gravity: "face" },
    { quality: "auto", fetch_format: "auto" },
  ]);

  req.user.avatar = result.secure_url;
  await req.user.save();

  res.status(201).json({
    success: true,
    data: {
      url: result.secure_url,
      publicId: result.public_id,
    },
  });
});

async function saveStaffCover(staff, file) {
  validateImageFile(file);
  await scanForViruses(file);
  const result = await uploadBuffer(file, "akshar-realestate/staff-covers", [
    { width: 1800, height: 600, crop: "fill", gravity: "auto" },
    { quality: "auto", fetch_format: "auto" },
  ]);
  staff.coverImage = result.secure_url;
  await staff.save();
  return result;
}

export const uploadMyCover = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(422, "Please upload a cover image");
  const result = await saveStaffCover(req.user, req.file);
  res.status(201).json({ success: true, data: { url: result.secure_url, publicId: result.public_id } });
});

export const removeMyCover = asyncHandler(async (req, res) => {
  req.user.coverImage = "";
  await req.user.save();
  res.json({ success: true, data: { url: "" } });
});

export const uploadStaffCover = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(422, "Please upload a cover image");
  const staff = await Staff.findById(req.validated.params.id);
  if (!staff) throw new ApiError(404, "Staff member not found");
  const result = await saveStaffCover(staff, req.file);
  res.status(201).json({ success: true, data: { url: result.secure_url, publicId: result.public_id } });
});

export const removeStaffCover = asyncHandler(async (req, res) => {
  const staff = await Staff.findById(req.validated.params.id);
  if (!staff) throw new ApiError(404, "Staff member not found");
  staff.coverImage = "";
  await staff.save();
  res.json({ success: true, data: { url: "" } });
});

export const uploadOwnerMedia = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    throw new ApiError(422, "Please upload at least one file");
  }

  for (const file of files) {
    validateMediaFile(file);
    await scanForViruses(file);
  }

  checkUploadQuota(req.ip || "", files.reduce((s, f) => s + f.size, 0), 200 * 1024 * 1024);

  const settled = await Promise.allSettled(files.map((file) => uploadOwnerBuffer(file)));
  const succeeded = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
  const failed = settled.filter((r) => r.status === "rejected");
  if (failed.length) {
    await Promise.allSettled(succeeded.map((r) => cloudinary.uploader.destroy(r.public_id, { resource_type: r.resourceType || "image" })));
    throw new ApiError(502, `${failed.length} file(s) failed to upload. Please try again.`);
  }

  const payload = { photos: [], videos: [], documents: [], files: [] };
  succeeded.forEach((result, index) => {
    const item = {
      originalName: sanitizeFilename(files[index].originalname),
      size: files[index].size,
      url: result.secure_url,
      publicId: result.public_id,
      type: result.resourceType,
    };
    payload.files.push(item);
    if (result.resourceType === "video") payload.videos.push(result.secure_url);
    else if (result.resourceType === "raw") payload.documents.push(result.secure_url);
    else payload.photos.push(result.secure_url);
  });

  res.status(201).json({ success: true, data: payload });
});

export const uploadOwnerProofs = asyncHandler(async (req, res) => {
  const files = req.files || [];
  const documentType = String(req.body?.documentType || "");
  const customDocumentName = String(req.body?.customDocumentName || "").trim();
  const allowedTypes = ["Ownership Proof", "Electricity Bill", "Tax Bill", "Index Copy", "Other"];
  if (!allowedTypes.includes(documentType)) {
    throw new ApiError(422, "Please select a valid owner proof document type");
  }
  if (documentType === "Other" && !customDocumentName) {
    throw new ApiError(422, "Custom document name is required when owner proof type is Others");
  }
  if (customDocumentName.length > 80) {
    throw new ApiError(422, "Custom document name must be 80 characters or less");
  }
  if (!files.length) {
    throw new ApiError(422, "Please upload at least one owner proof");
  }

  for (const file of files) {
    validateProofFile(file);
    await scanForViruses(file);
  }

  checkUploadQuota(req.ip || "", files.reduce((s, f) => s + f.size, 0), 100 * 1024 * 1024);

  const settled = await Promise.allSettled(files.map((file) => uploadOwnerProofBuffer(file)));
  const succeeded = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
  const failed = settled.filter((r) => r.status === "rejected");
  if (failed.length) {
    await Promise.allSettled(succeeded.map((r) => cloudinary.uploader.destroy(r.public_id, { resource_type: r.resource_type || "image", type: "authenticated" })));
    throw new ApiError(502, `${failed.length} proof file(s) failed to upload. Please try again.`);
  }

  res.status(201).json({
    success: true,
    data: files.map((file, index) => {
      const result = succeeded[index];
      return {
        documentType,
        customDocumentName: documentType === "Other" ? customDocumentName : "",
        originalName: sanitizeFilename(file.originalname),
        mimeType: file.mimetype,
        resourceType: result.resource_type,
        format: result.format || "",
        size: file.size,
        url: cloudinary.url(result.public_id, {
          secure: true,
          sign_url: true,
          type: "authenticated",
          resource_type: result.resource_type,
          format: result.format || undefined,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
        publicId: result.public_id,
        status: "uploaded",
        uploadedAt: new Date().toISOString(),
      };
    }),
  });
});

function buildUploadToken(folder) {
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    throw new ApiError(500, "Cloudinary is not configured");
  }
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { folder, timestamp };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.cloudinary.apiSecret);
  return { cloudName: env.cloudinary.cloudName, apiKey: env.cloudinary.apiKey, timestamp, signature, folder, expiresAt: timestamp + 3600 };
}

export const getOwnerUploadToken = asyncHandler(async (_req, res) => {
  const token = buildUploadToken("akshar-realestate/owner-submissions");
  res.json({ success: true, data: token });
});

export const getAdminUploadToken = asyncHandler(async (_req, res) => {
  const token = buildUploadToken("akshar-realestate/properties");
  res.json({ success: true, data: token });
});

export const refreshProofUrl = asyncHandler(async (req, res) => {
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    throw new ApiError(500, "Cloudinary is not configured");
  }
  const { id } = req.validated.params;
  const publicId = String(req.query.publicId || "").trim();
  if (!publicId) throw new ApiError(400, "publicId query param is required");

  const owner = await OwnerApplication.findById(id).select("media.ownerProofs");
  if (!owner) throw new ApiError(404, "Owner application not found");

  const proof = owner.media?.ownerProofs?.find((p) => p.publicId === publicId);
  if (!proof) throw new ApiError(404, "Proof not found in this owner application");

  const url = cloudinary.url(proof.publicId, {
    secure: true,
    sign_url: true,
    type: "authenticated",
    resource_type: proof.resourceType || "image",
    format: proof.format || undefined,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });

  res.json({ success: true, data: { url, expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() } });
});
