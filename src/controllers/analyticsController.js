import mongoose from "mongoose";
import { PUBLIC_LISTING_STATUSES } from "../config/propertyLifecycle.js";
import { Activity } from "../models/Activity.js";
import { AnalyticsEvent } from "../models/AnalyticsEvent.js";
import { Enquiry } from "../models/Enquiry.js";
import { Location } from "../models/Location.js";
import { OwnerApplication } from "../models/OwnerApplication.js";
import { Property } from "../models/Property.js";
import { Staff } from "../models/Staff.js";
import { buildSoldRentedRows, summarizeSoldRentedRows } from "../services/conversionReportService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegExp } from "../utils/escapeRegExp.js";
import { dateMatch, formatCrores, getDateRange } from "../utils/reporting.js";

function objectId(value) {
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

function propertyScope(user, query = {}) {
  const filter = user.role === "admin" ? {} : { $or: [{ assignedTo: user._id }, { createdBy: user._id }] };
  if (query.supervisorId && query.supervisorId !== "all" && user.role === "admin") {
    filter.$or = [{ assignedTo: objectId(query.supervisorId) }, { createdBy: objectId(query.supervisorId) }].filter((item) => item.assignedTo || item.createdBy);
  }
  if (query.city && query.city !== "all") filter.city = new RegExp(escapeRegExp(query.city), "i");
  if (query.propertyType && query.propertyType !== "all") filter.type = new RegExp(`^${escapeRegExp(query.propertyType)}$`, "i");
  return filter;
}

function enquiryScope(user, query = {}, dateField = "createdAt") {
  const filter = user.role === "admin" ? {} : { assignedTo: user._id };
  if (query.supervisorId && query.supervisorId !== "all" && user.role === "admin") filter.assignedTo = objectId(query.supervisorId);
  if (query.city && query.city !== "all") filter.preferredLocation = new RegExp(escapeRegExp(query.city), "i");
  if (query.propertyType && query.propertyType !== "all") filter.propertyType = new RegExp(`^${escapeRegExp(query.propertyType)}$`, "i");
  if (query.propertyId && query.propertyId !== "all") filter.propertyId = objectId(query.propertyId);
  if (query.source && query.source !== "all") filter.source = query.source;
  if (query.conversionType && query.conversionType !== "all") {
    filter.conversionType = query.conversionType === "no-conversion" ? { $in: ["no-conversion", "", null] } : query.conversionType;
  }
  if (query.status && query.status !== "all") filter.status = query.status;
  Object.assign(filter, dateMatch(dateField, query));
  return filter;
}

function activityScope(user) {
  if (user.role === "admin") return {};
  return { $or: [{ actorId: user._id }, { targetStaffIds: user._id }] };
}

function eventScope(user, query = {}) {
  const filter = { ...dateMatch("createdAt", query) };
  if (user.role === "supervisor") {
    filter["assignedSupervisor.id"] = user._id.toString();
  } else if (query.supervisorId && query.supervisorId !== "all") {
    filter["assignedSupervisor.id"] = query.supervisorId;
  }
  if (query.city && query.city !== "all") filter.city = new RegExp(escapeRegExp(query.city), "i");
  if (query.propertyType && query.propertyType !== "all") filter.propertyType = new RegExp(`^${escapeRegExp(query.propertyType)}$`, "i");
  return filter;
}

function seoPropertyScope(base = {}) {
  return { ...base, status: { $in: PUBLIC_LISTING_STATUSES }, deletedAt: null, visibility: { $ne: "private" } };
}

function eventChartItems(stats, labelKey = "_id") {
  return stats.map((item) => ({ label: item[labelKey] || "Unknown", value: item.value || 0 }));
}

function lastSevenDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return date;
  });
}

function lastSixMonths() {
  const today = new Date();
  today.setDate(1);
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today);
    date.setMonth(today.getMonth() - (5 - index));
    return date;
  });
}

function chartItems(stats, key = "_id") {
  return stats.map((item) => ({ label: item[key] || "Unknown", value: item.value || 0 }));
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export const dashboard = asyncHandler(async (req, res) => {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
  const properties = propertyScope(req.user);
  const enquiries = req.user.role === "admin" ? {} : { assignedTo: req.user._id };
  const activityFilter = activityScope(req.user);
  const [
    totalProperties,
    totalEnquiries,
    activeListings,
    soldRentedRows,
    activeSupervisors,
    pendingOwners,
    recentActivity,
    recentLeads,
    recentProperties,
    propertyTypeStats,
    enquiryStatusStats,
    supervisorPerformance,
    ownerSubmissionStats,
    sellerOwnerListings,
  ] = await Promise.all([
    Property.countDocuments(properties),
    Enquiry.countDocuments(enquiries),
    Property.countDocuments({ ...properties, status: { $in: PUBLIC_LISTING_STATUSES } }),
    buildSoldRentedRows({}, req.user),
    Staff.countDocuments({ role: "supervisor", status: "active" }),
    OwnerApplication.countDocuments({ status: "pending" }),
    Activity.find(activityFilter).sort({ createdAt: -1 }).limit(8),
    Enquiry.find(enquiries).populate("assignedTo", "name email").populate("propertyId", "title city location").sort({ createdAt: -1 }).limit(6),
    Property.find(properties).populate("assignedTo", "name email").sort({ createdAt: -1 }).limit(6),
    Property.aggregate([{ $match: properties }, { $group: { _id: "$type", value: { $sum: 1 } } }, { $sort: { value: -1 } }, { $limit: 8 }]),
    Enquiry.aggregate([{ $match: enquiries }, { $group: { _id: "$status", value: { $sum: 1 } } }]),
    req.user.role === "admin"
      ? Staff.aggregate([
          { $match: { role: "supervisor" } },
          {
            $lookup: {
              from: "properties",
              localField: "_id",
              foreignField: "assignedTo",
              as: "properties",
            },
          },
          {
            $lookup: {
              from: "enquiries",
              localField: "_id",
              foreignField: "assignedTo",
              as: "enquiries",
            },
          },
          {
            $project: {
              name: 1,
              email: 1,
              status: 1,
              propertiesAdded: { $size: "$properties" },
              leadsHandled: { $size: "$enquiries" },
              sold: {
                $add: [
                  { $size: { $filter: { input: "$enquiries", as: "enquiry", cond: { $eq: ["$$enquiry.conversionType", "sold"] } } } },
                  { $size: { $filter: { input: "$properties", as: "property", cond: { $eq: ["$$property.status", "sold"] } } } },
                ],
              },
              rented: {
                $add: [
                  { $size: { $filter: { input: "$enquiries", as: "enquiry", cond: { $eq: ["$$enquiry.conversionType", "rented"] } } } },
                  { $size: { $filter: { input: "$properties", as: "property", cond: { $eq: ["$$property.status", "rented"] } } } },
                ],
              },
              convertedLeads: {
                $size: {
                  $filter: {
                    input: "$enquiries",
                    as: "enquiry",
                    cond: { $in: ["$$enquiry.conversionType", ["sold", "rented"]] },
                  },
                },
              },
            },
          },
          { $sort: { convertedLeads: -1, propertiesAdded: -1, leadsHandled: -1 } },
        ])
      : Promise.resolve([]),
    req.user.role === "admin"
      ? OwnerApplication.aggregate([{ $group: { _id: "$status", value: { $sum: 1 } } }])
      : Promise.resolve([]),
    Property.countDocuments({ ...properties, source: "seller_owner" }),
  ]);

  const soldRentedTotals = summarizeSoldRentedRows(soldRentedRows);
  const convertedCount = soldRentedRows.length;
  const conversionRate = totalEnquiries ? Number(((convertedCount / totalEnquiries) * 100).toFixed(1)) : 0;
  const newToday = await Enquiry.countDocuments({ ...enquiries, createdAt: { $gte: todayStart } });

  res.json({
    success: true,
    data: {
      metrics: {
        totalProperties,
        totalEnquiries,
        conversionRate,
        activeListings,
        soldRented: soldRentedRows.length,
        soldCount: soldRentedTotals.sold,
        rentedCount: soldRentedTotals.rented,
        ownerSubmissions: ownerSubmissionStats.reduce((sum, item) => sum + item.value, 0),
        pendingOwnerSubmissions: ownerSubmissionStats.find((item) => item._id === "pending")?.value || 0,
        approvedOwnerSubmissions: ownerSubmissionStats.find((item) => item._id === "approved")?.value || 0,
        rejectedOwnerSubmissions: ownerSubmissionStats.find((item) => item._id === "rejected")?.value || 0,
        sellerOwnerListings,
      },
      supervisorMode: req.user.role === "supervisor",
      quickStats: {
        pendingApprovals: req.user.role === "admin" ? pendingOwners : totalProperties,
        activeSupervisors: req.user.role === "admin" ? activeSupervisors : activeListings,
        newEnquiriesToday: newToday,
      },
      recentActivity,
      recentLeads,
      recentProperties,
      propertyTypeStats: chartItems(propertyTypeStats),
      enquiryStatusStats: chartItems(enquiryStatusStats),
      supervisorPerformance,
      quickActions: [
        { label: "Add Property", path: "/admin/properties" },
        { label: "Review Enquiries", path: "/admin/enquiries" },
        { label: "Sold & Rented", path: "/admin/sold-rented" },
      ],
    },
  });
});

export const analytics = asyncHandler(async (req, res) => {
  const enquiries = enquiryScope(req.user, req.query);
  const properties = propertyScope(req.user, req.query);
  const days = lastSevenDays();
  const months = lastSixMonths();
  const { start } = getDateRange(req.query);

  const [
    totalLeads,
    closedLeads,
    soldRentedRows,
    noConversionLeads,
    pendingLeads,
    totalProperties,
    activeListings,
    weeklyStats,
    monthlyStats,
    sourceStats,
    statusStats,
    typeStats,
    cityStats,
    propertyStats,
    supervisorStats,
    handledLeads,
    ownerSubmissionStats,
    sellerOwnerListings,
    sourceBreakdown,
    indexableProperties,
    propertiesWithoutSeoTitles,
    propertiesWithoutDescriptions,
    propertiesWithoutImages,
    propertiesWithoutAltText,
    emptyLocationPages,
    recentlyUpdatedProperties,
    mostViewedProperties,
    mostContactedSupervisors,
    callClickEvents,
    whatsappClickEvents,
    inquirySubmissionEvents,
    eventTypeStats,
    campaignSourceStats,
  ] = await Promise.all([
    Enquiry.countDocuments(enquiries),
    Enquiry.countDocuments({ ...enquiries, status: "closed" }),
    buildSoldRentedRows(req.query, req.user),
    Enquiry.countDocuments({ ...enquiries, status: "closed", $or: [{ conversionType: "no-conversion" }, { conversionType: "" }, { conversionType: { $exists: false } }] }),
    Enquiry.countDocuments({ ...enquiries, status: { $ne: "closed" } }),
    Property.countDocuments(properties),
    Property.countDocuments({ ...properties, status: { $in: PUBLIC_LISTING_STATUSES } }),
    Enquiry.aggregate([
      { $match: { ...enquiries, createdAt: { $gte: days[0] } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
          enquiries: { $sum: 1 },
          conversions: { $sum: { $cond: [{ $in: ["$conversionType", ["sold", "rented"]] }, 1, 0] } },
        },
      },
    ]),
    Enquiry.aggregate([
      { $match: { ...enquiries, createdAt: { $gte: months[0] } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Kolkata" } },
          enquiries: { $sum: 1 },
          conversions: { $sum: { $cond: [{ $in: ["$conversionType", ["sold", "rented"]] }, 1, 0] } },
        },
      },
    ]),
    Enquiry.aggregate([{ $match: enquiries }, { $group: { _id: "$source", value: { $sum: 1 } } }, { $sort: { value: -1 } }]),
    Enquiry.aggregate([{ $match: enquiries }, { $group: { _id: "$status", value: { $sum: 1 } } }]),
    Property.aggregate([{ $match: properties }, { $group: { _id: "$type", value: { $sum: 1 } } }, { $sort: { value: -1 } }]),
    Enquiry.aggregate([{ $match: enquiries }, { $group: { _id: "$preferredLocation", value: { $sum: 1 } } }, { $sort: { value: -1 } }, { $limit: 8 }]),
    Enquiry.aggregate([{ $match: enquiries }, { $group: { _id: "$propertyTitle", value: { $sum: 1 } } }, { $sort: { value: -1 } }, { $limit: 8 }]),
    req.user.role === "admin"
      ? Enquiry.aggregate([
          { $match: enquiries },
          { $group: { _id: "$assignedTo", leads: { $sum: 1 }, sold: { $sum: { $cond: [{ $eq: ["$conversionType", "sold"] }, 1, 0] } }, rented: { $sum: { $cond: [{ $eq: ["$conversionType", "rented"] }, 1, 0] } } } },
          { $lookup: { from: "staffs", localField: "_id", foreignField: "_id", as: "staff" } },
          { $unwind: { path: "$staff", preserveNullAndEmptyArrays: true } },
          { $project: { name: "$staff.name", email: "$staff.email", leads: 1, sold: 1, rented: 1, conversions: { $add: ["$sold", "$rented"] } } },
          { $sort: { conversions: -1, leads: -1 } },
          { $limit: 8 },
        ])
      : Promise.resolve([]),
    Enquiry.find({ ...enquiries, status: { $ne: "new" }, updatedAt: { $gte: start } }).select("createdAt updatedAt").lean(),
    req.user.role === "admin"
      ? OwnerApplication.aggregate([{ $group: { _id: "$status", value: { $sum: 1 } } }])
      : Promise.resolve([]),
    Property.countDocuments({ ...properties, source: "seller_owner" }),
    Property.aggregate([{ $match: properties }, { $group: { _id: "$source", value: { $sum: 1 } } }, { $sort: { value: -1 } }]),
    Property.countDocuments({ ...seoPropertyScope(properties), isIndexable: true }),
    Property.countDocuments({
      ...seoPropertyScope(properties),
      $and: [
        { $or: [{ seoTitle: "" }, { seoTitle: { $exists: false } }] },
        { $or: [{ "seo.metaTitle": "" }, { "seo.metaTitle": { $exists: false } }] },
      ],
    }),
    Property.countDocuments({ ...seoPropertyScope(properties), $or: [{ description: "" }, { description: { $exists: false } }, { metaDescription: "" }, { metaDescription: { $exists: false } }] }),
    Property.countDocuments({
      ...seoPropertyScope(properties),
      $and: [
        { $or: [{ image: "" }, { image: { $exists: false } }] },
        { $or: [{ gallery: { $exists: false } }, { gallery: { $size: 0 } }] },
        { $or: [{ images: { $exists: false } }, { images: { $size: 0 } }] },
      ],
    }),
    Property.countDocuments({
      ...seoPropertyScope(properties),
      $or: [
        { imageAltTexts: { $exists: false } },
        { imageAltTexts: { $size: 0 } },
      ],
    }),
    req.user.role === "admin" ? Location.countDocuments({ isActive: true, isIndexable: true, propertyCount: { $lte: 0 } }) : Promise.resolve(0),
    Property.find(seoPropertyScope(properties))
      .populate("assignedTo", "name email")
      .sort({ lastModifiedAt: -1, updatedAt: -1 })
      .limit(8)
      .select("title slug city location type status isIndexable lastModifiedAt updatedAt assignedTo"),
    AnalyticsEvent.aggregate([
      { $match: { ...eventScope(req.user, req.query), eventName: "property_page_view" } },
      { $group: { _id: { slug: "$propertySlug", title: "$propertyTitle", location: "$location", city: "$city" }, value: { $sum: 1 } } },
      { $sort: { value: -1 } },
      { $limit: 8 },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...eventScope(req.user, req.query), eventName: { $in: ["call_button_clicked", "whatsapp_button_clicked", "supervisor_contacted"] } } },
      { $group: { _id: { id: "$assignedSupervisor.id", name: "$assignedSupervisor.name", companyName: "$assignedSupervisor.companyName" }, value: { $sum: 1 } } },
      { $sort: { value: -1 } },
      { $limit: 8 },
    ]),
    AnalyticsEvent.countDocuments({ ...eventScope(req.user, req.query), eventName: "call_button_clicked" }),
    AnalyticsEvent.countDocuments({ ...eventScope(req.user, req.query), eventName: "whatsapp_button_clicked" }),
    AnalyticsEvent.countDocuments({ ...eventScope(req.user, req.query), eventName: "inquiry_form_submitted" }),
    AnalyticsEvent.aggregate([{ $match: eventScope(req.user, req.query) }, { $group: { _id: "$eventName", value: { $sum: 1 } } }, { $sort: { value: -1 } }]),
    AnalyticsEvent.aggregate([{ $match: eventScope(req.user, req.query) }, { $group: { _id: "$campaign.utmSource", value: { $sum: 1 } } }, { $sort: { value: -1 } }, { $limit: 8 }]),
  ]);

  const soldRentedTotals = summarizeSoldRentedRows(soldRentedRows);
  const soldLeads = soldRentedTotals.sold;
  const rentedLeads = soldRentedTotals.rented;
  const conversionCount = soldRentedRows.length;
  const conversionRate = totalLeads ? Number(((conversionCount / totalLeads) * 100).toFixed(1)) : 0;
  const revenueGenerated = soldRentedTotals.revenue;
  const commissionGenerated = soldRentedTotals.commission;
  const avgResponseMs = handledLeads.length
    ? handledLeads.reduce((sum, item) => sum + (new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime()), 0) / handledLeads.length
    : 0;
  const avgResponseTime = avgResponseMs ? `${Math.max(0.1, avgResponseMs / 1000 / 60 / 60).toFixed(1)} hrs` : "0 hrs";

  const weeklyMap = new Map(weeklyStats.map((item) => [item._id, item]));
  const directPropertyConversionDays = new Map(
    soldRentedRows
      .filter((row) => row.sourceType === "property" && row.closingDate)
      .map((row) => [row.closingDate, 0])
  );
  soldRentedRows
    .filter((row) => row.sourceType === "property" && row.closingDate)
    .forEach((row) => directPropertyConversionDays.set(row.closingDate, (directPropertyConversionDays.get(row.closingDate) || 0) + 1));
  const weekly = days.map((date) => {
    const key = dateKey(date);
    const item = weeklyMap.get(key) || {};
    return { day: date.toLocaleDateString("en-US", { weekday: "short" }), date: key, enquiries: item.enquiries || 0, conversions: (item.conversions || 0) + (directPropertyConversionDays.get(key) || 0) };
  });

  const monthlyMap = new Map(monthlyStats.map((item) => [item._id, item]));
  const directPropertyConversionMonths = new Map();
  soldRentedRows
    .filter((row) => row.sourceType === "property" && row.closingDate)
    .forEach((row) => {
      const key = row.closingDate.slice(0, 7);
      directPropertyConversionMonths.set(key, (directPropertyConversionMonths.get(key) || 0) + 1);
    });
  const monthly = months.map((date) => {
    const key = monthKey(date);
    const item = monthlyMap.get(key) || {};
    return { label: date.toLocaleDateString("en-US", { month: "short" }), date: key, enquiries: item.enquiries || 0, conversions: (item.conversions || 0) + (directPropertyConversionMonths.get(key) || 0) };
  });

  const sourceLabels = { website: "Website", "property-detail": "Property Detail", guest: "Guest Form", admin: "Admin" };
  const statusMap = new Map(statusStats.map((item) => [item._id, item.value]));
  const inProgress = statusMap.get("in-progress") || 0;
  const funnelMax = Math.max(totalProperties, totalLeads, inProgress, conversionCount, 1);
  const mergedCityStats = new Map(cityStats.map((item) => [item._id || "Unknown", item.value || 0]));
  const mergedPropertyStats = new Map(propertyStats.map((item) => [item._id || "Unknown", item.value || 0]));
  soldRentedRows
    .filter((row) => row.sourceType === "property")
    .forEach((row) => {
      const city = row.cityLocation || "Unknown";
      const property = row.property || "Unknown";
      mergedCityStats.set(city, (mergedCityStats.get(city) || 0) + 1);
      mergedPropertyStats.set(property, (mergedPropertyStats.get(property) || 0) + 1);
    });

  res.json({
    success: true,
    data: {
      filters: {
        range: req.query.range || "this-month",
        supervisorId: req.query.supervisorId || "all",
        city: req.query.city || "all",
        propertyType: req.query.propertyType || "all",
        source: req.query.source || "all",
        conversionType: req.query.conversionType || "all",
      },
      cards: {
        totalLeads,
        conversionRate,
        revenueGenerated: formatCrores(revenueGenerated),
        commissionGenerated: formatCrores(commissionGenerated),
        avgResponseTime,
        totalProperties,
        activeListings,
        soldCount: soldLeads,
        rentedCount: rentedLeads,
        pendingEnquiries: pendingLeads,
        closedEnquiries: closedLeads,
        noConversion: noConversionLeads,
        ownerSubmissions: ownerSubmissionStats.reduce((sum, item) => sum + item.value, 0),
        pendingOwnerSubmissions: ownerSubmissionStats.find((item) => item._id === "pending")?.value || 0,
        approvedOwnerSubmissions: ownerSubmissionStats.find((item) => item._id === "approved")?.value || 0,
        rejectedOwnerSubmissions: ownerSubmissionStats.find((item) => item._id === "rejected")?.value || 0,
        sellerOwnerListings,
        indexableProperties,
        propertiesWithoutSeoTitles,
        propertiesWithoutDescriptions,
        propertiesWithoutImages,
        propertiesWithoutAltText,
        emptyLocationPages,
        callClicks: callClickEvents,
        whatsappClicks: whatsappClickEvents,
        inquirySubmissions: inquirySubmissionEvents || totalLeads,
      },
      weekly,
      monthly,
      sources: sourceStats.length ? sourceStats.map((item) => ({ label: sourceLabels[item._id] || item._id || "Unknown", value: item.value })) : [],
      conversionTypes: [
        { label: "Sold", value: soldLeads },
        { label: "Rented", value: rentedLeads },
        { label: "No Conversion", value: noConversionLeads },
      ],
      propertyTypes: chartItems(typeStats),
      sourceBreakdown: chartItems(sourceBreakdown),
      seoHealth: [
        { label: "Total Active Properties", value: activeListings },
        { label: "Indexable Properties", value: indexableProperties },
        { label: "Without SEO Titles", value: propertiesWithoutSeoTitles },
        { label: "Without Descriptions", value: propertiesWithoutDescriptions },
        { label: "Without Images", value: propertiesWithoutImages },
        { label: "Without Alt Text", value: propertiesWithoutAltText },
        { label: "Empty Location Pages", value: emptyLocationPages },
      ],
      recentlyUpdatedProperties: recentlyUpdatedProperties.map((property) => ({
        id: property._id,
        title: property.title,
        slug: property.slug,
        city: property.city,
        location: property.location,
        type: property.type,
        status: property.status,
        isIndexable: property.isIndexable,
        supervisor: property.assignedTo?.name || "",
        updatedAt: property.lastModifiedAt || property.updatedAt,
      })),
      mostViewedProperties: mostViewedProperties.map((item) => ({
        title: item._id?.title || item._id?.slug || "Unknown property",
        slug: item._id?.slug || "",
        location: [item._id?.location, item._id?.city].filter(Boolean).join(", "),
        value: item.value,
      })),
      mostContactedSupervisors: mostContactedSupervisors.map((item) => ({
        name: item._id?.name || "Unassigned",
        companyName: item._id?.companyName || "",
        value: item.value,
      })),
      eventTypes: eventChartItems(eventTypeStats),
      campaignSources: eventChartItems(campaignSourceStats.filter((item) => item._id)),
      cityStats: [...mergedCityStats.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8),
      propertyStats: [...mergedPropertyStats.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8),
      supervisorPerformance: supervisorStats,
      funnel: [
        { label: "Assigned Properties", value: totalProperties, percent: (totalProperties / funnelMax) * 100 },
        { label: "Enquiries", value: totalLeads, percent: (totalLeads / funnelMax) * 100 },
        { label: "In Progress", value: inProgress, percent: (inProgress / funnelMax) * 100 },
        { label: "Sold/Rented", value: conversionCount, percent: (conversionCount / funnelMax) * 100 },
      ],
    },
  });
});
