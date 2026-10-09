import { DocsNav, DocsPager } from "@/components/docs/docs-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

/** Every docs page: the site's header and footer, the page list beside the article, and the way on. */
export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-4 pb-16 sm:px-8 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-16 lg:pt-12 lg:pb-24">
        <DocsNav />
        <main className="max-w-[70ch] min-w-0">
          <article>{children}</article>
          <DocsPager />
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
