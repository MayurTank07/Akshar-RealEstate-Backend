import mongoose from "mongoose";

const ownerApplicationSchema = new mongoose.Schema(
  {
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    alternatePhone: { type: String, trim: true, default: "" },
    ownershipType: { type: String, trim: true, default: "" },
    propertyCount: { type: Number, default: 1 },
    propertyDetails: {
      title: { type: String, required: true, trim: true },
      type: { type: String, required: true, trim: true },
      purpose: { type: String, enum: ["sale", "rent", "pre-leased", "other"], default: "sale" },
      city: { type: String, required: true, trim: true },
      area: { type: String, required: true, trim: true },
      address: { type: String, trim: true, default: "" },
      bhk: { type: String, trim: true, default: "" },
      rooms: { type: String, trim: true, default: "" },
      carpetArea: { type: Number, default: 0 },
      builtUpArea: { type: Number, default: 0 },
      areaUnit: { type: String, trim: true, default: "sqft" },
      floorNumber: { type: String, trim: true, default: "" },
      totalFloors: { type: String, trim: true, default: "" },
      furnishing: { type: String, trim: true, default: "" },
      parking: { type: String, trim: true, default: "" },
      facing: { type: String, trim: true, default: "" },
      ageOfProperty: { type: String, trim: true, default: "" },
      constructionYear: { type: Number, min: 1900, max: new Date().getFullYear(), default: null },
      expectedPrice: { type: Number, required: true, min: 0 },
      negotiable: { type: Boolean, default: false },
      maintenanceCharges: { type: Number, default: 0 },
      amenities: [{ type: String, trim: true }],
      description: { type: String, required: true, trim: true, maxlength: 1000 },
      nearbyLandmarks: { type: String, trim: true, maxlength: 1000, default: "" },
      availability: { type: String, trim: true, default: "" },
      map: {
        address: { type: String, trim: true, default: "" },
        area: { type: String, trim: true, default: "" },
        city: { type: String, trim: true, default: "" },
        state: { type: String, trim: true, default: "" },
        pincode: { type: String, trim: true, default: "" },
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        placeId: { type: String, trim: true, default: "" },
      },
      notes: { type: String, trim: true, default: "" },
    },
    media: {
      photos: [{ type: String, trim: true }],
      videos: [{ type: String, trim: true }],
      documents: [{ type: String, trim: true }],
      ownerProofs: [
        {
          documentType: {
            type: String,
            enum: ["Ownership Proof", "Electricity Bill", "Tax Bill", "Index Copy", "Other"],
            required: true,
          },
          customDocumentName: { type: String, trim: true, default: "" },
          originalName: { type: String, required: true, trim: true },
          mimeType: { type: String, required: true, trim: true },
          resourceType: { type: String, trim: true, default: "image" },
          format: { type: String, trim: true, default: "" },
          size: { type: Number, min: 0, default: 0 },
          url: { type: String, required: true, trim: true },
          publicId: { type: String, trim: true, default: "" },
          status: { type: String, enum: ["uploaded", "verified", "rejected"], default: "uploaded" },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
    },
    declaration: {
      ownerOrAuthorized: { type: Boolean, required: true },
      accurateDetails: { type: Boolean, required: true },
      mediaBelongsToProperty: { type: Boolean, required: true },
      understandsRemoval: { type: Boolean, required: true },
      agreesContact: { type: Boolean, required: true },
    },
    declarationAccepted: { type: Boolean, default: false },
    declarationAcceptedAt: { type: Date, default: null },
    status: { type: String, enum: ["pending", "approved", "rejected", "needs_changes"], default: "pending" },
    reviewRemarks: { type: String, trim: true, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
    reviewedAt: { type: Date, default: null },
    approvedPropertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property", default: null },
    approvalInProgress: { type: Boolean, default: false },
    deleteStatus: { type: String, enum: ["none", "pending", "approved", "rejected"], default: "none" },
    deleteReason: { type: String, trim: true, default: "" },
    deleteRequestedAt: { type: Date, default: null },
    deleteReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
    deleteReviewedAt: { type: Date, default: null },
    deleteReviewRemarks: { type: String, trim: true, default: "" },
    source: { type: String, enum: ["seller_owner"], default: "seller_owner" },
    statusHistory: [
      {
        status: { type: String, trim: true },
        remarks: { type: String, trim: true, default: "" },
        changedByName: { type: String, trim: true, default: "" },
        changedByRole: { type: String, trim: true, default: "" },
        changedAt: { type: Date, default: Date.now },
      },
    ],
    revisionHistory: [
      {
        submittedAt: { type: Date, default: Date.now },
        statusBefore: { type: String, trim: true, default: "" },
        remarksBefore: { type: String, trim: true, default: "" },
      },
    ],
  },
  { timestamps: true }
);

ownerApplicationSchema.index({ status: 1, createdAt: -1 });
ownerApplicationSchema.index({ deleteStatus: 1, deleteRequestedAt: -1 });
ownerApplicationSchema.index({ ownerUserId: 1, createdAt: -1 });
ownerApplicationSchema.index({ name: "text", email: "text", phone: "text", "propertyDetails.title": "text", "propertyDetails.city": "text", "propertyDetails.area": "text", "propertyDetails.type": "text" });

export const OwnerApplication = mongoose.model("OwnerApplication", ownerApplicationSchema);
