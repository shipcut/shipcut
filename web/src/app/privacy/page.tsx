import type { Metadata } from "next";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

// What shipcut.dev collects, why, and how to have it removed. A page a
// person reads, so it stays short and in plain words.

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What shipcut.dev collects, why, and how to have it removed. No cookies, no ads, nothing sold.",
};

const MAIL = "hello@shipcut.dev";

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
            Updated <time dateTime="2026-10-09">9 October 2026</time>
          </p>
          <p>
            shipcut.dev is run by Roman Denysov, who is responsible for the
            personal data described here. Write to <Mail /> about any of it.
          </p>
          <p className="text-paper font-bold">
            No cookies, no ads, and nothing is sold.
          </p>

          <Section title="The waitlist">
            <p>
              When you join the waitlist, you give us your email address. If
              your visit came from a link with a <code>utm_source</code>, that
              source goes with it. The site sends both as one email to
              Roman&apos;s Gmail inbox, through Resend, an email service in the
              United States that works for us. Resend and Google keep copies as
              part of delivering and storing mail. Nothing else goes into a
              database, and the form sends you no email.
            </p>
            <p>
              We use your address for one thing: telling you when shipcut can
              run on your app. The legal basis is your consent. We keep the
              address until you ask us to remove it or the waitlist ends. To be
              removed, write to <Mail />.
            </p>
          </Section>

          <Section title="Analytics">
            <p>
              Vercel Web Analytics counts visits without cookies and stores no
              personal data. We see totals: page views, and two events,{" "}
              <code>Visit</code> and <code>Waitlist</code>, with the
              visit&apos;s <code>utm_source</code> when there is one.
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
              corrected or erased, object to its use, and withdraw your consent
              at any time. Write to <Mail />.
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

function Mail() {
  return (
    <a
      href={`mailto:${MAIL}`}
      className="text-paper underline underline-offset-4"
    >
      {MAIL}
    </a>
  );
}
