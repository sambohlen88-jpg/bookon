import { MAX_CLUB_LOGIN_PHOTOS, listPhotosForClub } from "@bookon/db";
import { PageTitle } from "@/components/admin/ui";
import { PhotoUploader } from "@/components/clubs/photo-uploader";
import { requireClub } from "@/lib/access";
import { getDb } from "@/lib/db";

export default async function ClubPhotosPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const { club, user } = await requireClub(clubId, `/club/${clubId}/photos`);
  const photos = await listPhotosForClub(getDb(), club.id);
  return (
    <>
      <PageTitle
        title="Photos"
        intro="Photos of your course for BookOn. We check each one before it goes on the site."
      />
      <PhotoUploader
        owner={{ kind: "club", clubId: club.id }}
        max={MAX_CLUB_LOGIN_PHOTOS}
        locked={false}
        defaultName={user.email}
        photos={photos
          .filter((p) => p.status !== "declined")
          .map((p) => ({ id: p.id, caption: p.caption, status: p.status }))}
      />
    </>
  );
}
