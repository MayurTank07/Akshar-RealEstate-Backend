import mongoose from "mongoose";
import { Enquiry } from "../models/Enquiry.js";
import { Property } from "../models/Property.js";
import { dateMatch, formatCrores, formatINR, getDateRange, parseINRAmount, parseMoneyToCrores } from "../utils/reporting.js";

export const CONVERSION_STATUSES = ["sold", "rented"];

export function objectId(value) {
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

export function propertyScope(user, query = {}) {
  const filter = user.role === "admin" ? {} : { $or: [{ assignedTo: user._id }, { createdBy: user._id }] };
  if (String(query.includeDeleted || "").toLowerCase() !== "true") filter.deletedAt = null;
  if (query.supervisorId && query.supervisorId !== "all" && user.role === "admin") {
    const supervisorId = objectId(query.supervisorId);
    if (supervisorId) filter.$or = [{ assignedTo: supervisorId }, { createdBy: supervisorId }];
  }
  if (query.city && query.city !== "all") filter.city = new RegExp(query.city, "i");
  if (query.propertyType && query.propertyType !== "all") filter.type = new RegExp(`^${query.propertyType}$`, "i");
  return filter;
}

export function enquiryScope(user, query = {}, dateField = "createdAt") {
  const filter = user.role === "admin" ? {} : { assignedTo: user._id };
  if (query.supervisorId && query.supervisorId !== "all" && user.role === "admin") {
    const supervisorId = objectId(query.supervisorId);
    if (supervisorId) filter.assignedTo = supervisorId;
  }
  if (query.city && query.city !== "all") filter.preferredLocation = new RegExp(query.city, "i");
  if (query.propertyType && query.propertyType !== "all") filter.propertyType = new RegExp(`^${query.propertyType}$`, "i");
  if (query.propertyId && query.propertyId !== "all") {
    const propertyId = objectId(query.propertyId);
    if (propertyId) filter.propertyId = propertyId;
  }
  if (query.source && query.source !== "all") filter.source = query.source;
  if (query.conversionType && query.conversionType !== "all") {
    filter.conversionType = query.conversionType === "no-conversion" ? { $in: ["no-conversion", "", null] } : query.conversionType;
  }
  if (query.status && query.status !== "all") filter.status = query.status;
  if (query.search) filter.$text = { $search: query.search };
  const hasSpecificDateRange = query.dateFrom || query.dateTo;
  const hasNamedRange = query.range && query.range !== "custom" && query.range !== "all-time" && query.range !== "all";
  if (hasSpecificDateRange || hasNamedRange) {
    Object.assign(filter, dateMatch(dateField, query));
  }
  return filter;
}

function propertyDateInRange(property, query = {}) {
  if (!query.range && !query.dateFrom && !query.dateTo) return true;
  const { start, end } = getDateRange(query);
  if (!property.statusUpdatedAt) return true;
  const date = property.statusUpdatedAt || property.updatedAt || property.createdAt;
  if (!date) return true;
  const time = new Date(date).getTime();
  return time >= start.getTime() && time <= end.getTime();
}

function matchesSearch(row, search) {
  if (!search) return true;
  const haystack = [row.property, row.cityLocation, row.customer, row.phone, row.email, row.supervisor, row.remarks].join(" ").toLowerCase();
  return haystack.includes(String(search).toLowerCase());
}

function enquiryRow(item) {
  return {
    id: item._id?.toString(),
    sourceType: "enquiry",
    propertyId: item.propertyId?._id?.toString?.() || item.propertyId?.toString?.() || "",
    propertyCode: item.propertyId?.propertyCode || "",
    property: item.propertyId?.title || item.propertyTitle || "General enquiry",
    image: item.propertyId?.image || "",
    gallery: item.propertyId?.gallery || [],
    cityLocation: item.propertyId?.city || item.preferredLocation || item.propertyId?.location || "",
    propertyType: item.propertyId?.type || item.propertyType || "",
    category: item.propertyId?.category || "",
    propertyStatus: item.propertyId?.status || "",
    customer: item.name,
    phone: item.phone,
    email: item.email,
    supervisor: item.assignedTo?.name || "",
    supervisorId: item.assignedTo?._id?.toString?.() || item.assignedTo?.toString?.() || "",
    dealSource: "Enquiry",
    conversionType: item.conversionType === "sold" ? "Sold" : "Rented",
    enquiryStatus: "Closed",
    originalPriceAmount: item.propertyId?.priceAmount || parseINRAmount(item.propertyId?.price),
    finalPriceAmount: item.finalPriceAmount || parseINRAmount(item.finalPrice) || item.propertyId?.finalPriceAmount || parseINRAmount(item.propertyId?.finalPrice) || item.propertyId?.priceAmount || parseINRAmount(item.propertyId?.price),
    commissionAmount: item.commissionAmount || parseINRAmount(item.commission) || item.propertyId?.commissionAmount || parseINRAmount(item.propertyId?.commission),
    originalPrice: formatINR(item.propertyId?.priceAmount || item.propertyId?.price || 0),
    finalPrice: formatINR(item.finalPriceAmount || item.finalPrice || item.propertyId?.finalPriceAmount || item.propertyId?.finalPrice || item.propertyId?.priceAmount || item.propertyId?.price || 0),
    commission: formatINR(item.commissionAmount || item.commission || item.propertyId?.commissionAmount || item.propertyId?.commission || 0),
    closingDate: item.closingDate?.toISOString?.().slice(0, 10) || item.updatedAt?.toISOString?.().slice(0, 10) || "",
    paymentDetails: item.paymentDetails || item.propertyId?.paymentDetails || "",
    customerAddress: "",
    remarks: item.remarks || item.notes?.at(-1)?.text || "",
  };
}

function propertyRow(item) {
  return {
    id: item._id?.toString(),
    sourceType: "property",
    propertyId: item._id?.toString(),
    propertyCode: item.propertyCode || "",
    property: item.title,
    image: item.image || "",
    gallery: item.gallery || [],
    cityLocation: item.city || item.location || "",
    propertyType: item.type || "",
    category: item.category || "",
    propertyStatus: item.status || "",
    customer: item.dealCustomerName || item.contact?.name || item.ownerName || "Direct property status",
    phone: item.dealCustomerPhone || item.contact?.phone || "",
    email: item.dealCustomerEmail || item.contact?.email || "",
    supervisor: item.assignedTo?.name || item.createdBy?.name || "",
    supervisorId: item.assignedTo?._id?.toString?.() || item.createdBy?._id?.toString?.() || "",
    dealSource: item.dealSource === "enquiry" ? "Enquiry" : "Manual",
    conversionType: item.status === "sold" ? "Sold" : "Rented",
    enquiryStatus: "Property Status",
    originalPriceAmount: item.priceAmount || parseINRAmount(item.price),
    finalPriceAmount: item.finalPriceAmount || parseINRAmount(item.finalPrice) || item.priceAmount || parseINRAmount(item.price),
    commissionAmount: item.commissionAmount || parseINRAmount(item.commission),
    originalPrice: formatINR(item.priceAmount || item.price || 0),
    finalPrice: formatINR(item.finalPriceAmount || item.finalPrice || item.priceAmount || item.price || 0),
    commission: formatINR(item.commissionAmount || item.commission || 0),
    closingDate: item.dealDate?.toISOString?.().slice(0, 10) || item.statusUpdatedAt?.toISOString?.().slice(0, 10) || item.updatedAt?.toISOString?.().slice(0, 10) || "",
    paymentDetails: item.paymentDetails || "",
    customerAddress: item.dealCustomerAddress || "",
    remarks: item.statusRemarks || "",
  };
}

export async function buildSoldRentedRows(query = {}, user) {
  const conversionType = query.conversionType && query.conversionType !== "all" ? query.conversionType : { $in: CONVERSION_STATUSES };
  const enquiryFilter = {
    ...enquiryScope(user, { ...query, conversionType: "all" }, "closingDate"),
    status: "closed",
    conversionType,
  };
  const propertyFilter = {
    ...propertyScope(user, query),
    status: conversionType,
  };
  if (query.propertyId && query.propertyId !== "all") {
    const propertyId = objectId(query.propertyId);
    if (propertyId) propertyFilter._id = propertyId;
  }

  const [enquiries, properties] = await Promise.all([
    Enquiry.find(enquiryFilter)
      .populate("assignedTo", "name email role")
      .populate("propertyId", "title city location type category price priceAmount status propertyCode finalPrice finalPriceAmount commission commissionAmount paymentDetails statusRemarks image gallery")
      .sort({ closingDate: -1, updatedAt: -1 })
      .lean(),
    Property.find(propertyFilter)
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .populate("statusUpdatedBy", "name email role")
      .sort({ statusUpdatedAt: -1, updatedAt: -1 })
      .lean(),
  ]);

  const rows = enquiries.map(enquiryRow);
  const convertedPropertyIds = new Set(rows.map((row) => row.propertyId).filter(Boolean));
  properties
    .filter((property) => propertyDateInRange(property, query))
    .filter((property) => !convertedPropertyIds.has(property._id.toString()))
    .map(propertyRow)
    .forEach((row) => rows.push(row));

  return rows
    .filter((row) => matchesSearch(row, query.search))
    .sort((a, b) => String(b.closingDate).localeCompare(String(a.closingDate)));
}

export function summarizeSoldRentedRows(rows) {
  const totals = rows.reduce(
    (acc, row) => ({
      sold: acc.sold + (row.conversionType === "Sold" ? 1 : 0),
      rented: acc.rented + (row.conversionType === "Rented" ? 1 : 0),
      revenue: acc.revenue + parseMoneyToCrores(row.finalPriceAmount || row.finalPrice),
      commission: acc.commission + parseMoneyToCrores(row.commissionAmount || row.commission),
    }),
    { sold: 0, rented: 0, revenue: 0, commission: 0 }
  );
  return {
    ...totals,
    revenueLabel: formatCrores(totals.revenue),
    commissionLabel: formatCrores(totals.commission),
  };
}
