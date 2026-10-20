import type { Metadata, Viewport } from "next";
import { siteUrl } from "@bookon/email";
import { Suspense } from "react";
import { PendingForms } from "@/components/pending-forms";
import { PhoneTabs } from "@/components/phone-tabs";
import { ServiceWorker } from "@/components/service-worker";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  // Link previews need full addresses for their pictures.
  metadataBase: new URL(siteUrl()),
  title: "BookOn",
  description: "Find a tee time at Perth public golf courses, then book with the club.",
  applicationName: "BookOn",
  appleWebApp: { capable: true, title: "BookOn", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the menu bar sit above the iPhone home bar (env(safe-area-inset-bottom)).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1f6f43" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1511" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU">
      {/* Phones: room at the bottom for the menu bar and the iPhone home bar. */}
      <body className="phone-tabs-space font-sans antialiased">
        {children}
        <SiteFooter />
        <Suspense>
          <PhoneTabs />
        </Suspense>
        <Suspense>
          <PendingForms />
        </Suspense>
        <ServiceWorker />
      </body>
    </html>
  );
}
