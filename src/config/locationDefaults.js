import { slugify } from "../utils/slugify.js";

const GUJARATI_NAMES = {
  Kudasan: "કુડાસણ",
  Sargasan: "સરગાસણ",
  "South Bopal": "સાઉથ બોપલ",
};

const LOCATION_NAMES = [
  "Gandhinagar",
  "Dehgam",
  "Mahudi",
  "Vijapur",
  "Pethapur",
  "Vavol",
  "Kudasan",
  "Sargasan",
  "Uvarsad",
  "Ambapur",
  "Palaj",
  "Randheja",
  "Kadi",
  "Kalol",
  "Chekhla",
  "Adhana",
  "Viramgam",
  "Sanand",
  "Kolat",
  "Shela",
  "Ghuma",
  "Bopal",
  "Ahmedabad",
  "Ahmedabad West",
  "Vaishnodevi",
  "Zundal",
  "Science City",
  "GIFT City",
  "Dholera",
  "South Bopal",
  "Manipur",
  "Bodakdev",
  "Adalaj",
  "Motera",
  "Thaltej",
  "Gota",
  "Chharodi",
  "S.G. Highway",
  "Memnagar",
  "Gurukul",
  "C.G. Road",
  "New C.G. Road",
  "Chandkheda",
  "Tragad",
  "Nadiad",
  "Anand",
  "Mahemdavad",
  "Bareja",
  "Kathlal",
  "Kubadthal",
  "Kujad",
  "Kanbha",
  "Lothal",
  "Moraiya",
  "Nalsarovar",
  "Bavla",
  "Changodar",
  "Bagodara",
  "Chhatral",
  "Vanthal",
  "Kumar Khan",
  "Shahpur",
  "Pirojpur",
  "Lavarpur",
  "Pundrasan",
  "Dhanap",
  "Deshela",
  "Sadra",
  "Gram Bharati",
  "Prantij",
  "Vahelal",
  "Naroda",
  "Kathwada",
  "Bhuvaldi",
  "Bahiyal",
  "Pasunj",
  "Ram Nagar",
  "Adroda",
  "Sola",
  "Lambha",
  "Isanpur",
  "Mota Isanpur",
  "Ajol",
  "Aankhaj",
  "Nardipur",
  "Ognaj",
  "Chandlodia",
  "Ghatlodia",
  "Singarva",
  "Odhav",
  "Bapunagar",
  "Maninagar",
  "Vatva",
  "Bakrol",
  "Bhat",
  "Shantipura",
  "Sanathal",
  "Godhavi",
  "Upar Dal",
  "Vinchiya",
];

function uniqueBySlug(names) {
  const seen = new Set();
  return names.filter((name) => {
    const slug = slugify(name);
    if (!slug || seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
}

function locationTypeFor(name) {
  if (["Ahmedabad", "Gandhinagar", "Anand", "Nadiad", "Sanand", "Kalol", "Kadi", "Dehgam", "Vijapur", "Viramgam", "Dholera", "Bavla"].includes(name)) {
    return "city";
  }
  if (["Ahmedabad West", "S.G. Highway", "C.G. Road", "New C.G. Road", "GIFT City"].includes(name)) return "region";
  return "locality";
}

export const DEFAULT_LOCATIONS = uniqueBySlug(LOCATION_NAMES).map((name) => {
  const slug = slugify(name);
  const locationType = locationTypeFor(name);
  return {
    name,
    gujaratiName: GUJARATI_NAMES[name] || "",
    slug,
    city: locationType === "city" ? name : "",
    district: "",
    taluka: "",
    state: "Gujarat",
    country: "India",
    pinCode: "",
    latitude: null,
    longitude: null,
    parentRegion: "",
    locationType,
    seoTitle: `${name} Real Estate | Akshar Estate The Property Hub`,
    metaDescription: `Explore verified property options in ${name} with Akshar Estate The Property Hub.`,
    shortDescription: `${name} is part of the Akshar Estate location master and is pending manual verification before SEO publication.`,
    longDescription: "",
    primaryKeyword: `${name} property`,
    secondaryKeywords: [`property in ${name}`, `${name} real estate`],
    isActive: true,
    isIndexable: false,
    propertyCount: 0,
    verificationStatus: "needsVerification",
  };
});

