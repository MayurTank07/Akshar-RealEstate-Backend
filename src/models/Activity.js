import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    actorName: { type: String, trim: true, default: "System" },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
    targetStaffIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Staff" }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "Staff" }],
  },
  { timestamps: true }
);

activitySchema.index({ actorId: 1, createdAt: -1 });
activitySchema.index({ targetStaffIds: 1, createdAt: -1 });

export const Activity = mongoose.model("Activity", activitySchema);
