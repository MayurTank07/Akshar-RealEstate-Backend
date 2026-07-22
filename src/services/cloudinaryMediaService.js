import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
});

export function assertCloudinaryConfigured() {
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    throw new ApiError(500, "Cloudinary is not configured");
  }
}

export function uploadBufferToCloudinary(
  file,
  {
    folder = "akshar-realestate/properties",
    resourceType = "image",
    transformation = [
      { quality: "auto", fetch_format: "auto" },
      { width: 1600, crop: "limit" },
    ],
    type,
    accessMode,
    publicId,
  } = {}
) {
  assertCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        transformation,
        ...(publicId ? { public_id: publicId, unique_filename: true, overwrite: false } : {}),
        ...(type ? { type } : {}),
        ...(accessMode ? { access_mode: accessMode } : {}),
      },
      (error, result) => {
        if (error) return reject(new ApiError(502, "Media upload failed. Please try again."));
        return resolve({ ...result, resourceType });
      }
    );
    stream.end(file.buffer);
  });
}

export function extractCloudinaryPublicId(url = "") {
  const value = String(url || "");
  if (!value.includes("res.cloudinary.com") || !value.includes("/upload/")) return "";
  const [, afterUpload = ""] = value.split("/upload/");
  const withoutQuery = afterUpload.split("?")[0];
  const segments = withoutQuery.split("/").filter(Boolean);
  const versionIndex = segments.findIndex((segment) => /^v\d+$/.test(segment));
  const publicSegments = versionIndex >= 0 ? segments.slice(versionIndex + 1) : segments;
  if (!publicSegments.length) return "";
  const publicPath = publicSegments.join("/");
  return publicPath.replace(/\.[a-z0-9]+$/i, "");
}

export function normalizeCloudinaryAsset(asset) {
  if (!asset) return null;
  if (typeof asset === "string") {
    const publicId = extractCloudinaryPublicId(asset);
    return publicId ? { url: asset, publicId, resourceType: "image" } : null;
  }
  const url = asset.url || asset.secure_url || "";
  const publicId = asset.publicId || asset.public_id || extractCloudinaryPublicId(url);
  if (!publicId) return null;
  return {
    url,
    publicId,
    resourceType: asset.resourceType || asset.resource_type || "image",
  };
}

export function mediaAssetsFromProperty(property) {
  const assets = [
    ...(Array.isArray(property?.media) ? property.media : []),
    property?.image,
    ...(Array.isArray(property?.gallery) ? property.gallery : []),
  ]
    .map(normalizeCloudinaryAsset)
    .filter(Boolean);
  return Array.from(new Map(assets.map((asset) => [asset.publicId, asset])).values());
}

export function removedCloudinaryAssets(previousAssets = [], nextAssets = []) {
  const nextIds = new Set(nextAssets.map((asset) => asset.publicId).filter(Boolean));
  return previousAssets.filter((asset) => asset.publicId && !nextIds.has(asset.publicId));
}

export async function deleteCloudinaryAssets(assets = []) {
  const uniqueAssets = Array.from(
    new Map(assets.map(normalizeCloudinaryAsset).filter(Boolean).map((asset) => [asset.publicId, asset])).values()
  );
  if (!uniqueAssets.length) return [];
  assertCloudinaryConfigured();
  const settled = await Promise.allSettled(
    uniqueAssets.map((asset) => cloudinary.uploader.destroy(asset.publicId, { resource_type: asset.resourceType || "image" }))
  );
  return settled.map((result, index) => ({ asset: uniqueAssets[index], result }));
}

export { cloudinary };
