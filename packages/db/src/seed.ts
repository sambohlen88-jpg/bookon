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
 * Courses chosen by the owner on 17 October 2026 (five launch courses, then Fremantle
 * Public, Whaleback and Point Walter). Sources are in
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
        enabled: false,
        bookingWindowDays: 10,
        notes:
          "Old and Tuart courses share one MiClub calendar (bookingResourceId 3000000, confirmed). " +
          "Times open 10 days ahead from 6 am. No public bookings in school holidays. " +
          "Switched off: since at least October 2026 the club puts timesheets behind a CAPTCHA, " +
          "so we do not read them. Needs the club's permission or a feed.",
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
        bookingWindowDays: 14,
        notes:
          "City of Stirling course. Times were listed at least 16 days ahead on 17 October 2026; " +
          "we read 14, the longest search range. Club website not yet confirmed.",
      },
    ],
  },
  {
    name: "Fremantle Public Golf Course",
    slug: "fremantle-public",
    courses: [
      {
        name: "Fremantle Public Golf Course",
        slug: "fremantle-public",
        suburb: "Fremantle",
        holes: 18,
        platform: "miclub",
        platformConfig: {
          baseUrl: "https://fremantlepublic.miclub.com.au",
          bookingResourceId: "3000000",
        },
        websiteUrl: "https://fremantlepublic.miclub.com.au",
        bookingUrl:
          "https://fremantlepublic.miclub.com.au/guests/bookings/ViewPublicCalendar.msp?bookingResourceId=3000000",
        enabled: true,
        bookingWindowDays: 9,
        notes:
          "City of Fremantle course. Checked live 17 October 2026: no CAPTCHA, times listed 9 days " +
          "ahead (today plus 8).",
      },
    ],
  },
  {
    name: "Whaleback Golf Course",
    slug: "whaleback",
    courses: [
      {
        name: "Whaleback Golf Course",
        slug: "whaleback",
        suburb: "Parkwood",
        holes: 18,
        platform: "miclub",
        platformConfig: {
          baseUrl: "https://www.whalebackgolfcourse.com.au",
          bookingResourceId: "3000000",
        },
        websiteUrl: "https://www.whalebackgolfcourse.com.au",
        bookingUrl: "https://www.whalebackgolfcourse.com.au/guests/bookings/ViewPublicCalendar.msp",
        enabled: true,
        bookingWindowDays: 10,
        notes:
          "City of Canning course. Checked live 17 October 2026: no CAPTCHA, rates named '18 Hole' " +
          "and '9 Hole'. Times open up to 10 days ahead, refreshed at 6 am. Prepaid, with a 48 hour " +
          "cancellation policy.",
      },
    ],
  },
  {
    name: "Point Walter Golf Course",
    slug: "point-walter",
    courses: [
      {
        name: "Point Walter Golf Course",
        slug: "point-walter",
        suburb: "Bicton",
        holes: 18,
        platform: "chronogolf",
        platformConfig: {},
        websiteUrl: "https://www.pointwaltergolf.com.au",
        bookingUrl: "https://www.chronogolf.com/club/point-walter-public-golf-course",
        enabled: false,
        bookingWindowDays: 11,
        notes:
          "Left Quick18 (its old site says 'coming soon', October 2026). Its Chronogolf page returns " +
          "404, so probably MiClub on its own domain like Marangaroo (same operator, Belgravia " +
          "Leisure). Not yet checked live. Times open 11 days ahead.",
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
          "Probably MiClub on its own domain (MiClub URL patterns, listed on TeeNet); its Chronogolf " +
          "page returns 404 (October 2026). Not yet checked live. Times open 11 days ahead from 9 am.",
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
        websiteUrl: "https://www.thecutgolf.com.au",
        bookingUrl: "https://www.chronogolf.com/club/the-cut-golf-course",
        enabled: false,
        bookingWindowDays: 7,
        notes:
          "Booking system not confirmed: its Chronogolf page now returns 404 (October 2026); Future " +
          "Golf and GolfNow list it. In Dawesville, about 80 km south of the Perth CBD.",
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
