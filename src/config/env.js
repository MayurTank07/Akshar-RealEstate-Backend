import dotenv from "dotenv";

dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
const required = [["MONGODB_URI or MONGO_URI", mongoUri], ["JWT_SECRET", process.env.JWT_SECRET]];
if (nodeEnv === "production") {
  required.push(
    ["CORS_ORIGIN", process.env.CORS_ORIGIN],
    ["CLOUDINARY_CLOUD_NAME", process.env.CLOUDINARY_CLOUD_NAME],
    ["CLOUDINARY_API_KEY", process.env.CLOUDINARY_API_KEY],
    ["CLOUDINARY_API_SECRET", process.env.CLOUDINARY_API_SECRET],
    ["GOOGLE_CLIENT_ID", process.env.GOOGLE_CLIENT_ID]
  );
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }
}

const developmentCorsOrigins = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5174",
  "http://localhost:5174",
  "http://127.0.0.1:5175",
  "http://localhost:5175",
  "http://127.0.0.1:5176",
  "http://localhost:5176",
  "http://127.0.0.1:5177",
  "http://localhost:5177",
  "http://127.0.0.1:5178",
  "http://localhost:5178",
  "http://127.0.0.1:5179",
  "http://localhost:5179",
  "http://127.0.0.1:5180",
  "http://localhost:5180",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
];
const productionCorsOrigins = [
  "https://akshar-real-estate.vercel.app",
];
const defaultCorsOrigins = nodeEnv === "production" ? productionCorsOrigins : [...developmentCorsOrigins, ...productionCorsOrigins];

for (const [key, value] of required) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT || 5000),
  portFallback: process.env.PORT_FALLBACK !== "false",
  mongoUri,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  },
  corsOrigins: [...new Set([...(process.env.CORS_ORIGIN || "").split(","), ...defaultCorsOrigins].map((origin) => origin.trim()).filter(Boolean))],
};
