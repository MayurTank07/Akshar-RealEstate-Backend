import { Enquiry } from "../models/Enquiry.js";
import { OwnerApplication } from "../models/OwnerApplication.js";
import { Property } from "../models/Property.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

function propertyScope(user) {
  return user.role === "admin" ? {} : { $or: [{ assignedTo: user._id }, { createdBy: user._id }] };
}

function enquiryScope(user) {
  return user.role === "admin" ? {} : { assignedTo: user._id };
}

export const exportReport = asyncHandler(async (req, res) => {
  const type = req.query.type || "enquiries";
  let rows = [];

  if (type === "properties") {
    rows = (await Property.find(propertyScope(req.user)).populate("assignedTo", "name email").lean()).map(({ title, location, price, status, ownerName, type: propertyType, assignedTo }) => ({
      title,
      location,
      price,
      status,
      ownerName,
      propertyType,
      supervisor: assignedTo?.name || "",
    }));
  } else if (type === "owners") {
    if (req.user.role !== "admin") {
      rows = [];
    } else {
      rows = (await OwnerApplication.find().lean()).map(({ name, email, phone, propertyCount, status }) => ({
        name,
        email,
        phone,
        propertyCount,
        status,
      }));
    }
  } else {
    rows = (await Enquiry.find(enquiryScope(req.user)).populate("assignedTo", "name email").lean()).map(({ name, email, phone, propertyTitle, status, message, assignedTo }) => ({
      name,
      email,
      phone,
      propertyTitle,
      status,
      message,
      supervisor: assignedTo?.name || "",
    }));
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${type}-report.csv"`);
  res.send(toCsv(rows));
});
