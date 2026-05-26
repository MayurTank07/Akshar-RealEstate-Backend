import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "owner"], default: "user" },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    avatar: { type: String, trim: true, default: "" },
    savedProperties: [{ type: mongoose.Schema.Types.Mixed }],
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, 12);
};

export const User = mongoose.model("User", userSchema);
