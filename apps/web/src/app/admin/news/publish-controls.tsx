import { perthDate } from "@bookon/core";
import type { Article } from "@bookon/db";
import { publishNewsNow, saveNewsDraft, scheduleNews } from "@/app/admin/news/actions";
import { fieldLabel } from "@/components/form";
import { primaryButton, secondaryButton, textInput } from "@/components/ui";

/** The admin's buttons under the editor: save, publish now, or schedule. */
export function PublishControls({ article }: { article?: Article }) {
  const now = new Date();
  const live = article?.status === "published" && article.publishAt! <= now;
  const scheduled = article?.status === "published" && article.publishAt! > now;
  const waiting = article?.status === "review";
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-5">
      <div className="flex flex-wrap gap-2">
        {live ? (
          <button type="submit" formAction={saveNewsDraft} className={primaryButton}>
            Save changes (it&apos;s live)
          </button>
        ) : (
          <>
            <button type="submit" formAction={publishNewsNow} className={primaryButton}>
              {waiting ? "Approve and publish now" : "Publish now"}
            </button>
            <button type="submit" formAction={saveNewsDraft} className={secondaryButton}>
              {scheduled ? "Save changes" : waiting ? "Save my edits" : "Save draft"}
            </button>
          </>
        )}
      </div>
      {!live && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-surface p-3">
          <div>
            <label htmlFor="publishDate" className={fieldLabel}>
              {scheduled ? "Goes live on" : "Or publish on"}
            </label>
            <input
              id="publishDate"
              name="publishDate"
              type="date"
              min={perthDate(now)}
              defaultValue={scheduled ? perthDate(article!.publishAt!) : ""}
              className={`${textInput} w-auto`}
            />
          </div>
          <div>
            <label htmlFor="publishTime" className={fieldLabel}>
              At
            </label>
            <input
              id="publishTime"
              name="publishTime"
              type="time"
              step={300}
              defaultValue="06:00"
              className={`${textInput} w-auto`}
            />
          </div>
          <button type="submit" formAction={scheduleNews} className={secondaryButton}>
            {scheduled ? "Change the time" : waiting ? "Approve and schedule" : "Schedule"}
          </button>
        </div>
      )}
    </div>
  );
}
