import { Activity } from "../models/Activity.js";
import { Property } from "../models/Property.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegExp } from "../utils/escapeRegExp.js";
import { parsePagination } from "../utils/pagination.js";
import { parseINRAmount } from "../utils/reporting.js";
import { generatePropertyCode, isReadablePropertyCode, previewPropertyCode, syncPropertyCodeCounter } from "../services/propertyCodeService.js";
import { publicPropertyView } from "../utils/publicProperty.js";

const PROPERTY_SORT_FIELDS = ["createdAt", "updatedAt", "title", "city", "type", "status", "priceAmount"];

const searchNumberWords = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
};

const searchSynonyms = new Map([
  ["flat", "apartment"],
  ["flats", "apartment"],
  ["apartments", "apartment"],
  ["shop", "retail"],
  ["shops", "retail"],
  ["office space", "office"],
  ["sell", "sale"],
  ["buy", "sale"],
  ["rental", "rent"],
  ["lease", "rent"],
  ["fully furnished", "furnished"],
  ["semi furnished", "semi-furnished"],
  ["un furnished", "unfurnished"],
  ["new projects", "new launch"],
  ["new project", "new launch"],
]);

const SEARCH_FIELDS = [
  "title",
  "propertyCode",
  "location",
  "city",
  "type",
  "dealType",
  "status",
  "propertyStatus",
  "category",
  "availability",
  "constructionStatus",
  "possessionStatus",
  "developerName",
  "topProject",
  "topDeveloper",
  "price",
  "priceUnit",
  "furnishing",
  "facing",
  "ownership",
  "parking",
  "area",
  "description",
  "nearbyLandmarks",
  "amenities",
  "features",
  "facilities",
  "highlights",
  "propertyTags",
  "measurement.unit",
];

function normalizeSearch(value = "") {
  let text = String(value || "").toLowerCase();
  Object.entries(searchNumberWords).forEach(([word, number]) => {
    text = text.replace(new RegExp(`\\b${word}\\s+bhk\\b`, "g"), `${number}bhk`);
  });
  text = text
    .replace(/\b(\d+)\s*b\s*h\s*k\b/g, "$1bhk")
    .replace(/\b(\d+)\s+bed(room)?s?\b/g, "$1bhk")
    .replace(/\b(properties?|flats?|homes?)\s+(for\s+)?(sale|rent|buy|lease)\s+in\b/g, " ")
    .replace(/\b(for\s+)?(sale|rent|buy|lease)\s+in\b/g, " ")
    .replace(/\bproperties\s+in\b/g, " ");
  searchSynonyms.forEach((to, from) => {
    text = text.replace(new RegExp(`\\b${escapeRegExp(from).replace(/\s+/g, "\\s+")}\\b`, "g"), to);
  });
  return text.replace(/[^a-z0-9.-]+/g, " ").replace(/\s+/g, " ").trim();
}

function searchTokens(value = "") {
  const normalized = normalizeSearch(value).replace(/\b(under|below|less than|upto|up to|above|over|greater than|from|min|max)?\s*(\d+(?:\.\d+)?)\s*(cr|crore|crores|lakh|lakhs|lac|lacs|k|thousand)\b/g, " ");
  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !["for", "in", "at", "the"].includes(token));
}

function priceIntentFilter(query) {
  const normalized = normalizeSearch(query);
  const match = normalized.match(/\b(under|below|less than|upto|up to|above|over|greater than|from|min|max)?\s*(\d+(?:\.\d+)?)\s*(cr|crore|crores|lakh|lakhs|lac|lacs|k|thousand)?\b/);
  if (!match || !/(under|below|less|upto|up to|above|over|greater|from|min|max|cr|crore|lakh|lac|thousand)/.test(match[0])) return null;
  const unit = match[3] || "";
  const amount = Number(match[2]) * (
    unit.startsWith("cr") || unit.startsWith("crore") ? 10000000 :
    unit.startsWith("lakh") || unit.startsWith("lac") ? 100000 :
    unit.startsWith("k") || unit.startsWith("thousand") ? 1000 :
    1
  );
  if (!amount) return null;
  if (["under", "below", "less than", "upto", "up to", "max"].includes(match[1])) return { priceAmount: { $lte: amount } };
  if (["above", "over", "greater than", "from", "min"].includes(match[1])) return { priceAmount: { $gte: amount } };
  return { priceAmount: { $gte: amount * 0.8, $lte: amount * 1.2 } };
}

function tokenSearchFilter(token, includePrivateSearch) {
  const bhk = token.match(/^(\d+)bhk$/);
  if (bhk) return { beds: Number(bhk[1]) };
  const pattern = new RegExp(escapeRegExp(token), "i");
  const fields = includePrivateSearch ? [...SEARCH_FIELDS, "ownerName"] : SEARCH_FIELDS;
  return { $or: fields.map((field) => ({ [field]: pattern })) };
}

function booleanQuery(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "new-projects", "new projects"].includes(normalized)) return true;
  if (["false", "0", "no", "standard"].includes(normalized)) return false;
  return null;
}

const listQuery = (query, { includePrivateSearch = true } = {}) => {
  const filter = {};
  if (String(query.includeDeleted || "").toLowerCase() !== "true") filter.deletedAt = null;

  if (query.status && query.status !== "all") filter.status = query.status;
  if (query.availability && query.availability !== "all") {
    if (query.availability === "available") filter.status = { $nin: ["sold", "rented"] };
    if (query.availability === "sold") filter.status = "sold";
    if (query.availability === "rented") filter.status = "rented";
  }
  if (query.city && query.city !== "all") filter.city = new RegExp(escapeRegExp(query.city), "i");
  if (query.type && query.type !== "all") filter.type = new RegExp(`^${escapeRegExp(query.type)}$`, "i");
  const category = String(query.category || "").trim();
  const newProjectQuery = [query.isNewProject, query.newProject, query.newProjects].map(booleanQuery).find((value) => value !== null);
  if (newProjectQuery === true || category.toLowerCase() === "new projects") filter.isNewProject = true;
  if (newProjectQuery === false) filter.isNewProject = { $ne: true };
  if (category && category !== "all" && category.toLowerCase() !== "new projects") filter.category = new RegExp(`^${escapeRegExp(category)}$`, "i");
  if (query.source) filter.source = query.source;
  if (query.propertyCode && query.propertyCode !== "all") filter.propertyCode = new RegExp(escapeRegExp(query.propertyCode), "i");
  if (query.propertyId && query.propertyId !== "all") filter.propertyCode = new RegExp(escapeRegExp(query.propertyId), "i");
  const search = query.search || query.q || "";
  if (search) {
    const tokenFilters = searchTokens(search).map((token) => tokenSearchFilter(token, includePrivateSearch));
    const priceFilter = priceIntentFilter(search);
    const allFilters = [...tokenFilters, ...(priceFilter ? [priceFilter] : [])];
    if (allFilters.length) filter.$and = [...(filter.$and || []), ...allFilters];
  }

  const minPrice = Number(query.minPrice || 0);
  const maxPrice = Number(query.maxPrice || 0);
  if (minPrice || maxPrice) {
    const priceRange = {};
    if (minPrice) priceRange.$gte = Math.round(minPrice * 10_000_000);
    if (maxPrice) priceRange.$lte = Math.round(maxPrice * 10_000_000);
    filter.priceAmount = priceRange;
  }

  return filter;
};

function supervisorOwnershipFilter(user) {
  if (user.role === "admin") return {};
  return { $or: [{ assignedTo: user._id }, { createdBy: user._id }] };
}

function canAccessProperty(user, property) {
  if (user.role === "admin") return true;
  return [property.assignedTo, property.createdBy].some((value) => {
    const id = value?._id || value;
    return id && id.toString() === user._id.toString();
  });
}

function activityTargets(...ids) {
  return [...new Set(ids.filter(Boolean).map((id) => id.toString()))];
}

function normalizeMoneyFields(body) {
  if ("price" in body || "priceAmount" in body) {
    body.priceAmount = body.priceAmount || parseINRAmount(body.price);
    body.price = String(body.priceAmount || parseINRAmount(body.price) || "");
  }
  if ("finalPrice" in body || "finalPriceAmount" in body) {
    body.finalPriceAmount = body.finalPriceAmount || parseINRAmount(body.finalPrice);
    body.finalPrice = body.finalPriceAmount ? String(body.finalPriceAmount) : "";
  }
  if ("commission" in body || "commissionAmount" in body) {
    body.commissionAmount = body.commissionAmount || parseINRAmount(body.commission);
    body.commission = body.commissionAmount ? String(body.commissionAmount) : "";
  }
  return body;
}

function normalizeNewProjectFlag(body) {
  const category = String(body.category || "").trim().toLowerCase();
  if (category === "new projects") body.isNewProject = true;
  return body;
}

function validateDealDetails(body, existing) {
  const status = body.status || existing.status;
  if (status !== "sold" && status !== "rented") return;
  const required = [
    ["finalPrice", "Final sold/rented price"],
    ["commission", "Commission amount"],
    ["dealCustomerName", "Customer name"],
    ["dealCustomerPhone", "Customer phone"],
    ["dealDate", "Deal date"],
  ];
  const missing = required
    .filter(([key]) => !String(body[key] ?? existing[key] ?? "").trim())
    .map(([, label]) => label);
  if (missing.length) {
    throw new ApiError(400, `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required when marking a property as ${status}`);
  }
}

export const publicProperties = asyncHandler(async (req, res) => {
  const filter = listQuery({ ...req.query, status: req.query.status || "active" }, { includePrivateSearch: false });
  filter.visibility = { $ne: "private" };
  const { page, limit, skip, sort } = parsePagination(req.query, { allowedSortFields: PROPERTY_SORT_FIELDS });
  const [properties, total] = await Promise.all([
    Property.find(filter)
      .populate("assignedTo", "name phone designation avatar role")
      .populate("createdBy", "name phone designation avatar role")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Property.countDocuments(filter),
  ]);
  res.json({ success: true, data: properties.map(publicPropertyView), pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

export const publicProperty = asyncHandler(async (req, res) => {
  const property = await Property.findOne({ _id: req.validated.params.id, status: "active", deletedAt: null, visibility: { $ne: "private" } })
    .populate("assignedTo", "name phone designation avatar role")
    .populate("createdBy", "name phone designation avatar role");
  if (!property) throw new ApiError(404, "Property not found");
  res.json({ success: true, data: publicPropertyView(property) });
});

export const listProperties = asyncHandler(async (req, res) => {
  const filter = { ...listQuery(req.query), ...supervisorOwnershipFilter(req.user) };
  const { page, limit, skip, sort } = parsePagination(req.query, { allowedSortFields: PROPERTY_SORT_FIELDS });
  const [properties, total] = await Promise.all([
    Property.find(filter)
      .populate("assignedTo", "name email phone designation avatar role")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Property.countDocuments(filter),
  ]);
  res.json({ success: true, data: properties, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

export const getProperty = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.validated.params.id).populate("assignedTo", "name email phone designation avatar role");
  if (!property) throw new ApiError(404, "Property not found");
  if (!canAccessProperty(req.user, property)) throw new ApiError(403, "You can only access assigned properties");
  res.json({ success: true, data: property });
});

export const nextPropertyCode = asyncHandler(async (req, res) => {
  const propertyCode = await previewPropertyCode(req.query.city || req.query.location || "Ahmedabad");
  res.json({ success: true, data: { propertyCode } });
});

export const checkPropertyCode = asyncHandler(async (req, res) => {
  const propertyCode = String(req.params.propertyCode || "").trim();
  if (!propertyCode) throw new ApiError(400, "Property ID is required");
  const filter = { propertyCode };
  if (req.query.excludeId) filter._id = { $ne: req.query.excludeId };
  const exists = await Property.exists(filter);
  res.json({ success: true, data: { propertyCode, available: !exists } });
});

export const createProperty = asyncHandler(async (req, res) => {
  const body = { ...req.validated.body };
  normalizeMoneyFields(body);
  normalizeNewProjectFlag(body);
  if (req.user.role === "supervisor") {
    body.assignedTo = req.user._id;
  }
  if (body.dealDate === "") body.dealDate = null;
  if (body.status === "sold" || body.status === "rented") {
    body.dealSource = body.dealSource || "manual";
    body.statusUpdatedAt = body.dealDate || new Date();
    body.statusUpdatedBy = req.user._id;
    validateDealDetails(body, {});
  }
  if (body.propertyCode) {
    body.propertyCode = String(body.propertyCode).trim().toUpperCase();
    if (!isReadablePropertyCode(body.propertyCode)) {
      throw new ApiError(422, "Property ID must use the AETP-CITY-0001 format.");
    }
    const duplicate = await Property.exists({ propertyCode: body.propertyCode });
    if (duplicate) throw new ApiError(409, "Property ID already exists");
  } else {
    body.propertyCode = await generatePropertyCode(body.city || body.location);
  }
  const property = await Property.create({
    ...body,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
  await syncPropertyCodeCounter(property.propertyCode);
  await Activity.create({
    type: "Property",
    title: "New Property",
    description: `${property.title} added`,
    category: "property",
    referenceType: "property",
    referenceId: property._id,
    metadata: { propertyId: property._id, propertyName: property.title, status: property.status },
    actorName: req.user.name,
    actorId: req.user._id,
    targetStaffIds: activityTargets(property.assignedTo, property.createdBy),
  });
  res.status(201).json({ success: true, data: property });
});

export const updateProperty = asyncHandler(async (req, res) => {
  const existing = await Property.findById(req.validated.params.id);
  if (!existing) throw new ApiError(404, "Property not found");
  if (!canAccessProperty(req.user, existing)) throw new ApiError(403, "You can only update assigned properties");
  const previousAssignedTo = existing.assignedTo?.toString();
  const previousStatus = existing.status;

  const body = normalizeMoneyFields({ ...req.validated.body, updatedBy: req.user._id });
  normalizeNewProjectFlag(body);
  if (req.user.role === "supervisor") {
    delete body.assignedTo;
  }
  if (body.status && body.status !== previousStatus) {
    body.statusUpdatedAt = new Date();
    body.statusUpdatedBy = req.user._id;
  }
  if (body.dealDate === "") body.dealDate = null;
  if ((body.status === "sold" || body.status === "rented") && !body.finalPrice && !existing.finalPrice) {
    body.finalPriceAmount = body.priceAmount || existing.priceAmount || parseINRAmount(existing.price);
    body.finalPrice = String(body.finalPriceAmount || "");
  }
  if (body.status === "sold" || body.status === "rented") {
    body.dealSource = body.dealSource || existing.dealSource || "manual";
    body.statusUpdatedAt = body.dealDate || body.statusUpdatedAt || existing.statusUpdatedAt || new Date();
    body.statusUpdatedBy = req.user._id;
  }
  if (body.propertyCode && body.propertyCode !== existing.propertyCode) {
    body.propertyCode = String(body.propertyCode).trim().toUpperCase();
    if (!isReadablePropertyCode(body.propertyCode)) {
      throw new ApiError(422, "Property ID must use the AETP-CITY-0001 format.");
    }
    const duplicate = await Property.exists({ propertyCode: body.propertyCode, _id: { $ne: existing._id } });
    if (duplicate) throw new ApiError(409, "Property ID already exists");
  }
  validateDealDetails(body, existing);

  Object.assign(existing, body);
  await existing.save();
  await syncPropertyCodeCounter(existing.propertyCode);
  const statusChanged = previousStatus !== existing.status;
  const isDealStatus = ["sold", "rented"].includes(existing.status);
  await Activity.create({
    type: "Property",
    title: statusChanged ? (isDealStatus ? `Property ${existing.status}` : "Property status updated") : previousAssignedTo !== existing.assignedTo?.toString() ? "Property assigned" : "Property updated",
    description: statusChanged ? `${existing.title} marked ${existing.status}` : existing.title,
    category: isDealStatus ? existing.status : statusChanged ? "property-status" : "property",
    priority: isDealStatus ? "high" : statusChanged ? "normal" : "low",
    status: existing.status,
    referenceType: "property",
    referenceId: existing._id,
    metadata: {
      propertyId: existing._id,
      propertyName: existing.title,
      status: existing.status,
      previousStatus,
      customerName: existing.dealCustomerName,
      customerPhone: existing.dealCustomerPhone,
      finalPrice: existing.finalPrice,
      finalPriceAmount: existing.finalPriceAmount,
      commission: existing.commission,
      commissionAmount: existing.commissionAmount,
    },
    actorName: req.user.name,
    actorId: req.user._id,
    targetStaffIds: activityTargets(existing.assignedTo, existing.createdBy),
  });
  res.json({ success: true, data: existing });
});

export const deleteProperty = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.validated.params.id);
  if (!property) throw new ApiError(404, "Property not found");
  if (!canAccessProperty(req.user, property)) throw new ApiError(403, "You can only delete assigned properties");
  const shouldArchiveForReports = ["sold", "rented"].includes(property.status);
  if (shouldArchiveForReports) {
    property.visibility = "private";
    property.deletedAt = new Date();
    property.deletedBy = req.user._id;
    property.updatedBy = req.user._id;
    await property.save();
    await Activity.create({
      type: "Property",
      title: "Property archived",
      description: property.title,
      category: "property",
      priority: "high",
      referenceType: "property",
      referenceId: property._id,
      metadata: { propertyId: property._id, propertyName: property.title, status: property.status, archived: true },
      actorName: req.user.name,
      actorId: req.user._id,
      targetStaffIds: activityTargets(property.assignedTo, property.createdBy),
    });
    return res.json({ success: true, data: { id: property._id, archived: true }, message: "Closed property archived and hidden from listings." });
  }
  await property.deleteOne();
  await Activity.create({
    type: "Property",
    title: "Property deleted",
    description: property.title,
    category: "property",
    priority: "high",
    referenceType: "property",
    referenceId: property._id,
    metadata: { propertyId: property._id, propertyName: property.title, status: "deleted" },
    actorName: req.user.name,
    actorId: req.user._id,
    targetStaffIds: activityTargets(property.assignedTo, property.createdBy),
  });
  res.json({ success: true, data: { id: property._id } });
});
