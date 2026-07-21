import { Enquiry } from "../models/Enquiry.js";
import { OwnerApplication } from "../models/OwnerApplication.js";
import { Property } from "../models/Property.js";
import { Staff } from "../models/Staff.js";
import { buildSoldRentedRows, enquiryScope, propertyScope, summarizeSoldRentedRows } from "../services/conversionReportService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { formatCrores, parseMoneyToCrores } from "../utils/reporting.js";

const detailColumns = [
  { key: "srNo", label: "No.", width: 22 },
  { key: "propertyCode", label: "Property ID", width: 50 },
  { key: "property", label: "Property", width: 43 },
  { key: "cityLocation", label: "City/Location", width: 48 },
  { key: "propertyType", label: "Type", width: 35 },
  { key: "originalPrice", label: "Listed", width: 42 },
  { key: "finalPrice", label: "Final", width: 44 },
  { key: "commission", label: "Commission", width: 42 },
  { key: "conversionType", label: "Deal", width: 34 },
  { key: "dealSource", label: "Source", width: 34 },
  { key: "customer", label: "Customer", width: 50 },
  { key: "phone", label: "Mobile", width: 46 },
  { key: "email", label: "Email", width: 58 },
  { key: "customerAddress", label: "Address", width: 54 },
  { key: "supervisor", label: "Supervisor", width: 46 },
  { key: "closingDate", label: "Date", width: 38 },
  { key: "paymentDetails", label: "Payment", width: 52 },
  { key: "remarks", label: "Remarks", width: 54 },
];

const enquiryColumns = [
  { key: "srNo", label: "Sr No", width: 28 },
  { key: "enquiryDate", label: "Enquiry Date", width: 48 },
  { key: "customerName", label: "Customer Name", width: 55 },
  { key: "phone", label: "Phone", width: 48 },
  { key: "email", label: "Email", width: 66 },
  { key: "propertyTitle", label: "Property Title", width: 62 },
  { key: "location", label: "Location", width: 52 },
  { key: "assignedSupervisor", label: "Assigned Supervisor", width: 58 },
  { key: "status", label: "Status", width: 38 },
  { key: "message", label: "Message / Requirement", width: 74 },
  { key: "followUpDate", label: "Follow-up Date", width: 48 },
];

function safeHtml(value) {
  return String(value ?? "").replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[char]);
}

function pdfText(value) {
  return String(value ?? "")
    .replace(/₹/g, "Rs. ")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdf(value) {
  return pdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value = new Date()) {
  return new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}

function labelize(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function cleanFilePart(value) {
  return String(value || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function truncate(value, max) {
  const text = pdfText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}~`;
}

function normalizedDealRows(rows) {
  return rows.map((row, index) => ({
    srNo: index + 1,
    propertyCode: row.propertyCode || "",
    property: row.property || "General enquiry",
    cityLocation: row.cityLocation || "",
    propertyType: row.propertyType || "",
    originalPrice: row.originalPrice || "",
    finalPrice: row.finalPrice || "",
    commission: row.commission || "",
    conversionType: row.conversionType || "No Conversion",
    dealSource: row.dealSource || "",
    enquiryStatus: row.enquiryStatus || "Closed",
    customer: row.customer || "",
    phone: row.phone || "",
    email: row.email || "",
    customerAddress: row.customerAddress || "",
    supervisor: row.supervisor || "Unassigned",
    closingDate: formatDate(row.closingDate),
    paymentDetails: row.paymentDetails || "",
    remarks: row.remarks || row.paymentDetails || "",
  }));
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

function summaryFromRows(rows, totalEnquiries = rows.length) {
  const summary = rows.reduce(
    (acc, row) => {
      const conversionType = String(row.conversionType || "").toLowerCase();
      return {
        totalEnquiries,
        sold: acc.sold + (conversionType === "sold" ? 1 : 0),
        rented: acc.rented + (conversionType === "rented" ? 1 : 0),
        noConversion: acc.noConversion + (conversionType === "no conversion" || conversionType === "no-conversion" ? 1 : 0),
        finalValue: acc.finalValue + parseMoneyToCrores(row.finalPrice),
        commission: acc.commission + parseMoneyToCrores(row.commission),
      };
    },
    { totalEnquiries, sold: 0, rented: 0, noConversion: 0, finalValue: 0, commission: 0 }
  );
  return {
    "Total enquiries": summary.totalEnquiries,
    "Total sold": summary.sold,
    "Total rented": summary.rented,
    "Closed without conversion": summary.noConversion,
    "Total final deal value": formatCrores(summary.finalValue),
    "Total commission": formatCrores(summary.commission),
  };
}

async function noConversionRows(query, user) {
  const filter = {
    ...enquiryScope(user, { ...query, conversionType: "all" }, "closingDate"),
    status: "closed",
    $or: [{ conversionType: "no-conversion" }, { conversionType: "" }, { conversionType: null }, { conversionType: { $exists: false } }],
  };
  const enquiries = await Enquiry.find(filter)
    .populate("assignedTo", "name email role")
    .populate("propertyId", "title city location type price status propertyCode")
    .sort({ closingDate: -1, updatedAt: -1 })
    .lean();

  return enquiries.map((item) => ({
    id: item._id?.toString(),
    sourceType: "enquiry",
    propertyId: item.propertyId?._id?.toString?.() || item.propertyId?.toString?.() || "",
    propertyCode: item.propertyId?.propertyCode || "",
    property: item.propertyId?.title || item.propertyTitle || "General enquiry",
    cityLocation: item.propertyId?.city || item.preferredLocation || item.propertyId?.location || "",
    propertyType: item.propertyId?.type || item.propertyType || "",
    customer: item.name,
    phone: item.phone,
    email: item.email,
    supervisor: item.assignedTo?.name || "",
    supervisorId: item.assignedTo?._id?.toString?.() || item.assignedTo?.toString?.() || "",
    dealSource: "Enquiry",
    conversionType: "No Conversion",
    enquiryStatus: "Closed",
    originalPrice: item.propertyId?.price || "",
    finalPrice: "",
    commission: "",
    closingDate: item.closingDate?.toISOString?.().slice(0, 10) || item.updatedAt?.toISOString?.().slice(0, 10) || "",
    paymentDetails: item.paymentDetails || "",
    customerAddress: "",
    remarks: item.remarks || item.notes?.at(-1)?.text || "",
  }));
}

async function analyticsDealRows(query, user) {
  const includeDeals = !query.conversionType || query.conversionType === "all" || query.conversionType === "sold" || query.conversionType === "rented";
  const includeNoConversion = !query.conversionType || query.conversionType === "all" || query.conversionType === "no-conversion";
  const [dealRows, noConversion] = await Promise.all([
    includeDeals ? buildSoldRentedRows(query, user) : Promise.resolve([]),
    includeNoConversion ? noConversionRows(query, user) : Promise.resolve([]),
  ]);
  return [...dealRows, ...noConversion].sort((a, b) => String(b.closingDate).localeCompare(String(a.closingDate)));
}

async function filterMetadata(query, user, type) {
  const supervisor =
    query.supervisorId && query.supervisorId !== "all" && user.role === "admin"
      ? await Staff.findById(query.supervisorId).select("name email").lean()
      : null;
  return {
    "Role type": labelize(user.role),
    "Generated for": user.name || user.email || "",
    ...(supervisor ? { Supervisor: supervisor.name } : {}),
    "Date range": query.range === "all-time" ? "All Time" : query.range === "last-30" ? "Last 30 Days" : labelize(query.range || "this-month"),
    ...(query.city && query.city !== "all" ? { City: query.city } : {}),
    ...(query.propertyType && query.propertyType !== "all" ? { "Property type": query.propertyType } : {}),
    ...(query.source && query.source !== "all" ? { "Lead source": labelize(query.source) } : {}),
    ...(query.status && query.status !== "all" ? { Status: labelize(query.status) } : {}),
    ...(query.search ? { Search: query.search } : {}),
    ...(query.conversionType && query.conversionType !== "all" ? { Conversion: labelize(query.conversionType) } : {}),
    ...(query.dateFrom ? { "From date": query.dateFrom } : {}),
    ...(query.dateTo ? { "To date": query.dateTo } : {}),
    "Report type": type === "analytics" ? "Analytics" : type === "enquiries" ? "Enquiries" : "Sold & Rented",
  };
}

async function buildEnquiryReport(user, query = {}) {
  const enquiries = await Enquiry.find(enquiryScope(user, query))
    .populate("assignedTo", "name email role")
    .populate("propertyId", "title city location type propertyCode")
    .sort({ createdAt: -1 })
    .lean();
  const rows = enquiries.map((item, index) => ({
    srNo: index + 1,
    enquiryDate: formatDate(item.createdAt),
    customerName: item.name || "",
    phone: item.phone || "",
    email: item.email || "",
    propertyTitle: item.propertyId?.title || item.propertyTitle || "General enquiry",
    location: item.propertyId?.city || item.propertyId?.location || item.preferredLocation || "",
    assignedSupervisor: item.assignedTo?.name || "Unassigned",
    status: labelize(item.status),
    message: item.message || item.remarks || item.notes?.at(-1)?.text || "",
    followUpDate: formatDate(item.followUpDate),
  }));
  return {
    title: "Enquiries Report",
    columns: enquiryColumns,
    rows,
    summary: { "Total enquiries": rows.length },
    filters: await filterMetadata(query, user, "enquiries"),
    generatedAt: formatDateTime(),
  };
}

async function buildDealReport(type, user, query = {}) {
  const rawRows = type === "analytics" ? await analyticsDealRows(query, user) : await buildSoldRentedRows(query, user);
  const rows = normalizedDealRows(rawRows);
  const totalEnquiries = type === "analytics" ? await Enquiry.countDocuments(enquiryScope(user, query)) : rows.length;
  return {
    title: type === "analytics" ? "Analytics Report" : "Sold & Rented Report",
    rows,
    summary: summaryFromRows(rows, totalEnquiries),
    filters: await filterMetadata(query, user, type),
    generatedAt: formatDateTime(),
  };
}

async function buildSimpleRows(type, user) {
  if (type === "properties") {
    return (await Property.find(propertyScope(user)).populate("assignedTo", "name email").lean()).map(({ title, propertyCode, location, city, price, status, ownerName, ownerSellerName, type: propertyType, assignedTo, createdAt }) => ({
      propertyCode,
      title,
      location,
      city,
      price,
      status,
      ownerName: ownerSellerName || ownerName,
      propertyType,
      supervisor: assignedTo?.name || "",
      createdAt: createdAt?.toISOString?.().slice(0, 10) || "",
    }));
  }

  if (type === "owners") {
    if (user.role !== "admin") return [];
    return (await OwnerApplication.find().lean()).map(({ name, email, phone, propertyCount, status }) => ({ name, email, phone, propertyCount, status }));
  }

  return (await Enquiry.find(enquiryScope(user)).populate("assignedTo", "name email").lean()).map(({ name, email, phone, propertyTitle, status, conversionType, finalPrice, source, assignedTo, createdAt }) => ({
    name,
    email,
    phone,
    propertyTitle,
    status,
    conversionType,
    finalPrice,
    source,
    supervisor: assignedTo?.name || "",
    createdAt: createdAt?.toISOString?.().slice(0, 10) || "",
  }));
}

function renderExcel(report) {
  const columns = report.columns || detailColumns;
  const columnHtml = columns.map((column) => `<col style="width:${Math.max(70, column.width * 1.6)}px" />`).join("");
  const summaryRows = Object.entries(report.summary)
    .map(([label, value]) => `<tr><th>${safeHtml(label)}</th><td>${safeHtml(value)}</td></tr>`)
    .join("");
  const filterRows = Object.entries(report.filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([label, value]) => `<tr><th>${safeHtml(label)}</th><td>${safeHtml(value)}</td></tr>`)
    .join("");
  const detailRows = report.rows.length
    ? report.rows
        .map((row) => `<tr>${columns.map((column) => `<td>${safeHtml(row[column.key])}</td>`).join("")}</tr>`)
        .join("")
    : `<tr><td colspan="${columns.length}" class="empty">No records found</td></tr>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; }
    h1 { margin: 0 0 4px; font-size: 22px; }
    h2 { margin: 22px 0 8px; font-size: 16px; }
    .muted { color: #64748b; font-size: 12px; }
    table { border-collapse: collapse; margin-bottom: 16px; width: 100%; }
    th { background: #eaf1ff; color: #1e3a8a; font-weight: 700; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; mso-number-format:"\\@"; }
    .meta th, .summary th { width: 220px; text-align: left; }
    .summary td { font-weight: 700; }
    .detail thead th { position: sticky; top: 0; }
    .empty { text-align: center; color: #64748b; padding: 20px; }
  </style>
</head>
<body>
  <h1>Akshar Estate CRM</h1>
  <div class="muted">${safeHtml(report.title)} • Generated ${safeHtml(report.generatedAt)}</div>
  <h2>Selected Filters</h2>
  <table class="meta">${filterRows}</table>
  <h2>Summary</h2>
  <table class="summary">${summaryRows}</table>
  <h2>Detailed Table</h2>
  <table class="detail">
    <colgroup>${columnHtml}</colgroup>
    <thead><tr>${columns.map((column) => `<th>${safeHtml(column.label)}</th>`).join("")}</tr></thead>
    <tbody>${detailRows}</tbody>
  </table>
</body>
</html>`;
}

function text(commands, value, x, y, size = 8) {
  commands.push(`BT /F1 ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET`);
}

function rect(commands, x, y, width, height, stroke = true, fill = false) {
  if (fill) commands.push(`${x} ${y} ${width} ${height} re f`);
  if (stroke) commands.push(`${x} ${y} ${width} ${height} re S`);
}

function renderPdf(report) {
  const columns = report.columns || detailColumns;
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 24;
  const rowHeight = 24;
  const headerHeight = 22;
  const top = 560;
  const bottom = 34;
  const pages = [];
  let rowIndex = 0;
  const rows = report.rows.length ? report.rows : [{ srNo: "", property: "No records found" }];

  while (rowIndex < rows.length || pages.length === 0) {
    const commands = ["0.96 0.98 1 rg", `0 0 ${pageWidth} ${pageHeight} re f`, "0 0 0 rg", "0.82 0.88 0.96 RG"];
    text(commands, "Akshar Estate CRM", margin, top, 14);
    text(commands, report.title, margin, top - 18, 11);
    text(commands, `Generated: ${report.generatedAt}`, margin, top - 33, 8);

    const metaText = Object.entries(report.filters)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([label, value]) => `${label}: ${value}`)
      .join("   ");
    text(commands, truncate(metaText, 150), margin, top - 48, 7);

    const summary = Object.entries(report.summary);
    const cardWidth = 125;
    summary.forEach(([label, value], index) => {
      const x = margin + (index % 3) * (cardWidth + 10);
      const y = top - 88 - Math.floor(index / 3) * 42;
      commands.push("1 1 1 rg");
      rect(commands, x, y, cardWidth, 34, true, true);
      commands.push("0 0 0 rg");
      text(commands, truncate(label, 24), x + 6, y + 21, 6.5);
      text(commands, truncate(value, 20), x + 6, y + 8, 8.5);
    });

    let y = top - 158;
    commands.push("0.90 0.94 1 rg");
    let x = margin;
    columns.forEach((column) => {
      rect(commands, x, y, column.width, headerHeight, true, true);
      x += column.width;
    });
    commands.push("0 0 0 rg");
    x = margin;
    columns.forEach((column) => {
      text(commands, truncate(column.label, Math.floor(column.width / 4.2)), x + 3, y + 8, 5.4);
      x += column.width;
    });
    y -= rowHeight;

    while (rowIndex < rows.length && y > bottom) {
      x = margin;
      const row = rows[rowIndex];
      commands.push(rowIndex % 2 === 0 ? "1 1 1 rg" : "0.97 0.98 1 rg");
      columns.forEach((column) => {
        rect(commands, x, y, column.width, rowHeight, true, true);
        x += column.width;
      });
      commands.push("0 0 0 rg");
      x = margin;
      columns.forEach((column) => {
        text(commands, truncate(row[column.key], Math.floor(column.width / 3.8)), x + 3, y + 10, 5.2);
        x += column.width;
      });
      y -= rowHeight;
      rowIndex += 1;
    }

    pages.push(commands);
  }

  pages.forEach((commands, index) => {
    text(commands, `Page ${index + 1} of ${pages.length}`, pageWidth - 92, 18, 7);
  });

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    `2 0 obj << /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >> endobj`,
    "3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];
  pages.forEach((commands, index) => {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    const content = commands.join("\n");
    objects.push(`${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >> endobj`);
    objects.push(`${contentId} 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`);
  });

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

export const listSoldRentedReports = asyncHandler(async (req, res) => {
  const rows = await buildSoldRentedRows(req.query, req.user);
  res.json({
    success: true,
    data: {
      rows,
      totals: summarizeSoldRentedRows(rows),
    },
  });
});

export const exportReport = asyncHandler(async (req, res) => {
  const type = req.query.type || "enquiries";
  const format = req.query.format || "csv";
  const date = new Date().toISOString().slice(0, 10);

  if (type === "analytics" || type === "sold-rented" || type === "enquiries") {
    const report = type === "enquiries" ? await buildEnquiryReport(req.user, req.query) : await buildDealReport(type, req.user, req.query);
    const filename = `${cleanFilePart(type)}-report-${date}`;

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
      return res.send(renderPdf(report));
    }

    if (format === "excel" || format === "xls") {
      res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.xls"`);
      return res.send(renderExcel(report));
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    return res.send(toCsv(report.rows));
  }

  const rows = await buildSimpleRows(type, req.user);
  const title = `${type.split("-").map((item) => item.charAt(0).toUpperCase() + item.slice(1)).join(" ")} Report`;
  const report = {
    title,
    rows,
    summary: { Records: rows.length },
    filters: await filterMetadata(req.query, req.user, type),
    generatedAt: formatDateTime(),
  };
  const filename = `${cleanFilePart(type)}-report-${date}`;

  if (format === "pdf") {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
    return res.send(renderPdf({ ...report, rows: normalizedDealRows(rows) }));
  }

  if (format === "excel" || format === "xls") {
    res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.xls"`);
    return res.send(renderExcel({ ...report, rows: normalizedDealRows(rows) }));
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
  return res.send(toCsv(rows));
});
