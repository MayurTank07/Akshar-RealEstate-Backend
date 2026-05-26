import { PERMISSIONS } from "../config/permissions.js";
import { Activity } from "../models/Activity.js";
import { OwnerApplication } from "../models/OwnerApplication.js";
import { Property } from "../models/Property.js";
import { Staff } from "../models/Staff.js";
import { generatePropertyCode, syncPropertyCodeCounter } from "../services/propertyCodeService.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function statusLabel(status) {
  return String(status || "").replace(/_/g, " ");
}

async function ownerManagementTargets() {
  const staff = await Staff.find({
    status: "active",
    $or: [{ role: "admin" }, { permissions: PERMISSIONS.OWNER_MANAGEMENT }],
  }).select("_id");
  return staff.map((item) => item._id);
}

function buildOwnerPayload(body, user, previous = null) {
  const { ownerDetails, propertyDetails, media, declaration } = body;
  return {
    ownerUserId: user._id,
    name: ownerDetails.name,
    email: ownerDetails.email.toLowerCase(),
    phone: ownerDetails.phone,
    alternatePhone: ownerDetails.alternatePhone || "",
    ownershipType: ownerDetails.ownershipType,
    propertyCount: 1,
    propertyDetails,
    media: {
      photos: media.photos || [],
      videos: media.videos || [],
      documents: media.documents || [],
    },
    declaration,
    declarationAccepted: true,
    declarationAcceptedAt: new Date(),
    status: "pending",
    reviewRemarks: "",
    revisionHistory: previous
      ? [
          ...(previous.revisionHistory || []),
          {
            submittedAt: new Date(),
            statusBefore: previous.status,
            remarksBefore: previous.reviewRemarks || "",
          },
        ]
      : [],
  };
}

function staffName(staff) {
  return staff?.name || (staff?.role === "admin" ? "Admin" : "Supervisor");
}

async function createActivity({ title, description, category, priority = "normal", status, request, actorName, actorId = null, targets = [] }) {
  await Activity.create({
    type: "Owner Request",
    title,
    description,
    category,
    priority,
    status,
    referenceType: "owner-request",
    referenceId: request._id,
    metadata: {
      ownerRequestId: request._id,
      ownerName: request.name,
      ownerPhone: request.phone,
      propertyName: request.propertyDetails?.title,
      city: request.propertyDetails?.city,
      area: request.propertyDetails?.area,
      status: request.status,
      approvedPropertyId: request.approvedPropertyId,
    },
    actorName,
    actorId,
    targetStaffIds: targets,
  });
}

function mapRequestToProperty(request, reviewer) {
  const details = request.propertyDetails || {};
  const firstPhoto = request.media?.photos?.[0] || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1600&q=80";
  const sizeValue = details.builtUpArea || details.carpetArea || 0;
  const purpose = details.purpose || "sale";

  return {
    title: details.title,
    location: details.area || details.city,
    city: details.city,
    area: details.area,
    type: details.type,
    dealType: purpose === "rent" ? "Rent" : purpose === "pre-leased" ? "Pre-leased" : "Sale",
    price: String(details.expectedPrice || 0),
    priceAmount: Number(details.expectedPrice || 0),
    beds: Number.parseInt(details.bhk, 10) || Number.parseInt(details.rooms, 10) || 0,
    sqft: sizeValue,
    measurement: { value: sizeValue, unit: details.areaUnit || "sqft", customUnit: "" },
    status: "active",
    propertyStatus: details.availability || "Ready",
    availability: details.availability || "Available",
    visibility: "public",
    ownerName: request.name,
    image: firstPhoto,
    gallery: request.media?.photos || [firstPhoto],
    videoUrl: request.media?.videos?.[0] || "",
    description: details.description,
    amenities: details.amenities || [],
    parking: details.parking || "",
    floorNumber: details.floorNumber || "",
    totalFloors: details.totalFloors || "",
    furnishing: details.furnishing || "",
    ageOfProperty: details.ageOfProperty || "",
    facing: details.facing || "",
    contact: {
      name: request.name,
      phone: request.phone,
      email: request.email,
    },
    map: {
      address: details.map?.address || details.address || "",
      area: details.map?.area || details.area || "",
      city: details.map?.city || details.city || "",
      state: details.map?.state || "",
      pincode: details.map?.pincode || "",
      latitude: details.map?.latitude ?? null,
      longitude: details.map?.longitude ?? null,
      placeId: details.map?.placeId || "",
      embedUrl: "",
    },
    ownerUserId: request.ownerUserId,
    ownerRequestId: request._id,
    source: "seller_owner",
    createdBy: reviewer._id,
    updatedBy: reviewer._id,
  };
}

async function approveRequest(request, reviewer) {
  if (request.approvedPropertyId) return request.approvedPropertyId;
  const propertyBody = mapRequestToProperty(request, reviewer);
  propertyBody.propertyCode = await generatePropertyCode(propertyBody.city || propertyBody.location);
  const property = await Property.create(propertyBody);
  await syncPropertyCodeCounter(property.propertyCode);
  return property._id;
}

export const listMyOwnerRequests = asyncHandler(async (req, res) => {
  const requests = await OwnerApplication.find({ ownerUserId: req.ownerUser._id })
    .populate("approvedPropertyId", "title propertyCode status city location image")
    .sort({ createdAt: -1 });
  res.json({ success: true, data: requests });
});

export const createOwnerRequest = asyncHandler(async (req, res) => {
  const payload = buildOwnerPayload(req.validated.body, req.ownerUser);
  const request = await OwnerApplication.create({
    ...payload,
    statusHistory: [
      {
        status: "pending",
        remarks: "Submitted by owner",
        changedByName: req.ownerUser.name,
        changedByRole: "owner",
      },
    ],
  });

  await createActivity({
    title: "New owner property request",
    description: `${request.name} submitted ${request.propertyDetails.title}`,
    category: "owner-request",
    priority: "high",
    status: "pending",
    request,
    actorName: request.name,
    targets: await ownerManagementTargets(),
  });

  res.status(201).json({ success: true, data: request });
});

export const updateMyOwnerRequest = asyncHandler(async (req, res) => {
  const request = await OwnerApplication.findOne({ _id: req.validated.params.id, ownerUserId: req.ownerUser._id });
  if (!request) throw new ApiError(404, "Owner property request not found");
  if (request.status === "approved") throw new ApiError(403, "Approved properties cannot be edited from this form");

  const payload = buildOwnerPayload(req.validated.body, req.ownerUser, request);
  Object.assign(request, payload);
  request.statusHistory.push({
    status: "pending",
    remarks: "Owner resubmitted after changes",
    changedByName: req.ownerUser.name,
    changedByRole: "owner",
    changedAt: new Date(),
  });
  await request.save();

  await createActivity({
    title: "Owner property resubmitted",
    description: `${request.name} resubmitted ${request.propertyDetails.title}`,
    category: "owner-request",
    priority: "high",
    status: "pending",
    request,
    actorName: request.name,
    targets: await ownerManagementTargets(),
  });

  res.json({ success: true, data: request });
});

export const listOwners = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
  if (req.query.city && req.query.city !== "all") filter["propertyDetails.city"] = new RegExp(escapeRegExp(req.query.city), "i");
  if (req.query.type && req.query.type !== "all") filter["propertyDetails.type"] = new RegExp(`^${escapeRegExp(req.query.type)}$`, "i");
  if (req.query.search) {
    const pattern = new RegExp(escapeRegExp(req.query.search), "i");
    filter.$or = [
      { name: pattern },
      { email: pattern },
      { phone: pattern },
      { "propertyDetails.title": pattern },
      { "propertyDetails.city": pattern },
      { "propertyDetails.area": pattern },
      { "propertyDetails.type": pattern },
    ];
  }

  const owners = await OwnerApplication.find(filter)
    .populate("ownerUserId", "name email phone")
    .populate("reviewedBy", "name role")
    .populate("approvedPropertyId", "title propertyCode status city location")
    .sort({ createdAt: -1 });
  res.json({ success: true, data: owners });
});

export const updateOwnerStatus = asyncHandler(async (req, res) => {
  const { status, remarks } = req.validated.body;
  const owner = await OwnerApplication.findById(req.validated.params.id);
  if (!owner) throw new ApiError(404, "Owner property request not found");

  if (["rejected", "needs_changes"].includes(status) && !remarks.trim()) {
    throw new ApiError(400, "Remarks are required when rejecting or requesting changes");
  }

  let approvedPropertyId = owner.approvedPropertyId;
  if (status === "approved") {
    approvedPropertyId = await approveRequest(owner, req.user);
  }

  owner.status = status;
  owner.reviewRemarks = remarks || (status === "approved" ? "Approved and listed on website" : owner.reviewRemarks);
  owner.reviewedBy = req.user._id;
  owner.reviewedAt = new Date();
  owner.approvedPropertyId = approvedPropertyId || null;
  owner.statusHistory.push({
    status,
    remarks: owner.reviewRemarks,
    changedByName: staffName(req.user),
    changedByRole: req.user.role,
    changedAt: new Date(),
  });
  await owner.save();

  await createActivity({
    title: `Owner request ${statusLabel(status)}`,
    description: `${owner.propertyDetails.title} ${statusLabel(status)}`,
    category: status === "approved" ? "property" : "owner-request",
    priority: ["rejected", "needs_changes"].includes(status) ? "high" : "normal",
    status,
    request: owner,
    actorName: staffName(req.user),
    actorId: req.user._id,
    targets: await ownerManagementTargets(),
  });

  const populated = await OwnerApplication.findById(owner._id)
    .populate("ownerUserId", "name email phone")
    .populate("reviewedBy", "name role")
    .populate("approvedPropertyId", "title propertyCode status city location");

  res.json({ success: true, data: populated });
});
