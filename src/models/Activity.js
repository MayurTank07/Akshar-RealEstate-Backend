import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    actorName: { type: String, trim: true, default: "System" },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
  },
  { timestamps: true }
);

export const Activity = mongoose.model("Activity", activitySchema);
