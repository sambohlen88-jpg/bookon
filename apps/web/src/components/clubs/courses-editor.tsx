"use client";

import { useRef, useState } from "react";
import { fieldLabel } from "@/components/form";
import { secondaryButton, textInput } from "@/components/ui";

interface Row {
  key: number;
  name: string;
  holes: string;
  par: string;
  layouts: string;
}

/** The club's courses (or layouts), sent as JSON in a hidden field. */
export function CoursesEditor({
  initial,
}: {
  initial: { name: string; holes: number; par?: number; layouts?: string }[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    // Keys number from 1 in order, so the server's page and the browser agree on field ids.
    (initial.length > 0 ? initial : [{ name: "", holes: 18 }]).map((c, i) => ({
      key: i + 1,
      name: c.name,
      holes: String(c.holes || 18),
      par: c.par ? String(c.par) : "",
      layouts: c.layouts ?? "",
    })),
  );
  const lastKey = useRef(rows.length);
  const update = (key: number, change: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...change } : r)));

  return (
    <div className="flex flex-col gap-4">
      <input
        type="hidden"
        name="courses"
        value={JSON.stringify(
          rows.map((r) => ({ name: r.name, holes: r.holes, par: r.par, layouts: r.layouts })),
        )}
      />
      {rows.map((r, i) => (
        <fieldset key={r.key} className="rounded-xl border border-border p-4">
          <legend className="px-1 font-semibold">Course {i + 1}</legend>
          <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
            <div>
              <label htmlFor={`c-name-${r.key}`} className={fieldLabel}>
                Name
              </label>
              <input
                id={`c-name-${r.key}`}
                value={r.name}
                onChange={(e) => update(r.key, { name: e.target.value })}
                required
                maxLength={120}
                className={textInput}
              />
            </div>
            <div>
              <label htmlFor={`c-holes-${r.key}`} className={fieldLabel}>
                Holes
              </label>
              <select
                id={`c-holes-${r.key}`}
                value={r.holes}
                onChange={(e) => update(r.key, { holes: e.target.value })}
                className={textInput}
              >
                {["9", "18", "27", "36"].map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`c-par-${r.key}`} className={fieldLabel}>
                Par <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id={`c-par-${r.key}`}
                value={r.par}
                inputMode="numeric"
                onChange={(e) => update(r.key, { par: e.target.value.replace(/\D/g, "") })}
                maxLength={2}
                className={textInput}
              />
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor={`c-layouts-${r.key}`} className={fieldLabel}>
              Nines or layouts golfers can book{" "}
              <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id={`c-layouts-${r.key}`}
              value={r.layouts}
              onChange={(e) => update(r.key, { layouts: e.target.value })}
              placeholder="For example: Island & Pines, Pines & Lakes"
              maxLength={200}
              className={textInput}
            />
          </div>
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
              className={`${secondaryButton} mt-4`}
            >
              Remove this course
            </button>
          )}
        </fieldset>
      ))}
      {rows.length < 10 && (
        <div>
          <button
            type="button"
            onClick={() =>
              setRows((rs) => [
                ...rs,
                { key: ++lastKey.current, name: "", holes: "9", par: "", layouts: "" },
              ])
            }
            className={secondaryButton}
          >
            Add another course
          </button>
        </div>
      )}
    </div>
  );
}
