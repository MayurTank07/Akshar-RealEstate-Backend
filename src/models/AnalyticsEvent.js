import mongoose from "mongoose";

const analyticsEventSchema = new mongoose.Schema(
  {
    eventName: {
      type: String,
      required: true,
      enum: [
        "property_page_view",
        "search_performed",
        "location_selected",
        "filter_applied",
        "property_image_opened",
        "call_button_clicked",
        "whatsapp_button_clicked",
        "inquiry_form_opened",
        "inquiry_form_submitted",
        "supervisor_contacted",
        "property_shared",
        "map_opened",
      ],
    },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property", default: null },
    propertySlug: { type: String, trim: true, default: "" },
    propertyTitle: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    propertyType: { type: String, trim: true, default: "" },
    bhk: { type: Number, default: 0 },
    listingType: { type: String, trim: true, default: "" },
    assignedSupervisor: {
      id: { type: String, trim: true, default: "" },
      name: { type: String, trim: true, default: "" },
      companyName: { type: String, trim: true, default: "" },
    },
    pagePath: { type: String, trim: true, default: "" },
    pageTitle: { type: String, trim: true, default: "" },
    referrer: { type: String, trim: true, default: "" },
    source: { type: String, trim: true, default: "" },
    campaign: {
      utmSource: { type: String, trim: true, default: "" },
      utmMedium: { type: String, trim: true, default: "" },
      utmCampaign: { type: String, trim: true, default: "" },
      utmTerm: { type: String, trim: true, default: "" },
      utmContent: { type: String, trim: true, default: "" },
      gclid: { type: String, trim: true, default: "" },
      fbclid: { type: String, trim: true, default: "" },
      ref: { type: String, trim: true, default: "" },
      supervisor: { type: String, trim: true, default: "" },
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

analyticsEventSchema.index({ eventName: 1, createdAt: -1 });
analyticsEventSchema.index({ propertyId: 1, eventName: 1, createdAt: -1 });
analyticsEventSchema.index({ propertySlug: 1, eventName: 1, createdAt: -1 });
analyticsEventSchema.index({ "assignedSupervisor.name": 1, eventName: 1, createdAt: -1 });

export const AnalyticsEvent = mongoose.model("AnalyticsEvent", analyticsEventSchema);
