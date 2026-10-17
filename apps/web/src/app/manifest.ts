import type { MetadataRoute } from "next";

/** Lets golfers add BookOn to their home screen, where it opens like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BookOn: Perth tee times",
    short_name: "BookOn",
    description: "Find a tee time at Perth public golf courses, then book with the club.",
    id: "/",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1f6f43",
    lang: "en-AU",
    categories: ["sports", "travel"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
