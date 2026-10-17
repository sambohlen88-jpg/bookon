import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { preparePhoto } from "./photos";

describe("preparePhoto", () => {
  it("resizes, converts to WebP and drops hidden details such as location", async () => {
    const original = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: "#3f8f52" },
    })
      .jpeg()
      .withExif({
        IFD0: { Make: "TestCam" },
        IFD3: { GPSLatitudeRef: "S", GPSLatitude: "31/1 57/1 0/1" },
      })
      .toBuffer();
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const photo = (await preparePhoto(original))!;
    expect(photo.contentType).toBe("image/webp");
    expect([photo.width, photo.height]).toEqual([2000, 1500]);
    const meta = await sharp(photo.data).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
  });

  it("leaves small photos their size", async () => {
    const small = await sharp({
      create: { width: 800, height: 600, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer();
    expect(await preparePhoto(small)).toMatchObject({ width: 800, height: 600 });
  });

  it("refuses anything that isn't a photo", async () => {
    expect(await preparePhoto(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(await preparePhoto(Buffer.from("%PDF-1.7"))).toBeNull();
  });
});
