"use client";

import { useEffect, useRef } from "react";

import type { Entry } from "./entries";

/**
 * An entry's video: muted and looping, loaded and played only while it is on
 * screen. With reduced motion it never plays by itself and shows controls.
 */
export function EntryVideo({ video }: { video: Entry["video"] }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.controls = true;
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.play().catch(() => {
            // Autoplay refused, as in a low-power mode: the poster stays.
          });
        } else el.pause();
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={video.src}
      poster={video.poster}
      muted
      playsInline
      loop
      preload="none"
      className="bg-slab aspect-[16/10] w-full rounded-xl"
    />
  );
}
