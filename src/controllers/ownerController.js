import { OwnerApplication } from "../models/OwnerApplication.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listOwners = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
  const owners = await OwnerApplication.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: owners });
});

export const updateOwnerStatus = asyncHandler(async (req, res) => {
  const owner = await OwnerApplication.findByIdAndUpdate(
    req.validated.params.id,
    { status: req.validated.body.status },
    { new: true, runValidators: true }
  );
  if (!owner) throw new ApiError(404, "Owner application not found");
  res.json({ success: true, data: owner });
});
