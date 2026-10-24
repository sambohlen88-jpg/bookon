import { LOCAL_DATABASE_URL, createDb } from "../client";
import { seed } from "../seed";
import { isLocalDatabaseUrl, seedSampleCoaches } from "../coaches";
import { seedSampleArticles } from "../news";

const url = process.env.DATABASE_URL || LOCAL_DATABASE_URL;
const handle = createDb(url);
await handle.migrate();
await seed(handle.db);
// Made-up coaches, to show the Coaches pages. Never on a hosted database.
if (isLocalDatabaseUrl(url)) {
  await seedSampleCoaches(handle.db);
  await seedSampleArticles(handle.db, new Date());
}
await handle.close();
console.log("Seeded launch courses");
