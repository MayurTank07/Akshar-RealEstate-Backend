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

export const dashboard = asyncHandler(async (req, res) => {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
  const properties = propertyScope(req.user);
  const enquiries = enquiryScope(req.user);
  const activityFilter = req.user.role === "admin" ? {} : { actorId: req.user._id };
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
        pendingApprovals: req.user.role === "admin" ? pendingOwners : 0,
        activeSupervisors: req.user.role === "admin" ? activeSupervisors : 0,
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
  const [totalLeads, closedLeads] = await Promise.all([
    Enquiry.countDocuments(enquiries),
    Enquiry.countDocuments({ ...enquiries, status: "closed" }),
  ]);

  const conversionRate = totalLeads ? Number(((closedLeads / totalLeads) * 100).toFixed(1)) : 0;

  res.json({
    success: true,
    data: {
      cards: {
        totalLeads,
        conversionRate,
        revenueGenerated: "₹45.2 Cr",
        avgResponseTime: "2.4 hrs",
      },
      weekly: [
        { day: "Mon", enquiries: 45, conversions: 12 },
        { day: "Tue", enquiries: 52, conversions: 15 },
        { day: "Wed", enquiries: 48, conversions: 14 },
        { day: "Thu", enquiries: 61, conversions: 20 },
        { day: "Fri", enquiries: 55, conversions: 18 },
        { day: "Sat", enquiries: 68, conversions: 24 },
        { day: "Sun", enquiries: 43, conversions: 11 },
      ],
      sources: [
        { label: "Website", value: 245 },
        { label: "Social Media", value: 175 },
        { label: "Referrals", value: 118 },
        { label: "Direct", value: 91 },
        { label: "Others", value: 58 },
      ],
      funnel: [
        { label: "Website Visitors", value: 15420, percent: 100 },
        { label: "Enquiries", value: totalLeads, percent: 32 },
        { label: "Site Visits", value: Math.round(totalLeads * 0.42), percent: 18 },
        { label: "Closed Clients", value: closedLeads, percent: conversionRate },
      ],
    },
  });
});
