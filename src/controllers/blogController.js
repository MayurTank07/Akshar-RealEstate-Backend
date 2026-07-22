import { defaultBlogDrafts } from "../config/blogDefaults.js";
import { BlogPost } from "../models/BlogPost.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegExp } from "../utils/escapeRegExp.js";
import { slugify } from "../utils/slugify.js";

const PUBLIC_SELECT = "title slug excerpt body featuredImage metaTitle metaDescription author publishedAt category relatedLocations isIndexable updatedAt createdAt";

async function ensureDefaultBlogDrafts() {
  await Promise.all(
    defaultBlogDrafts.map((draft) =>
      BlogPost.findOneAndUpdate(
        { slug: draft.slug },
        { $setOnInsert: draft },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    )
  );
}

function publicBlogFilter(extra = {}) {
  return {
    status: "published",
    isIndexable: true,
    deletedAt: null,
    publishedAt: { $ne: null, $lte: new Date() },
    ...extra,
  };
}

function normalizePayload(body = {}, existing = null) {
  const next = { ...body };
  if (next.slug !== undefined || !existing) next.slug = slugify(next.slug || next.title || existing?.title || "");
  if (next.relatedLocations !== undefined) {
    next.relatedLocations = [...new Set((next.relatedLocations || []).map((item) => String(item || "").trim()).filter(Boolean))];
  }
  if (next.status === "published" && !next.publishedAt && !existing?.publishedAt) next.publishedAt = new Date();
  if (next.publishedAt === "") next.publishedAt = null;
  if (next.status === "draft") next.isIndexable = false;
  return next;
}

async function assertUniqueSlug(slug, ignoreId = null) {
  if (!slug) throw new ApiError(422, "Blog slug is required");
  const duplicate = await BlogPost.exists({ slug, deletedAt: null, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) });
  if (duplicate) throw new ApiError(409, "Blog slug already exists");
}

export const listPublicBlogs = asyncHandler(async (req, res) => {
  await ensureDefaultBlogDrafts();
  const { limit = 12, location = "", category = "" } = req.query;
  const filter = publicBlogFilter();
  if (location) filter.relatedLocations = new RegExp(`^${escapeRegExp(location)}$`, "i");
  if (category) filter.category = new RegExp(`^${escapeRegExp(category)}$`, "i");
  const blogs = await BlogPost.find(filter)
    .sort({ publishedAt: -1, updatedAt: -1 })
    .limit(Math.min(Number(limit) || 12, 50))
    .select(PUBLIC_SELECT);
  res.json({ success: true, data: blogs });
});

export const getPublicBlogBySlug = asyncHandler(async (req, res) => {
  await ensureDefaultBlogDrafts();
  const blog = await BlogPost.findOne(publicBlogFilter({ slug: slugify(req.params.slug) })).select(PUBLIC_SELECT);
  if (!blog) throw new ApiError(404, "Blog post not found");
  res.json({ success: true, data: blog });
});

export const listAdminBlogs = asyncHandler(async (_req, res) => {
  await ensureDefaultBlogDrafts();
  const blogs = await BlogPost.find({ deletedAt: null }).sort({ updatedAt: -1, createdAt: -1 });
  res.json({ success: true, data: blogs });
});

export const createBlog = asyncHandler(async (req, res) => {
  const payload = normalizePayload(req.validated.body);
  await assertUniqueSlug(payload.slug);
  const blog = await BlogPost.create(payload);
  res.status(201).json({ success: true, data: blog });
});

export const updateBlog = asyncHandler(async (req, res) => {
  const blog = await BlogPost.findOne({ _id: req.validated.params.id, deletedAt: null });
  if (!blog) throw new ApiError(404, "Blog post not found");
  const payload = normalizePayload(req.validated.body, blog);
  if (payload.slug && payload.slug !== blog.slug) await assertUniqueSlug(payload.slug, blog._id);
  Object.assign(blog, payload);
  await blog.save();
  res.json({ success: true, data: blog });
});

export const deleteBlog = asyncHandler(async (req, res) => {
  const blog = await BlogPost.findOne({ _id: req.validated.params.id, deletedAt: null });
  if (!blog) throw new ApiError(404, "Blog post not found");
  blog.deletedAt = new Date();
  blog.status = "draft";
  blog.isIndexable = false;
  await blog.save();
  res.json({ success: true, data: { id: blog._id } });
});
