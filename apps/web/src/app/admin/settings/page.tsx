import { SOCIAL_NETWORKS, socialLinks } from "@bookon/db";
import { saveSocialLinks } from "@/app/admin/coach-actions";
import { PageTitle, panel } from "@/components/admin/ui";
import { Field } from "@/components/form";
import { Notice, primaryButton } from "@/components/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

const NAMES = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" } as const;

export default async function AdminSettings({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const links = await socialLinks(getDb());
  const { saved } = await searchParams;
  return (
    <>
      <PageTitle title="Settings" />
      <form action={saveSocialLinks} className={`${panel} flex flex-col gap-4`}>
        <h2 className="text-lg font-semibold">BookOn&apos;s social accounts</h2>
        <p className="text-sm text-muted">
          Shown as &quot;Follow BookOn&quot; on the home page. Leave one empty to hide it.
        </p>
        {saved && <Notice tone="info">Saved.</Notice>}
        {SOCIAL_NETWORKS.map((n) => (
          <Field
            key={n}
            label={`${NAMES[n]} page address`}
            name={n}
            defaultValue={links[n]}
            placeholder={`https://www.${n}.com/…`}
          />
        ))}
        <button type="submit" className={primaryButton}>
          Save
        </button>
      </form>
    </>
  );
}
