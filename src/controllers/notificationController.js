import { Activity } from "../models/Activity.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function notificationScope(user) {
  if (user.role === "admin") return {};
  return { $or: [{ actorId: user._id }, { targetStaffIds: user._id }] };
}

export const listNotifications = asyncHandler(async (req, res) => {
  const filter = notificationScope(req.user);
  const notifications = await Activity.find(filter).sort({ createdAt: -1 }).limit(20).lean();
  const userId = req.user._id.toString();

  res.json({
    success: true,
    data: {
      unreadCount: notifications.filter((item) => !(item.readBy || []).some((id) => id.toString() === userId)).length,
      notifications: notifications.map((item) => ({
        ...item,
        category: item.category || String(item.type || "general").toLowerCase(),
        priority: item.priority || "normal",
        referenceType: item.referenceType || String(item.type || "").toLowerCase(),
        referenceId: item.referenceId || item.metadata?.propertyId || item.metadata?.enquiryId || null,
        read: (item.readBy || []).some((id) => id.toString() === userId),
      })),
    },
  });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  await Activity.updateOne({ _id: req.validated.params.id, ...notificationScope(req.user) }, { $addToSet: { readBy: req.user._id } });
  res.json({ success: true });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Activity.updateMany(notificationScope(req.user), { $addToSet: { readBy: req.user._id } });
  res.json({ success: true });
});
