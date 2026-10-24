"use client";

import { useRef, useState } from "react";
import {
  NEWS_BODY_MAX,
  NEWS_CATEGORIES,
  NEWS_SUMMARY_MAX,
  NEWS_TITLE_MAX,
} from "@bookon/core/news";
import { ArticleBody } from "@/components/news/article-body";
import { fieldLabel, hintText } from "@/components/form";
import { secondaryButton, textInput } from "@/components/ui";

export interface EditorArticle {
  id?: string;
  title: string;
  summary: string;
  body: string;
  category: string | null;
  coverPhotoId: string | null;
  coverArt: string | null;
  coverAlt: string | null;
}

const tool =
  "flex min-h-10 min-w-10 items-center justify-center rounded-md border border-border px-2 text-sm font-semibold hover:bg-surface";

/** Upload a picture, returning its address. */
async function upload(
  file: File,
  rightsBy: string,
): Promise<{ url: string; id: string } | { error: string }> {
  const form = new FormData();
  form.set("photo", file);
  form.set("rights", "yes");
  form.set("rightsBy", rightsBy);
  try {
    const response = await fetch("/api/news/photo", { method: "POST", body: form });
    const data = (await response.json()) as { id?: string; message?: string };
    if (!response.ok || !data.id)
      return { error: data.message ?? "That didn't upload. Try again." };
    return { id: data.id, url: `/news-photos/${data.id}` };
  } catch {
    return { error: "That didn't upload. Check your connection and try again." };
  }
}

/**
 * Writing an article (Milestone 24): headline, summary, category, cover
 * picture, and the text with formatting buttons and a preview. The form's
 * buttons come from the page, as each makes a different decision.
 */
export function ArticleEditor({
  article,
  courses,
  writerName,
  children,
}: {
  article?: EditorArticle;
  courses: { slug: string; name: string }[];
  writerName: string;
  /** The page's buttons (save, send in, publish), each its own action. */
  children: React.ReactNode;
}) {
  const body = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(article?.body ?? "");
  const [preview, setPreview] = useState(false);
  const [cover, setCover] = useState<"none" | "photo" | "art">(
    article?.coverPhotoId ? "photo" : article?.coverArt ? "art" : "none",
  );
  const [coverPhotoId, setCoverPhotoId] = useState(article?.coverPhotoId ?? "");
  const [coverArt, setCoverArt] = useState(article?.coverArt ?? courses[0]?.slug ?? "");
  const [rightsBy, setRightsBy] = useState(writerName);
  const [rights, setRights] = useState(false);
  const [picture, setPicture] = useState({ alt: "", caption: "" });
  const [status, setStatus] = useState<string | null>(null);
  const pictureFile = useRef<HTMLInputElement>(null);
  const coverFile = useRef<HTMLInputElement>(null);

  /** Wrap the selection, or insert at the cursor, keeping focus in the text. */
  function edit(change: (selected: string) => { text: string; select?: [number, number] }) {
    const el = body.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const result = change(text.slice(start, end));
    const next = text.slice(0, start) + result.text + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const [a, b] = result.select ?? [result.text.length, result.text.length];
      el.setSelectionRange(start + a, start + b);
    });
  }
  const wrap = (mark: string, placeholder: string) =>
    edit((s) => {
      const inner = s || placeholder;
      return { text: `${mark}${inner}${mark}`, select: [mark.length, mark.length + inner.length] };
    });
  const line = (prefix: string, placeholder: string) =>
    edit((s) => {
      const lines = (s || placeholder).split("\n");
      const out = lines
        .map(
          (l, i) =>
            `${prefix === "1. " ? `${i + 1}. ` : prefix}${l.replace(/^(#{1,3} |[-*] |\d+\. |> )/, "")}`,
        )
        .join("\n");
      // With nothing selected, select just the placeholder words, so typing replaces them and keeps the mark.
      return {
        text: `\n${out}\n`,
        select: s ? [1, out.length + 1] : [1 + prefix.length, out.length + 1],
      };
    });
  function link() {
    const url = window.prompt(
      "Link to (a web address, like https://…, or a BookOn page, like /coaches)",
    );
    if (!url) return;
    edit((s) => {
      const label = s || "link text";
      return { text: `[${label}](${url.trim()})`, select: [1, 1 + label.length] };
    });
  }

  async function addPicture() {
    const file = pictureFile.current?.files?.[0];
    if (!file) return setStatus("Choose a picture first.");
    if (!picture.alt.trim()) return setStatus("Describe the picture in a few words first.");
    if (!rights || !rightsBy.trim())
      return setStatus("Confirm you may use this picture, and add your name.");
    setStatus("Uploading…");
    const result = await upload(file, rightsBy.trim());
    if ("error" in result) return setStatus(result.error);
    const caption = picture.caption.trim().replace(/"/g, "'");
    edit(() => ({
      text: `\n\n![${picture.alt.trim().replace(/[[\]]/g, "")}](${result.url}${caption ? ` "${caption}"` : ""})\n\n`,
    }));
    setPicture({ alt: "", caption: "" });
    if (pictureFile.current) pictureFile.current.value = "";
    setStatus("Picture added.");
  }

  async function uploadCover() {
    const file = coverFile.current?.files?.[0];
    if (!file) return;
    if (!rights || !rightsBy.trim()) {
      setStatus("Confirm you may use this picture, and add your name, then choose it again.");
      if (coverFile.current) coverFile.current.value = "";
      return;
    }
    setStatus("Uploading…");
    const result = await upload(file, rightsBy.trim());
    if ("error" in result) return setStatus(result.error);
    setCoverPhotoId(result.id);
    setStatus("Cover picture added.");
  }

  const rightsBox = (
    <div className="flex flex-col gap-2 rounded-lg bg-surface p-3 text-sm">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={rights}
          onChange={(e) => setRights(e.target.checked)}
          className="mt-1 size-5 accent-brand"
        />
        <span>
          I took these pictures, or have permission to use them on BookOn. (Never copy photos from a
          club&apos;s or anyone else&apos;s website.)
        </span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-muted">Your name</span>
        <input
          value={rightsBy}
          onChange={(e) => setRightsBy(e.target.value)}
          maxLength={120}
          className={`${textInput} min-h-10`}
        />
      </label>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {article?.id && <input type="hidden" name="articleId" value={article.id} />}
      <div>
        <label htmlFor="title" className={fieldLabel}>
          Headline
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={NEWS_TITLE_MAX}
          defaultValue={article?.title}
          className={`${textInput} text-lg font-semibold`}
        />
      </div>
      <div>
        <label htmlFor="summary" className={fieldLabel}>
          Summary
        </label>
        <textarea
          id="summary"
          name="summary"
          required
          rows={2}
          maxLength={NEWS_SUMMARY_MAX}
          defaultValue={article?.summary}
          className={`${textInput} py-2`}
        />
        <p className={hintText}>
          One or two sentences. Shows on the news page and when the article is shared.
        </p>
      </div>
      <div>
        <label htmlFor="category" className={fieldLabel}>
          Category
        </label>
        <select
          id="category"
          name="category"
          defaultValue={article?.category ?? ""}
          className={textInput}
        >
          <option value="">None</option>
          {Object.entries(NEWS_CATEGORIES).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <legend className="px-1 font-semibold">Cover picture</legend>
        <div className="flex flex-wrap gap-x-6">
          {(
            [
              ["none", "None"],
              ["photo", "Upload a picture"],
              ["art", "A course drawing"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="coverKind"
                value={value}
                checked={cover === value}
                onChange={() => setCover(value)}
                className="size-5 accent-brand"
              />
              {label}
            </label>
          ))}
        </div>
        <input type="hidden" name="coverPhotoId" value={cover === "photo" ? coverPhotoId : ""} />
        <input type="hidden" name="coverArt" value={cover === "art" ? coverArt : ""} />
        {cover === "photo" && (
          <>
            {rightsBox}
            <input
              ref={coverFile}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={uploadCover}
              className="text-sm"
              aria-label="Cover picture"
            />
            {coverPhotoId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/news-photos/${coverPhotoId}`}
                alt=""
                className="max-h-48 w-auto self-start rounded-lg"
              />
            )}
          </>
        )}
        {cover === "art" && (
          <>
            <select
              value={coverArt}
              onChange={(e) => setCoverArt(e.target.value)}
              className={textInput}
              aria-label="Course drawing"
            >
              {courses.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/art/${coverArt}-wide.svg`}
              alt=""
              className="max-h-40 w-auto self-start rounded-lg"
            />
          </>
        )}
        {cover !== "none" && (
          <div>
            <label htmlFor="coverAlt" className={fieldLabel}>
              Describe the picture
            </label>
            <input
              id="coverAlt"
              name="coverAlt"
              maxLength={200}
              defaultValue={article?.coverAlt ?? ""}
              placeholder="Golfers walking up the 18th at sunset"
              className={textInput}
            />
            <p className={hintText}>For people who can&apos;t see it, and for Google.</p>
          </div>
        )}
      </fieldset>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className={fieldLabel}>The article</span>
          <div className="flex gap-1" role="tablist" aria-label="Write or preview">
            <button
              type="button"
              role="tab"
              aria-selected={!preview}
              onClick={() => setPreview(false)}
              className={`${tool} ${!preview ? "bg-surface" : ""}`}
            >
              Write
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={preview}
              onClick={() => setPreview(true)}
              className={`${tool} ${preview ? "bg-surface" : ""}`}
            >
              Preview
            </button>
          </div>
        </div>
        <textarea name="body" value={text} readOnly hidden />
        {preview ? (
          <div className="min-h-64 rounded-xl border border-border p-4">
            {text.trim() ? (
              <ArticleBody markdown={text} />
            ) : (
              <p className="text-muted">Nothing written yet.</p>
            )}
          </div>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap gap-1" role="toolbar" aria-label="Formatting">
              <button
                type="button"
                className={tool}
                onClick={() => line("## ", "Heading")}
                title="Heading"
              >
                H
              </button>
              <button
                type="button"
                className={tool}
                onClick={() => line("### ", "Smaller heading")}
                title="Smaller heading"
              >
                h
              </button>
              <button
                type="button"
                className={tool}
                onClick={() => wrap("**", "bold text")}
                title="Bold"
              >
                B
              </button>
              <button
                type="button"
                className={`${tool} italic`}
                onClick={() => wrap("*", "italic text")}
                title="Italics"
              >
                I
              </button>
              <button type="button" className={tool} onClick={link} title="Link">
                Link
              </button>
              <button
                type="button"
                className={tool}
                onClick={() => line("- ", "List item")}
                title="Bullet list"
              >
                • List
              </button>
              <button
                type="button"
                className={tool}
                onClick={() => line("1. ", "First step")}
                title="Numbered list"
              >
                1. List
              </button>
              <button
                type="button"
                className={tool}
                onClick={() => line("> ", "A quote")}
                title="Quote"
              >
                “Quote”
              </button>
            </div>
            <textarea
              ref={body}
              aria-label="The article"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={20}
              maxLength={NEWS_BODY_MAX}
              className={`${textInput} py-3 font-mono text-base leading-relaxed`}
            />
            <p className={hintText}>
              Leave a blank line between paragraphs. Select some words, then press a button to
              format them.
            </p>
          </>
        )}
      </div>

      {!preview && (
        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer font-semibold">Add a picture to the article</summary>
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm text-muted">
              It goes where your cursor is in the article. Pictures are resized for phones, and
              hidden details like where they were taken are removed.
            </p>
            {rightsBox}
            <input
              ref={pictureFile}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="text-sm"
              aria-label="Picture"
            />
            <label className="flex flex-col gap-1 text-sm">
              <span className={fieldLabel}>Describe the picture</span>
              <input
                value={picture.alt}
                onChange={(e) => setPicture({ ...picture, alt: e.target.value })}
                maxLength={200}
                className={textInput}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className={fieldLabel}>Caption (optional)</span>
              <input
                value={picture.caption}
                onChange={(e) => setPicture({ ...picture, caption: e.target.value })}
                maxLength={200}
                className={textInput}
              />
            </label>
            <button type="button" onClick={addPicture} className={`${secondaryButton} self-start`}>
              Upload and add
            </button>
          </div>
        </details>
      )}
      {status && (
        <p role="status" className="text-sm text-muted">
          {status}
        </p>
      )}
      {children}
    </div>
  );
}
