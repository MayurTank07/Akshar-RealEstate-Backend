import { PROPERTY_OPTION_DEFAULTS } from "../config/propertyOptionDefaults.js";
import { PropertyOption } from "../models/PropertyOption.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function normalize(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

async function ensureDefaultOptions() {
  const operations = Object.entries(PROPERTY_OPTION_DEFAULTS).flatMap(([group, values]) =>
    values.map((value) => ({
      updateOne: {
        filter: { group, normalizedValue: value.toLowerCase() },
        update: { $setOnInsert: { group, label: value, value, normalizedValue: value.toLowerCase(), isDefault: true } },
        upsert: true,
      },
    }))
  );
  if (operations.length) await PropertyOption.bulkWrite(operations, { ordered: false });
}

export const listPropertyOptions = asyncHandler(async (_req, res) => {
  await ensureDefaultOptions();
  const options = await PropertyOption.find().sort({ group: 1, isDefault: -1, label: 1 }).lean();
  const grouped = options.reduce((acc, item) => {
    acc[item.group] ||= [];
    acc[item.group].push({ _id: item._id, label: item.label, value: item.value, isDefault: item.isDefault });
    return acc;
  }, {});
  res.json({ success: true, data: grouped });
});

export const createPropertyOption = asyncHandler(async (req, res) => {
  const group = normalize(req.validated.body.group);
  const value = normalize(req.validated.body.value);
  const normalizedValue = value.toLowerCase();
  const option = await PropertyOption.findOneAndUpdate(
    { group, normalizedValue },
    { $setOnInsert: { group, label: value, value, normalizedValue, createdBy: req.user._id } },
    { upsert: true, new: true, runValidators: true }
  ).lean();
  res.status(201).json({ success: true, data: { _id: option._id, label: option.label, value: option.value, isDefault: option.isDefault } });
});
