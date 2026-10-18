import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { formatPerthDay, formatPerthTime, perthDate } from "@bookon/core";
import type { Share, SharedCourse } from "@bookon/db";
import {
  distinctTimes,
  priceSummary,
  shareDetails,
  shareTime,
  shareTitle,
  timesByDay,
} from "./share";

/**
 * The pictures of a share: one phone screen to send in a group chat, and a
 * wide card for link previews. Like the course drawings, they're images and
 * can't see page CSS, so they carry the light palette from globals.css.
 */
const C = {
  background: "#ffffff",
  foreground: "#14211a",
  muted: "#5b6b62",
  surface: "#f3f6f4",
  border: "#d9e2dc",
  brand: "#1f6f43",
  heroBg: "#133f27",
  heroFg: "#ffffff",
  heroMuted: "#c7dccd",
};

export const CARD_SIZE = { width: 1200, height: 630 };

/*
 * The picture fits one phone screen (1080 x 1920 at most). Every part has a
 * fixed height, so the picture's height is worked out exactly and nothing is
 * cut off. Courses that don't fit are counted at the bottom.
 */
const WIDTH = 1080;
const MAX_HEIGHT = 1920;
const SIDE = 56;
const HEADER = 330;
const FOOTER = 170;
const BODY_TOP = 16;
const COURSE_TOP = 28;
const NAME = 52;
const SUB = 40;
const PILLS_GAP = 14;
const PILL = { width: 176, height: 64, gap: 12 };
const ROW_GAP = 10;
const COURSE_BOTTOM = 26;
const HIDDEN_LINE = 64;
/** Times per row on a one-day search; per day, beside the day, on longer ones. */
const ONE_DAY_PILLS = 5;
const PER_DAY_PILLS = 4;
const DAYS_PER_COURSE = 2;

type Font = { name: string; data: Buffer; weight: 400 | 600 | 700 | 800; style: "normal" };
let fonts: Promise<Font[]> | null = null;
let logo: Promise<string> | null = null;

/** Inter, from src/fonts (SIL Open Font License). */
export function pictureFonts(): Promise<Font[]> {
  fonts ??= Promise.all(
    ([400, 600, 700, 800] as const).map(async (weight) => ({
      name: "Inter",
      data: await readFile(join(process.cwd(), "src/fonts", `inter-${weight}.woff`)),
      weight,
      style: "normal" as const,
    })),
  );
  return fonts;
}

async function logoSrc(): Promise<string> {
  logo ??= readFile(join(process.cwd(), "src/app/icon.svg")).then(
    (svg) => `data:image/svg+xml;base64,${svg.toString("base64")}`,
  );
  return logo;
}

/** "bookon.com.au/s/abc" for the footer. */
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

interface Pill {
  label: string;
  more?: boolean;
}

/** Up to `room` pills; when there are more times, the last pill counts them. */
export function pills(labels: string[], room: number, total = labels.length): Pill[] {
  if (total <= room) return labels.slice(0, room).map((label) => ({ label }));
  const shown = labels.slice(0, room - 1).map((label) => ({ label }));
  return [...shown, { label: `+${total - shown.length} more`, more: true }];
}

interface CourseBlock {
  course: SharedCourse;
  sub: string;
  /** One row per day; `day` is null on a one-day search. */
  rows: { day: string | null; pills: Pill[] }[];
  height: number;
}

/** `alone`: the only course shared, so it gets three rows of times. */
export function courseBlock(course: SharedCourse, multiDay: boolean, alone = false): CourseBlock {
  const price = priceSummary(course.teeTimes);
  const notKept = course.total - course.teeTimes.length;
  let rows: CourseBlock["rows"];
  let otherDays = 0;
  if (!multiDay) {
    const labels = distinctTimes(course.teeTimes).map(shareTime);
    const all = pills(labels, ONE_DAY_PILLS * (alone ? 3 : 1), labels.length + notKept);
    rows = [];
    for (let i = 0; i < all.length; i += ONE_DAY_PILLS)
      rows.push({ day: null, pills: all.slice(i, i + ONE_DAY_PILLS) });
  } else {
    const days = timesByDay(course);
    const shown = days.slice(0, DAYS_PER_COURSE);
    rows = shown.map(([day, times]) => ({
      day,
      pills: pills(distinctTimes(times).map(shareTime), PER_DAY_PILLS),
    }));
    otherDays = course.total - shown.reduce((n, [, t]) => n + t.length, 0);
  }
  const sub = [course.suburb, price, otherDays > 0 ? `+${otherDays} more on other days` : null]
    .filter(Boolean)
    .join(" · ");
  const height =
    COURSE_TOP +
    NAME +
    SUB +
    PILLS_GAP +
    rows.length * PILL.height +
    (rows.length - 1) * ROW_GAP +
    COURSE_BOTTOM;
  return { course, sub, rows, height };
}

/** The picture for a group chat, with its size. */
export async function sharePicture(share: Share, url: string) {
  const multiDay = share.params.dateFrom !== share.params.dateTo;
  const room = MAX_HEIGHT - HEADER - FOOTER - BODY_TOP;
  const blocks: CourseBlock[] = [];
  let used = 0;
  for (const [i, course] of share.courses.entries()) {
    const block = courseBlock(course, multiDay, share.courses.length === 1);
    const othersLeft = i < share.courses.length - 1;
    if (blocks.length > 0 && used + block.height + (othersLeft ? HIDDEN_LINE : 0) > room) break;
    blocks.push(block);
    used += block.height;
  }
  const hidden = share.courses.length - blocks.length;
  const height = HEADER + BODY_TOP + used + (hidden > 0 ? HIDDEN_LINE : 0) + FOOTER;
  const courseCount = share.courses.length;

  const element = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: C.background,
        color: C.foreground,
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: HEADER,
          padding: `44px ${SIDE}px 0`,
          background: C.heroBg,
          color: C.heroFg,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={await logoSrc()} width={64} height={64} style={{ borderRadius: 16 }} />
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>BookOn</div>
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: multiDay ? 50 : 62,
            fontWeight: 800,
            letterSpacing: -1.5,
            lineHeight: 1.1,
          }}
        >
          {shareTitle(share.params)}
        </div>
        <div style={{ marginTop: 14, fontSize: 30, color: C.heroMuted }}>
          {shareDetails(share.params)}
        </div>
        <div style={{ marginTop: 4, fontSize: 30, color: C.heroMuted }}>
          {`${share.totalTeeTimes} ${share.totalTeeTimes === 1 ? "time" : "times"} at ${courseCount} ${courseCount === 1 ? "course" : "courses"}`}
        </div>
      </div>

      <div
        style={{ display: "flex", flexDirection: "column", padding: `${BODY_TOP}px ${SIDE}px 0` }}
      >
        {blocks.map((b, i) => (
          <CourseRow key={b.course.id} block={b} last={i === blocks.length - 1 && hidden === 0} />
        ))}
        {hidden > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: HIDDEN_LINE,
              fontSize: 30,
              fontWeight: 600,
              color: C.brand,
            }}
          >
            {`+${hidden} more ${hidden === 1 ? "course" : "courses"} on the link`}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          height: FOOTER,
          marginTop: "auto",
          padding: `0 ${SIDE}px`,
          background: C.surface,
          gap: 8,
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 700, color: C.brand }}>
          {`Book at ${shortUrl(url)}`}
        </div>
        <div style={{ fontSize: 26, color: C.muted }}>
          {`Free at ${formatPerthTime(share.createdAt)}, ${formatPerthDay(perthDate(share.createdAt))}. Times go fast, so book soon.`}
        </div>
      </div>
    </div>
  );
  return { element, width: WIDTH, height };
}

function CourseRow({ block, last }: { block: CourseBlock; last: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: block.height,
        paddingTop: COURSE_TOP,
        borderBottom: last ? "none" : `2px solid ${C.border}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: NAME,
          fontSize: 40,
          fontWeight: 700,
          letterSpacing: -0.5,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {block.course.name}
      </div>
      <div style={{ height: SUB, fontSize: 28, color: C.muted }}>{block.sub}</div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: ROW_GAP,
          marginTop: PILLS_GAP,
        }}
      >
        {block.rows.map((row, i) => (
          <div
            key={row.day ?? i}
            style={{ display: "flex", alignItems: "center", gap: PILL.gap, height: PILL.height }}
          >
            {row.day && (
              <div style={{ width: 150, fontSize: 28, fontWeight: 700, color: C.muted }}>
                {/* "Tue 20": the month is in the title. */}
                {formatPerthDay(row.day).replace(/ \S+$/, "")}
              </div>
            )}
            {row.pills.map((p) => (
              <PillBox key={p.label} pill={p} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PillBox({ pill }: { pill: Pill }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: PILL.width,
        height: PILL.height,
        borderRadius: PILL.height / 2,
        fontSize: pill.more ? 26 : 32,
        fontWeight: pill.more ? 600 : 700,
        background: pill.more ? C.background : C.surface,
        border: `2px solid ${pill.more ? C.border : C.surface}`,
        color: pill.more ? C.brand : C.foreground,
      }}
    >
      {pill.label}
    </div>
  );
}

/** The wide card shown in link previews: the first few courses and times. */
export async function shareCard(share: Share | null) {
  if (!share) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          background: C.heroBg,
          color: C.heroFg,
          fontFamily: "Inter",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={await logoSrc()} width={120} height={120} style={{ borderRadius: 28 }} />
        <div style={{ fontSize: 80, fontWeight: 800 }}>BookOn</div>
      </div>
    );
  }
  const shown = share.courses.slice(0, 4);
  const hidden = share.courses.length - shown.length;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: C.background,
        color: C.foreground,
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "40px 56px",
          background: C.heroBg,
          color: C.heroFg,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 54, fontWeight: 800, letterSpacing: -1 }}>
            {shareTitle(share.params)}
          </div>
          <div style={{ marginTop: 8, fontSize: 28, color: C.heroMuted }}>
            {shareDetails(share.params)}
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={await logoSrc()} width={96} height={96} style={{ borderRadius: 22 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", padding: "28px 56px 0", gap: 18 }}>
        {shown.map((course) => (
          <div key={course.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 340,
                fontSize: 30,
                fontWeight: 700,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              {course.name.replace(/ Golf (Course|Club)$/, "")}
            </div>
            {pills(distinctTimes(course.teeTimes).map(shareTime), 4, course.total).map((p) => (
              <div
                key={p.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 176,
                  height: 64,
                  borderRadius: 32,
                  fontSize: p.more ? 24 : 28,
                  fontWeight: p.more ? 600 : 700,
                  background: p.more ? C.background : C.surface,
                  border: `2px solid ${p.more ? C.border : C.surface}`,
                  color: p.more ? C.brand : C.foreground,
                }}
              >
                {p.label}
              </div>
            ))}
          </div>
        ))}
        {hidden > 0 && (
          <div style={{ fontSize: 26, color: C.muted, fontWeight: 600 }}>
            {`+${hidden} more ${hidden === 1 ? "course" : "courses"}`}
          </div>
        )}
      </div>
    </div>
  );
}
