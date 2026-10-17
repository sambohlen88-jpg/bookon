import { LOCAL_DATABASE_URL, createDb } from "../client";
import { seed } from "../seed";

const handle = createDb(process.env.DATABASE_URL || LOCAL_DATABASE_URL);
await handle.migrate();
await seed(handle.db);
await handle.close();
console.log("Seeded launch courses");
