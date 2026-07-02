import mongoose from "mongoose";

const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    countryCode: { type: String, trim: true, default: "+91" },
    phone: { type: String, required: true, trim: true },
    age: { type: Number },
    preferredLocation: { type: String, trim: true, default: "" },
    budget: { type: String, trim: true, default: "" },
    budgetAmount: { type: Number, default: 0 },
    budgetLabel: { type: String, trim: true, default: "" },
    propertyType: { type: String, trim: true, default: "" },
    propertyTitle: { type: String, trim: true, default: "" },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
    message: { type: String, trim: true, default: "" },
    source: { type: String, enum: ["website", "property-detail", "guest", "admin"], default: "website" },
    status: { type: String, enum: ["new", "in-progress", "closed"], default: "new" },
    conversionType: { type: String, enum: ["sold", "rented", "no-conversion", ""], default: "" },
    finalPrice: { type: String, trim: true, default: "" },
    finalPriceAmount: { type: Number, default: 0 },
    commission: { type: String, trim: true, default: "" },
    commissionAmount: { type: Number, default: 0 },
    paymentDetails: { type: String, trim: true, default: "" },
    closingDate: { type: Date, default: null },
    followUpDate: { type: Date, default: null },
    remarks: { type: String, trim: true, default: "" },
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

enquirySchema.index({ name: "text", email: "text", phone: "text", propertyTitle: "text", message: "text", preferredLocation: "text" });
enquirySchema.index({ status: 1, conversionType: 1, closingDate: -1, assignedTo: 1 });

export const Enquiry = mongoose.model("Enquiry", enquirySchema);
