/**
 * Seed script: inserts demo Certification documents for visual testing.
 * Run once: node src/seed-certifications.js
 * Safe to re-run – skips insertion if demo records already exist.
 */
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { Certification } from "./models/Certification.js";

const demos = [
  {
    title: "ISO 9001 Certified",
    description: "International standard for quality management systems.",
    image: "https://placehold.co/800x600/eff6ff/2563eb.png?text=ISO+9001+Certified",
    publicId: "",
    displayOrder: 1,
    isActive: true,
  },
  {
    title: "RERA Registered",
    description: "Registered under Real Estate Regulatory Authority.",
    image: "https://placehold.co/800x600/f0fdf4/16a34a.png?text=RERA+Registered",
    publicId: "",
    displayOrder: 2,
    isActive: true,
  },
  {
    title: "NAR Member",
    description: "Proud member of the National Association of Realtors.",
    image: "https://placehold.co/800x600/fefce8/ca8a04.png?text=NAR+Member",
    publicId: "",
    displayOrder: 3,
    isActive: true,
  },
  {
    title: "Best Real Estate Agency 2024",
    description: "Awarded Best Real Estate Agency in Ahmedabad for 2024.",
    image: "https://placehold.co/800x600/fdf4ff/9333ea.png?text=Best+Agency+2024",
    publicId: "",
    displayOrder: 4,
    isActive: true,
  },
];

async function seed() {
  await mongoose.connect(env.mongoUri);
  console.log("Connected to MongoDB");

  let inserted = 0;
  for (const demo of demos) {
    const exists = await Certification.findOne({ title: demo.title });
    if (!exists) {
      await Certification.create(demo);
      console.log(`  ✓ Inserted: ${demo.title}`);
      inserted++;
    } else {
      console.log(`  – Already exists, skipped: ${demo.title}`);
    }
  }

  console.log(`\nDone. ${inserted} new certification(s) inserted.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
