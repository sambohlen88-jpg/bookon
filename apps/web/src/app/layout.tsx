import type { Metadata, Viewport } from "next";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";

export const metadata: Metadata = {
  title: "BookOn",
  description: "Find a tee time at Perth public golf courses, then book with the club.",
  applicationName: "BookOn",
  appleWebApp: { capable: true, title: "BookOn", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
      <body className="font-sans antialiased">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
