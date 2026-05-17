import { z } from "zod";
import { ALL_PERMISSION_VALUES } from "../config/permissions.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const mediaString = z.string().min(1);
const stringArray = z.array(z.string().trim().min(1)).optional().default([]);
const assignableId = z.union([objectId, z.literal(""), z.null()]).optional().transform((value) => value || null);

export const idParamSchema = z.object({
  params: z.object({ id: objectId }),
});

export const staffLoginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
  }),
});

export const propertySchema = z.object({
  body: z.object({
    title: z.string().min(2),
    location: z.string().min(2),
    city: z.string().optional().default(""),
    type: z.string().min(2),
    price: z.string().min(1),
    beds: z.coerce.number().int().min(0).default(0),
    baths: z.coerce.number().int().min(0).default(0),
    sqft: z.coerce.number().int().min(0).default(0),
    measurement: z
      .object({
        value: z.coerce.number().min(0).optional().default(0),
        unit: z.enum(["sqft", "vigha", "acre", "sq-yard", "sq-meter", "guntha", "hectare", "custom"]).optional().default("sqft"),
        customUnit: z.string().optional().default(""),
      })
      .optional()
      .default({ value: 0, unit: "sqft", customUnit: "" }),
    area: z.string().optional().default(""),
    tag: z.enum(["Featured", "New", "Hot", "Standard"]).default("Standard"),
    badge: z.string().optional().default(""),
    badgeColor: z.string().optional().default("bg-blue-600"),
    status: z.enum(["active", "pending", "inactive", "sold", "rented"]).default("active"),
    propertyStatus: z.string().optional().default("Ready"),
    category: z.string().optional().default(""),
    availability: z.string().optional().default(""),
    facing: z.string().optional().default(""),
    visibility: z.enum(["public", "private"]).optional().default("public"),
    featured: z.coerce.boolean().optional().default(false),
    ownerName: z.string().optional().default("Akshar Estate"),
    image: mediaString,
    gallery: z.array(mediaString).optional().default([]),
    description: z.string().optional().default(""),
    videoUrl: z.string().optional().default(""),
    amenities: stringArray,
    features: stringArray,
    facilities: stringArray,
    highlights: stringArray,
    parking: z.string().optional().default(""),
    furnishing: z.string().optional().default(""),
    propertyTags: stringArray,
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
        latitude: z.coerce.number().nullable().optional().default(null),
        longitude: z.coerce.number().nullable().optional().default(null),
        embedUrl: z.string().optional().default(""),
      })
      .optional()
      .default({ address: "", latitude: null, longitude: null, embedUrl: "" }),
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
    assignedTo: assignableId,
    source: z.enum(["home", "pricing"]).default("pricing"),
  }),
});

export const enquiryCreateSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(8),
    age: z.coerce.number().optional(),
    preferredLocation: z.string().optional().default(""),
    location: z.string().optional(),
    budget: z.union([z.string(), z.number()]).optional().default(""),
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
    avatar: z.string().optional().default(""),
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
    status: z.enum(["pending", "approved", "rejected"]),
  }),
});

export const contentUpdateSchema = z.object({
  body: z.object({
    value: z.any(),
  }),
});
