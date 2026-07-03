import { z } from "zod";
import { ALL_PERMISSION_VALUES } from "../config/permissions.js";
import { PROPERTY_OPTION_GROUPS } from "../config/propertyOptionDefaults.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const mediaString = z.string().min(1);
const stringArray = z.array(z.string().trim().min(1)).optional().default([]);
const mediaAssetSchema = z.object({
  url: z.string().trim().min(1),
  publicId: z.string().trim().optional().default(""),
  resourceType: z.string().trim().optional().default("image"),
  originalName: z.string().trim().optional().default(""),
  format: z.string().trim().optional().default(""),
  size: z.coerce.number().min(0).optional().default(0),
});
const assignableId = z.union([objectId, z.literal(""), z.null()]).optional().transform((value) => value || null);
const propertyTextLimit = 1000;
const propertyDescription = z.string().trim().max(propertyTextLimit, "Property description must be 1000 characters or less");
const nearbyLandmarksText = z.string().trim().max(propertyTextLimit, "Nearby landmarks must be 1000 characters or less");
const ownerProofDocumentSchema = z
  .object({
    documentType: z.enum(["Ownership Proof", "Electricity Bill", "Tax Bill", "Index Copy", "Other"]),
    customDocumentName: z.string().trim().max(80, "Custom document name must be 80 characters or less").optional().default(""),
    originalName: z.string().trim().min(1),
    mimeType: z.string().trim().min(1),
    resourceType: z.string().trim().optional().default("image"),
    format: z.string().trim().optional().default(""),
    size: z.coerce.number().min(0).optional().default(0),
    url: z.string().trim().min(1),
    publicId: z.string().trim().optional().default(""),
    status: z.enum(["uploaded", "verified", "rejected"]).optional().default("uploaded"),
    uploadedAt: z.union([z.coerce.date(), z.string()]).optional(),
  })
  .refine((value) => value.documentType !== "Other" || Boolean(value.customDocumentName), {
    message: "Custom document name is required when owner proof type is Others",
    path: ["customDocumentName"],
  });

export const idParamSchema = z.object({
  params: z.object({ id: objectId }),
});

export const propertyOptionCreateSchema = z.object({
  body: z.object({
    group: z.enum(PROPERTY_OPTION_GROUPS),
    value: z.string().trim().min(1, "Option value is required").max(80),
  }),
});

export const staffLoginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
  }),
});

export const userRegisterSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
    email: z.string().email(),
    phone: z.string().trim().min(8),
    password: z.string().min(8),
  }),
});

export const userLoginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
  }),
});

export const userGoogleAuthSchema = z.object({
  body: z.object({
    credential: z.string().trim().min(20, "Google credential is required"),
  }),
});

export const userWishlistItemSchema = z.object({
  body: z
    .object({
      _id: z.string().optional(),
      id: z.union([z.string(), z.number()]).optional(),
      source: z.string().trim().optional().default("property"),
      title: z.string().trim().optional().default(""),
      location: z.string().trim().optional().default(""),
      city: z.string().trim().optional().default(""),
      area: z.union([z.string(), z.number()]).optional().default(""),
      image: z.string().trim().optional().default(""),
      price: z.union([z.string(), z.number()]).optional().default(""),
      priceAmount: z.coerce.number().optional().default(0),
      beds: z.coerce.number().optional().default(0),
      baths: z.coerce.number().optional().default(0),
      sqft: z.coerce.number().optional().default(0),
      type: z.string().trim().optional().default(""),
      tag: z.string().trim().optional().default(""),
      badge: z.string().trim().optional().default(""),
      badgeColor: z.string().trim().optional().default(""),
    })
    .passthrough()
    .refine((value) => value._id || value.id, "Property id is required"),
});

export const profileUpdateSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional().default(""),
    designation: z.string().optional(),
    avatar: z.string().optional(),
  }),
});

export const passwordChangeSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(8),
  }),
});

export const propertySchema = z.object({
  body: z.object({
    title: z.string().min(2),
    location: z.string().min(2),
    city: z.string().optional().default(""),
    type: z.string().min(2),
    dealType: z.string().optional().default(""),
    developerName: z.string().optional().default(""),
    topProject: z.string().optional().default(""),
    topDeveloper: z.string().optional().default(""),
    price: z.string().min(1),
    priceAmount: z.coerce.number().min(0).optional().default(0),
    priceUnit: z.string().optional().default(""),
    beds: z.coerce.number().int().min(0).default(0),
    baths: z.coerce.number().int().min(0).default(0),
    sqft: z.coerce.number().int().min(0).default(0),
    measurement: z
      .object({
        value: z.coerce.number().min(0).optional().default(0),
        unit: z.string().trim().min(1).optional().default("sqft"),
      })
      .optional()
      .default({ value: 0, unit: "sqft" }),
    area: z.string().optional().default(""),
    tag: z.string().trim().min(1).default("Standard"),
    badge: z.string().optional().default(""),
    badgeColor: z.string().optional().default("bg-blue-600"),
    status: z.string().trim().min(1).transform((value) => value.toLowerCase()).default("active"),
    propertyStatus: z.string().optional().default("Ready"),
    category: z.string().optional().default(""),
    availability: z.string().optional().default(""),
    constructionStatus: z.string().optional().default(""),
    possessionStatus: z.string().optional().default(""),
    brokerageType: z.string().optional().default(""),
    facing: z.string().optional().default(""),
    ownership: z.string().optional().default(""),
    visibility: z.enum(["public", "private"]).optional().default("public"),
    featured: z.coerce.boolean().optional().default(false),
    ownerName: z.string().optional().default("Akshar Estate"),
    image: mediaString,
    gallery: z.array(mediaString).optional().default([]),
    media: z.array(mediaAssetSchema).optional().default([]),
    description: propertyDescription.optional().default(""),
    nearbyLandmarks: nearbyLandmarksText.optional().default(""),
    videoUrl: z.string().optional().default(""),
    amenities: stringArray,
    features: stringArray,
    facilities: stringArray,
    highlights: stringArray,
    parking: z.string().optional().default(""),
    floorNumber: z.string().optional().default(""),
    totalFloors: z.string().optional().default(""),
    furnishing: z.string().optional().default(""),
    kitchen: z.string().optional().default(""),
    balcony: z.string().optional().default(""),
    landArea: z.string().optional().default(""),
    plotSize: z.string().optional().default(""),
    roadAccess: z.string().optional().default(""),
    waterAvailability: z.string().optional().default(""),
    electricityAvailability: z.string().optional().default(""),
    zoning: z.string().optional().default(""),
    frontage: z.string().optional().default(""),
    washrooms: z.string().optional().default(""),
    businessSuitability: z.string().optional().default(""),
    pantry: z.string().optional().default(""),
    loadingAccess: z.string().optional().default(""),
    legalNotes: z.string().optional().default(""),
    ageOfProperty: z.string().optional().default(""),
    propertyTags: stringArray,
    isNewProject: z.coerce.boolean().optional().default(false),
    isPreLeased: z.coerce.boolean().optional().default(false),
    isBarter: z.coerce.boolean().optional().default(false),
    roi: z.string().optional().default(""),
    contact: z
      .object({
        name: z.string().optional().default(""),
        phone: z.string().optional().default(""),
        email: z.union([z.string().email(), z.literal("")]).optional().default(""),
      })
      .optional()
      .default({ name: "", phone: "", email: "" }),
    map: z
      .object({
        address: z.string().optional().default(""),
        area: z.string().optional().default(""),
        city: z.string().optional().default(""),
        state: z.string().optional().default(""),
        pincode: z.string().optional().default(""),
        latitude: z.coerce.number().nullable().optional().default(null),
        longitude: z.coerce.number().nullable().optional().default(null),
        placeId: z.string().optional().default(""),
        embedUrl: z.string().optional().default(""),
      })
      .optional()
      .default({ address: "", area: "", city: "", state: "", pincode: "", latitude: null, longitude: null, placeId: "", embedUrl: "" }),
    seo: z
      .object({
        metaTitle: z.string().optional().default(""),
        metaDescription: z.string().optional().default(""),
        slug: z.string().optional().default(""),
      })
      .optional()
      .default({ metaTitle: "", metaDescription: "", slug: "" }),
    yearBuilt: z.coerce.number().int().nullable().optional().default(null),
    propertyCode: z.string().optional().default(""),
    finalPrice: z.string().optional().default(""),
    finalPriceAmount: z.coerce.number().min(0).optional().default(0),
    commission: z.string().optional().default(""),
    commissionAmount: z.coerce.number().min(0).optional().default(0),
    paymentDetails: z.string().optional().default(""),
    statusRemarks: z.string().optional().default(""),
    dealSource: z.enum(["", "manual", "enquiry"]).optional().default(""),
    dealEnquiryId: assignableId.optional().nullable(),
    dealCustomerName: z.string().optional().default(""),
    dealCustomerPhone: z.string().optional().default(""),
    dealCustomerEmail: z.union([z.string().email(), z.literal("")]).optional().default(""),
    dealCustomerAddress: z.string().optional().default(""),
    dealDate: z.union([z.coerce.date(), z.literal(""), z.null()]).optional().default(null),
    assignedTo: assignableId,
    ownerUserId: assignableId.optional().nullable(),
    ownerRequestId: assignableId.optional().nullable(),
    source: z.enum(["home", "pricing", "admin_added", "supervisor_added", "seller_owner"]).default("pricing"),
  }),
});

export const enquiryCreateSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    countryCode: z.string().trim().regex(/^\+\d{1,4}$/, "Country code must start with + and contain digits").optional().default("+91"),
    phone: z.string().min(8),
    age: z.coerce.number().optional(),
    preferredLocation: z.string().optional().default(""),
    location: z.string().optional(),
    budget: z.union([z.string(), z.number()]).optional().default(""),
    budgetAmount: z.coerce.number().min(0).optional().default(0),
    budgetLabel: z.string().optional().default(""),
    propertyType: z.string().optional(),
    type: z.string().optional(),
    propertyTitle: z.string().optional().default(""),
    propertyId: objectId.optional(),
    message: z.string().optional().default(""),
    source: z.enum(["website", "property-detail", "guest", "admin"]).optional().default("website"),
    status: z.enum(["new", "in-progress", "closed"]).optional().default("new"),
  }),
});

export const enquiryUpdateSchema = z.object({
  body: enquiryCreateSchema.shape.body.partial().extend({
    assignedTo: objectId.optional().nullable(),
    note: z.string().optional(),
    conversionType: z.enum(["sold", "rented", "no-conversion", ""]).optional(),
    finalPrice: z.string().optional(),
    finalPriceAmount: z.coerce.number().min(0).optional(),
    commission: z.string().optional(),
    commissionAmount: z.coerce.number().min(0).optional(),
    paymentDetails: z.string().optional(),
    closingDate: z.union([z.coerce.date(), z.literal(""), z.null()]).optional(),
    followUpDate: z.union([z.coerce.date(), z.literal(""), z.null()]).optional(),
    remarks: z.string().optional(),
  }),
});

const permissionSchema = z.array(z.enum(ALL_PERMISSION_VALUES)).optional().default([]);

export const staffCreateSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(["admin", "supervisor"]),
    phone: z.string().optional().default(""),
    designation: z.string().optional().default(""),
    companyName: z.string().trim().max(120).optional().default(""),
    avatar: z.string().optional().default(""),
    coverImage: z.string().optional().default(""),
    permissions: permissionSchema,
    status: z.enum(["active", "disabled"]).optional().default("active"),
    propertiesManaged: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export const staffUpdateSchema = z.object({
  body: staffCreateSchema.shape.body.omit({ password: true }).partial().extend({
    password: z.string().min(8).optional(),
  }),
});

export const ownerStatusSchema = z.object({
  body: z.object({
    status: z.enum(["pending", "approved", "rejected", "needs_changes"]),
    remarks: z.string().optional().default(""),
  }),
});

export const ownerDeleteRequestSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(5, "Delete request reason is required"),
  }),
});

export const ownerDeleteReviewSchema = z.object({
  body: z.object({
    deleteStatus: z.enum(["approved", "rejected"]),
    remarks: z.string().trim().optional().default(""),
  }),
});

const ownerDeclarationSchema = z.object({
  ownerOrAuthorized: z.coerce.boolean(),
  accurateDetails: z.coerce.boolean(),
  mediaBelongsToProperty: z.coerce.boolean(),
  understandsRemoval: z.coerce.boolean(),
  agreesContact: z.coerce.boolean(),
});

const ownerPropertyDetailsSchema = z.object({
  title: z.string().trim().min(2),
  type: z.string().trim().min(2),
  purpose: z.enum(["sale", "rent", "pre-leased", "other"]).optional().default("sale"),
  city: z.string().trim().min(2),
  area: z.string().trim().min(2),
  address: z.string().trim().optional().default(""),
  bhk: z.string().trim().optional().default(""),
  rooms: z.string().trim().optional().default(""),
  carpetArea: z.coerce.number().min(0).optional().default(0),
  builtUpArea: z.coerce.number().min(0).optional().default(0),
  areaUnit: z.string().trim().optional().default("sqft"),
  floorNumber: z.string().trim().optional().default(""),
  totalFloors: z.string().trim().optional().default(""),
  furnishing: z.string().trim().optional().default(""),
  parking: z.string().trim().optional().default(""),
  facing: z.string().trim().optional().default(""),
  ageOfProperty: z.string().trim().optional().default(""),
  constructionYear: z.coerce
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear())
    .optional()
    .nullable()
    .default(null),
  expectedPrice: z.coerce.number().min(1, "Expected price/rent is required"),
  negotiable: z.coerce.boolean().optional().default(false),
  maintenanceCharges: z.coerce.number().min(0).optional().default(0),
  amenities: z.array(z.string().trim().min(1)).optional().default([]),
  description: propertyDescription.min(20, "Property description must be at least 20 characters"),
  nearbyLandmarks: nearbyLandmarksText.optional().default(""),
  availability: z.string().trim().optional().default(""),
  map: z
    .object({
      address: z.string().optional().default(""),
      area: z.string().optional().default(""),
      city: z.string().optional().default(""),
      state: z.string().optional().default(""),
      pincode: z.string().optional().default(""),
      latitude: z.coerce.number().nullable().optional().default(null),
      longitude: z.coerce.number().nullable().optional().default(null),
      placeId: z.string().optional().default(""),
    })
    .optional()
    .default({ address: "", area: "", city: "", state: "", pincode: "", latitude: null, longitude: null, placeId: "" }),
  notes: z.string().trim().optional().default(""),
});

export const ownerRequestSchema = z.object({
  body: z.object({
    ownerDetails: z.object({
      name: z.string().trim().min(2),
      email: z.string().email(),
      phone: z.string().trim().min(8),
      alternatePhone: z.string().trim().optional().default(""),
      ownershipType: z.string().trim().min(2),
    }),
    propertyDetails: ownerPropertyDetailsSchema,
    media: z
      .object({
        photos: z.array(z.string().trim().min(1)).min(4, "At least 4 property photos are required").max(10, "Maximum 10 property photos are allowed"),
        videos: z.array(z.string().trim().min(1)).optional().default([]),
        documents: z.array(z.string().trim().min(1)).optional().default([]),
        ownerProofs: z
          .array(ownerProofDocumentSchema)
          .min(1, "At least one owner proof document is required"),
      })
      .default({ photos: [], videos: [], documents: [], ownerProofs: [] }),
    declaration: ownerDeclarationSchema.refine((value) => Object.values(value).every(Boolean), "All declaration checkboxes must be accepted"),
  }),
});

export const ownerAdminUpdateSchema = z.object({
  body: z.object({
    ownerDetails: z
      .object({
        name: z.string().trim().min(2).optional(),
        email: z.string().email().optional(),
        phone: z.string().trim().min(8).optional(),
        alternatePhone: z.string().trim().optional(),
        ownershipType: z.string().trim().min(2).optional(),
      })
      .optional(),
    propertyDetails: ownerPropertyDetailsSchema.partial().optional(),
    media: z
      .object({
        photos: z.array(z.string().trim().min(1)).optional(),
        videos: z.array(z.string().trim().min(1)).optional(),
        documents: z.array(z.string().trim().min(1)).optional(),
      })
      .optional(),
  }),
});

export const userStatusSchema = z.object({
  body: z.object({
    status: z.enum(["active", "disabled"]),
  }),
});

export const contentUpdateSchema = z.object({
  body: z.object({
    value: z.any(),
  }),
});

export const certificationCreateSchema = z.object({
  body: z.object({
    title: z.string().trim().optional().default(""),
    description: z.string().trim().optional().default(""),
    image: z.string().trim().min(1, "Certification image is required"),
    publicId: z.string().trim().optional().default(""),
    displayOrder: z.coerce.number().int().min(0).optional().default(0),
    isActive: z.coerce.boolean().optional().default(true),
  }),
});

export const certificationUpdateSchema = z.object({
  body: certificationCreateSchema.shape.body.partial(),
});
