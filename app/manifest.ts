import type {
  MetadataRoute,
} from "next";

export default function manifest():
  MetadataRoute.Manifest {
  return {
    name:
      "Gridiron365",

    short_name:
      "G365",

    description:
      "Gridiron365 Fantasy Football",

    start_url:
      "/",

    scope:
      "/",

    display:
      "standalone",

    background_color:
      "#0f0f0f",

    theme_color:
      "#0f0f0f",

    orientation:
      "portrait-primary",

    icons: [
      {
        src:
          "/branding/gridiron365-pwa-192.png",

        sizes:
          "192x192",

        type:
          "image/png",

        purpose:
          "any",
      },

      {
        src:
          "/branding/gridiron365-pwa-512.png",

        sizes:
          "512x512",

        type:
          "image/png",

        purpose:
          "any",
      },

      {
        src:
          "/branding/gridiron365-pwa-512.png",

        sizes:
          "512x512",

        type:
          "image/png",

        purpose:
          "maskable",
      },
    ],
  };
}