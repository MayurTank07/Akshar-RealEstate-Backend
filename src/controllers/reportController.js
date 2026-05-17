import { Enquiry } from "../models/Enquiry.js";
import { OwnerApplication } from "../models/OwnerApplication.js";
import { Property } from "../models/Property.js";
import { Staff } from "../models/Staff.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

function toExcelHtml(rows, title) {
  const headers = rows.length ? Object.keys(rows[0]) : ["message"];
  const bodyRows = rows.length ? rows : [{ message: "No records found" }];
  const cell = (value, tag = "td") => `<${tag} style="border:1px solid #d9e2ec;padding:8px;">${String(value ?? "").replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[char])}</${tag}>`;
  return `<!doctype html><html><head><meta charset="utf-8" /></head><body><h2>${title}</h2><table><tr>${headers.map((header) => cell(header, "th")).join("")}</tr>${bodyRows
    .map((row) => `<tr>${headers.map((header) => cell(row[header])).join("")}</tr>`)
    .join("")}</table></body></html>`;
}

function toPdf(rows, title) {
  const escapePdf = (value) => String(value ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const lines = [
    "Akshar Estate CRM",
    title,
    `Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
    "",
    ...(rows.length ? rows : [{ message: "No records found" }]).flatMap((row, index) => [
      `${index + 1}. ${Object.entries(row)
        .map(([key, value]) => `${key}: ${value ?? ""}`)
        .join(" | ")}`,
    ]),
  ];
  const content = ["BT", "/F1 11 Tf", "50 790 Td", "14 TL", ...lines.slice(0, 52).map((line) => `(${escapePdf(line).slice(0, 180)}) Tj T*`), "ET"].join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`,
  ];
  let offset = "%PDF-1.4\n".length;
  const xref = ["0000000000 65535 f "];
  const body = objects
    .map((object) => {
      xref.push(`${String(offset).padStart(10, "0")} 00000 n `);
      offset += Buffer.byteLength(`${object}\n`);
      return object;
    })
    .join("\n");
  return Buffer.from(`%PDF-1.4\n${body}\nxref\n0 ${xref.length}\n${xref.join("\n")}\ntrailer << /Root 1 0 R /Size ${xref.length} >>\nstartxref\n${offset}\n%%EOF`);
}

function propertyScope(user) {
  return user.role === "admin" ? {} : { $or: [{ assignedTo: user._id }, { createdBy: user._id }] };
}

function enquiryScope(user) {
  return user.role === "admin" ? {} : { assignedTo: user._id };
}

async function buildRows(type, user) {
  if (type === "properties") {
    return (await Property.find(propertyScope(user)).populate("assignedTo", "name email").lean()).map(({ title, location, city, price, status, ownerName, type: propertyType, assignedTo, createdAt }) => ({
      title,
      location,
      city,
      price,
      status,
      ownerName,
      propertyType,
      supervisor: assignedTo?.name || "",
      createdAt: createdAt?.toISOString?.().slice(0, 10) || "",
    }));
  }

  if (type === "owners") {
    if (user.role !== "admin") return [];
    return (await OwnerApplication.find().lean()).map(({ name, email, phone, propertyCount, status }) => ({
      name,
      email,
      phone,
      propertyCount,
      status,
    }));
  }

  if (type === "analytics") {
    const [properties, enquiries, closed, active, soldRented, supervisors] = await Promise.all([
      Property.countDocuments(propertyScope(user)),
      Enquiry.countDocuments(enquiryScope(user)),
      Enquiry.countDocuments({ ...enquiryScope(user), status: "closed" }),
      Property.countDocuments({ ...propertyScope(user), status: "active" }),
      Property.countDocuments({ ...propertyScope(user), status: { $in: ["sold", "rented"] } }),
      user.role === "admin" ? Staff.countDocuments({ role: "supervisor" }) : Promise.resolve(0),
    ]);
    return [
      { metric: "Total Properties", value: properties },
      { metric: "Active Listings", value: active },
      { metric: "Sold / Rented", value: soldRented },
      { metric: "Total Enquiries", value: enquiries },
      { metric: "Closed Enquiries", value: closed },
      { metric: "Conversion Rate", value: enquiries ? `${((closed / enquiries) * 100).toFixed(1)}%` : "0%" },
      ...(user.role === "admin" ? [{ metric: "Supervisors", value: supervisors }] : []),
    ];
  }

  return (await Enquiry.find(enquiryScope(user)).populate("assignedTo", "name email").lean()).map(({ name, email, phone, propertyTitle, status, message, source, assignedTo, createdAt }) => ({
    name,
    email,
    phone,
    propertyTitle,
    status,
    source,
    message,
    supervisor: assignedTo?.name || "",
    createdAt: createdAt?.toISOString?.().slice(0, 10) || "",
  }));
}

export const exportReport = asyncHandler(async (req, res) => {
  const type = req.query.type || "enquiries";
  const format = req.query.format || "csv";
  const rows = await buildRows(type, req.user);
  const title = `${type.charAt(0).toUpperCase()}${type.slice(1)} Report`;

  if (format === "pdf") {
    const pdf = toPdf(rows, title);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${type}-report.pdf"`);
    return res.send(pdf);
  }

  if (format === "excel" || format === "xls") {
    res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${type}-report.xls"`);
    return res.send(toExcelHtml(rows, title));
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${type}-report.csv"`);
  return res.send(toCsv(rows));
});
