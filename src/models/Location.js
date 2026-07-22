import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    gujaratiName: { type: String, trim: true, default: "" },
    slug: { type: String, required: true, trim: true, lowercase: true },
    city: { type: String, trim: true, default: "" },
    district: { type: String, trim: true, default: "" },
    taluka: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "Gujarat" },
    country: { type: String, trim: true, default: "India" },
    pinCode: { type: String, trim: true, default: "" },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    parentRegion: { type: String, trim: true, default: "" },
    locationType: {
      type: String,
      enum: ["country", "state", "district", "taluka", "city", "region", "locality", "road", "project", "landmark"],
      default: "locality",
    },
    seoTitle: { type: String, trim: true, default: "" },
    metaDescription: { type: String, trim: true, default: "" },
    shortDescription: { type: String, trim: true, default: "" },
    longDescription: { type: String, trim: true, default: "" },
    primaryKeyword: { type: String, trim: true, default: "" },
    secondaryKeywords: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
    isIndexable: { type: Boolean, default: false },
    propertyCount: { type: Number, default: 0 },
    verificationStatus: { type: String, enum: ["verified", "needsVerification"], default: "needsVerification" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
  },
  { timestamps: true }
);

locationSchema.index({ slug: 1 }, { unique: true });
locationSchema.index({ name: "text", gujaratiName: "text", city: "text", district: "text", taluka: "text", state: "text" });
locationSchema.index({ isActive: 1, isIndexable: 1, locationType: 1, name: 1 });

export const Location = mongoose.model("Location", locationSchema);

