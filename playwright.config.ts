import { defineConfig } from "@playwright/test";

// export default defineConfig({
//   testDir: "./e2e",
//   fullyParallel: false,
//   retries: 0,
//   reporter: "list",
//   use: {
//     baseURL:
//       process.env.E2E_API_BASE_URL ||
//       process.env.NEXT_PUBLIC_API_BASE_URL ||
//       "http://localhost:4000/api/v1",
//   },
// });


// export default defineConfig({
//   testDir: "./e2e",
//   fullyParallel: false,
//   retries: 0,
//   reporter: "list",
//   use: {
//     baseURL:
//       process.env.E2E_API_BASE_URL ||
//       process.env.NEXT_PUBLIC_API_BASE_URL ||
//       "https://willowy-zorana-swifttech-4219e978.koyeb.app/api/v1",
//   },
// });


export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL:
      process.env.E2E_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "https://koboplan-backend.up.railway.app/api/v1",
  },
});
