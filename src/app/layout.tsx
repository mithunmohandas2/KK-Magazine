import "./globals.css";
import type { Metadata } from "next";
import OfflineRegistration from "@/components/OfflineRegistration";
import ToastProvider from "@/components/ToastProvider";
import { magazineName } from "@/lib/data";

export const metadata: Metadata = {
  title: `${magazineName} | Digital Magazine`,
  description:
    "Mozhi, a digital magazine about culture, design, and discovery.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link
          rel="icon"
          type="image/png"
          sizes="192x192"
          href="/icons/mozhi-192.png"
        />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content={magazineName} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
        window.addEventListener('beforeinstallprompt', function (event) {
          event.preventDefault();
          window.mozhiInstallPrompt = event;
        }, { once: true });
      `,
          }}
        />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
        <OfflineRegistration />
      </body>
    </html>
  );
}
