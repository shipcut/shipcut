"use client";

import { track } from "@vercel/analytics";
import { useEffect } from "react";

/** The visit's utm_source, which every link in a launch post carries. */
export function utmSource(): string | undefined {
  return (
    new URLSearchParams(window.location.search).get("utm_source") ?? undefined
  );
}

/**
 * Vercel's Pro plan shows no utm_source, so a tagged visit reports it as a
 * custom event, and the waitlist does the same on a sign-up.
 */
export function VisitSource() {
  useEffect(() => {
    const source = utmSource();
    if (source) track("Visit", { source });
  }, []);
  return null;
}
