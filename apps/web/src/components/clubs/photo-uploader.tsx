"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fieldLabel } from "@/components/form";
import { secondaryButton, textInput } from "@/components/ui";

export interface ListingPhoto {
  id: string;
  caption: string | null;
  status: "pending" | "approved" | "declined";
}

/**
 * Add photos to a listing. Each upload needs the club to confirm it owns the
 * photo or may share it, and who confirmed it.
 */
/** Whose photos these are: a listing still being filled in, or a live club. */
export type PhotoOwner = { kind: "listing"; token: string } | { kind: "club"; clubId: string };

const STATUS = { pending: "Waiting for approval", approved: "On the site", declined: "Not used" };

export function PhotoUploader({
  owner,
  photos,
  max,
  defaultName,
  locked,
}: {
  owner: PhotoOwner;
  photos: ListingPhoto[];
  max: number;
  defaultName: string;
  locked: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const ownerField = owner.kind === "listing" ? { token: owner.token } : { clubId: owner.clubId };
  const src = (id: string) =>
    owner.kind === "listing"
      ? `/clubs/join/${owner.token}/photo/${id}`
      : `/club/${owner.clubId}/photo/${id}`;

  async function upload(form: HTMLFormElement) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/clubs/photos", {
        method: "POST",
        body: new FormData(form),
      });
      if (!response.ok) {
        setMessage(
          ((await response.json().catch(() => null)) as { message?: string } | null)?.message ??
            "That didn't upload. Try again.",
        );
        return;
      }
      form.reset();
      setMessage("Photo added.");
      router.refresh();
    } catch {
      setMessage("That didn't upload. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(photoId: string) {
    setBusy(true);
    await fetch("/api/clubs/photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ownerField, photoId }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src(p.id)}
                alt={p.caption ?? "Course photo"}
                className="aspect-video w-full object-cover"
              />
              <div className="flex items-center justify-between gap-2 p-2 text-xs">
                <span className="min-w-0 truncate text-muted">
                  {owner.kind === "club" ? STATUS[p.status] : (p.caption ?? "No caption")}
                </span>
                {!locked && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(p.id)}
                    className="shrink-0 font-medium text-brand underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!locked && photos.length < max && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void upload(e.currentTarget);
          }}
          className="flex flex-col gap-4 rounded-xl bg-surface p-4"
        >
          {Object.entries(ownerField).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <div>
            <label htmlFor="photo-file" className={fieldLabel}>
              Photo
            </label>
            <input
              id="photo-file"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              required
              className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-border file:bg-background file:px-4 file:font-medium"
            />
            <p className="mt-1 text-sm text-muted">
              JPEG, PNG or WebP, up to 15 MB. Landscape works best.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="photo-caption" className={fieldLabel}>
                Caption <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="photo-caption"
                name="caption"
                maxLength={200}
                placeholder="The 18th green at sunset"
                className={textInput}
              />
            </div>
            <div>
              <label htmlFor="photo-credit" className={fieldLabel}>
                Photographer <span className="font-normal text-muted">(optional)</span>
              </label>
              <input id="photo-credit" name="credit" maxLength={120} className={textInput} />
            </div>
          </div>
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="rights"
              value="yes"
              required
              className="mt-0.5 size-5 shrink-0 accent-brand"
            />
            <span>
              The club owns this photo, or has permission to share it, and BookOn may show it on its
              website.
            </span>
          </label>
          <div>
            <label htmlFor="photo-by" className={fieldLabel}>
              Your name
            </label>
            <input
              id="photo-by"
              name="rightsBy"
              required
              defaultValue={defaultName}
              maxLength={120}
              className={textInput}
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={busy}
              className={`${secondaryButton} bg-background disabled:opacity-60`}
            >
              {busy ? "Uploading…" : "Add photo"}
            </button>
          </div>
        </form>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <p className="text-sm text-muted">
        {photos.length} of {max} photos. We check each photo before it goes on the site.
      </p>
    </div>
  );
}
