import { Activity } from "../models/Activity.js";
import { Enquiry } from "../models/Enquiry.js";
import { OwnerApplication } from "../models/OwnerApplication.js";
import { Property } from "../models/Property.js";
import { Staff } from "../models/Staff.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function propertyScope(user) {
  return user.role === "admin" ? {} : { $or: [{ assignedTo: user._id }, { createdBy: user._id }] };
}

function enquiryScope(user) {
  return user.role === "admin" ? {} : { assignedTo: user._id };
}

function activityScope(user) {
  if (user.role === "admin") return {};
  return { $or: [{ actorId: user._id }, { targetStaffIds: user._id }] };
}

function parseCroreValue(price) {
  const text = String(price || "").toLowerCase();
  const value = Number.parseFloat(text.replace(/[^\d.]/g, "")) || 0;
  if (!value) return 0;
  if (text.includes("l") && !text.includes("cr")) return value / 100;
  if (text.includes("k")) return value / 100000;
  return value;
}

function formatCrores(value) {
  return `₹${Number(value || 0).toFixed(value >= 10 ? 1 : 2).replace(/\.00$/, "")} Cr`;
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

export const dashboard = asyncHandler(async (req, res) => {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
  const properties = propertyScope(req.user);
  const enquiries = enquiryScope(req.user);
  const activityFilter = activityScope(req.user);
  const [
    totalProperties,
    totalEnquiries,
    activeListings,
    soldRented,
    activeSupervisors,
    pendingOwners,
    recentActivity,
    recentLeads,
    recentProperties,
    propertyTypeStats,
    enquiryStatusStats,
    supervisorPerformance,
  ] = await Promise.all([
    Property.countDocuments(properties),
    Enquiry.countDocuments(enquiries),
    Property.countDocuments({ ...properties, status: "active" }),
    Property.countDocuments({ ...properties, status: { $in: ["sold", "rented"] } }),
    Staff.countDocuments({ role: "supervisor", status: "active" }),
    OwnerApplication.countDocuments({ status: "pending" }),
    Activity.find(activityFilter).sort({ createdAt: -1 }).limit(8),
    Enquiry.find(enquiries).populate("assignedTo", "name email").sort({ createdAt: -1 }).limit(6),
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
              convertedLeads: {
                $size: {
                  $filter: {
                    input: "$enquiries",
                    as: "enquiry",
                    cond: { $eq: ["$$enquiry.status", "closed"] },
                  },
                },
              },
            },
          },
          { $sort: { propertiesAdded: -1, leadsHandled: -1 } },
        ])
      : Promise.resolve([]),
  ]);

  const closed = await Enquiry.countDocuments({ ...enquiries, status: "closed" });
  const conversionRate = totalEnquiries ? Number(((closed / totalEnquiries) * 100).toFixed(1)) : 0;
  const newToday = await Enquiry.countDocuments({
    ...enquiries,
    createdAt: { $gte: todayStart },
  });

  res.json({
    success: true,
    data: {
      metrics: {
        totalProperties,
        totalEnquiries,
        conversionRate,
        activeListings,
        soldRented,
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
      propertyTypeStats: propertyTypeStats.map((item) => ({ label: item._id || "Unknown", value: item.value })),
      enquiryStatusStats: enquiryStatusStats.map((item) => ({ label: item._id || "unknown", value: item.value })),
      supervisorPerformance,
      quickActions: [
        { label: "Add Property", path: "/admin/properties" },
        { label: "Review Enquiries", path: "/admin/enquiries" },
        { label: "Manage Content", path: "/admin/settings" },
      ],
    },
  });
});

export const analytics = asyncHandler(async (req, res) => {
  const enquiries = enquiryScope(req.user);
  const properties = propertyScope(req.user);
  const days = lastSevenDays();
  const start = days[0];
  const [
    totalLeads,
    closedLeads,
    totalProperties,
    activeListings,
    soldRentedProperties,
    weeklyStats,
    sourceStats,
    statusStats,
    typeStats,
    handledLeads,
  ] = await Promise.all([
    Enquiry.countDocuments(enquiries),
    Enquiry.countDocuments({ ...enquiries, status: "closed" }),
    Property.countDocuments(properties),
    Property.countDocuments({ ...properties, status: "active" }),
    Property.find({ ...properties, status: { $in: ["sold", "rented"] } }).select("price").lean(),
    Enquiry.aggregate([
      { $match: { ...enquiries, createdAt: { $gte: start } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Asia/Kolkata",
            },
          },
          enquiries: { $sum: 1 },
          conversions: { $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] } },
        },
      },
    ]),
    Enquiry.aggregate([{ $match: enquiries }, { $group: { _id: "$source", value: { $sum: 1 } } }, { $sort: { value: -1 } }]),
    Enquiry.aggregate([{ $match: enquiries }, { $group: { _id: "$status", value: { $sum: 1 } } }]),
    Property.aggregate([{ $match: properties }, { $group: { _id: "$type", value: { $sum: 1 } } }, { $sort: { value: -1 } }]),
    Enquiry.find({ ...enquiries, status: { $ne: "new" } }).select("createdAt updatedAt").lean(),
  ]);

  const conversionRate = totalLeads ? Number(((closedLeads / totalLeads) * 100).toFixed(1)) : 0;
  const revenueGenerated = soldRentedProperties.reduce((sum, property) => sum + parseCroreValue(property.price), 0);
  const avgResponseMs = handledLeads.length
    ? handledLeads.reduce((sum, item) => sum + (new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime()), 0) / handledLeads.length
    : 0;
  const avgResponseTime = avgResponseMs ? `${Math.max(0.1, avgResponseMs / 1000 / 60 / 60).toFixed(1)} hrs` : "0 hrs";

  const weeklyMap = new Map(weeklyStats.map((item) => [item._id, item]));
  const weekly = days.map((date) => {
    const key = date.toISOString().slice(0, 10);
    const item = weeklyMap.get(key) || {};
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      date: key,
      enquiries: item.enquiries || 0,
      conversions: item.conversions || 0,
    };
  });

  const sourceLabels = {
    website: "Website",
    "property-detail": "Property Detail",
    guest: "Guest Form",
    admin: "Admin",
  };
  const sources = sourceStats.length
    ? sourceStats.map((item) => ({ label: sourceLabels[item._id] || item._id || "Unknown", value: item.value }))
    : [{ label: "No leads yet", value: 0 }];
  const statusMap = new Map(statusStats.map((item) => [item._id, item.value]));
  const inProgress = statusMap.get("in-progress") || 0;
  const funnelMax = Math.max(totalProperties, totalLeads, inProgress, closedLeads, 1);

  res.json({
    success: true,
    data: {
      cards: {
        totalLeads,
        conversionRate,
        revenueGenerated: formatCrores(revenueGenerated),
        avgResponseTime,
        totalProperties,
        activeListings,
        soldRented: soldRentedProperties.length,
      },
      weekly,
      sources,
      propertyTypes: typeStats.map((item) => ({ label: item._id || "Unknown", value: item.value })),
      funnel: [
        { label: "Assigned Properties", value: totalProperties, percent: (totalProperties / funnelMax) * 100 },
        { label: "Enquiries", value: totalLeads, percent: (totalLeads / funnelMax) * 100 },
        { label: "In Progress", value: inProgress, percent: (inProgress / funnelMax) * 100 },
        { label: "Closed Clients", value: closedLeads, percent: (closedLeads / funnelMax) * 100 },
      ],
    },
  });
});
