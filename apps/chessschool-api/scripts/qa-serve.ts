import { resolve } from "node:path";
import { seedQa } from "./qa-seed";

const given = process.env.DATABASE_URL;
if (given && !given.startsWith("file:")) {
  console.error("qa:serve refuses a non-local database");
  process.exit(1);
}
process.env.DATABASE_URL = given ?? `file:${resolve("qa.local.db")}`;
process.env.PORT ??= "8788";
process.env.HOST ??= "0.0.0.0";

await seedQa(process.env.DATABASE_URL);
await import("../src/server.js");
