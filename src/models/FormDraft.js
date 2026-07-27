import mongoose from "mongoose";

const formDraftSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true, index: true },
    ownerRole: { type: String, enum: ["admin", "supervisor"], required: true },
    formType: { type: String, required: true, trim: true, maxlength: 80 },
    mode: { type: String, required: true, trim: true, maxlength: 40 },
    recordId: { type: String, required: true, trim: true, default: "new", maxlength: 120 },
    draftKey: { type: String, required: true, unique: true, trim: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    schemaVersion: { type: Number, default: 1 },
    status: { type: String, enum: ["active", "completed", "discarded", "expired"], default: "active", index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

formDraftSchema.index({ ownerId: 1, formType: 1, mode: 1, recordId: 1 }, { unique: true });
formDraftSchema.index({ ownerId: 1, status: 1, updatedAt: -1 });
formDraftSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const FormDraft = mongoose.model("FormDraft", formDraftSchema);
