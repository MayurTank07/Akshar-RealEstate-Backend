import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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
    if (!file.mimetype?.startsWith("image/")) {
      return cb(new ApiError(422, "Only image files are allowed"));
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
    if (!file.mimetype?.startsWith("image/")) {
      return cb(new ApiError(422, "Only image files are allowed"));
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
    const allowed =
      file.mimetype?.startsWith("image/") ||
      file.mimetype?.startsWith("video/") ||
      ["application/pdf", "image/heic", "image/heif"].includes(file.mimetype);
    if (!allowed) {
      return cb(new ApiError(422, "Only image, video, and PDF files are allowed"));
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

export const uploadPropertyImages = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    throw new ApiError(422, "Please upload at least one image");
  }

  const results = await Promise.all(files.map((file) => uploadBuffer(file)));
  const urls = results.map((result) => result.secure_url);
  res.status(201).json({
    success: true,
    data: {
      urls,
      files: files.map((file, index) => ({
        originalName: file.originalname,
        size: file.size,
        url: urls[index],
        publicId: results[index].public_id,
      })),
    },
  });
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(422, "Please upload a profile image");
  }

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

export const uploadOwnerMedia = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    throw new ApiError(422, "Please upload at least one file");
  }

  const results = await Promise.all(files.map((file) => uploadOwnerBuffer(file)));
  const payload = {
    photos: [],
    videos: [],
    documents: [],
    files: [],
  };

  results.forEach((result, index) => {
    const item = {
      originalName: files[index].originalname,
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
