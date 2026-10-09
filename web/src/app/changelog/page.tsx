import type { Metadata } from "next";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

import { ENTRIES } from "./entries";
import { EntryVideo } from "./entry-video";

// What changed in shipcut, newest first, each change with a video shipcut made.

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "What changed in shipcut, newest first, each change with a video shipcut recorded.",
};

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default function Changelog() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pt-8 pb-20 sm:px-8 lg:pt-16">
        <h1 className="text-5xl font-black tracking-tight">Changelog</h1>
        <p className="text-haze mt-5 max-w-[44ch] text-lg leading-relaxed text-pretty">
          What changed, newest first. Every video here is a shipcut run of a
          real app, recorded from a script in its repo.
        </p>
        <ol className="mt-12 flex flex-col">
          {ENTRIES.map((entry) => (
            <li
              key={entry.id}
              className="border-line border-t py-10 first:border-t-0 first:pt-0 lg:py-14"
            >
              <article
                id={entry.id}
                className="grid scroll-mt-8 gap-6 lg:grid-cols-5 lg:gap-12"
              >
                <div className="flex flex-col gap-3 lg:col-span-2">
                  <time dateTime={entry.date} className="text-haze">
                    {DATE.format(new Date(entry.date))}
                  </time>
                  <h2 className="text-3xl leading-tight font-bold tracking-tight text-balance">
                    <a
                      href={`#${entry.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {entry.title}
                    </a>
                  </h2>
                  {entry.text.map((line) => (
                    <p
                      key={line}
                      className="text-haze text-lg leading-relaxed text-pretty"
                    >
                      {line}
                    </p>
                  ))}
                </div>
                <figure className="flex flex-col gap-3 lg:col-span-3">
                  <EntryVideo video={entry.video} />
                  <figcaption className="text-haze text-sm">
                    {entry.video.label}
                  </figcaption>
                </figure>
              </article>
            </li>
          ))}
        </ol>
      </main>
      <SiteFooter />
    </>
  );
}
