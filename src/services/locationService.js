import { DEFAULT_LOCATIONS } from "../config/locationDefaults.js";
import { Location } from "../models/Location.js";
import { Property } from "../models/Property.js";
import { ApiError } from "../utils/ApiError.js";
import { slugify } from "../utils/slugify.js";

export const LOCATION_PUBLIC_FIELDS = "name gujaratiName slug city district taluka state country pinCode latitude longitude parentRegion locationType seoTitle metaDescription shortDescription longDescription primaryKeyword secondaryKeywords isActive isIndexable propertyCount verificationStatus";

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function locationSetDefaults(body = {}) {
  const name = normalizeText(body.name);
  const slug = slugify(body.slug || name);
  return {
    name,
    gujaratiName: normalizeText(body.gujaratiName),
    slug,
    city: normalizeText(body.city),
    district: normalizeText(body.district),
    taluka: normalizeText(body.taluka),
    state: normalizeText(body.state) || "Gujarat",
    country: normalizeText(body.country) || "India",
    pinCode: normalizeText(body.pinCode),
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    parentRegion: normalizeText(body.parentRegion),
    locationType: body.locationType || "locality",
    seoTitle: normalizeText(body.seoTitle) || `${name} Real Estate | Akshar Estate The Property Hub`,
    metaDescription: normalizeText(body.metaDescription) || `Explore verified property options in ${name} with Akshar Estate The Property Hub.`,
    shortDescription: normalizeText(body.shortDescription),
    longDescription: normalizeText(body.longDescription),
    primaryKeyword: normalizeText(body.primaryKeyword) || `${name} property`,
    secondaryKeywords: Array.isArray(body.secondaryKeywords) ? body.secondaryKeywords.map(normalizeText).filter(Boolean) : [],
    isActive: body.isActive !== false,
    isIndexable: Boolean(body.isIndexable && body.verificationStatus === "verified"),
    propertyCount: Number(body.propertyCount || 0),
    verificationStatus: body.verificationStatus === "verified" ? "verified" : "needsVerification",
  };
}

export async function ensureDefaultLocations() {
  const operations = DEFAULT_LOCATIONS.map((location) => ({
    updateOne: {
      filter: { slug: location.slug },
      update: { $setOnInsert: location },
      upsert: true,
    },
  }));
  if (operations.length) await Location.bulkWrite(operations, { ordered: false });
}

export async function recalculateLocationPropertyCounts() {
  const counts = await Property.aggregate([
    { $match: { deletedAt: null, locationRef: { $ne: null } } },
    { $group: { _id: "$locationRef", count: { $sum: 1 } } },
  ]);
  await Location.updateMany({}, { $set: { propertyCount: 0 } });
  if (!counts.length) return;
  await Location.bulkWrite(
    counts.map((item) => ({
      updateOne: {
        filter: { _id: item._id },
        update: { $set: { propertyCount: item.count } },
      },
    })),
    { ordered: false }
  );
}

export async function createLocation(body, user) {
  await ensureDefaultLocations();
  const payload = locationSetDefaults(body);
  if (!payload.name) throw new ApiError(400, "Location name is required");
  if (!payload.slug) throw new ApiError(400, "Location slug is required");
  const duplicate = await Location.exists({ slug: payload.slug });
  if (duplicate) throw new ApiError(409, "Location slug already exists");
  const location = await Location.create({ ...payload, createdBy: user?._id || null, updatedBy: user?._id || null });
  return location;
}

export async function resolveLocationInput(body = {}) {
  await ensureDefaultLocations();
  const id = body.locationRef || body.locationId;
  const rawLocation = normalizeText(body.location);
  const rawSlug = slugify(body.locationSlug || rawLocation);
  const location = id
    ? await Location.findOne({ _id: id, isActive: true })
    : rawSlug
      ? await Location.findOne({ slug: rawSlug, isActive: true })
      : null;
  if (!location) {
    throw new ApiError(422, "Select a valid location from the master location list.");
  }
  const city = location.city || normalizeText(body.city);
  return {
    location,
    patch: {
      locationRef: location._id,
      location: location.name,
      city,
      map: {
        ...(body.map || {}),
        area: location.name,
        city: city || body.map?.city || "",
        state: location.state || body.map?.state || "Gujarat",
        pincode: location.pinCode || body.map?.pincode || "",
        latitude: location.latitude ?? body.map?.latitude ?? null,
        longitude: location.longitude ?? body.map?.longitude ?? null,
      },
    },
  };
}

export function publicLocationView(value) {
  if (!value) return null;
  const location = typeof value.toObject === "function" ? value.toObject() : value;
  return {
    _id: location._id,
    name: location.name,
    gujaratiName: location.gujaratiName || "",
    slug: location.slug,
    city: location.city || "",
    district: location.district || "",
    taluka: location.taluka || "",
    state: location.state || "",
    country: location.country || "",
    pinCode: location.pinCode || "",
    latitude: location.latitude ?? null,
    longitude: location.longitude ?? null,
    parentRegion: location.parentRegion || "",
    locationType: location.locationType || "locality",
    seoTitle: location.seoTitle || "",
    metaDescription: location.metaDescription || "",
    shortDescription: location.shortDescription || "",
    longDescription: location.longDescription || "",
    primaryKeyword: location.primaryKeyword || "",
    secondaryKeywords: location.secondaryKeywords || [],
    isActive: location.isActive !== false,
    isIndexable: Boolean(location.isIndexable),
    propertyCount: location.propertyCount || 0,
    verificationStatus: location.verificationStatus || "needsVerification",
  };
}

