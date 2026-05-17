import mongoose from "mongoose";

const siteContentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    section: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: ["text", "textarea", "image", "json"], default: "text" },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    isEditable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const SiteContent = mongoose.model("SiteContent", siteContentSchema);
