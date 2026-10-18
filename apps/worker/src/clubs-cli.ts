/**
 * Review club listings from the terminal. The admin area (/admin) does the same with buttons.
 *
 *   pnpm clubs                                  listings waiting for review
 *   pnpm clubs -- all                           every listing
 *   pnpm clubs -- show <id>                     everything a club sent, and its photos
 *   pnpm clubs -- approve <id> [note]           create the club, its courses (switched off) and an owner login
 *   pnpm clubs -- decline <id> [note]
 *   pnpm clubs -- reopen <id>                   let the club edit it again with its link
 *   pnpm clubs -- photo <photo id> approve <course slug>
 *   pnpm clubs -- photo <photo id> decline
 *
 * Ids can be shortened to their first 8 characters.
 */
import {
  approveClubApplication,
  clubApplicationById,
  createDb,
  findCourseBySlug,
  listApplicationRates,
  listClubApplications,
  listClubPhotos,
  setClubApplicationStatus,
  setClubPhotoStatus,
  type ClubApplication,
  type Database,
} from "@bookon/db";
import { clubApplicationText } from "@bookon/email";
import { loadConfig } from "./config";

const args = process.argv.slice(2).filter((a) => a !== "--");
const [command = "list", ...rest] = args;
const handle = createDb(loadConfig().databaseUrl);

async function find(db: Database, id: string | undefined): Promise<ClubApplication> {
  if (!id) throw new Error("Give a listing id (from `pnpm clubs`).");
  const exact = /^[0-9a-f-]{36}$/.test(id) ? await clubApplicationById(db, id) : null;
  const match = exact ?? (await listClubApplications(db)).find((a) => a.id.startsWith(id));
  if (!match) throw new Error(`No listing with id ${id}`);
  return match;
}

function row(a: ClubApplication): string {
  const when = (a.submittedAt ?? a.updatedAt).toLocaleString("en-AU", {
    timeZone: "Australia/Perth",
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `${a.id.slice(0, 8)}  ${a.status.padEnd(9)}  ${a.clubName.padEnd(32).slice(0, 32)}  ${a.contactEmail.padEnd(30).slice(0, 30)}  ${when}`;
}

try {
  await handle.migrate();
  const db = handle.db;
  const now = new Date();
  if (command === "list" || command === "all") {
    const list = await listClubApplications(db, command === "all" ? undefined : ["submitted"]);
    if (list.length === 0)
      console.log(command === "all" ? "No listings yet." : "Nothing waiting for review.");
    for (const a of list) console.log(row(a));
  } else if (command === "show") {
    const a = await find(db, rest[0]);
    const photos = await listClubPhotos(db, a.id);
    console.log(`${row(a)}\n`);
    console.log(clubApplicationText(a, await listApplicationRates(db, a.id), photos.length));
    for (const p of photos) {
      console.log(
        `  photo ${p.id.slice(0, 8)}  ${p.status}  ${p.width}x${p.height}  ${p.caption ?? ""}  (rights: ${p.rightsConfirmedBy})`,
      );
    }
    if (a.reviewNotes) console.log(`\nNotes: ${a.reviewNotes}`);
  } else if (command === "approve") {
    const a = await find(db, rest[0]);
    const result = await approveClubApplication(
      db,
      a,
      { email: "pnpm clubs", role: "admin" },
      rest.slice(1).join(" ") || null,
      now,
    );
    if ("error" in result) throw new Error("Only listings the club has sent can be approved.");
    console.log(`${a.clubName}: approved, with ${result.courseIds.length} course(s) switched off.`);
    console.log(
      "Next: in /admin, set up each course's booking system, test it, then switch it on.",
    );
    console.log(
      "The club wasn't emailed; approve in /admin to email them, or let them know yourself.",
    );
  } else if (command === "decline" || command === "reopen") {
    const a = await find(db, rest[0]);
    const status = command === "decline" ? "declined" : "draft";
    await setClubApplicationStatus(db, a.id, status, rest.slice(1).join(" ") || a.reviewNotes, now);
    console.log(`${a.clubName}: ${status}`);
  } else if (command === "photo") {
    const [photoId, decision, slug] = rest;
    const listings = await listClubApplications(db);
    let photo = null;
    for (const a of listings) {
      photo ??=
        (await listClubPhotos(db, a.id)).find((p) => p.id.startsWith(photoId ?? "-")) ?? null;
    }
    if (!photo) throw new Error(`No photo with id ${photoId}`);
    if (decision === "approve") {
      const course = slug ? await findCourseBySlug(db, slug) : null;
      if (!course) throw new Error("Give the course slug the photo shows, e.g. collier-park.");
      await setClubPhotoStatus(db, photo.id, "approved", course.id);
      console.log(`Photo approved for ${course.name}.`);
    } else if (decision === "decline") {
      await setClubPhotoStatus(db, photo.id, "declined", null);
      console.log("Photo declined.");
    } else {
      throw new Error("Use: pnpm clubs -- photo <id> approve <course slug> | decline");
    }
  } else {
    throw new Error(`Unknown command "${command}".`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await handle.close();
}
