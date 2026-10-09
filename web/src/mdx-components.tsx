// How Markdown in the docs renders: the landing's type on black, hairline
// tables, Geist Mono for code. rehype-pretty-code colours the code blocks.
// Props are typed by hand: @types/mdx reads the global JSX namespace, which
// React 19's types no longer declare.
import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentProps } from "react";

const components = {
  h1: ({ children }: ComponentProps<"h1">) => (
    <h1 className="mb-6 text-4xl leading-tight font-black tracking-tight text-balance sm:text-5xl">
      {children}
    </h1>
  ),
  h2: ({ id, children }: ComponentProps<"h2">) => (
    <h2
      id={id}
      className="mt-14 mb-4 text-2xl leading-snug font-bold tracking-tight text-balance"
    >
      <a href={`#${id}`}>{children}</a>
    </h2>
  ),
  h3: ({ id, children }: ComponentProps<"h3">) => (
    <h3 id={id} className="mt-10 mb-3 text-lg font-bold tracking-tight">
      {children}
    </h3>
  ),
  p: (props: ComponentProps<"p">) => (
    <p className="text-haze my-4 leading-relaxed" {...props} />
  ),
  ul: (props: ComponentProps<"ul">) => (
    <ul
      className="text-haze marker:text-line my-4 list-disc space-y-2 pl-5 leading-relaxed"
      {...props}
    />
  ),
  ol: (props: ComponentProps<"ol">) => (
    <ol
      className="text-haze marker:text-haze my-4 list-decimal space-y-2 pl-5 leading-relaxed"
      {...props}
    />
  ),
  strong: (props: ComponentProps<"strong">) => (
    <strong className="text-paper font-bold" {...props} />
  ),
  a: ({ href = "", children }: ComponentProps<"a">) => (
    <Link
      href={href}
      className="text-lavender decoration-line hover:decoration-lavender underline underline-offset-4"
    >
      {children}
    </Link>
  ),
  // A block's <code> carries the language rehype-pretty-code gave it; only
  // inline code gets a chip, kept on one line.
  code: (props: ComponentProps<"code">) =>
    "data-language" in props ? (
      <code {...props} />
    ) : (
      <code
        className="bg-slab text-paper rounded-sm px-1.5 py-0.5 font-mono text-[0.875em] whitespace-nowrap"
        {...props}
      />
    ),
  pre: (props: ComponentProps<"pre">) => (
    <pre
      className="border-line my-6 overflow-x-auto rounded-lg border p-4 font-mono text-sm leading-6"
      {...props}
    />
  ),
  table: (props: ComponentProps<"table">) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm" {...props} />
    </div>
  ),
  th: (props: ComponentProps<"th">) => (
    <th
      className="border-line text-paper border-b py-2 pr-4 align-bottom font-bold"
      {...props}
    />
  ),
  td: (props: ComponentProps<"td">) => (
    <td
      className="border-line text-haze border-b py-2 pr-4 align-top leading-6 first:whitespace-nowrap"
      {...props}
    />
  ),
  hr: () => <hr className="border-line my-10" />,
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return components;
}
