import { connectDB } from "../config/db.js";
import { Property } from "../models/Property.js";
import { applyPropertySeoFields } from "../services/propertySeoService.js";

async function backfillPropertySeo() {
  await connectDB();
  const properties = await Property.find({ deletedAt: null });
  const updated = [];

  for (const property of properties) {
    const body = property.toObject();
    body.slug = "";
    if (body.seo) body.seo.slug = "";
    await applyPropertySeoFields(body, { existing: property, user: { role: "admin" }, forceSlug: true });
    Object.assign(property, {
      slug: body.slug,
      seoTitle: body.seoTitle,
      metaDescription: body.metaDescription,
      canonicalUrl: body.canonicalUrl,
      seo: body.seo,
      propertyType: body.propertyType,
      listingType: body.listingType,
      bhk: body.bhk,
      carpetArea: body.carpetArea,
      builtUpArea: body.builtUpArea,
      plotArea: body.plotArea,
      propertyAge: body.propertyAge,
      floor: body.floor,
      projectName: body.projectName,
      societyName: body.societyName,
      address: body.address,
      locationId: body.locationId,
      district: body.district,
      latitude: body.latitude,
      longitude: body.longitude,
      assignedSupervisor: body.assignedSupervisor,
      sellerName: body.sellerName,
      isFeatured: body.isFeatured,
      isIndexable: body.isIndexable,
      images: body.images,
      imageAltTexts: body.imageAltTexts,
      publishedAt: body.publishedAt,
      lastModifiedAt: body.lastModifiedAt,
    });
    await property.save();
    updated.push({ id: property._id.toString(), title: property.title, slug: property.slug });
  }

  console.log(JSON.stringify({ updatedCount: updated.length, updated }, null, 2));
  process.exit(0);
}

backfillPropertySeo().catch((error) => {
  console.error(error);
  process.exit(1);
});
