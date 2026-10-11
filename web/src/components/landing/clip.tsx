"use client";

import { cn } from "cn";
import { type ReactEventHandler, useEffect, useRef } from "react";

/**
 * A clip that peeks into the first screen waits for a scroll instead of
 * moving beside the hero.
 */
const PLAY_AT = 0.85;

export function Clip({
  src,
  poster,
  className,
  ref,
  onTimeUpdate,
}: {
  src: string;
  poster: string;
  className?: string;
  ref?: (el: HTMLVideoElement | null) => void;
  onTimeUpdate?: ReactEventHandler<HTMLVideoElement>;
}) {
  const own = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = own.current;
    if (!el) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) el.controls = true;
    const near = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.poster = poster;
        el.src = src;
        near.disconnect();
      },
      { rootMargin: "50%" }
    );
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (still) return;
        if ((entry?.intersectionRatio ?? 0) >= PLAY_AT) {
          el.play().catch(() => {
            // Autoplay refused, as in a low-power mode: the poster stays.
          });
        } else el.pause();
      },
      { threshold: [0, PLAY_AT] }
    );
    near.observe(el);
    seen.observe(el);
    return () => {
      near.disconnect();
      seen.disconnect();
    };
  }, [src, poster]);

  return (
    <video
      ref={(el) => {
        own.current = el;
        ref?.(el);
      }}
      muted
      playsInline
      loop
      preload="none"
      onTimeUpdate={onTimeUpdate}
      className={cn("bg-slab w-full rounded-xl", className)}
    />
  );
}
