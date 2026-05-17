import { Activity } from "../models/Activity.js";
import { Property } from "../models/Property.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const listQuery = (query) => {
  const filter = {};

  if (query.status && query.status !== "all") filter.status = query.status;
  if (query.source) filter.source = query.source;
  if (query.search) {
    filter.$text = { $search: query.search };
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
  const properties = await Property.find({ ...listQuery(req.query), ...supervisorOwnershipFilter(req.user) })
    .populate("assignedTo", "name email role")
    .sort({ createdAt: -1 });
  res.json({ success: true, data: properties });
});

export const getProperty = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.validated.params.id).populate("assignedTo", "name email role");
  if (!property) throw new ApiError(404, "Property not found");
  if (!canAccessProperty(req.user, property)) throw new ApiError(403, "You can only access assigned properties");
  res.json({ success: true, data: property });
});

export const createProperty = asyncHandler(async (req, res) => {
  const body = { ...req.validated.body };
  if (req.user.role === "supervisor") {
    body.assignedTo = req.user._id;
  }
  const property = await Property.create({
    ...body,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
  await Activity.create({
    type: "Property",
    title: "New Property",
    description: `${property.title} added`,
    actorName: req.user.name,
    actorId: req.user._id,
  });
  res.status(201).json({ success: true, data: property });
});

export const updateProperty = asyncHandler(async (req, res) => {
  const existing = await Property.findById(req.validated.params.id);
  if (!existing) throw new ApiError(404, "Property not found");
  if (!canAccessProperty(req.user, existing)) throw new ApiError(403, "You can only update assigned properties");

  const body = { ...req.validated.body, updatedBy: req.user._id };
  if (req.user.role === "supervisor") {
    delete body.assignedTo;
  }

  Object.assign(existing, body);
  await existing.save();
  await Activity.create({
    type: "Property",
    title: "Property updated",
    description: existing.title,
    actorName: req.user.name,
    actorId: req.user._id,
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
    actorName: req.user.name,
    actorId: req.user._id,
  });
  res.json({ success: true, data: { id: property._id } });
});
