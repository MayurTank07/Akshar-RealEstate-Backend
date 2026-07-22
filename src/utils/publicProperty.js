const DEFAULT_PUBLIC_BROKER = {
  name: "Contact our property expert",
  phone: "",
  whatsapp: "",
  hasDirectContact: false,
  designation: "Real Estate Expert",
  companyName: "Akshar Estate The Property HUB",
  avatar: "",
};

const PUBLIC_PROPERTY_FIELDS = [
  "_id",
  "id",
  "locationRef",
  "title",
  "location",
  "city",
  "type",
  "dealType",
  "developerName",
  "topProject",
  "topDeveloper",
  "price",
  "priceAmount",
  "priceUnit",
  "beds",
  "baths",
  "sqft",
  "measurement",
  "area",
  "tag",
  "badge",
  "badgeColor",
  "status",
  "propertyStatus",
  "category",
  "availability",
  "constructionStatus",
  "possessionStatus",
  "facing",
  "ownership",
  "featured",
  "image",
  "gallery",
  "media",
  "description",
  "nearbyLandmarks",
  "videoUrl",
  "amenities",
  "features",
  "facilities",
  "highlights",
  "parking",
  "floorNumber",
  "totalFloors",
  "furnishing",
  "kitchen",
  "balcony",
  "landArea",
  "plotSize",
  "roadAccess",
  "waterAvailability",
  "electricityAvailability",
  "zoning",
  "frontage",
  "washrooms",
  "businessSuitability",
  "pantry",
  "loadingAccess",
  "legalNotes",
  "ageOfProperty",
  "propertyTags",
  "isNewProject",
  "isPreLeased",
  "isBarter",
  "roi",
  "yearBuilt",
  "propertyCode",
  "source",
  "createdAt",
  "updatedAt",
];

function plainObject(value) {
  return typeof value?.toObject === "function" ? value.toObject() : value || {};
}

function pick(source, keys) {
  return Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
}

function sanitizePublicDescription(value = "") {
  return String(value)
    .replace(/private site visits?/gi, "private consultation")
    .replace(/site visits?/gi, "property consultation");
}

function usableStaff(value) {
  const staff = plainObject(value);
  return staff && (staff.name || staff.phone || staff.whatsapp || staff.role) ? staff : null;
}

function publicBroker(property) {
  const assignedTo = usableStaff(property.assignedTo);
  const staff = assignedTo?.role === "supervisor" ? assignedTo : null;
  if (!staff) return { ...DEFAULT_PUBLIC_BROKER };
  return {
    name: staff.name || DEFAULT_PUBLIC_BROKER.name,
    phone: staff.phone || "",
    whatsapp: staff.whatsapp || staff.phone || "",
    hasDirectContact: Boolean(staff.whatsapp || staff.phone),
    designation: staff.designation || DEFAULT_PUBLIC_BROKER.designation,
    companyName: staff.companyName || DEFAULT_PUBLIC_BROKER.companyName,
    avatar: staff.avatar || DEFAULT_PUBLIC_BROKER.avatar,
  };
}

export function publicPropertyView(value) {
  const property = plainObject(value);
  const safe = pick(property, PUBLIC_PROPERTY_FIELDS);
  if (safe.locationRef && typeof safe.locationRef === "object") {
    safe.locationMaster = {
      _id: safe.locationRef._id,
      name: safe.locationRef.name || "",
      gujaratiName: safe.locationRef.gujaratiName || "",
      slug: safe.locationRef.slug || "",
      city: safe.locationRef.city || "",
      state: safe.locationRef.state || "",
      locationType: safe.locationRef.locationType || "",
      isIndexable: Boolean(safe.locationRef.isIndexable),
      verificationStatus: safe.locationRef.verificationStatus || "needsVerification",
    };
    safe.locationRef = safe.locationRef._id;
  }
  if (safe.description) safe.description = sanitizePublicDescription(safe.description);
  const map = plainObject(property.map);
  safe.map = {
    area: map.area || property.location || "",
    city: map.city || property.city || "",
    state: map.state || "",
  };
  safe.broker = publicBroker(property);
  return safe;
}

export function sanitizeWishlistProperty(value) {
  const property = plainObject(value);
  const safe = pick(property, PUBLIC_PROPERTY_FIELDS);
  if (safe.locationRef && typeof safe.locationRef === "object") {
    safe.locationMaster = {
      _id: safe.locationRef._id,
      name: safe.locationRef.name || "",
      gujaratiName: safe.locationRef.gujaratiName || "",
      slug: safe.locationRef.slug || "",
      city: safe.locationRef.city || "",
      state: safe.locationRef.state || "",
      locationType: safe.locationRef.locationType || "",
      isIndexable: Boolean(safe.locationRef.isIndexable),
      verificationStatus: safe.locationRef.verificationStatus || "needsVerification",
    };
    safe.locationRef = safe.locationRef._id;
  }
  if (safe.description) safe.description = sanitizePublicDescription(safe.description);
  const broker = plainObject(property.broker);
  const map = plainObject(property.map);
  safe.map = {
    area: map.area || property.location || "",
    city: map.city || property.city || "",
    state: map.state || "",
  };
  safe.broker = {
    name: broker.name || DEFAULT_PUBLIC_BROKER.name,
    phone: broker.phone || DEFAULT_PUBLIC_BROKER.phone,
    whatsapp: broker.hasDirectContact === false ? "" : broker.whatsapp || broker.phone || DEFAULT_PUBLIC_BROKER.whatsapp,
    hasDirectContact: broker.hasDirectContact !== false && Boolean(broker.whatsapp || broker.phone),
    designation: broker.designation || DEFAULT_PUBLIC_BROKER.designation,
    companyName: broker.companyName || DEFAULT_PUBLIC_BROKER.companyName,
    avatar: broker.avatar || DEFAULT_PUBLIC_BROKER.avatar,
  };
  return safe;
}
