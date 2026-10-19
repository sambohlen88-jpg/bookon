/**
 * Pages written for people searching Google: one for each area of Perth and
 * one for each common search. The wording lives here so it's easy to change;
 * the times on each page are live. Shown at /golf/<slug>.
 */
import type { AreaId } from "@bookon/core";

export type SeoPage =
  | {
      kind: "area";
      slug: string;
      area: AreaId;
      /** Reads after "in", e.g. "Perth's northern suburbs" or "regional WA". */
      place: string;
      suburbs: string;
    }
  | {
      kind: "today" | "weekend" | "twilight" | "nine" | "cheap" | "sims" | "lessons";
      slug: string;
    };

interface Words {
  /** The page heading. */
  h1: string;
  /** The browser tab and Google result title, under 60 characters. */
  title: string;
  /** The Google result description, under 160 characters. */
  description: string;
  intro: string;
}

export const SEO_PAGES: (SeoPage & Words)[] = [
  {
    kind: "area",
    slug: "perth-northern-suburbs",
    area: "north",
    place: "Perth's northern suburbs",
    suburbs: "Joondalup, Yanchep, Marangaroo, Karrinyup and Wangara",
    h1: "Golf tee times in Perth's northern suburbs",
    title: "Golf Tee Times Perth Northern Suburbs | BookOn",
    description:
      "Free tee times at public golf courses in Perth's north, from Joondalup to Karrinyup. See what's free today, then book with the club.",
    intro:
      "Every public course in the northern suburbs we check, with the next free tee time at each. Book straight on the club's own page.",
  },
  {
    kind: "area",
    slug: "perth-east-and-hills",
    area: "east",
    place: "Perth's east and hills",
    suburbs: "Maylands, Forrestfield and Forrestdale",
    h1: "Golf tee times in Perth's east and hills",
    title: "Golf Tee Times Perth East & Hills | BookOn",
    description:
      "Free tee times at public golf courses in Perth's east and hills. See what's free today and tomorrow, then book with the club.",
    intro:
      "Public courses in the east and the hills, with the next free tee time at each. Book straight on the club's own page.",
  },
  {
    kind: "area",
    slug: "perth-southern-suburbs",
    area: "south",
    place: "Perth's southern suburbs",
    suburbs: "Como, Parkwood, Kwinana, Rockingham, Secret Harbour and Mandurah",
    h1: "Golf tee times in Perth's southern suburbs",
    title: "Golf Tee Times Perth Southern Suburbs | BookOn",
    description:
      "Free tee times at public golf courses from Como and Parkwood to Rockingham and Mandurah. See what's free today, then book with the club.",
    intro:
      "Public courses south of the river, down to Rockingham and Mandurah, with the next free tee time at each.",
  },
  {
    kind: "area",
    slug: "perth-western-suburbs",
    area: "west",
    place: "Perth's western suburbs",
    suburbs: "Fremantle, Bicton, Claremont and Leederville",
    h1: "Golf tee times in Perth's western suburbs",
    title: "Golf Tee Times Fremantle & Western Suburbs | BookOn",
    description:
      "Free tee times at public golf courses in Fremantle and Perth's western suburbs. See what's free today, then book with the club.",
    intro:
      "Public courses in Fremantle and the western suburbs, with the next free tee time at each.",
  },
  {
    kind: "area",
    slug: "regional-wa",
    area: "regional",
    place: "regional WA",
    suburbs:
      "Bunbury, Busselton, Dunsborough, Margaret River, Albany, Geraldton, Karratha and Broome",
    h1: "Golf tee times in regional WA",
    title: "Golf Tee Times Regional WA & South West | BookOn",
    description:
      "Free tee times at public golf courses across regional WA, from the South West to Broome. Planning a trip? See what's free and book with the club.",
    intro:
      "Public courses across regional WA, from Bunbury and Margaret River to Albany, Geraldton, Karratha and Broome.",
  },
  {
    kind: "today",
    slug: "tee-times-today-perth",
    h1: "Tee times today in Perth",
    title: "Golf Tee Times Today in Perth | BookOn",
    description:
      "Who can play today? Free tee times at Perth public golf courses in the next few hours, checked through the day. Book with the club.",
    intro:
      "The next free tee times today at Perth and WA public courses, soonest first. Times are checked through the day.",
  },
  {
    kind: "weekend",
    slug: "golf-this-weekend-perth",
    h1: "Golf this weekend in Perth",
    title: "Golf Tee Times This Weekend in Perth | BookOn",
    description:
      "Free weekend tee times at Perth public golf courses for Saturday and Sunday. See which courses have room, then book with the club.",
    intro: "How many tee times are free this Saturday and Sunday at each course.",
  },
  {
    kind: "twilight",
    slug: "twilight-golf-perth",
    h1: "Twilight golf in Perth",
    title: "Twilight Golf Perth: Tee Times After 3 pm | BookOn",
    description:
      "Afternoon and twilight tee times at Perth public golf courses, today and tomorrow. Many clubs charge less late in the day.",
    intro:
      "Tee times from 3 pm today and tomorrow. Many clubs have cheaper twilight rates late in the day; check the price on the club's page.",
  },
  {
    kind: "nine",
    slug: "9-hole-golf-perth",
    h1: "9-hole golf in Perth",
    title: "9-Hole Golf Perth: Free Tee Times | BookOn",
    description:
      "Short on time? Free 9-hole tee times at Perth public golf courses today and tomorrow. Book with the club.",
    intro: "Free 9-hole tee times today and tomorrow, for a quick round before or after work.",
  },
  {
    kind: "cheap",
    slug: "cheap-golf-perth",
    h1: "Cheap golf in Perth",
    title: "Cheap Golf Perth: Lowest Green Fees Today | BookOn",
    description:
      "The cheapest free tee times at Perth public golf courses today and tomorrow, lowest green fee first. Book with the club.",
    intro:
      "The lowest green fee at each course today and tomorrow, cheapest first, from the prices clubs show online.",
  },
  {
    kind: "sims",
    slug: "golf-simulators-perth",
    h1: "Golf simulators and driving ranges in Perth",
    title: "Golf Simulators & Driving Ranges Perth | BookOn",
    description:
      "Free golf simulator and driving range bays around Perth, by the hour. See the next free bay at each venue and book with them.",
    intro:
      "Simulator and range bays you can book by the hour, with the next free bay at each venue.",
  },
  {
    kind: "lessons",
    slug: "golf-lessons-perth",
    h1: "Golf lessons in Perth",
    title: "Golf Lessons Perth: Find a Golf Coach | BookOn",
    description:
      "Golf coaches around Perth: who's teaching this week, what they charge and where. Message a coach to book a lesson.",
    intro: "Golf coaches around Perth, with when they teach and what a lesson costs.",
  },
];

export function seoPage(slug: string) {
  return SEO_PAGES.find((p) => p.slug === slug) ?? null;
}
