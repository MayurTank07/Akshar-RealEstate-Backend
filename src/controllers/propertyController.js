import { Activity } from "../models/Activity.js";
import { Property } from "../models/Property.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseINRAmount, parseMoneyToCrores } from "../utils/reporting.js";
import { generatePropertyCode, previewPropertyCode, syncPropertyCodeCounter } from "../services/propertyCodeService.js";

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const listQuery = (query) => {
  const filter = {};

  if (query.status && query.status !== "all") filter.status = query.status;
  if (query.availability && query.availability !== "all") {
    if (query.availability === "available") filter.status = { $nin: ["sold", "rented"] };
    if (query.availability === "sold") filter.status = "sold";
    if (query.availability === "rented") filter.status = "rented";
  }
  if (query.city && query.city !== "all") filter.city = new RegExp(query.city, "i");
  if (query.type && query.type !== "all") filter.type = new RegExp(`^${query.type}$`, "i");
  if (query.source) filter.source = query.source;
  if (query.propertyCode && query.propertyCode !== "all") filter.propertyCode = new RegExp(escapeRegExp(query.propertyCode), "i");
  if (query.propertyId && query.propertyId !== "all") filter.propertyCode = new RegExp(escapeRegExp(query.propertyId), "i");
  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), "i");
    filter.$or = [
      { title: pattern },
      { propertyCode: pattern },
      { location: pattern },
      { city: pattern },
      { type: pattern },
      { dealType: pattern },
      { status: pattern },
      { propertyStatus: pattern },
      { category: pattern },
      { ownerName: pattern },
      { developerName: pattern },
      { topProject: pattern },
      { topDeveloper: pattern },
      { price: pattern },
    ];
  }

  return filter;
};

function supervisorOwnershipFilter(user) {
  if (user.role === "admin") return {};
  return { $or: [{ assignedTo: user._id }, { createdBy: user._id }] };
}

function canAccessProperty(user, property) {
  if (user.role === "admin") return true;
  return [property.assignedTo, property.createdBy].some((id) => id && id.toString() === user._id.toString());
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
  const filter = listQuery({ ...req.query, status: req.query.status || "active" });
  filter.visibility = { $ne: "private" };
  const properties = await Property.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: properties });
});

export const publicProperty = asyncHandler(async (req, res) => {
  const property = await Property.findOne({ _id: req.validated.params.id, visibility: { $ne: "private" } });
  if (!property) throw new ApiError(404, "Property not found");
  res.json({ success: true, data: property });
});

export const listProperties = asyncHandler(async (req, res) => {
  let properties = await Property.find({ ...listQuery(req.query), ...supervisorOwnershipFilter(req.user) })
    .populate("assignedTo", "name email role")
    .sort({ createdAt: -1 });
  const minPrice = Number(req.query.minPrice || 0);
  const maxPrice = Number(req.query.maxPrice || 0);
  if (minPrice || maxPrice) {
    properties = properties.filter((property) => {
      const crores = parseMoneyToCrores(property.price);
      return (!minPrice || crores >= minPrice) && (!maxPrice || crores <= maxPrice);
    });
  }
  res.json({ success: true, data: properties });
});

export const getProperty = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.validated.params.id).populate("assignedTo", "name email role");
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
