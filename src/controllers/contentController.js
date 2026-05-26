import { SiteContent } from "../models/SiteContent.js";
import { siteContentDefaults } from "../config/siteDefaults.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

async function ensureDefaultContent() {
  await Promise.all(
    siteContentDefaults.map((item) =>
      SiteContent.updateOne(
        { key: item.key },
        { $setOnInsert: item },
        { upsert: true }
      )
    )
  );
}

export const publicContent = asyncHandler(async (_req, res) => {
  await ensureDefaultContent();
  const content = await SiteContent.find().sort({ section: 1, key: 1 });
  res.json({ success: true, data: content });
});

export const updateContent = asyncHandler(async (req, res) => {
  const content = await SiteContent.findById(req.validated.params.id);
  if (!content) throw new ApiError(404, "Content item not found");
  if (!content.isEditable) throw new ApiError(403, "This content item cannot be edited");

  content.value = req.validated.body.value;
  await content.save();

  res.json({ success: true, data: content });
});
