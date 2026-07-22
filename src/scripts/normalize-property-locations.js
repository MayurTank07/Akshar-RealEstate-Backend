import { connectDB } from "../config/db.js";
import { Location } from "../models/Location.js";
import { Property } from "../models/Property.js";
import { ensureDefaultLocations, recalculateLocationPropertyCounts } from "../services/locationService.js";
import { slugify } from "../utils/slugify.js";

function candidateSlugs(property) {
  const values = [
    property.location,
    property.map?.area,
    String(property.location || "").split(",")[0],
  ];
  return [...new Set(values.map(slugify).filter(Boolean))];
}

async function normalizePropertyLocations() {
  await connectDB();
  await ensureDefaultLocations();

  const locations = await Location.find({ isActive: true }).lean();
  const bySlug = new Map(locations.map((location) => [location.slug, location]));
  const properties = await Property.find({ deletedAt: null }).lean();
  const updated = [];
  const needsVerification = [];

  for (const property of properties) {
    const match = candidateSlugs(property).map((slug) => bySlug.get(slug)).find(Boolean);
    if (!match) {
      needsVerification.push({
        id: property._id.toString(),
        title: property.title,
        location: property.location,
        city: property.city,
      });
      continue;
    }

    const city = match.city || property.city || property.map?.city || "";
    await Property.updateOne(
      { _id: property._id },
      {
        $set: {
          locationRef: match._id,
          location: match.name,
          city,
          "map.area": match.name,
          "map.city": city,
          "map.state": match.state || property.map?.state || "Gujarat",
          "map.pincode": match.pinCode || property.map?.pincode || "",
          "map.latitude": match.latitude ?? property.map?.latitude ?? null,
          "map.longitude": match.longitude ?? property.map?.longitude ?? null,
        },
      }
    );
    updated.push({ id: property._id.toString(), title: property.title, location: match.name, slug: match.slug });
  }

  await recalculateLocationPropertyCounts();
  console.log(JSON.stringify({ updatedCount: updated.length, updated, needsVerificationCount: needsVerification.length, needsVerification }, null, 2));
  process.exit(0);
}

normalizePropertyLocations().catch((error) => {
  console.error(error);
  process.exit(1);
});

