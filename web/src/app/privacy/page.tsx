import type { Metadata } from "next";

import { REPO } from "@/components/site/links";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What shipcut.dev collects and why. No cookies, no ads, nothing sold.",
};

const ISSUES = `${REPO}/issues`;

export default function Privacy() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pt-8 pb-20 sm:px-8 lg:pt-16">
        <article className="text-haze flex max-w-[64ch] flex-col gap-5 text-lg leading-relaxed text-pretty">
          <h1 className="text-paper text-5xl font-black tracking-tight">
            Privacy
          </h1>
          <p className="text-base">
            Updated <time dateTime="2026-10-12">12 October 2026</time>
          </p>
          <p>
            shipcut.dev is run by Roman Denysov, who is responsible for the
            personal data described here. Ask about any of it in a <Issues />.
          </p>
          <p className="text-paper font-bold">
            No cookies, no ads, no forms, and nothing is sold.
          </p>

          <Section title="Analytics">
            <p>
              Vercel Web Analytics counts visits without cookies and stores no
              personal data. We see totals: page views and three events.{" "}
              <code>Visit</code> carries the visit&apos;s{" "}
              <code>utm_source</code> when there is one. <code>Click</code>{" "}
              names the button or the outside address a link leads to, and the
              page it was on. <code>Copy</code> carries the first line of code
              copied from a code block, and the page.
            </p>
          </Section>

          <Section title="Hosting and videos">
            <p>
              The site runs on Vercel, which keeps logs of requests to run and
              protect it. The videos come from media.shipcut.dev, served by
              Cloudflare R2, which sees the requests that fetch them.
              shipcut.dev serves its own fonts, so no font service sees your
              visit.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              Under the GDPR you can ask what we hold about you, have it
              corrected or erased, and object to its use. Ask in a <Issues />.
            </p>
            <p>
              You can also complain to a data protection authority, in your own
              country or in Slovakia, where Roman is based. Slovakia&apos;s is
              the{" "}
              <a
                href="https://dataprotection.gov.sk"
                className="text-paper underline underline-offset-4"
              >
                Úrad na ochranu osobných údajov
              </a>
              .
            </p>
          </Section>

          <p>When this page changes, the date at the top changes with it.</p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 flex flex-col gap-4">
      <h2 className="text-paper text-2xl font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Issues() {
  return (
    <a href={ISSUES} className="text-paper underline underline-offset-4">
      GitHub issue
    </a>
  );
}
