import { PERMISSIONS } from "../config/permissions.js";
import { Activity } from "../models/Activity.js";
import { OwnerApplication } from "../models/OwnerApplication.js";
import { Property } from "../models/Property.js";
import { Staff } from "../models/Staff.js";
import { generatePropertyCode, syncPropertyCodeCounter } from "../services/propertyCodeService.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegExp } from "../utils/escapeRegExp.js";
import { parsePagination } from "../utils/pagination.js";

const OWNER_SORT_FIELDS = ["createdAt", "updatedAt", "name", "status"];

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
      ownerProofs: media.ownerProofs || [],
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
      deleteStatus: request.deleteStatus,
      deleteReason: request.deleteReason,
      approvedPropertyId: request.approvedPropertyId,
    },
    actorName,
    actorId,
    targetStaffIds: targets,
  });
}

function mapRequestToProperty(request, reviewer) {
  const details = request.propertyDetails || {};
  const photos = request.media?.photos || [];
  const firstPhoto = photos[0];
  if (!firstPhoto) throw new ApiError(422, "At least one uploaded property photo is required before approving this owner listing.");
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
    measurement: { value: sizeValue, unit: details.areaUnit || "sqft" },
    status: "active",
    propertyStatus: details.availability || "Ready",
    availability: details.availability || "Available",
    visibility: "public",
    ownerName: request.name,
    image: firstPhoto,
    gallery: photos,
    videoUrl: request.media?.videos?.[0] || "",
    description: details.description,
    nearbyLandmarks: details.nearbyLandmarks || "",
    amenities: details.amenities || [],
    parking: details.parking || "",
    floorNumber: details.floorNumber || "",
    totalFloors: details.totalFloors || "",
    furnishing: details.furnishing || "",
    ageOfProperty: details.ageOfProperty || "",
    yearBuilt: details.constructionYear || null,
    facing: details.facing || "",
    contact: {
      name: staffName(reviewer),
      phone: reviewer.phone || "",
      email: reviewer.email || "",
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
    assignedTo: reviewer._id,
    createdBy: reviewer._id,
    updatedBy: reviewer._id,
  };
}

async function approveRequest(request, reviewer) {
  if (request.approvedPropertyId) return request.approvedPropertyId;

  const lockedRequest = await OwnerApplication.findOneAndUpdate(
    { _id: request._id, approvedPropertyId: null, approvalInProgress: { $ne: true } },
    { $set: { approvalInProgress: true } },
    { new: true }
  );

  if (!lockedRequest) {
    const latest = await OwnerApplication.findById(request._id).select("approvedPropertyId approvalInProgress");
    if (latest?.approvedPropertyId) return latest.approvedPropertyId;
    throw new ApiError(409, "This owner request is already being approved. Please refresh and try again.");
  }

  try {
    const propertyBody = mapRequestToProperty(lockedRequest, reviewer);
    propertyBody.propertyCode = await generatePropertyCode(propertyBody.city || propertyBody.location);
    const property = await Property.create(propertyBody);
    await syncPropertyCodeCounter(property.propertyCode);
    await OwnerApplication.updateOne(
      { _id: lockedRequest._id },
      { $set: { approvedPropertyId: property._id, approvalInProgress: false } }
    );
    return property._id;
  } catch (error) {
    await OwnerApplication.updateOne({ _id: lockedRequest._id }, { $set: { approvalInProgress: false } });
    throw error;
  }
}

export const listMyOwnerRequests = asyncHandler(async (req, res) => {
  const requests = await OwnerApplication.find({ ownerUserId: req.ownerUser._id })
    .populate("approvedPropertyId", "title propertyCode status visibility city location image")
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
  if (request.approvalInProgress) throw new ApiError(409, "This property is currently under approval review. Please try again shortly.");

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

export const deleteMyOwnerRequest = asyncHandler(async (req, res) => {
  const request = await OwnerApplication.findOne({ _id: req.validated.params.id, ownerUserId: req.ownerUser._id }).populate("approvedPropertyId", "status title");
  if (!request) throw new ApiError(404, "Owner property request not found");
  if (request.approvalInProgress) throw new ApiError(409, "This property is currently under approval review. Please try again shortly.");
  if (request.approvedPropertyId?.status === "sold") {
    throw new ApiError(400, "This property has already been sold and cannot be deleted.");
  }
  if (request.status !== "pending" || request.approvedPropertyId) {
    throw new ApiError(400, "Only pending owner submissions can be deleted directly. Request deletion for approved/live properties.");
  }

  await createActivity({
    title: "Owner deleted pending property",
    description: `${request.name} deleted ${request.propertyDetails.title}`,
    category: "owner-delete",
    priority: "normal",
    status: "deleted",
    request,
    actorName: request.name,
    targets: await ownerManagementTargets(),
  });

  await request.deleteOne();
  res.json({ success: true, data: { id: req.validated.params.id, deleted: true } });
});

export const deleteOwnerRequest = asyncHandler(async (req, res) => {
  const request = await OwnerApplication.findById(req.validated.params.id).populate("approvedPropertyId", "status title visibility");
  if (!request) throw new ApiError(404, "Owner property request not found");
  if (request.approvalInProgress) throw new ApiError(409, "This property is currently under approval review. Please try again shortly.");

  const linkedProperty = request.approvedPropertyId ? await Property.findById(request.approvedPropertyId._id) : null;
  let propertyAction = "none";
  if (linkedProperty) {
    if (["sold", "rented"].includes(linkedProperty.status)) {
      linkedProperty.visibility = "private";
      linkedProperty.deletedAt = new Date();
      linkedProperty.deletedBy = req.user._id;
      linkedProperty.updatedBy = req.user._id;
      await linkedProperty.save();
      propertyAction = "archived";
    } else {
      await linkedProperty.deleteOne();
      propertyAction = "deleted";
    }
  }

  await createActivity({
    title: "Owner request deleted",
    description: `${request.name} deleted ${request.propertyDetails?.title || "owner property request"}`,
    category: "owner-delete",
    priority: "high",
    status: "deleted",
    request,
    actorName: req.user.name,
    actorId: req.user._id,
    targets: await ownerManagementTargets(),
  });

  await request.deleteOne();
  res.json({ success: true, data: { id: req.validated.params.id, deleted: true, propertyAction } });
});

export const requestOwnerPropertyDelete = asyncHandler(async (req, res) => {
  const { reason } = req.validated.body;
  const request = await OwnerApplication.findOne({ _id: req.validated.params.id, ownerUserId: req.ownerUser._id }).populate("approvedPropertyId", "status visibility title");
  if (!request) throw new ApiError(404, "Owner property request not found");
  if (request.approvalInProgress) throw new ApiError(409, "This property is currently under approval review. Please try again shortly.");
  if (request.approvedPropertyId?.status === "sold") {
    throw new ApiError(400, "This property has already been sold and cannot be deleted.");
  }
  if (request.status !== "approved" || !request.approvedPropertyId) {
    throw new ApiError(400, "Only approved/live properties can use the delete request flow.");
  }
  if (request.deleteStatus === "pending") {
    throw new ApiError(409, "A delete request is already waiting for review.");
  }
  if (request.deleteStatus === "approved" || request.approvedPropertyId.visibility === "private") {
    throw new ApiError(400, "This property has already been removed from public listings.");
  }

  request.deleteStatus = "pending";
  request.deleteReason = reason;
  request.deleteRequestedAt = new Date();
  request.deleteReviewedBy = null;
  request.deleteReviewedAt = null;
  request.deleteReviewRemarks = "";
  request.statusHistory.push({
    status: "delete_requested",
    remarks: reason,
    changedByName: req.ownerUser.name,
    changedByRole: "owner",
    changedAt: new Date(),
  });
  await request.save();

  await createActivity({
    title: "Owner requested property delete",
    description: `${request.name} requested deletion for ${request.propertyDetails.title}`,
    category: "owner-delete",
    priority: "high",
    status: "delete_requested",
    request,
    actorName: request.name,
    targets: await ownerManagementTargets(),
  });

  const populated = await OwnerApplication.findById(request._id).populate("approvedPropertyId", "title propertyCode status visibility city location image");
  res.json({ success: true, data: populated });
});

export const listOwners = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.deleteStatus && req.query.deleteStatus !== "all") filter.deleteStatus = req.query.deleteStatus;
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

  const { page, limit, skip, sort } = parsePagination(req.query, { allowedSortFields: OWNER_SORT_FIELDS });
  const [owners, total] = await Promise.all([
    OwnerApplication.find(filter)
      .populate("ownerUserId", "name email phone")
      .populate("reviewedBy", "name role phone email designation avatar")
      .populate("deleteReviewedBy", "name role")
      .populate("approvedPropertyId", "title propertyCode status visibility city location")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    OwnerApplication.countDocuments(filter),
  ]);
  res.json({ success: true, data: owners, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

export const updateOwnerContent = asyncHandler(async (req, res) => {
  const owner = await OwnerApplication.findById(req.validated.params.id);
  if (!owner) throw new ApiError(404, "Owner property request not found");
  if (owner.approvalInProgress) throw new ApiError(409, "This property is currently under approval review.");

  const { ownerDetails, propertyDetails, media } = req.validated.body;
  if (ownerDetails) {
    if (ownerDetails.name !== undefined) owner.name = ownerDetails.name;
    if (ownerDetails.email !== undefined) owner.email = ownerDetails.email.toLowerCase();
    if (ownerDetails.phone !== undefined) owner.phone = ownerDetails.phone;
    if (ownerDetails.alternatePhone !== undefined) owner.alternatePhone = ownerDetails.alternatePhone;
    if (ownerDetails.ownershipType !== undefined) owner.ownershipType = ownerDetails.ownershipType;
  }
  if (propertyDetails) Object.assign(owner.propertyDetails, propertyDetails);
  if (media) {
    if (media.photos !== undefined) owner.media.photos = media.photos;
    if (media.videos !== undefined) owner.media.videos = media.videos;
    if (media.documents !== undefined) owner.media.documents = media.documents;
  }
  owner.statusHistory.push({
    status: "content_updated",
    remarks: "Submission content updated internally",
    changedByName: staffName(req.user),
    changedByRole: req.user.role,
    changedAt: new Date(),
  });
  await owner.save();

  if (owner.approvedPropertyId) {
    const property = await Property.findById(owner.approvedPropertyId);
    const approvingStaff = await Staff.findById(owner.reviewedBy || property?.assignedTo || property?.createdBy);
    if (property && approvingStaff) {
      const mapped = mapRequestToProperty(owner, approvingStaff);
      const editableKeys = [
        "title", "location", "city", "area", "type", "dealType", "price", "priceAmount", "beds", "sqft", "measurement",
        "propertyStatus", "availability", "image", "gallery", "videoUrl", "description", "nearbyLandmarks", "amenities", "parking", "floorNumber",
        "totalFloors", "furnishing", "ageOfProperty", "yearBuilt", "facing", "map",
      ];
      editableKeys.forEach((key) => {
        property[key] = mapped[key];
      });
      property.updatedBy = req.user._id;
      await property.save();
    }
  }

  const populated = await OwnerApplication.findById(owner._id)
    .populate("ownerUserId", "name email phone")
    .populate("reviewedBy", "name role phone email designation avatar")
    .populate("deleteReviewedBy", "name role")
    .populate("approvedPropertyId", "title propertyCode status visibility city location");
  res.json({ success: true, data: populated });
});

export const updateOwnerStatus = asyncHandler(async (req, res) => {
  const { status, remarks } = req.validated.body;
  const owner = await OwnerApplication.findById(req.validated.params.id);
  if (!owner) throw new ApiError(404, "Owner property request not found");

  if (["rejected", "needs_changes"].includes(status) && !remarks.trim()) {
    throw new ApiError(400, "Remarks are required when rejecting or requesting changes");
  }
  if (owner.status === "approved" && status !== "approved") {
    throw new ApiError(400, "Approved owner requests cannot be moved back from this screen. Update the listed property instead.");
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
  owner.approvalInProgress = false;
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
    .populate("reviewedBy", "name role phone email designation avatar")
    .populate("deleteReviewedBy", "name role")
    .populate("approvedPropertyId", "title propertyCode status visibility city location");

  res.json({ success: true, data: populated });
});

export const reviewOwnerDeleteRequest = asyncHandler(async (req, res) => {
  const { deleteStatus, remarks } = req.validated.body;
  const owner = await OwnerApplication.findById(req.validated.params.id).populate("approvedPropertyId");
  if (!owner) throw new ApiError(404, "Owner property request not found");
  if (owner.deleteStatus !== "pending") throw new ApiError(400, "There is no pending delete request for this owner property.");
  if (deleteStatus === "rejected" && !remarks.trim()) throw new ApiError(400, "Remarks are required when rejecting a delete request.");
  if (!owner.approvedPropertyId) throw new ApiError(404, "Approved linked property not found");
  if (owner.approvedPropertyId.status === "sold") {
    throw new ApiError(400, "This property has already been sold and cannot be deleted.");
  }

  if (deleteStatus === "approved") {
    owner.approvedPropertyId.visibility = "private";
    owner.approvedPropertyId.status = "inactive";
    owner.approvedPropertyId.statusUpdatedAt = new Date();
    owner.approvedPropertyId.statusUpdatedBy = req.user._id;
    owner.approvedPropertyId.statusRemarks = remarks || "Owner delete request approved";
    owner.approvedPropertyId.updatedBy = req.user._id;
    await owner.approvedPropertyId.save();
  }

  owner.deleteStatus = deleteStatus;
  owner.deleteReviewRemarks = remarks || (deleteStatus === "approved" ? "Delete request approved and listing removed from website" : "");
  owner.deleteReviewedBy = req.user._id;
  owner.deleteReviewedAt = new Date();
  owner.statusHistory.push({
    status: `delete_${deleteStatus}`,
    remarks: owner.deleteReviewRemarks || owner.deleteReason,
    changedByName: staffName(req.user),
    changedByRole: req.user.role,
    changedAt: new Date(),
  });
  await owner.save();

  await createActivity({
    title: `Owner delete request ${deleteStatus}`,
    description: `${owner.propertyDetails.title} delete request ${deleteStatus}`,
    category: "owner-delete",
    priority: deleteStatus === "approved" ? "high" : "normal",
    status: `delete_${deleteStatus}`,
    request: owner,
    actorName: staffName(req.user),
    actorId: req.user._id,
    targets: await ownerManagementTargets(),
  });

  const populated = await OwnerApplication.findById(owner._id)
    .populate("ownerUserId", "name email phone")
    .populate("reviewedBy", "name role phone email designation avatar")
    .populate("deleteReviewedBy", "name role")
    .populate("approvedPropertyId", "title propertyCode status visibility city location");

  res.json({ success: true, data: populated });
});
