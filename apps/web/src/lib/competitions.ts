import "server-only";
import {
  TEAM_NAME,
  areaName,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  type TeamSize,
} from "@bookon/core";
import type { ListedEvent } from "@bookon/db";
import type { ListedCompetition } from "@/components/competition-list";

/** An open event as the Competitions page and other lists show it (Milestone 21). */
export function listedCompetition(
  e: ListedEvent,
  now: Date,
): ListedCompetition & { areaName: string } {
  return {
    id: e.id,
    title: e.title,
    clubName: e.clubName,
    courseName: e.courseName,
    suburb: e.suburb,
    area: e.area,
    areaName: areaName(e.area),
    date: e.date,
    when: `${formatPerthDay(e.date)}, ${formatPerthTime(e.firstStart)}${e.startType === "shotgun" ? " shotgun" : ""}`,
    format: `${TEAM_NAME[e.teamSize as TeamSize]}, ${e.holes} holes`,
    fee: `${formatPrice(e.feeCents)} a player`,
    left: e.left,
    closed: e.entriesClose <= now,
    latitude: e.latitude,
    longitude: e.longitude,
  };
}
