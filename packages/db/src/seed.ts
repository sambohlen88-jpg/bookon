import { eq, sql } from "drizzle-orm";
import type { AreaId } from "@bookon/core";
import type { Database } from "./client";
import { COURSE_LOCATIONS } from "./course-locations";
import { clubs, courses } from "./schema";

type CourseSeed = Omit<typeof courses.$inferInsert, "id" | "clubId" | "createdAt" | "updatedAt">;

interface ClubSeed {
  name: string;
  slug: string;
  courses: CourseSeed[];
}

/**
 * MiClub courses found on 17 October 2026 by probing `<club>.miclub.com.au`
 * calendars. All read cleanly in a live test on 17 October 2026, so all are on. Hole counts
 * come from the rates each course sells; booking windows are the clubs'
 * published ones where known, otherwise 14 days (the longest search).
 */
interface MiClubSeed {
  slug: string;
  name: string;
  suburb: string;
  holes: number;
  host: string;
  resource?: string;
  /** Club website, when it has its own. */
  website?: string;
  window: number;
  enabled: boolean;
  notes: string;
  feeGroupPattern?: string;
}

const WA_MICLUB_COURSES: MiClubSeed[] = [
  // Perth metro and Peel
  {
    slug: "marangaroo",
    name: "Marangaroo Golf Course",
    suburb: "Marangaroo",
    holes: 18,
    host: "marangaroo.miclub.com.au",
    website: "https://www.marangaroogolf.com.au",
    window: 11,
    enabled: true,
    notes:
      "Run by Belgravia Leisure. Times open 11 days ahead from 9 am. Prepaid. Its old Chronogolf listing is gone.",
  },
  {
    slug: "point-walter",
    name: "Point Walter Golf Course",
    suburb: "Bicton",
    holes: 9,
    host: "pointwalter.miclub.com.au",
    website: "https://www.pointwaltergolf.com.au",
    window: 11,
    enabled: true,
    notes: "9 holes. Run by Belgravia Leisure. Times open 11 days ahead. Left Quick18 in 2026.",
  },
  {
    slug: "maylands",
    name: "Maylands Peninsula Golf Course",
    suburb: "Maylands",
    holes: 18,
    host: "maylandsembleton.miclub.com.au",
    window: 14,
    enabled: true,
    notes:
      "Shares a booking site with Embleton (resource 3900000), whose calendar was empty on 17 October 2026. Booking window not confirmed.",
  },
  {
    slug: "kwinana",
    name: "Kwinana Golf Club",
    suburb: "Medina",
    holes: 18,
    host: "kwinana.miclub.com.au",
    window: 14,
    enabled: true,
    notes: "Booking window not confirmed.",
  },
  {
    slug: "rockingham",
    name: "Rockingham Golf Club",
    suburb: "Rockingham",
    holes: 18,
    host: "rockingham.miclub.com.au",
    resource: "3900000",
    window: 14,
    enabled: true,
    notes:
      "Public bookings are the 'Social Golf Bookings' calendar (resource 3900000), prepaid. Booking window not confirmed.",
  },
  {
    slug: "secret-harbour",
    name: "Secret Harbour Golf Links",
    suburb: "Secret Harbour",
    holes: 18,
    host: "secretharbour.miclub.com.au",
    window: 14,
    enabled: true,
    notes: "Booking window not confirmed.",
  },
  {
    slug: "kennedy-bay",
    name: "Links Kennedy Bay",
    suburb: "Port Kennedy",
    holes: 18,
    host: "kennedybay.miclub.com.au",
    window: 14,
    enabled: true,
    notes: "Booking window not confirmed.",
  },
  {
    slug: "hartfield",
    name: "Hartfield Golf Club",
    suburb: "Forrestfield",
    holes: 18,
    host: "hartfield.miclub.com.au",
    website: "https://www.hartfieldgolf.com.au",
    window: 14,
    enabled: true,
    notes: "Members' club that sells public tee times online. Booking window not confirmed.",
  },
  {
    slug: "joondalup-resort",
    name: "Joondalup Resort Golf",
    suburb: "Connolly",
    holes: 27,
    host: "joondalup.miclub.com.au",
    resource: "3900000",
    window: 14,
    enabled: true,
    feeGroupPattern: "^()(18|9) holes(?: \\+ cart| walking)$",
    notes:
      "Three nines (Lake, Quarry, Dunes). Public calendar is resource 3900000. 18 hole rates always include a cart, so '18 Holes + Cart' is read. Booking window not confirmed.",
  },
  {
    slug: "sun-city",
    name: "Sun City Country Club",
    suburb: "Yanchep",
    holes: 18,
    host: "suncity.miclub.com.au",
    window: 14,
    enabled: true,
    notes: "Members' club that sells public tee times online. Booking window not confirmed.",
  },
  {
    slug: "meadow-springs",
    name: "Meadow Springs Golf & Country Club",
    suburb: "Meadow Springs",
    holes: 18,
    host: "meadowsprings.miclub.com.au",
    window: 14,
    enabled: true,
    notes: "Separate weekday and weekend rates. Booking window not confirmed.",
  },
  {
    slug: "the-cut",
    name: "The Cut Golf Course",
    suburb: "Dawesville",
    holes: 18,
    host: "thecut.miclub.com.au",
    website: "https://www.thecutgolf.com.au",
    window: 14,
    enabled: true,
    notes:
      "About 80 km south of the Perth CBD. Walking rates are read; cart packages are skipped. Booking window not confirmed.",
  },
  {
    slug: "pinjarra",
    name: "Pinjarra Golf Club",
    suburb: "Pinjarra",
    holes: 18,
    host: "pinjarra.miclub.com.au",
    window: 14,
    enabled: true,
    notes: "Booking window not confirmed.",
  },
  // South West and Great Southern
  {
    slug: "bunbury",
    name: "Bunbury Golf Club",
    suburb: "Bunbury",
    holes: 18,
    host: "bunbury.miclub.com.au",
    window: 14,
    enabled: true,
    notes: "Booking window not confirmed.",
  },
  {
    slug: "capel",
    name: "Capel Golf Club",
    suburb: "Capel",
    holes: 18,
    host: "capel.miclub.com.au",
    window: 14,
    enabled: true,
    notes: "Booking window not confirmed.",
  },
  {
    slug: "busselton",
    name: "Busselton Golf Club",
    suburb: "Busselton",
    holes: 18,
    host: "busselton.miclub.com.au",
    window: 14,
    enabled: true,
    notes: "Booking window not confirmed.",
  },
  {
    slug: "dunsborough-lakes",
    name: "Dunsborough Lakes Golf Club",
    suburb: "Dunsborough",
    holes: 18,
    host: "dunsborough.miclub.com.au",
    window: 14,
    enabled: true,
    notes: "Booking window not confirmed.",
  },
  {
    slug: "margaret-river",
    name: "Margaret River Golf Club",
    suburb: "Margaret River",
    holes: 18,
    host: "margaretriver.miclub.com.au",
    window: 14,
    enabled: true,
    notes: "Booking window not confirmed.",
  },
  {
    slug: "albany",
    name: "Albany Golf Club",
    suburb: "Albany",
    holes: 18,
    host: "albany.miclub.com.au",
    website: "https://albanygolfclub.com.au",
    window: 14,
    enabled: true,
    notes: "At Middleton Beach. Booking window not confirmed.",
  },
  // Mid West and North
  {
    slug: "geraldton",
    name: "Geraldton Golf Club",
    suburb: "Geraldton",
    holes: 18,
    host: "geraldton.miclub.com.au",
    window: 14,
    enabled: true,
    notes: "Visitors register online before booking. Booking window not confirmed.",
  },
  {
    slug: "karratha",
    name: "Karratha Golf Course",
    suburb: "Karratha",
    holes: 18,
    host: "karratha.miclub.com.au",
    window: 14,
    enabled: true,
    notes: "Booking window not confirmed.",
  },
  {
    slug: "broome",
    name: "Broome Golf Club",
    suburb: "Broome",
    holes: 18,
    host: "broome.miclub.com.au",
    window: 14,
    enabled: true,
    notes: "Booking window not confirmed.",
  },
];

function miclubClub(c: MiClubSeed): ClubSeed {
  const resource = c.resource ?? "3000000";
  const base = `https://${c.host}`;
  return {
    name: c.name,
    slug: c.slug,
    courses: [
      {
        name: c.name,
        slug: c.slug,
        suburb: c.suburb,
        holes: c.holes,
        platform: "miclub",
        platformConfig: {
          baseUrl: base,
          bookingResourceId: resource,
          ...(c.feeGroupPattern ? { feeGroupPattern: c.feeGroupPattern } : {}),
        },
        websiteUrl: c.website ?? `${base}/cms/`,
        bookingUrl: `${base}/guests/bookings/ViewPublicCalendar.msp?bookingResourceId=${resource}`,
        enabled: c.enabled,
        bookingWindowDays: c.window,
        notes: c.notes,
      },
    ],
  };
}

/**
 * Golf simulators and driving ranges on Your Golf Booking, approved by the
 * owner on 18 October 2026 (docs/platforms.md). Only venues whose live
 * free bays can be read. Bays open weeks ahead; we read 14 days, the longest search.
 */
function ygbVenue(v: {
  slug: string;
  name: string;
  suburb: string;
  kind: "simulator" | "range";
  venue: string;
  group: string;
  bays?: string[];
  website: string;
  notes: string;
}): CourseSeed {
  return {
    name: v.name,
    slug: v.slug,
    suburb: v.suburb,
    holes: 0,
    kind: v.kind,
    platform: "ygb",
    platformConfig: { venue: v.venue, group: v.group, ...(v.bays ? { bays: v.bays } : {}) },
    websiteUrl: v.website,
    bookingUrl: `https://yourgolfbooking.com/venues/${v.venue}/booking/${v.group}`,
    enabled: true,
    bookingWindowDays: 14,
    notes: v.notes,
  };
}

const YGB_VENUES: ClubSeed[] = [
  {
    name: "OuttaBounds",
    slug: "outtabounds",
    courses: [
      ygbVenue({
        slug: "outtabounds-simulators",
        name: "OuttaBounds Simulators",
        suburb: "North Lake",
        kind: "simulator",
        venue: "outta-bounds",
        group: "simulators",
        website: "https://www.outtabounds.com.au",
        notes: "9 simulator bays, up to 6 players. Bays open 4 weeks ahead.",
      }),
      ygbVenue({
        slug: "outtabounds-range",
        name: "OuttaBounds Driving Range",
        suburb: "North Lake",
        kind: "range",
        venue: "outta-bounds",
        group: "bays",
        website: "https://www.outtabounds.com.au",
        notes:
          "18 range bays, up to 6 players. Priced per player, so no price is shown. Bays open 4 weeks ahead.",
      }),
    ],
  },
  {
    name: "Albatross Lounge",
    slug: "albatross-lounge",
    courses: [
      ygbVenue({
        slug: "albatross-lounge",
        name: "Albatross Lounge",
        suburb: "Mount Pleasant",
        kind: "simulator",
        venue: "albatross-lounge",
        group: "bays",
        bays: ["1", "2"],
        website: "https://www.albatrosslounge.au",
        notes:
          "2 simulator bays (the booking group also has darts and pool, which we leave out). Closed Mondays. Bays open 3 weeks ahead.",
      }),
    ],
  },
  {
    name: "Elevate Golf Lounge",
    slug: "elevate-golf-lounge",
    courses: [
      ygbVenue({
        slug: "elevate-golf-lounge",
        name: "Elevate Golf Lounge",
        suburb: "Leederville",
        kind: "simulator",
        venue: "elevate-golf",
        group: "bays",
        website: "https://elevategolflounge.com.au",
        notes: "4 Trackman simulator bays. Bays open 2 weeks ahead.",
      }),
    ],
  },
  {
    name: "Lights Out Golf",
    slug: "lights-out-golf",
    courses: [
      ygbVenue({
        slug: "lights-out-golf",
        name: "Lights Out Golf",
        suburb: "Wangara",
        kind: "simulator",
        venue: "lights-out-golf",
        group: "bays",
        website: "https://www.lightsoutgolf.com.au",
        notes:
          "4 simulator bays, up to 4 players. The public rate runs 7 am to 9 pm. Bays open 6 weeks ahead.",
      }),
    ],
  },
];

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
  ...WA_MICLUB_COURSES.map(miclubClub),
  // Quick18 blocks Claude-User, so these wait for the owner to run a check on their own computer.
  {
    name: "The Springs Club",
    slug: "the-springs",
    courses: [
      {
        name: "The Springs Club",
        slug: "the-springs",
        suburb: "Forrestdale",
        holes: 18,
        platform: "quick18",
        platformConfig: { baseUrl: "https://springs.quick18.com" },
        websiteUrl: "https://springs.quick18.com",
        bookingUrl: "https://springs.quick18.com/teetimes/searchmatrix",
        enabled: false,
        bookingWindowDays: 14,
        notes:
          "Quick18. Parses correctly from a 2025 saved page; not yet checked live. Owner to run a check.",
      },
    ],
  },
  {
    name: "Lake Claremont Golf Course",
    slug: "lake-claremont",
    courses: [
      {
        name: "Lake Claremont Golf Course",
        slug: "lake-claremont",
        suburb: "Claremont",
        holes: 9,
        platform: "quick18",
        platformConfig: { baseUrl: "https://lakeclaremont.quick18.com" },
        websiteUrl: "https://lakeclaremont.quick18.com",
        bookingUrl: "https://lakeclaremont.quick18.com/teetimes/searchmatrix",
        enabled: false,
        bookingWindowDays: 14,
        notes: "Quick18, 9 holes. Not yet checked live. Owner to run a check.",
      },
    ],
  },
  ...YGB_VENUES,
];

/** The owner's areas (18 October 2026). Admins can change a course's area afterwards. */
export const SEED_AREAS: Record<string, AreaId> = {
  marangaroo: "north",
  "joondalup-resort": "north",
  "sun-city": "north",
  hamersley: "north",
  wembley: "north",
  "lake-claremont": "west",
  "point-walter": "west",
  "fremantle-public": "west",
  maylands: "east",
  hartfield: "east",
  "the-springs": "east",
  "collier-park": "south",
  whaleback: "south",
  kwinana: "south",
  rockingham: "rockingham",
  "secret-harbour": "rockingham",
  "kennedy-bay": "rockingham",
  "meadow-springs": "peel",
  "the-cut": "peel",
  pinjarra: "peel",
  bunbury: "south-west",
  capel: "south-west",
  busselton: "south-west",
  "dunsborough-lakes": "south-west",
  "margaret-river": "south-west",
  albany: "regional",
  geraldton: "regional",
  karratha: "regional",
  broome: "regional",
  "outtabounds-simulators": "south",
  "outtabounds-range": "south",
  "albatross-lounge": "south",
  "elevate-golf-lounge": "west",
  "lights-out-golf": "north",
};

/** Insert or update the launch clubs and courses. Safe to run repeatedly. */
export async function seed(db: Database): Promise<void> {
  for (const club of SEED_CLUBS) {
    const [row] = await db
      .insert(clubs)
      .values({ name: club.name, slug: club.slug })
      .onConflictDoUpdate({ target: clubs.slug, set: { name: club.name } })
      .returning({ id: clubs.id });

    for (const course of club.courses) {
      // Until the admin dashboard (Milestone 6) exists, this file decides which courses are on.
      const place = COURSE_LOCATIONS[course.slug];
      const where = {
        area: SEED_AREAS[course.slug] ?? null,
        latitude: place?.latitude ?? null,
        longitude: place?.longitude ?? null,
      };
      await db
        .insert(courses)
        .values({ ...course, ...where, clubId: row!.id })
        .onConflictDoUpdate({
          target: courses.slug,
          set: {
            ...course,
            clubId: row!.id,
            updatedAt: sql`now()`,
            // Only fill these in: an admin may have changed them.
            area: sql`coalesce(${courses.area}, excluded.area)`,
            latitude: sql`coalesce(${courses.latitude}, excluded.latitude)`,
            longitude: sql`coalesce(${courses.longitude}, excluded.longitude)`,
          },
        });
    }
  }
}

/**
 * Seed a database that has no golf courses yet, such as a new local one.
 * Never touches a database that has them, so admin changes stay.
 */
export async function seedIfEmpty(db: Database): Promise<boolean> {
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.kind, "course"))
    .limit(1);
  if (course) return false;
  await seed(db);
  return true;
}
