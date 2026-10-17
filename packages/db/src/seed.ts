import { sql } from "drizzle-orm";
import type { Database } from "./client";
import { clubs, courses } from "./schema";

type CourseSeed = Omit<typeof courses.$inferInsert, "id" | "clubId" | "createdAt" | "updatedAt">;

interface ClubSeed {
  name: string;
  slug: string;
  courses: CourseSeed[];
}

/**
 * Launch courses chosen by the owner on 17 October 2026. Sources are in
 * docs/platforms.md. Coordinates are left empty until verified.
 */
export const SEED_CLUBS: ClubSeed[] = [
  {
    name: "Wembley Golf Course",
    slug: "wembley",
    courses: [
      {
        name: "Wembley Golf Course",
        slug: "wembley",
        suburb: "Wembley Downs",
        holes: 36,
        platform: "miclub",
        platformConfig: { baseUrl: "https://www.wembleygolf.com.au", bookingResourceId: "3000000" },
        websiteUrl: "https://www.wembleygolf.com.au",
        bookingUrl: "https://www.wembleygolf.com.au/guests/bookings/ViewPublicCalendar.msp",
        enabled: true,
        bookingWindowDays: 10,
        notes:
          "Old and Tuart courses share one MiClub calendar. Times open 10 days ahead from 6 am. " +
          "No public bookings in school holidays. Golfers must register with the club to book. " +
          "bookingResourceId 3000000 is the MiClub default and is not yet confirmed for Wembley.",
      },
    ],
  },
  {
    name: "Collier Park Golf Course",
    slug: "collier-park",
    courses: [
      {
        name: "Collier Park Golf Course",
        slug: "collier-park",
        suburb: "Como",
        holes: 27,
        platform: "miclub",
        platformConfig: {
          baseUrl: "https://bookings.collierparkgolf.com.au",
          bookingResourceId: "3000000",
        },
        websiteUrl: "https://collierparkgolf.com.au",
        bookingUrl:
          "https://bookings.collierparkgolf.com.au/guests/bookings/ViewPublicCalendar.msp?bookingResourceId=3000000",
        enabled: true,
        bookingWindowDays: 8,
        notes:
          "Three nines (Pine, Lake, Island). Times open 8 days ahead at 12 pm. Prepaid online. " +
          "Prices change with demand.",
      },
    ],
  },
  {
    name: "Hamersley Public Golf Course",
    slug: "hamersley",
    courses: [
      {
        name: "Hamersley Public Golf Course",
        slug: "hamersley",
        suburb: "Karrinyup",
        holes: 18,
        platform: "quick18",
        platformConfig: { baseUrl: "https://hamersley.quick18.com" },
        websiteUrl: "https://hamersley.quick18.com",
        bookingUrl: "https://hamersley.quick18.com/teetimes/searchmatrix",
        enabled: true,
        bookingWindowDays: 7,
        notes: "City of Stirling course. Booking window and club website not yet confirmed.",
      },
    ],
  },
  {
    name: "Marangaroo Golf Course",
    slug: "marangaroo",
    courses: [
      {
        name: "Marangaroo Golf Course",
        slug: "marangaroo",
        suburb: "Marangaroo",
        holes: 18,
        platform: "chronogolf",
        platformConfig: {},
        websiteUrl: "https://www.marangaroogolf.com.au",
        bookingUrl: "https://www.chronogolf.com/club/marangaroo-golf-course",
        enabled: false,
        bookingWindowDays: 11,
        notes:
          "Books through Chronogolf (Lightspeed Golf), not MiClub. Not searchable until Lightspeed " +
          "partner API access is arranged. Times open 11 days ahead from 9 am.",
      },
    ],
  },
  {
    name: "The Cut Golf Course",
    slug: "the-cut",
    courses: [
      {
        name: "The Cut Golf Course",
        slug: "the-cut",
        suburb: "Dawesville",
        holes: 18,
        platform: "chronogolf",
        platformConfig: {},
        websiteUrl: "https://www.the-cut.com.au",
        bookingUrl: "https://www.chronogolf.com/club/the-cut-golf-course",
        enabled: false,
        bookingWindowDays: 7,
        notes:
          "Books through Chronogolf (Lightspeed Golf). Not searchable until partner API access is " +
          "arranged. In Dawesville, about 80 km south of the Perth CBD. Booking window not confirmed.",
      },
    ],
  },
];

/** Insert or update the launch clubs and courses. Safe to run repeatedly. */
export async function seed(db: Database): Promise<void> {
  for (const club of SEED_CLUBS) {
    const [row] = await db
      .insert(clubs)
      .values({ name: club.name, slug: club.slug })
      .onConflictDoUpdate({ target: clubs.slug, set: { name: club.name } })
      .returning({ id: clubs.id });

    for (const course of club.courses) {
      // Leave `enabled` alone on update, as an admin may have changed it since the first seed.
      const { enabled: _enabled, ...rest } = course;
      await db
        .insert(courses)
        .values({ ...course, clubId: row!.id })
        .onConflictDoUpdate({
          target: courses.slug,
          set: { ...rest, clubId: row!.id, updatedAt: sql`now()` },
        });
    }
  }
}
