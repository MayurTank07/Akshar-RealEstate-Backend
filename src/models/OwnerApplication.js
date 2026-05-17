import mongoose from "mongoose";

const ownerApplicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    propertyCount: { type: Number, default: 1 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

export const OwnerApplication = mongoose.model("OwnerApplication", ownerApplicationSchema);
