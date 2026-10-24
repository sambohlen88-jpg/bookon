"use client";

import { useRef, useState } from "react";
import { createShareLink } from "@/app/share-actions";
import type { ShareLink } from "@/lib/share";
import { track } from "@/lib/analytics-client";

type Status = { kind: "idle" | "working" } | { kind: "error"; message: string };

/**
 * Share times with mates: a picture for the group chat, a link, or plain text.
 * The share is made when the panel opens, and the picture fetched then too,
 * so the phone's share sheet opens straight from the tap (iPhones refuse it
 * after a wait).
 */
export function ShareButton({
  query,
  course = null,
  ready = null,
  label = "Share",
  courseName,
}: {
  /** The search to share, as /search?... */
  query?: string;
  /** Share just this course's times. */
  course?: string | null;
  /** An existing share, on the share page itself. */
  ready?: ShareLink | null;
  label?: string;
  /** For the button's accessible name on a course card. */
  courseName?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [share, setShare] = useState<ShareLink | null>(ready);
  const [picture, setPicture] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [done, setDone] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  // Phones get the share sheet; computers download and copy. Set on open, to match the server's HTML.
  const [touch, setTouch] = useState(false);

  async function open() {
    dialog.current?.showModal();
    track("share", course ? "course" : "search");
    setTouch(matchMedia("(pointer: coarse)").matches);
    setDone(null);
    setShowText(false);
    let current = share;
    if (!current) {
      setStatus({ kind: "working" });
      try {
        const made = await createShareLink(query ?? "", course);
        if ("error" in made) return setStatus({ kind: "error", message: made.error });
        current = made;
        setShare(made);
      } catch {
        return setStatus({
          kind: "error",
          message: "We couldn't make a share just now. Try again.",
        });
      }
    }
    setStatus({ kind: "idle" });
    if (!picture) void loadPicture(current);
  }

  async function loadPicture(s: ShareLink) {
    try {
      const response = await fetch(`/s/${s.code}/picture`);
      if (!response.ok) return;
      const blob = await response.blob();
      setPicture(new File([blob], `bookon-tee-times.png`, { type: "image/png" }));
    } catch {
      // The picture button falls back to opening the picture.
    }
  }

  async function sendPicture() {
    if (!share) return;
    if (picture && navigator.canShare?.({ files: [picture] })) {
      try {
        await navigator.share({ files: [picture], title: share.title });
        return setDone("picture");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }
    if (touch) {
      // Phones that can't attach files here (such as before launch): open it to press and hold.
      window.open(`/s/${share.code}/picture`, "_blank", "noopener");
      return setDone("opened");
    }
    const a = document.createElement("a");
    a.href = `/s/${share.code}/picture?download=1`;
    a.download = "bookon-tee-times.png";
    a.click();
    setDone("downloaded");
  }

  async function sendLink() {
    if (!share) return;
    if (navigator.share && touch) {
      try {
        await navigator.share({ title: share.title, url: share.url });
        return setDone("link");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }
    await copy(share.url, "link-copied");
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setDone(what);
    } catch {
      setShowText(true);
    }
  }

  const messages: Record<string, string> = {
    picture: "Sent.",
    opened: "Press and hold the picture to save or share it.",
    downloaded: "Picture saved to your downloads.",
    link: "Sent.",
    "link-copied": "Link copied. Paste it into your chat.",
    "text-copied": "Copied. Paste it into your chat.",
  };
  const option =
    "flex min-h-12 w-full items-center gap-3 rounded-lg border border-border px-4 text-left font-semibold disabled:opacity-50";

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-label={courseName ? `Share times at ${courseName}` : undefined}
        className={
          courseName
            ? "-mt-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:text-brand"
            : "inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold"
        }
      >
        <ShareIcon />
        {!courseName && label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="share-title"
        className="m-0 mt-auto w-full max-w-none rounded-t-2xl bg-background p-5 text-foreground backdrop:bg-foreground/40 sm:m-auto sm:max-w-sm sm:rounded-2xl"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="share-title" className="text-lg font-semibold">
              Share with your mates
            </h2>
            {share && <p className="text-sm text-muted">{share.title}</p>}
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="-mr-2 -mt-2 flex size-11 items-center justify-center rounded-lg text-2xl text-muted"
          >
            <span aria-hidden>×</span>
          </button>
        </div>

        {status.kind === "working" && <p className="mt-4 text-sm text-muted">Getting it ready…</p>}
        {status.kind === "error" && (
          <p role="alert" className="mt-4 text-sm text-warning-fg">
            {status.message}
          </p>
        )}

        {share && status.kind === "idle" && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/s/${share.code}/picture`}
              alt="A picture of the times, as your mates will see it"
              className="mt-4 max-h-56 w-full rounded-lg border border-border object-cover object-top"
            />
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" onClick={sendPicture} className={option}>
                <span aria-hidden>🖼️</span>
                {touch ? "Send picture" : "Download picture"}
                {!picture && (
                  <span className="ml-auto text-xs font-normal text-muted">Loading</span>
                )}
              </button>
              <button type="button" onClick={sendLink} className={option}>
                <span aria-hidden>🔗</span>
                {touch ? "Send link" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={() => copy(share.text, "text-copied")}
                className={option}
              >
                <span aria-hidden>📋</span>
                Copy as text
              </button>
            </div>
            {done && (
              <p role="status" className="mt-3 text-sm text-brand">
                {messages[done]}
              </p>
            )}
            {showText && (
              <textarea
                readOnly
                value={`${share.text}`}
                rows={8}
                aria-label="Times as text, to copy"
                onFocus={(e) => e.currentTarget.select()}
                className="mt-3 w-full rounded-lg border border-border bg-surface p-3 text-sm"
              />
            )}
            <p className="mt-3 text-xs text-muted">
              The link shows these times, crossed out once they&apos;re booked. It stops working a
              week after the day.
            </p>
          </>
        )}
      </dialog>
    </>
  );
}

function ShareIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}
