import { DEFAULT_SUPERVISOR_PERMISSIONS } from "../config/permissions.js";
import { Activity } from "../models/Activity.js";
import { Enquiry } from "../models/Enquiry.js";
import { Property } from "../models/Property.js";
import { Staff } from "../models/Staff.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function cleanStaff(staff) {
  const data = staff.toObject ? staff.toObject() : { ...staff };
  delete data.passwordHash;
  if (data.role === "supervisor" && !data.permissions?.length) {
    data.permissions = DEFAULT_SUPERVISOR_PERMISSIONS;
  }
  return data;
}

export const listStaff = asyncHandler(async (_req, res) => {
  const staff = await Staff.find().select("+passwordPlain -passwordHash").sort({ role: 1, createdAt: 1 });
  const supervisorIds = staff.filter((item) => item.role === "supervisor").map((item) => item._id);
  const [propertyStats, enquiryStats, activityStats] = await Promise.all([
    Property.aggregate([
      { $match: { $or: [{ assignedTo: { $in: supervisorIds } }, { createdBy: { $in: supervisorIds } }] } },
      {
        $group: {
          _id: { $ifNull: ["$assignedTo", "$createdBy"] },
          propertiesAdded: { $sum: 1 },
          activeProperties: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
        },
      },
    ]),
    Enquiry.aggregate([
      { $match: { assignedTo: { $in: supervisorIds } } },
      {
        $group: {
          _id: "$assignedTo",
          leadsHandled: { $sum: 1 },
          convertedLeads: { $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] } },
        },
      },
    ]),
    Activity.aggregate([
      { $match: { actorId: { $in: supervisorIds } } },
      { $group: { _id: "$actorId", activityCount: { $sum: 1 } } },
    ]),
  ]);

  const byId = (items) => new Map(items.map((item) => [String(item._id), item]));
  const propertyMap = byId(propertyStats);
  const enquiryMap = byId(enquiryStats);
  const activityMap = byId(activityStats);
  const data = staff.map((item) => {
    const clean = cleanStaff(item);
    if (clean.role !== "supervisor") return clean;
    const id = String(clean._id);
    const property = propertyMap.get(id) || {};
    const enquiry = enquiryMap.get(id) || {};
    const activity = activityMap.get(id) || {};
    clean.performance = {
      propertiesAdded: property.propertiesAdded || 0,
      activeProperties: property.activeProperties || 0,
      leadsHandled: enquiry.leadsHandled || 0,
      convertedLeads: enquiry.convertedLeads || 0,
      conversionRate: enquiry.leadsHandled ? Number(((enquiry.convertedLeads / enquiry.leadsHandled) * 100).toFixed(1)) : 0,
      activityCount: activity.activityCount || 0,
    };
    return clean;
  });

  res.json({ success: true, data });
});

export const createStaff = asyncHandler(async (req, res) => {
  const body = {
    ...req.validated.body,
    permissions: req.validated.body.role === "supervisor" && !req.validated.body.permissions.length
      ? DEFAULT_SUPERVISOR_PERMISSIONS
      : req.validated.body.permissions,
  };
  const staff = await Staff.create({
    ...body,
    passwordHash: await Staff.hashPassword(body.password),
    passwordPlain: body.password,
  });

  res.status(201).json({ success: true, data: cleanStaff(staff) });
});

export const updateStaff = asyncHandler(async (req, res) => {
  const body = { ...req.validated.body };
  const current = await Staff.findById(req.validated.params.id).select("+passwordHash");
  if (!current) throw new ApiError(404, "Staff member not found");

  if (body.password) {
    body.passwordHash = await Staff.hashPassword(body.password);
    body.passwordPlain = body.password;
    delete body.password;
  }
  if (body.role === "admin") {
    body.permissions = [];
  }
  if ((body.role || current.role) === "supervisor" && body.permissions && !body.permissions.length) {
    body.permissions = DEFAULT_SUPERVISOR_PERMISSIONS;
  }

  Object.assign(current, body);
  await current.save();

  res.json({ success: true, data: cleanStaff(current) });
});

export const deleteStaff = asyncHandler(async (req, res) => {
  if (req.user._id.toString() === req.validated.params.id) {
    throw new ApiError(400, "You cannot delete your own account");
  }

  const staff = await Staff.findByIdAndDelete(req.validated.params.id);
  if (!staff) throw new ApiError(404, "Staff member not found");
  if (staff.role === "supervisor") {
    await Promise.all([
      Property.updateMany({ assignedTo: staff._id }, { $set: { assignedTo: null } }),
      Enquiry.updateMany({ assignedTo: staff._id }, { $set: { assignedTo: null } }),
    ]);
  }

  res.json({ success: true, data: { id: staff._id } });
});
