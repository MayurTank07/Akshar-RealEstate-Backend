import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { DEFAULT_SUPERVISOR_PERMISSIONS } from "../config/permissions.js";

const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    passwordPlain: { type: String, trim: true, default: "" },
    role: { type: String, enum: ["admin", "supervisor"], required: true },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    phone: { type: String, trim: true, default: "" },
    whatsapp: { type: String, trim: true, default: "" },
    designation: { type: String, trim: true, default: "" },
    companyName: { type: String, trim: true, default: "" },
    avatar: { type: String, trim: true, default: "" },
    coverImage: { type: String, trim: true, default: "" },
    permissions: {
      type: [{ type: String, trim: true }],
      default() {
        return this.role === "supervisor" ? DEFAULT_SUPERVISOR_PERMISSIONS : [];
      },
    },
    propertiesManaged: { type: Number, default: 0 },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

staffSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

staffSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, 12);
};

export const Staff = mongoose.model("Staff", staffSchema);
