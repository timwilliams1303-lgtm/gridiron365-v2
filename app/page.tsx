"use client";

import {
  useEffect,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  getGridiron365ResumeRoute,
} from "@/components/pwa/Gridiron365ResumeTracker";

export default function HomePage() {
  const router =
    useRouter();

  useEffect(
    () => {
      const savedRoute =
        getGridiron365ResumeRoute();

      if (
        savedRoute &&
        savedRoute !== "/"
      ) {
        router.replace(
          savedRoute
        );

        return;
      }

      router.replace(
        "/my-leagues"
      );
    },
    [
      router,
    ]
  );

  return null;
}