"use client";

import { track } from "@vercel/analytics";
import { useEffect } from "react";

import { ensureQueue } from "@/components/landing/visit-source";

/** Long enough to tell commands apart, short of Vercel's 255-character cap. */
const MAX = 100;

/**
 * A link's name for `Click`: its data-track, else the address of a link off
 * this site. Links within the site are counted by their page views instead.
 */
function linkName(link: HTMLAnchorElement): string | undefined {
  if (link.dataset.track) return link.dataset.track;
  if (link.origin === window.location.origin) return undefined;
  return `${link.host}${link.pathname}`.slice(0, MAX);
}

/** Reports which links get clicked and which code gets copied, per page. */
export function Usage() {
  useEffect(() => {
    // auxclick too: a middle click opens the link in a new tab.
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a");
      if (!link) return;
      const name = linkName(link);
      if (!name) return;
      ensureQueue();
      track("Click", { link: name, page: window.location.pathname });
    };

    // A copy by selection inside a code block; the install button reports its
    // own, since the clipboard API fires no copy event.
    const onCopy = () => {
      const selection = document.getSelection();
      const node = selection?.anchorNode;
      const element = node instanceof Element ? node : node?.parentElement;
      const block = element?.closest("pre");
      if (!block) return;
      const line = selection?.toString().trim().split("\n")[0];
      if (!line) return;
      ensureQueue();
      track("Copy", {
        code: line.slice(0, MAX),
        page: window.location.pathname,
      });
    };

    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("auxclick", onClick, { capture: true });
    document.addEventListener("copy", onCopy);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("auxclick", onClick, { capture: true });
      document.removeEventListener("copy", onCopy);
    };
  }, []);
  return null;
}
