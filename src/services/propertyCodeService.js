import { Counter } from "../models/Counter.js";
import { Property } from "../models/Property.js";

const cityCodes = {
  surat: "ST",
  ahmedabad: "AHMD",
  mumbai: "MUM",
  vadodara: "VDR",
  rajkot: "RJK",
  gandhinagar: "GNR",
};

export function cityCodeFor(city = "") {
  const normalized = String(city || "").trim().toLowerCase();
  if (cityCodes[normalized]) return cityCodes[normalized];
  const letters = normalized.replace(/[^a-z]/g, "").toUpperCase();
  return (letters.slice(0, 4) || "GEN").padEnd(2, "X");
}

function sequenceFromCode(propertyCode = "") {
  const match = String(propertyCode).match(/-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

async function highestExistingSequence() {
  const existing = await Property.find({ propertyCode: /^AETP-[A-Z0-9]+-\d+$/ })
    .select("propertyCode")
    .lean();
  return existing.reduce((max, item) => Math.max(max, sequenceFromCode(item.propertyCode)), 0);
}

async function nextGlobalSequence({ reserve = false } = {}) {
  const counter = await Counter.findOne({ key: "property:global" }).lean();
  const current = Math.max(Number(counter?.seq || 0), await highestExistingSequence());
  if (!reserve) return current + 1;
  await Counter.updateOne(
    { key: "property:global" },
    { $max: { seq: current } },
    { upsert: true }
  );
  const updated = await Counter.findOneAndUpdate(
    { key: "property:global" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return updated.seq;
}

export async function previewPropertyCode(city) {
  const code = cityCodeFor(city || "Ahmedabad");
  const sequence = await nextGlobalSequence();
  return `AETP-${code}-${String(sequence).padStart(4, "0")}`;
}

export async function generatePropertyCode(city) {
  const code = cityCodeFor(city);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const sequence = await nextGlobalSequence({ reserve: true });
    const propertyCode = `AETP-${code}-${String(sequence).padStart(4, "0")}`;
    const exists = await Property.exists({ propertyCode });
    if (!exists) return propertyCode;
  }
  throw new Error("Unable to generate a unique property ID. Please retry.");
}

export async function syncPropertyCodeCounter(propertyCode) {
  const sequence = sequenceFromCode(propertyCode);
  if (!sequence) return;
  await Counter.updateOne(
    { key: "property:global" },
    { $max: { seq: sequence } },
    { upsert: true }
  );
}
