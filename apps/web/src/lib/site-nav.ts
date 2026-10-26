/**
 * The site's menu (Milestone 25): five sections, each with a dropdown of
 * links. Desktop shows them as Apple-style panels; phones as a full-screen
 * menu. The logo goes home, where the tee time search is.
 */

export interface NavLink {
  href: string;
  label: string;
  /** A short line under the link, on desktop. */
  hint?: string;
}

export interface NavGroup {
  title: string;
  links: NavLink[];
}

export interface NavSection {
  id: string;
  label: string;
  /** Where the section's own name goes, on phones and for "See all". */
  href: string;
  groups: NavGroup[];
}

/** A featured item beside a section's links: the latest article, or the next competition. */
export interface NavFeature {
  section: string;
  kicker: string;
  title: string;
  href: string;
}

export function siteNav({ baysHref }: { baysHref: string }): NavSection[] {
  return [
    {
      id: "courses",
      label: "Courses",
      href: "/courses",
      groups: [
        {
          title: "Play",
          links: [
            {
              href: "/",
              label: "Find a tee time",
              hint: "Every course's free times, in one search",
            },
            { href: "/courses", label: "All courses", hint: "Prices, ratings and tee sheets" },
            { href: baysHref, label: "Simulators and driving ranges", hint: "Free bays tonight" },
          ],
        },
        {
          title: "More",
          links: [
            {
              href: "/account?tab=alerts",
              label: "Tee time alerts",
              hint: "Hear when a time opens up",
            },
            {
              href: "/golf",
              label: "Golf in Perth guides",
              hint: "Courses by area, twilight, 9 holes",
            },
          ],
        },
      ],
    },
    {
      id: "competitions",
      label: "Competitions",
      href: "/competitions",
      groups: [
        {
          title: "Enter",
          links: [
            {
              href: "/competitions",
              label: "All competitions",
              hint: "Open days and events near you",
            },
            {
              href: "/competitions#matchplay",
              label: "Match play",
              hint: "Knockouts at Perth clubs",
            },
          ],
        },
      ],
    },
    {
      id: "coaching",
      label: "Coaching",
      href: "/coaches",
      groups: [
        {
          title: "Learn",
          links: [
            { href: "/coaches", label: "Find a coach", hint: "PGA pros near you" },
            {
              href: "/coaches#sessions",
              label: "Group sessions",
              hint: "Clinics and group lessons",
            },
          ],
        },
        {
          title: "Coaches",
          links: [{ href: "/coaching", label: "List your coaching", hint: "Listing is free" }],
        },
      ],
    },
    {
      id: "news",
      label: "News",
      href: "/news",
      groups: [
        {
          title: "Read",
          links: [{ href: "/news", label: "Latest news", hint: "Golf in Perth" }],
        },
        {
          title: "Topics",
          links: [
            { href: "/news?category=course-news", label: "Course news" },
            { href: "/news?category=tips", label: "Tips and how-to" },
            { href: "/news?category=competitions", label: "Competitions" },
            { href: "/news?category=around-perth", label: "Around Perth" },
            { href: "/news?category=gear", label: "Gear" },
          ],
        },
      ],
    },
    {
      id: "clubs",
      label: "For golf clubs",
      href: "/clubs",
      groups: [
        {
          title: "Clubs",
          links: [
            { href: "/clubs", label: "Why BookOn", hint: "What clubs get. Free to list" },
            { href: "/clubs/join", label: "List your club", hint: "About 15 minutes to set up" },
            {
              href: "/clubs#events",
              label: "Run your events",
              hint: "Entries, payments and start sheets",
            },
            { href: "/clubs#matchplay", label: "Run your match play", hint: "Draws and results" },
          ],
        },
      ],
    },
  ];
}
