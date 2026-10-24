import { formatPerthDay, roundName } from "@bookon/core";
import type { MatchplayMatch, MatchplayRound } from "@bookon/db";

export interface BracketSide {
  label: string;
  seed: number | null;
}

/**
 * A knockout draw sheet (Milestone 22): one column per round, scrolling
 * sideways on a phone. Used on the public draw and in the club portal.
 */
export function Bracket({
  matches,
  rounds,
  sides,
  highlight,
}: {
  matches: MatchplayMatch[];
  rounds: MatchplayRound[];
  sides: Map<string, BracketSide>;
  /** An entry to pick out, like the golfer looking at their own draw. */
  highlight?: string;
}) {
  const count = Math.max(0, ...matches.map((m) => m.round));
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      <ol className="flex min-w-max gap-4">
        {Array.from({ length: count }, (_, i) => {
          const round = i + 1;
          const playBy = rounds[i]?.playBy;
          return (
            <li key={round} className="flex w-56 flex-col">
              <p className="font-semibold">{roundName(round, count)}</p>
              <p className="mb-2 text-sm text-muted">
                {playBy ? `Play by ${formatPerthDay(playBy)}` : " "}
              </p>
              <ol className="flex flex-1 flex-col justify-around gap-3">
                {matches
                  .filter((m) => m.round === round)
                  .map((m) => (
                    <li key={m.id}>
                      <MatchCard match={m} sides={sides} highlight={highlight} />
                    </li>
                  ))}
              </ol>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MatchCard({
  match,
  sides,
  highlight,
}: {
  match: MatchplayMatch;
  sides: Map<string, BracketSide>;
  highlight?: string;
}) {
  const done = match.status === "done";
  const bye = done && match.score === "Bye";
  const row = (entryId: string | null) => {
    const side = entryId ? sides.get(entryId) : undefined;
    const won = done && entryId !== null && match.winnerEntryId === entryId;
    const lost = done && entryId !== null && !won;
    return (
      <p
        className={`flex items-baseline gap-2 px-3 py-1.5 text-sm ${won ? "font-semibold" : ""} ${lost ? "text-muted line-through decoration-1" : ""} ${entryId && entryId === highlight ? "bg-info-bg" : ""}`}
      >
        {side?.seed && <span className="text-xs text-muted tabular-nums">{side.seed}</span>}
        <span className="min-w-0 flex-1 truncate">
          {side ? (
            side.label
          ) : entryId === null && bye ? (
            "Bye"
          ) : (
            <span className="text-muted">To come</span>
          )}
        </span>
        {won && match.score && match.score !== "Bye" && (
          <span className="shrink-0 text-xs font-normal tabular-nums">{match.score}</span>
        )}
      </p>
    );
  };
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {row(match.entryA)}
      {row(match.entryB)}
      {(match.status === "reported" || match.status === "disputed") && (
        <p className="px-3 py-1 text-xs text-muted">
          {match.status === "reported" ? "Result waiting to be confirmed" : "Result disputed"}
        </p>
      )}
    </div>
  );
}
