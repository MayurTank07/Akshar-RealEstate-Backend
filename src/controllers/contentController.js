import { SiteContent } from "../models/SiteContent.js";
import { siteContentDefaults } from "../config/siteDefaults.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function mergeMissingDefaults(defaultValue, currentValue) {
  if (!isPlainObject(defaultValue) || !isPlainObject(currentValue)) {
    return currentValue === undefined || currentValue === null ? defaultValue : currentValue;
  }
  return Object.fromEntries(
    Object.entries(defaultValue).map(([key, value]) => [
      key,
      mergeMissingDefaults(value, currentValue[key]),
    ]).concat(
      Object.entries(currentValue).filter(([key]) => !(key in defaultValue))
    )
  );
}

async function ensureDefaultContent() {
  const defaults = await Promise.all(
    siteContentDefaults.map((item) =>
      SiteContent.findOneAndUpdate(
        { key: item.key },
        { $setOnInsert: item },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    )
  );
  await Promise.all(defaults.map((content) => {
    const defaultItem = siteContentDefaults.find((item) => item.key === content.key);
    if (!defaultItem || !isPlainObject(defaultItem.value)) return null;
    const mergedValue = mergeMissingDefaults(defaultItem.value, content.value);
    if (JSON.stringify(mergedValue) === JSON.stringify(content.value)) return null;
    content.value = mergedValue;
    return content.save();
  }));
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
