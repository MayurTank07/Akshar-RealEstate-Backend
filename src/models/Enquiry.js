import mongoose from "mongoose";

const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    age: { type: Number },
    preferredLocation: { type: String, trim: true, default: "" },
    budget: { type: String, trim: true, default: "" },
    budgetLabel: { type: String, trim: true, default: "" },
    propertyType: { type: String, trim: true, default: "" },
    propertyTitle: { type: String, trim: true, default: "" },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
    message: { type: String, trim: true, default: "" },
    source: { type: String, enum: ["website", "property-detail", "guest", "admin"], default: "website" },
    status: { type: String, enum: ["new", "in-progress", "closed"], default: "new" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
    notes: [
      {
        text: { type: String, required: true, trim: true },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

enquirySchema.index({ name: "text", email: "text", phone: "text", propertyTitle: "text", message: "text" });

export const Enquiry = mongoose.model("Enquiry", enquirySchema);
