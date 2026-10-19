import { SOCIAL_NETWORKS, pitchContact, socialLinks } from "@bookon/db";
import { saveSocialLinks } from "@/app/admin/coach-actions";
import { savePitchContact } from "@/app/admin/settings-actions";
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
  const contact = await pitchContact(getDb());
  const { saved, error } = await searchParams;
  return (
    <>
      <PageTitle title="Settings" />
      {saved && (
        <div className="mb-4">
          <Notice tone="info">Saved.</Notice>
        </div>
      )}
      {error === "email" && (
        <div className="mb-4">
          <Notice tone="warning">Check the email address.</Notice>
        </div>
      )}
      <form action={savePitchContact} className={`${panel} mb-6 flex flex-col gap-4`}>
        <h2 className="text-lg font-semibold">Contact on pitch reports</h2>
        <p className="text-sm text-muted">Printed at the bottom of each club pitch report.</p>
        <Field label="Name" name="name" defaultValue={contact.name} />
        <Field label="Phone" name="phone" type="tel" defaultValue={contact.phone} />
        <Field label="Email" name="email" type="email" defaultValue={contact.email} />
        <button type="submit" className={primaryButton}>
          Save contact
        </button>
      </form>
      <form action={saveSocialLinks} className={`${panel} flex flex-col gap-4`}>
        <h2 className="text-lg font-semibold">BookOn&apos;s social accounts</h2>
        <p className="text-sm text-muted">
          Shown as &quot;Follow BookOn&quot; on the home page. Leave one empty to hide it.
        </p>
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
