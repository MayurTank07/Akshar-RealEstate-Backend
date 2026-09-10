import { formatINR } from "../utils/formatINR.js";

function plainObject(value) {
  return typeof value?.toObject === "function" ? value.toObject() : value || {};
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizePhone(value = "") {
  return String(value || "").replace(/[^\d+]/g, "");
}

function displayValue(value, fallback = "-") {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function formatDateTime(value = new Date()) {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function propertyUrl(property, siteOrigin) {
  const key = property.slug || property._id || property.id;
  if (!key) return "";
  return `${String(siteOrigin || "https://www.aksharestate.in").replace(/\/$/, "")}/property/${encodeURIComponent(String(key))}`;
}

function detailRow(label, value) {
  return `
    <tr>
      <td style="padding:10px 0;color:#64748b;font-size:13px;font-weight:700;width:38%;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;color:#0f172a;font-size:14px;font-weight:800;">${escapeHtml(displayValue(value))}</td>
    </tr>
  `;
}

function cta(label, href, background = "#2563eb", color = "#ffffff") {
  if (!href) return "";
  return `
    <a href="${escapeHtml(href)}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 16px;border-radius:12px;background:${background};color:${color};font-size:13px;font-weight:800;text-decoration:none;">
      ${escapeHtml(label)}
    </a>
  `;
}

export function buildPropertyEnquiryEmail({ supervisor, property, enquiry, siteOrigin }) {
  const staff = plainObject(supervisor);
  const listing = plainObject(property);
  const lead = plainObject(enquiry);
  const phone = normalizePhone(lead.phone);
  const cleanPhoneForWhatsapp = phone.replace(/^\+/, "");
  const url = propertyUrl(listing, siteOrigin);
  const propertyId = listing.propertyCode || listing._id || "Property";
  const purpose = listing.listingType || listing.dealType || "Sale / Rent";
  const bhk = Number(listing.bhk || listing.beds || 0);
  const area = listing.area || (listing.measurement?.value ? `${listing.measurement.value} ${listing.measurement.unit || ""}` : "");
  const price = listing.priceAmount ? formatINR(listing.priceAmount) : listing.price;
  const message = displayValue(lead.message, "Customer requested a broker callback.");
  const subject = `New Property Enquiry | Akshar Estate : The Property Hub | ${propertyId}`;

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0;background:#f4f7fb;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <div style="max-width:680px;margin:0 auto;border-radius:24px;overflow:hidden;background:#ffffff;box-shadow:0 24px 70px rgba(15,23,42,0.12);">
          <div style="background:#0f3ea8;padding:28px 30px;color:#ffffff;">
            <div style="font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.86;">Akshar Estate : The Property Hub</div>
            <h1 style="margin:12px 0 0;font-size:26px;line-height:1.25;">New property enquiry received</h1>
            <p style="margin:10px 0 0;color:#dbeafe;font-size:15px;line-height:1.6;">A customer has requested a callback for a property associated with you.</p>
          </div>

          <div style="padding:28px 30px;">
            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">Hello <strong>${escapeHtml(displayValue(staff.name, "Property Supervisor"))}</strong>,</p>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.7;">
              You have received a new enquiry for a property listed on <strong>Akshar Estate : The Property Hub</strong>. Please contact the customer as soon as possible.
            </p>

            <div style="border:1px solid #e2e8f0;border-radius:18px;padding:20px;margin-bottom:20px;">
              <h2 style="margin:0 0 8px;font-size:18px;">Property Details</h2>
              <table role="presentation" style="width:100%;border-collapse:collapse;">
                ${detailRow("Property ID", propertyId)}
                ${detailRow("Property Title", listing.title)}
                ${detailRow("Property Type", listing.propertyType || listing.type)}
                ${detailRow("BHK", bhk ? `${bhk} BHK` : "-")}
                ${detailRow("Purpose", purpose)}
                ${detailRow("Price", price)}
                ${detailRow("Location", listing.location)}
                ${detailRow("Area / Locality", area)}
                ${detailRow("City", listing.city)}
              </table>
              ${cta("View Property", url)}
            </div>

            <div style="border:1px solid #dbeafe;border-radius:18px;background:#eff6ff;padding:20px;margin-bottom:20px;">
              <h2 style="margin:0 0 8px;font-size:18px;">Customer Enquiry</h2>
              <table role="presentation" style="width:100%;border-collapse:collapse;">
                ${detailRow("Customer Name", lead.name)}
                ${detailRow("Phone Number", lead.phone)}
                ${detailRow("Email Address", lead.email)}
                ${detailRow("Message", message)}
                ${detailRow("Date & Time", formatDateTime(lead.createdAt || new Date()))}
              </table>
              <div style="margin-top:8px;">
                ${cta("Call Customer", phone ? `tel:${phone}` : "")}
                ${cta("Email Customer", lead.email ? `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(`Regarding your enquiry for ${listing.title || "Akshar Estate property"}`)}` : "", "#ffffff", "#2563eb")}
                ${cta("WhatsApp Customer", cleanPhoneForWhatsapp ? `https://wa.me/${cleanPhoneForWhatsapp}?text=${encodeURIComponent(`Hello ${lead.name || ""}, thank you for your enquiry on Akshar Estate : The Property Hub.`)}` : "", "#16a34a")}
              </div>
            </div>

            <p style="margin:0;color:#475569;font-size:15px;line-height:1.7;">Regards,<br><strong>Akshar Estate : The Property Hub</strong></p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = [
    "Akshar Estate : The Property Hub",
    "",
    `Hello ${displayValue(staff.name, "Property Supervisor")},`,
    "You have received a new enquiry for a property you listed on Akshar Estate : The Property Hub.",
    "",
    "Property Details",
    `Property ID: ${displayValue(propertyId)}`,
    `Property Title: ${displayValue(listing.title)}`,
    `Property Type: ${displayValue(listing.propertyType || listing.type)}`,
    `BHK: ${bhk ? `${bhk} BHK` : "-"}`,
    `Purpose: ${displayValue(purpose)}`,
    `Price: ${displayValue(price)}`,
    `Location: ${displayValue(listing.location)}`,
    `Area / Locality: ${displayValue(area)}`,
    `City: ${displayValue(listing.city)}`,
    url ? `View Property: ${url}` : "",
    "",
    "Customer Enquiry",
    `Customer Name: ${displayValue(lead.name)}`,
    `Phone: ${displayValue(lead.phone)}`,
    `Email: ${displayValue(lead.email)}`,
    `Message: ${message}`,
    `Date & Time: ${formatDateTime(lead.createdAt || new Date())}`,
    "",
    "Please contact the customer as soon as possible to follow up on this enquiry.",
    "",
    "Regards,",
    "Akshar Estate : The Property Hub",
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}
