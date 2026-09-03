"use client";

import {
  useEffect,
} from "react";

import {
  usePathname,
  useSearchParams,
} from "next/navigation";

export const G365_LAST_ROUTE_KEY =
  "g365:last-route";

const ROUTES_NOT_TO_REMEMBER = [
  "/",
  "/auth",
];

function shouldRememberRoute(
  pathname: string
) {
  if (
    !pathname ||
    pathname === "/"
  ) {
    return false;
  }

  return !ROUTES_NOT_TO_REMEMBER.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(
        `${route}/`
      )
  );
}

export function clearGridiron365ResumeRoute() {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  window.localStorage.removeItem(
    G365_LAST_ROUTE_KEY
  );
}

export function getGridiron365ResumeRoute() {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  const savedRoute =
    window.localStorage.getItem(
      G365_LAST_ROUTE_KEY
    );

  if (
    !savedRoute ||
    !savedRoute.startsWith("/") ||
    savedRoute.startsWith("//")
  ) {
    return null;
  }

  return savedRoute;
}

export default function Gridiron365ResumeTracker() {
  const pathname =
    usePathname();

  const searchParams =
    useSearchParams();

  useEffect(
    () => {
      if (
        !shouldRememberRoute(
          pathname
        )
      ) {
        return;
      }

      const query =
        searchParams.toString();

      const route =
        query
          ? `${pathname}?${query}`
          : pathname;

      window.localStorage.setItem(
        G365_LAST_ROUTE_KEY,
        route
      );
    },
    [
      pathname,
      searchParams,
    ]
  );

  return null;
}