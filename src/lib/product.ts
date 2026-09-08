export const PRODUCT_NAME =
  process.env.NEXT_PUBLIC_PRODUCT_NAME?.trim() || "KoboPlan";

// export const API_BASE_URL =
//   process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
//   "http://localhost:4000/api/v1";

// export const API_BASE_URL =
//   process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
//   "https://willowy-zorana-swifttech-4219e978.koyeb.app/api/v1";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "https://koboplan-backend.up.railway.app/api/v1";
