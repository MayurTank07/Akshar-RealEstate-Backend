import { connectDB } from "./config/db.js";
import { Activity } from "./models/Activity.js";
import { Enquiry } from "./models/Enquiry.js";
import { OwnerApplication } from "./models/OwnerApplication.js";
import { Property } from "./models/Property.js";
import { SiteContent } from "./models/SiteContent.js";
import { Staff } from "./models/Staff.js";
import { siteContentDefaults } from "./config/siteDefaults.js";

const image = "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=900";

const properties = [
  {
    title: "Luxury Modern Villa",
    location: "Thaltej, Ahmedabad",
    city: "Ahmedabad",
    type: "Villas",
    price: "₹8.5 Cr",
    beds: 4,
    baths: 3,
    sqft: 3200,
    area: "3200 sq.ft",
    tag: "Featured",
    badge: "Featured",
    badgeColor: "bg-blue-600",
    status: "active",
    ownerName: "Sarah Johnson",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=900",
    source: "home",
  },
  {
    title: "Contemporary Apartment",
    location: "Vesu, Surat",
    city: "Surat",
    type: "Apartments",
    price: "₹2.8 Cr",
    beds: 3,
    baths: 2,
    sqft: 1850,
    area: "1850 sq.ft",
    tag: "New",
    badge: "New",
    badgeColor: "bg-emerald-500",
    status: "pending",
    ownerName: "Sarah Johnson",
    image,
    source: "pricing",
  },
  {
    title: "Modern Penthouse",
    location: "Kalawad Road, Rajkot",
    city: "Rajkot",
    type: "Apartments",
    price: "₹6.5 Cr",
    beds: 4,
    baths: 3,
    sqft: 3800,
    area: "3800 sq.ft",
    tag: "Featured",
    badge: "Featured",
    badgeColor: "bg-blue-600",
    status: "active",
    ownerName: "Hitesh Patel",
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=900",
    source: "pricing",
  },
];

const enquiries = [
  {
    name: "Alice Cooper",
    email: "alice@email.com",
    phone: "+91 98765 43210",
    propertyTitle: "Luxury Modern Villa",
    message: "Interested in scheduling a visit this weekend",
    status: "new",
    source: "website",
  },
  {
    name: "Bob Martin",
    email: "bob@email.com",
    phone: "+91 98765 43211",
    propertyTitle: "Contemporary Apartment",
    message: "Would like more information about financing options",
    status: "in-progress",
    source: "website",
  },
  {
    name: "David Lee",
    email: "david@email.com",
    phone: "+91 98765 43212",
    propertyTitle: "Luxury Villa with Pool",
    message: "Successfully closed, purchased the property",
    status: "closed",
    source: "website",
  },
];

async function upsertStaff({ name, email, password, role, propertiesManaged }) {
  const existing = await Staff.findOne({ email });
  if (existing) return existing;

  return Staff.create({
    name,
    email,
    role,
    propertiesManaged,
    passwordHash: await Staff.hashPassword(password),
  });
}

async function seed() {
  await connectDB();

  await upsertStaff({
    name: "Akshar Estate Admin",
    email: "admin@aksharrealestate.test",
    password: "Admin@12345",
    role: "admin",
    propertiesManaged: 0,
  });
  await upsertStaff({
    name: "Alex Martinez",
    email: "supervisor@aksharrealestate.test",
    password: "Supervisor@12345",
    role: "supervisor",
    propertiesManaged: 45,
  });
  await upsertStaff({
    name: "Sarah Chen",
    email: "sarah.supervisor@aksharrealestate.test",
    password: "Supervisor@12345",
    role: "supervisor",
    propertiesManaged: 38,
  });

  if ((await Property.countDocuments()) === 0) {
    await Property.insertMany(properties);
  }

  if ((await Enquiry.countDocuments()) === 0) {
    await Enquiry.insertMany(enquiries);
  }

  if ((await OwnerApplication.countDocuments()) === 0) {
    await OwnerApplication.insertMany([
      { name: "Robert Johnson", email: "robert.j@email.com", phone: "+91 98765 43210", propertyCount: 3 },
      { name: "Emily Davis", email: "emily.davis@email.com", phone: "+91 98765 43211", propertyCount: 1 },
      { name: "Karan Shah", email: "karan@email.com", phone: "+91 98765 43212", propertyCount: 2, status: "approved" },
    ]);
  }

  await Promise.all(siteContentDefaults.map((item) => SiteContent.updateOne({ key: item.key }, { $setOnInsert: item }, { upsert: true })));

  if ((await Activity.countDocuments()) === 0) {
    await Activity.insertMany([
      { type: "Property", title: "New Property", description: "Luxury Villa added", actorName: "Owner #1234" },
      { type: "Enquiry", title: "Enquiry", description: "New enquiry on Modern Apartment", actorName: "John Doe" },
      { type: "Approval", title: "Approval", description: "Owner approved", actorName: "Admin" },
      { type: "Property", title: "Property", description: "Property status updated", actorName: "Supervisor" },
    ]);
  }

  console.log("Seed complete");
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
