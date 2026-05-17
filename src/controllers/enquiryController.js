import { Activity } from "../models/Activity.js";
import { Enquiry } from "../models/Enquiry.js";
import { Property } from "../models/Property.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function normalizeEnquiry(body) {
  return {
    ...body,
    preferredLocation: body.preferredLocation || body.location || "",
    propertyType: body.propertyType || body.type || "",
    budget: String(body.budget || ""),
  };
}

async function findEnquiryProperty(body) {
  if (body.propertyId) {
    return Property.findById(body.propertyId).select("assignedTo createdBy title city location type");
  }

  if (body.propertyTitle) {
    return Property.findOne({ title: new RegExp(`^${body.propertyTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).select(
      "assignedTo createdBy title city location type"
    );
  }

  return null;
}

export const createPublicEnquiry = asyncHandler(async (req, res) => {
  const body = normalizeEnquiry(req.validated.body);
  const property = await findEnquiryProperty(body);

  if (property) {
    body.assignedTo = property?.assignedTo || property?.createdBy || undefined;
    body.propertyId = body.propertyId || property._id;
    body.propertyTitle = body.propertyTitle || property.title;
    body.preferredLocation = body.preferredLocation || property.city || property.location || "";
    body.propertyType = body.propertyType || property.type || "";
  }

  const enquiry = await Enquiry.create(body);
  await Activity.create({
    type: "Enquiry",
    title: "New enquiry",
    description: enquiry.propertyTitle || enquiry.preferredLocation || "Website enquiry",
    actorName: enquiry.name,
  });
  res.status(201).json({ success: true, data: enquiry });
});

export const listEnquiries = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
  if (req.query.search) filter.$text = { $search: req.query.search };
  if (req.user.role === "supervisor") filter.assignedTo = req.user._id;

  const enquiries = await Enquiry.find(filter).populate("assignedTo", "name email role").sort({ createdAt: -1 });
  res.json({ success: true, data: enquiries });
});

export const updateEnquiry = asyncHandler(async (req, res) => {
  const update = normalizeEnquiry(req.validated.body);
  const note = update.note;
  delete update.note;

  const enquiry = await Enquiry.findById(req.validated.params.id);
  if (!enquiry) throw new ApiError(404, "Enquiry not found");
  if (req.user.role === "supervisor" && enquiry.assignedTo?.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only manage assigned enquiries");
  }

  Object.assign(enquiry, update);
  if (note) {
    enquiry.notes.push({ text: note, by: req.user._id });
  }
  await enquiry.save();

  await Activity.create({
    type: "Enquiry",
    title: "Enquiry updated",
    description: `${enquiry.name} marked ${enquiry.status}`,
    actorName: req.user.name,
    actorId: req.user._id,
  });

  res.json({ success: true, data: enquiry });
});

export const deleteEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.findByIdAndDelete(req.validated.params.id);
  if (!enquiry) throw new ApiError(404, "Enquiry not found");
  res.json({ success: true, data: { id: enquiry._id } });
});
