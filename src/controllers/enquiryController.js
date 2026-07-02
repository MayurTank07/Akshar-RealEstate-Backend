import { Activity } from "../models/Activity.js";
import { Enquiry } from "../models/Enquiry.js";
import { Property } from "../models/Property.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegExp } from "../utils/escapeRegExp.js";
import { parsePagination } from "../utils/pagination.js";
import { parseINRAmount } from "../utils/reporting.js";

const ENQUIRY_SORT_FIELDS = ["createdAt", "updatedAt", "name", "status", "source"];

function normalizeEnquiry(body) {
  const countryCode = String(body.countryCode || "+91").trim();
  const rawPhone = String(body.phone || "").trim();
  const digitPhone = rawPhone.replace(/\D/g, "");
  const normalizedPhone = rawPhone.startsWith("+") ? rawPhone : digitPhone ? `${countryCode}${digitPhone}` : rawPhone;
  return {
    ...body,
    countryCode,
    phone: normalizedPhone,
    preferredLocation: body.preferredLocation || body.location || "",
    propertyType: body.propertyType || body.type || "",
    budget: String(body.budget || ""),
    budgetAmount: body.budgetAmount || parseINRAmount(body.budgetLabel || body.budget),
    finalPriceAmount: body.finalPriceAmount || parseINRAmount(body.finalPrice),
    commissionAmount: body.commissionAmount || parseINRAmount(body.commission),
    finalPrice: body.finalPriceAmount ? String(body.finalPriceAmount) : body.finalPrice,
    commission: body.commissionAmount ? String(body.commissionAmount) : body.commission,
  };
}

async function findEnquiryProperty(body) {
  if (body.propertyId) {
    return Property.findById(body.propertyId).select("assignedTo createdBy title city location type price status");
  }

  if (body.propertyTitle) {
    return Property.findOne({ title: new RegExp(`^${body.propertyTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).select(
      "assignedTo createdBy title city location type price status"
    );
  }

  return null;
}

function activityTargets(...ids) {
  return [...new Set(ids.filter(Boolean).map((id) => id.toString()))];
}

function enquiryFilter(query, user) {
  const filter = {};
  if (query.status && query.status !== "all") filter.status = query.status;
  if (query.source && query.source !== "all") filter.source = query.source;
  if (query.conversionType && query.conversionType !== "all") {
    filter.conversionType = query.conversionType === "no-conversion" ? { $in: ["no-conversion", "", null] } : query.conversionType;
  }
  if (query.city && query.city !== "all") filter.preferredLocation = new RegExp(escapeRegExp(query.city), "i");
  if (query.propertyId && query.propertyId !== "all") filter.propertyId = query.propertyId;
  if (query.supervisorId && query.supervisorId !== "all" && user.role === "admin") filter.assignedTo = query.supervisorId;
  if (query.dateFrom || query.dateTo) {
    const createdAt = {};
    if (query.dateFrom) {
      const start = new Date(query.dateFrom);
      start.setHours(0, 0, 0, 0);
      createdAt.$gte = start;
    }
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      createdAt.$lte = end;
    }
    filter.createdAt = createdAt;
  }
  if (query.search) filter.$text = { $search: query.search };
  if (user.role === "supervisor") filter.assignedTo = user._id;
  return filter;
}

async function syncPropertyConversion(enquiry, previousConversionType, actorId) {
  const conversionType = enquiry.conversionType || "";
  const property =
    enquiry.propertyId
      ? await Property.findById(enquiry.propertyId)
      : enquiry.propertyTitle
        ? await findEnquiryProperty({ propertyTitle: enquiry.propertyTitle })
        : null;

  if (!property) return;
  if ((conversionType === "sold" || conversionType === "rented") && enquiry.status === "closed") {
    property.status = conversionType;
    property.statusUpdatedAt = enquiry.closingDate || new Date();
    property.statusUpdatedBy = actorId;
    property.finalPriceAmount = enquiry.finalPriceAmount || parseINRAmount(enquiry.finalPrice) || property.priceAmount || parseINRAmount(property.price);
    property.finalPrice = String(property.finalPriceAmount || "");
    property.commissionAmount = enquiry.commissionAmount || parseINRAmount(enquiry.commission);
    property.commission = property.commissionAmount ? String(property.commissionAmount) : "";
    property.paymentDetails = enquiry.paymentDetails || "";
    property.statusRemarks = enquiry.remarks || "";
    property.dealSource = "enquiry";
    property.dealEnquiryId = enquiry._id;
    property.dealCustomerName = enquiry.name || "";
    property.dealCustomerPhone = enquiry.phone || "";
    property.dealCustomerEmail = enquiry.email || "";
    property.dealCustomerAddress = "";
    property.dealDate = enquiry.closingDate || new Date();
    await property.save();
    return;
  }

  if ((previousConversionType === "sold" || previousConversionType === "rented") && property.status === previousConversionType) {
    property.status = "active";
    property.statusUpdatedAt = new Date();
    property.statusUpdatedBy = actorId;
    await property.save();
  }
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
    category: "enquiry",
    priority: "high",
    referenceType: "enquiry",
    referenceId: enquiry._id,
    metadata: {
      enquiryId: enquiry._id,
      propertyId: enquiry.propertyId,
      propertyName: enquiry.propertyTitle,
      customerName: enquiry.name,
      customerPhone: enquiry.phone,
      status: enquiry.status,
    },
    actorName: enquiry.name,
    targetStaffIds: activityTargets(enquiry.assignedTo),
  });
  res.status(201).json({ success: true, data: enquiry });
});

export const listEnquiries = asyncHandler(async (req, res) => {
  const filter = enquiryFilter(req.query, req.user);
  const { page, limit, skip, sort } = parsePagination(req.query, { allowedSortFields: ENQUIRY_SORT_FIELDS });
  const [enquiries, total] = await Promise.all([
    Enquiry.find(filter)
      .populate("assignedTo", "name email role")
      .populate("propertyId", "title city location type price status propertyCode")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Enquiry.countDocuments(filter),
  ]);
  res.json({ success: true, data: enquiries, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

export const updateEnquiry = asyncHandler(async (req, res) => {
  const update = normalizeEnquiry(req.validated.body);
  const note = update.note;
  delete update.note;
  if (update.closingDate === "") update.closingDate = null;
  if (update.followUpDate === "") update.followUpDate = null;

  const enquiry = await Enquiry.findById(req.validated.params.id);
  if (!enquiry) throw new ApiError(404, "Enquiry not found");
  if (req.user.role === "supervisor" && enquiry.assignedTo?.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only manage assigned enquiries");
  }

  const previousConversionType = enquiry.conversionType;
  if (update.status && update.status !== "closed") {
    update.conversionType = "";
    update.closingDate = null;
  }
  if (update.status === "closed" && !update.conversionType) {
    update.conversionType = enquiry.conversionType || "no-conversion";
  }
  if (update.conversionType && update.conversionType !== "" && !update.status) {
    update.status = "closed";
  }
  if (update.status === "closed" && !update.closingDate && !enquiry.closingDate) {
    update.closingDate = new Date();
  }
  const finalConversionType = update.conversionType ?? enquiry.conversionType;
  if (update.status === "closed" && (finalConversionType === "sold" || finalConversionType === "rented") && !String(update.finalPrice || enquiry.finalPrice || "").trim()) {
    throw new ApiError(400, "Final deal price is required when closing as sold or rented");
  }
  if (update.status === "closed" && finalConversionType === "no-conversion") {
    update.finalPrice = "";
    update.commission = "";
    update.paymentDetails = update.paymentDetails || "";
  }

  Object.assign(enquiry, update);
  if (note) {
    enquiry.notes.push({ text: note, by: req.user._id });
  }
  await enquiry.save();
  await syncPropertyConversion(enquiry, previousConversionType, req.user._id);

  await Activity.create({
    type: "Enquiry",
    title: enquiry.status === "closed" && ["sold", "rented"].includes(enquiry.conversionType) ? `Enquiry closed as ${enquiry.conversionType}` : "Enquiry updated",
    description: `${enquiry.name} marked ${enquiry.status}${enquiry.conversionType ? ` (${enquiry.conversionType})` : ""}`,
    category: ["sold", "rented"].includes(enquiry.conversionType) ? enquiry.conversionType : "enquiry",
    priority: enquiry.status === "closed" ? "high" : "normal",
    status: enquiry.status,
    referenceType: "enquiry",
    referenceId: enquiry._id,
    metadata: {
      enquiryId: enquiry._id,
      propertyId: enquiry.propertyId,
      propertyName: enquiry.propertyTitle,
      customerName: enquiry.name,
      customerPhone: enquiry.phone,
      conversionType: enquiry.conversionType,
      finalPrice: enquiry.finalPrice,
      finalPriceAmount: enquiry.finalPriceAmount,
      commission: enquiry.commission,
      commissionAmount: enquiry.commissionAmount,
    },
    actorName: req.user.name,
    actorId: req.user._id,
    targetStaffIds: activityTargets(enquiry.assignedTo),
  });

  res.json({ success: true, data: enquiry });
});

export const deleteEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.findByIdAndDelete(req.validated.params.id);
  if (!enquiry) throw new ApiError(404, "Enquiry not found");
  res.json({ success: true, data: { id: enquiry._id } });
});
