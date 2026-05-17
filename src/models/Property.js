import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    city: { type: String, trim: true, default: "" },
    type: { type: String, required: true, trim: true },
    price: { type: String, required: true, trim: true },
    beds: { type: Number, default: 0 },
    baths: { type: Number, default: 0 },
    sqft: { type: Number, default: 0 },
    measurement: {
      value: { type: Number, default: 0 },
      unit: {
        type: String,
        enum: ["sqft", "vigha", "acre", "sq-yard", "sq-meter", "guntha", "hectare", "custom"],
        default: "sqft",
      },
      customUnit: { type: String, trim: true, default: "" },
    },
    area: { type: String, trim: true, default: "" },
    tag: { type: String, enum: ["Featured", "New", "Hot", "Standard"], default: "Standard" },
    badge: { type: String, trim: true, default: "" },
    badgeColor: { type: String, trim: true, default: "bg-blue-600" },
    status: { type: String, enum: ["active", "pending", "inactive", "sold", "rented"], default: "active" },
    propertyStatus: { type: String, trim: true, default: "Ready" },
    category: { type: String, trim: true, default: "" },
    availability: { type: String, trim: true, default: "" },
    facing: { type: String, trim: true, default: "" },
    visibility: { type: String, enum: ["public", "private"], default: "public" },
    featured: { type: Boolean, default: false },
    ownerName: { type: String, trim: true, default: "Akshar Estate" },
    image: { type: String, required: true, trim: true },
    gallery: [{ type: String, trim: true }],
    description: { type: String, trim: true, default: "" },
    videoUrl: { type: String, trim: true, default: "" },
    amenities: [{ type: String, trim: true }],
    features: [{ type: String, trim: true }],
    facilities: [{ type: String, trim: true }],
    highlights: [{ type: String, trim: true }],
    parking: { type: String, trim: true, default: "" },
    furnishing: { type: String, trim: true, default: "" },
    propertyTags: [{ type: String, trim: true }],
    isPreLeased: { type: Boolean, default: false },
    isBarter: { type: Boolean, default: false },
    roi: { type: String, trim: true, default: "" },
    contact: {
      name: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, default: "" },
    },
    map: {
      address: { type: String, trim: true, default: "" },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      embedUrl: { type: String, trim: true, default: "" },
    },
    seo: {
      metaTitle: { type: String, trim: true, default: "" },
      metaDescription: { type: String, trim: true, default: "" },
      slug: { type: String, trim: true, default: "" },
    },
    yearBuilt: { type: Number, default: null },
    propertyCode: { type: String, trim: true, default: "" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
    source: { type: String, enum: ["home", "pricing"], default: "pricing" },
  },
  { timestamps: true }
);

propertySchema.index({ title: "text", location: "text", city: "text", type: "text", ownerName: "text" });

export const Property = mongoose.model("Property", propertySchema);
