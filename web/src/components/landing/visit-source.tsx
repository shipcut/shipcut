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
 * <Analytics /> sits in a Suspense boundary, so its effect, which sets up the
 * queue track() writes to, can run after a sibling's, and track() drops an
 * event that finds no queue. This is the same queue it would set up.
 */
function ensureQueue() {
  window.va ??= (event, properties) => {
    (window.vaq ??= []).push([event, properties]);
  };
}

/**
 * Vercel's Pro plan shows no utm_source, so a tagged visit reports it as a
 * custom event, and the waitlist does the same on a sign-up.
 */
export function VisitSource() {
  useEffect(() => {
    const source = utmSource();
    if (!source) return;
    ensureQueue();
    track("Visit", { source });
  }, []);
  return null;
}
