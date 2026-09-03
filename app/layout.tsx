import type {
  Metadata,
  Viewport,
} from "next";

import {
  Geist,
  Geist_Mono,
} from "next/font/google";

import {
  Suspense,
} from "react";

import Gridiron365ResumeTracker from "@/components/pwa/Gridiron365ResumeTracker";

import "./globals.css";

const geistSans =
  Geist({
    variable:
      "--font-geist-sans",

    subsets: [
      "latin",
    ],
  });

const geistMono =
  Geist_Mono({
    variable:
      "--font-geist-mono",

    subsets: [
      "latin",
    ],
  });

export const metadata:
  Metadata = {
  title: {
    default:
      "Gridiron365",

    template:
      "%s | Gridiron365",
  },

  description:
    "Gridiron365 Fantasy Football",

  applicationName:
    "Gridiron365",

  manifest:
    "/manifest.webmanifest",

  appleWebApp: {
    capable: true,

    title:
      "Gridiron365",

    statusBarStyle:
      "black-translucent",
  },

  icons: {
    icon: [
      {
        url:
          "/branding/gridiron365-pwa-192.png",

        sizes:
          "192x192",

        type:
          "image/png",
      },

      {
        url:
          "/branding/gridiron365-pwa-512.png",

        sizes:
          "512x512",

        type:
          "image/png",
      },
    ],

    apple: [
      {
        url:
          "/branding/gridiron365-pwa-192.png",

        sizes:
          "192x192",

        type:
          "image/png",
      },
    ],
  },
};

export const viewport:
  Viewport = {
  width:
    "device-width",

  initialScale:
    1,

  viewportFit:
    "cover",

  themeColor:
    "#0f0f0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={
        `${geistSans.variable} ${geistMono.variable}`
      }
    >
      <body>
        <Suspense
          fallback={null}
        >
          <Gridiron365ResumeTracker />
        </Suspense>

        {children}
      </body>
    </html>
  );
}