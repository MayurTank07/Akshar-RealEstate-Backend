import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "general" },
    priority: { type: String, enum: ["low", "normal", "high"], default: "normal" },
    status: { type: String, trim: true, default: "" },
    referenceType: { type: String, trim: true, default: "" },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
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
