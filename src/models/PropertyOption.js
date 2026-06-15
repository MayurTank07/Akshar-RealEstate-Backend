import mongoose from "mongoose";

const propertyOptionSchema = new mongoose.Schema(
  {
    group: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    normalizedValue: { type: String, required: true, trim: true, lowercase: true },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
  },
  { timestamps: true }
);

propertyOptionSchema.index({ group: 1, normalizedValue: 1 }, { unique: true });

export const PropertyOption = mongoose.model("PropertyOption", propertyOptionSchema);
