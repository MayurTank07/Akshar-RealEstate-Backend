import mongoose from "mongoose";

const certificationSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    image: { type: String, trim: true, required: true },
    publicId: { type: String, trim: true, default: "" },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

certificationSchema.index({ isActive: 1, displayOrder: 1, createdAt: -1 });

export const Certification = mongoose.model("Certification", certificationSchema);
