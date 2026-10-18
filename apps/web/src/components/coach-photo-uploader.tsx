"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fieldLabel } from "@/components/form";
import { secondaryButton, textInput } from "@/components/ui";

/** A coach adds a photo of themselves. BookOn checks it before it shows. */
export function CoachPhotoUploader({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(form: HTMLFormElement) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/coaches/photo", {
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
      setMessage("Thanks. We'll check it and it'll show on your page once approved.");
      router.refresh();
    } catch {
      setMessage("That didn't upload. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void upload(e.currentTarget);
      }}
      className="flex flex-col gap-3"
    >
      <div>
        <label htmlFor="coach-photo" className={fieldLabel}>
          A photo of you
        </label>
        <input
          id="coach-photo"
          name="photo"
          type="file"
          accept="image/*"
          required
          className="text-sm"
        />
        <p className="mt-1 text-sm text-muted">
          A clear, friendly head and shoulders photo works best. JPEG or PNG, under 15 MB.
        </p>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="rights"
          value="yes"
          required
          className="mt-0.5 size-5 accent-brand"
        />
        <span>It&apos;s a photo of me, and I&apos;m allowed to share it.</span>
      </label>
      <div>
        <label htmlFor="coach-photo-by" className={fieldLabel}>
          Your name
        </label>
        <input
          id="coach-photo-by"
          name="rightsBy"
          required
          defaultValue={defaultName}
          className={textInput}
        />
      </div>
      <button type="submit" disabled={busy} className={secondaryButton}>
        {busy ? "Uploading…" : "Upload photo"}
      </button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </form>
  );
}
