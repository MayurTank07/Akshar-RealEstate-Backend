import { AnalyticsEvent } from "../models/AnalyticsEvent.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const ALLOWED_METADATA_KEYS = new Set([
  "searchType",
  "query",
  "filterName",
  "filterValue",
  "imageIndex",
  "shareMethod",
  "mapProvider",
  "formType",
  "resultCount",
]);

function cleanString(value, limit = 180) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function cleanMetadata(metadata = {}) {
  return Object.fromEntries(
    Object.entries(metadata || {})
      .filter(([key]) => ALLOWED_METADATA_KEYS.has(key))
      .map(([key, value]) => [key, typeof value === "number" || typeof value === "boolean" ? value : cleanString(value, 180)])
      .filter(([, value]) => value !== "")
  );
}

export const trackAnalyticsEvent = asyncHandler(async (req, res) => {
  const body = req.validated.body;
  const event = await AnalyticsEvent.create({
    eventName: body.eventName,
    propertyId: body.propertyId || null,
    propertySlug: cleanString(body.propertySlug || body.propertySlug === "" ? body.propertySlug : body.slug),
    propertyTitle: cleanString(body.propertyTitle),
    location: cleanString(body.location),
    city: cleanString(body.city),
    propertyType: cleanString(body.propertyType),
    bhk: Number(body.bhk || 0),
    listingType: cleanString(body.listingType),
    assignedSupervisor: {
      id: cleanString(body.assignedSupervisor?.id, 80),
      name: cleanString(body.assignedSupervisor?.name),
      companyName: cleanString(body.assignedSupervisor?.companyName),
    },
    pagePath: cleanString(body.pagePath, 300),
    pageTitle: cleanString(body.pageTitle),
    referrer: cleanString(body.referrer, 300),
    source: cleanString(body.source),
    campaign: {
      utmSource: cleanString(body.campaign?.utmSource),
      utmMedium: cleanString(body.campaign?.utmMedium),
      utmCampaign: cleanString(body.campaign?.utmCampaign),
      utmTerm: cleanString(body.campaign?.utmTerm),
      utmContent: cleanString(body.campaign?.utmContent),
      gclid: cleanString(body.campaign?.gclid),
      fbclid: cleanString(body.campaign?.fbclid),
      ref: cleanString(body.campaign?.ref),
      supervisor: cleanString(body.campaign?.supervisor),
    },
    metadata: cleanMetadata(body.metadata),
  });

  res.status(201).json({ success: true, data: { id: event._id } });
});
