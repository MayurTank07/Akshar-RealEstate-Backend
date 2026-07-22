import { Location } from "../models/Location.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createLocation, ensureDefaultLocations, publicLocationView, recalculateLocationPropertyCounts } from "../services/locationService.js";

function locationFilter(query = {}) {
  const filter = {};
  if (query.active !== "all") filter.isActive = query.active === "false" ? false : true;
  if (query.indexable === "true") filter.isIndexable = true;
  if (query.verificationStatus && query.verificationStatus !== "all") filter.verificationStatus = query.verificationStatus;
  if (query.locationType && query.locationType !== "all") filter.locationType = query.locationType;
  return filter;
}

export const listLocations = asyncHandler(async (req, res) => {
  await ensureDefaultLocations();
  if (req.query.refreshCounts === "true") await recalculateLocationPropertyCounts();
  const locations = await Location.find(locationFilter(req.query)).sort({ locationType: 1, name: 1 }).lean();
  res.json({ success: true, data: locations.map(publicLocationView) });
});

export const createLocationHandler = asyncHandler(async (req, res) => {
  const location = await createLocation(req.validated.body, req.user);
  res.status(201).json({ success: true, data: publicLocationView(location) });
});

