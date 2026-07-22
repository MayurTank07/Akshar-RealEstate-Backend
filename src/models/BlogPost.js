import mongoose from "mongoose";

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, trim: true, default: "" },
    body: { type: String, trim: true, default: "" },
    featuredImage: { type: String, trim: true, default: "" },
    metaTitle: { type: String, trim: true, default: "" },
    metaDescription: { type: String, trim: true, default: "" },
    author: { type: String, trim: true, default: "Akshar Estate Editorial Team" },
    publishedAt: { type: Date, default: null },
    category: { type: String, trim: true, default: "Buying Guide" },
    relatedLocations: [{ type: String, trim: true }],
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    isIndexable: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

blogPostSchema.index({ status: 1, isIndexable: 1, publishedAt: -1 });
blogPostSchema.index({ relatedLocations: 1, status: 1 });

export const BlogPost = mongoose.model("BlogPost", blogPostSchema);
