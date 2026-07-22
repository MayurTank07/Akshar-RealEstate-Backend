export const PROPERTY_STATUSES = [
  "draft",
  "published",
  "available",
  "reserved",
  "sold",
  "rented",
  "inactive",
  "deleted",
  "active",
  "pending",
];

export const DEAL_STATUSES = ["sold", "rented"];
export const PUBLIC_LISTING_STATUSES = ["active", "published", "available", "reserved"];
export const PUBLIC_DETAIL_STATUSES = [...PUBLIC_LISTING_STATUSES, ...DEAL_STATUSES, "inactive"];
export const INDEXABLE_PROPERTY_STATUSES = [...PUBLIC_LISTING_STATUSES, ...DEAL_STATUSES];
export const NON_INDEXABLE_PROPERTY_STATUSES = ["draft", "inactive", "deleted", "pending"];
export const DELETED_PROPERTY_STATUS = "deleted";

export function normalizePropertyStatus(value, fallback = "active") {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "-");
  if (!normalized) return fallback;
  if (normalized === "available-only") return "available";
  if (PROPERTY_STATUSES.includes(normalized)) return normalized;
  return normalized;
}

export function isDealStatus(status) {
  return DEAL_STATUSES.includes(normalizePropertyStatus(status, ""));
}

export function isPublicListingStatus(status) {
  return PUBLIC_LISTING_STATUSES.includes(normalizePropertyStatus(status, ""));
}

export function isPublicDetailStatus(status) {
  return PUBLIC_DETAIL_STATUSES.includes(normalizePropertyStatus(status, ""));
}

export function isIndexablePropertyStatus(status) {
  return INDEXABLE_PROPERTY_STATUSES.includes(normalizePropertyStatus(status, ""));
}

export function isNonIndexablePropertyStatus(status) {
  return NON_INDEXABLE_PROPERTY_STATUSES.includes(normalizePropertyStatus(status, ""));
}
