"use client";

/** Where a lesson is: one of the coach's places, or somewhere the golfer chooses (Milestone 26). */
import { useState } from "react";
import { PLAYER_CHOICE } from "@bookon/core/coaching";
import { fieldLabel, hintText } from "@/components/form";
import { textInput } from "@/components/ui";

export function LessonPlacePicker({
  places,
  playerChoice,
  coach,
}: {
  places: string[];
  playerChoice: boolean;
  coach: string;
}) {
  const choices = playerChoice ? [...places, PLAYER_CHOICE] : places;
  const [place, setPlace] = useState(choices[0] ?? "");
  const theirs = place === PLAYER_CHOICE;
  return (
    <>
      {choices.length > 1 ? (
        <div>
          <label htmlFor="f-place" className={fieldLabel}>
            Where
          </label>
          <select
            id="f-place"
            name="place"
            required
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            className={textInput}
          >
            {choices.map((p) => (
              <option key={p} value={p}>
                {p === PLAYER_CHOICE ? "Somewhere you choose" : p}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="place" value={place} />
      )}
      {theirs && (
        <div>
          <label htmlFor="f-playerPlace" className={fieldLabel}>
            Where would you like {coach} to come?
          </label>
          <input
            id="f-playerPlace"
            name="playerPlace"
            required
            maxLength={200}
            autoComplete="street-address"
            aria-describedby="f-playerPlace-hint"
            className={textInput}
          />
          <p id="f-playerPlace-hint" className={hintText}>
            Your club, a park or your address, and the suburb.
          </p>
        </div>
      )}
    </>
  );
}
