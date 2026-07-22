import { slugify } from "../utils/slugify.js";

const drafts = [
  {
    title: "Best Areas to Buy Property in Gandhinagar and Ahmedabad",
    excerpt: "A practical draft guide comparing established and fast-moving residential areas across Gandhinagar and Ahmedabad.",
    category: "Buying Guide",
    relatedLocations: ["Gandhinagar", "Ahmedabad", "Kudasan", "Sargasan", "Bopal", "South Bopal", "Shela", "GIFT City"],
    body: [
      "This draft is intended for the Akshar Estate content team.",
      "",
      "Suggested coverage:",
      "- Buyer priorities such as commute, nearby services, property type, budget comfort and long-term usability.",
      "- Gandhinagar areas including Kudasan, Sargasan, Vavol, Pethapur and GIFT City.",
      "- Ahmedabad areas including Bopal, South Bopal, Shela, Science City, Thaltej and Sanand.",
      "- A balanced comparison that avoids guaranteed returns or unsupported statistics.",
      "",
      "Before publishing, add current inventory examples, verified local observations and supervisor-reviewed details.",
    ].join("\n"),
  },
  {
    title: "2 BHK vs 3 BHK in Gandhinagar",
    excerpt: "A draft buyer guide for comparing 2 BHK and 3 BHK homes in Gandhinagar localities.",
    category: "Buying Guide",
    relatedLocations: ["Gandhinagar", "Kudasan", "Sargasan", "Vavol", "Pethapur", "GIFT City"],
    body: [
      "This draft is intended for the Akshar Estate content team.",
      "",
      "Suggested coverage:",
      "- How family size, work-from-home needs, maintenance comfort and resale flexibility affect the choice.",
      "- Local examples from Kudasan, Sargasan, Vavol, Pethapur and GIFT City when active inventory is available.",
      "- A simple checklist for buyers to compare usable carpet area, parking, society amenities and possession status.",
      "",
      "Before publishing, verify all property examples against live inventory and avoid promises about price growth.",
    ].join("\n"),
  },
  {
    title: "GIFT City, Kudasan, Sargasan or Bopal: Where Should You Invest?",
    excerpt: "A draft comparison of four priority markets for buyers weighing lifestyle, commute and property options.",
    category: "Market Guide",
    relatedLocations: ["GIFT City", "Kudasan", "Sargasan", "Bopal", "Gandhinagar", "Ahmedabad"],
    body: [
      "This draft is intended for the Akshar Estate content team.",
      "",
      "Suggested coverage:",
      "- Compare buyer intent rather than predicting returns.",
      "- GIFT City for business district proximity, Kudasan and Sargasan for Gandhinagar residential demand, and Bopal for Ahmedabad connectivity.",
      "- Include practical checks such as commute route, possession status, usable area, parking, nearby services and supervisor availability.",
      "",
      "Before publishing, add only verified project or listing information and avoid guaranteed investment outcomes.",
    ].join("\n"),
  },
];

export const defaultBlogDrafts = drafts.map((draft) => ({
  ...draft,
  slug: slugify(draft.title),
  metaTitle: draft.title,
  metaDescription: draft.excerpt,
  author: "Akshar Estate Editorial Team",
  status: "draft",
  isIndexable: false,
  publishedAt: null,
}));
