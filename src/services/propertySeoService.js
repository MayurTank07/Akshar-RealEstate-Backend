import { Property } from "../models/Property.js";
import { isIndexablePropertyStatus, isNonIndexablePropertyStatus, normalizePropertyStatus } from "../config/propertyLifecycle.js";
import { ApiError } from "../utils/ApiError.js";
import { formatINR } from "../utils/formatINR.js";
import { slugify } from "../utils/slugify.js";

const SITE_ORIGIN = process.env.SITE_ORIGIN || process.env.FRONTEND_URL || "https://www.aksharestate.in";

function compact(value, limit) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function listingType(property = {}) {
  const text = [property.listingType, property.dealType, property.category].join(" ").toLowerCase();
  if (/\b(rent|rental|lease)\b/.test(text)) return "rent";
  return "sale";
}

function propertyType(property = {}) {
  return property.propertyType || property.type || "property";
}

function cleanPlacePart(value) {
  const text = String(value || "").trim();
  if (/^https?:\/\//i.test(text)) return "";
  return text;
}

function bhkText(property = {}) {
  const bhk = Number(property.bhk ?? property.beds ?? 0);
  return bhk > 0 ? `${bhk}-bhk` : "";
}

function uniqueId(property = {}) {
  const propertyCode = String(property.propertyCode || "").trim();
  if (propertyCode) {
    const parts = propertyCode.split(/[^a-z0-9]+/i).filter(Boolean);
    return parts.at(-1) || propertyCode;
  }
  return String(property._id || property.id || Date.now()).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(-8);
}

export function buildPropertySlug(property = {}) {
  const kind = bhkText(property) || slugify(propertyType(property));
  const deal = listingType(property) === "rent" ? "for-rent" : "for-sale";
  const type = bhkText(property) ? propertyType(property) : "";
  return slugify([kind, type, deal, cleanPlacePart(property.location), cleanPlacePart(property.city), uniqueId(property)].filter(Boolean).join(" "));
}

export async function ensureUniquePropertySlug(baseSlug, excludeId) {
  const cleanBase = slugify(baseSlug);
  let candidate = cleanBase || `property-${Date.now()}`;
  let suffix = 2;
  while (await Property.exists({
    $or: [{ slug: candidate }, { oldSlugs: candidate }],
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })) {
    candidate = `${cleanBase}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function buildSeoTitle(property = {}) {
  const bhk = Number(property.bhk ?? property.beds ?? 0);
  const type = titleCase(propertyType(property));
  const deal = listingType(property) === "rent" ? "Rent" : "Sale";
  const prefix = `${bhk > 0 ? `${bhk} BHK ` : ""}${type} for ${deal}`;
  const place = [property.location, property.city && property.city !== property.location ? property.city : ""].filter(Boolean).join(", ");
  const price = property.priceAmount || property.price ? ` | ${formatINR(property.priceAmount || property.price)}` : "";
  return compact(`${prefix}${place ? ` in ${place}` : ""}${price}`, 70);
}

export function buildMetaDescription(property = {}) {
  const bhk = Number(property.bhk ?? property.beds ?? 0);
  const type = propertyType(property).toLowerCase();
  const deal = listingType(property) === "rent" ? "rent" : "sale";
  const place = [property.location, property.city && property.city !== property.location ? property.city : ""].filter(Boolean).join(", ");
  return compact(
    `Explore this ${bhk > 0 ? `${bhk} BHK ` : ""}${type} for ${deal}${place ? ` in ${place}` : ""}. View price, carpet area, amenities, photos, location and contact details.`,
    160
  );
}

export function buildCanonicalUrl(slug) {
  return `${SITE_ORIGIN.replace(/\/$/, "")}/property/${slug}`;
}

export async function applyPropertySeoFields(body, { existing = null, user = null, forceSlug = false } = {}) {
  const isAdmin = user?.role === "admin";
  const existingSeo = existing?.seo || {};
  const existingPublished = existing?.publishedAt || null;
  body.status = normalizePropertyStatus(body.status || existing?.status || "active");
  const manualSlug = isAdmin ? body.slug || body.seo?.slug : "";
  const currentSlug = existing?.slug || existingSeo.slug || "";
  const canRegenerateSlug = forceSlug || !existing || !currentSlug || (!existingPublished && !currentSlug);
  const baseSlug = manualSlug || (canRegenerateSlug ? buildPropertySlug(body) : currentSlug);
  if (manualSlug) {
    const cleanManualSlug = slugify(manualSlug);
    const duplicate = await Property.exists({
      $or: [{ slug: cleanManualSlug }, { oldSlugs: cleanManualSlug }],
      ...(existing?._id ? { _id: { $ne: existing._id } } : {}),
    });
    if (duplicate) throw new ApiError(409, "Property slug already exists");
  }
  const slug = await ensureUniquePropertySlug(baseSlug, existing?._id);
  const generatedSeoTitle = buildSeoTitle({ ...existing?.toObject?.(), ...body, slug });
  const generatedMetaDescription = buildMetaDescription({ ...existing?.toObject?.(), ...body, slug });
  const seoTitle = isAdmin && (body.seoTitle || body.seo?.metaTitle) ? body.seoTitle || body.seo?.metaTitle : existing?.seoTitle || existingSeo.metaTitle || generatedSeoTitle;
  const metaDescription = isAdmin && (body.metaDescription || body.seo?.metaDescription) ? body.metaDescription || body.seo?.metaDescription : existing?.metaDescription || existingSeo.metaDescription || generatedMetaDescription;
  const images = Array.from(new Set([body.image, ...(body.gallery || []), ...(body.images || [])].filter(Boolean)));

  body.slug = slug;
  body.seoTitle = seoTitle;
  body.metaDescription = metaDescription;
  body.canonicalUrl = buildCanonicalUrl(slug);
  body.seo = {
    ...(body.seo || {}),
    slug,
    metaTitle: seoTitle,
    metaDescription,
  };
  body.propertyType = body.propertyType || body.type || "";
  body.listingType = body.listingType || listingType(body);
  body.bhk = Number(body.bhk ?? body.beds ?? 0);
  body.builtUpArea = Number(body.builtUpArea || (body.measurement?.unit === "sqft" ? body.measurement?.value : 0) || body.sqft || 0);
  body.carpetArea = Number(body.carpetArea || 0);
  body.plotArea = Number(body.plotArea || (body.landArea ? body.measurement?.value : 0) || 0);
  body.propertyAge = body.propertyAge || body.ageOfProperty || "";
  body.floor = body.floor || body.floorNumber || "";
  body.projectName = body.projectName || body.topProject || "";
  body.societyName = body.societyName || body.topProject || "";
  body.address = body.address || body.map?.address || [body.location, body.city].filter(Boolean).join(", ");
  body.locationId = body.locationId || body.locationRef || null;
  body.district = body.district || "";
  body.latitude = body.latitude ?? body.map?.latitude ?? null;
  body.longitude = body.longitude ?? body.map?.longitude ?? null;
  body.assignedSupervisor = body.assignedSupervisor || body.assignedTo || null;
  body.sellerName = body.sellerName || body.ownerSellerName || body.ownerName || "";
  body.isFeatured = Boolean(body.isFeatured ?? body.featured);
  body.featured = Boolean(body.featured ?? body.isFeatured);
  const hasIndexableStatus = isIndexablePropertyStatus(body.status);
  const forcedNoindex = isNonIndexablePropertyStatus(body.status) || body.visibility === "private";
  body.isIndexable = Boolean(body.locationRef) && !forcedNoindex && hasIndexableStatus && (isAdmin ? Boolean(body.isIndexable) : Boolean(existing?.isIndexable ?? body.visibility === "public"));
  body.images = images;
  body.imageAltTexts = images.map((_, index) => body.imageAltTexts?.[index] || `${body.title || "Property"} in ${body.location || body.city || "Gujarat"}`);
  body.publishedAt = body.publishedAt || existing?.publishedAt || (hasIndexableStatus && body.visibility !== "private" ? new Date() : null);
  body.lastModifiedAt = new Date();
  return body;
}
