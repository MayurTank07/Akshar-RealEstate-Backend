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

function uploadBuffer(file) {
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    throw new ApiError(500, "Cloudinary is not configured");
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "akshar-realestate/properties",
        resource_type: "image",
        transformation: [
          { quality: "auto", fetch_format: "auto" },
          { width: 1600, crop: "limit" },
        ],
      },
      (error, result) => {
        if (error) return reject(new ApiError(502, "Image upload failed. Please try again."));
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
