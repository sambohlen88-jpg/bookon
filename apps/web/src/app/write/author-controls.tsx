import { saveMyDraft, sendForApproval } from "@/app/write/actions";
import { primaryButton, secondaryButton } from "@/components/ui";

/** An author's buttons under the editor: save, or send to BookOn for approval. */
export function AuthorControls({ waiting }: { waiting: boolean }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-5">
      <div className="flex flex-wrap gap-2">
        <button type="submit" formAction={sendForApproval} className={primaryButton}>
          {waiting ? "Save changes" : "Send to BookOn for approval"}
        </button>
        {!waiting && (
          <button type="submit" formAction={saveMyDraft} className={secondaryButton}>
            Save draft
          </button>
        )}
      </div>
      <p className="text-sm text-muted">
        {waiting
          ? "It's waiting for approval. Your changes are saved with it."
          : "BookOn reads it before it goes on the news page. You'll get an email either way."}
      </p>
    </div>
  );
}
