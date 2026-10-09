// Downloads Satoshi from Fontshare into src/fonts/ before dev, build and
// check-types. Its licence (ITF Free Font License 2.0) allows self-hosting
// but forbids the font file in a public repository, so the files are
// gitignored and fetched here. The variable woff2 is the site's text face;
// the static TTFs are for the social image, since satori reads no woff2.
// Node runs this file as is, so only erasable TypeScript.
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

const CSS =
  "https://api.fontshare.com/v2/css?f[]=satoshi@1,500,700,900&display=swap";
const DIR = new URL("../src/fonts/", import.meta.url);

/** Fontshare's `font-weight` for each file, and the format to take from its `src`. */
const FILES = [
  { name: "Satoshi-Variable.woff2", weight: "300 900", format: "woff2" },
  { name: "Satoshi-Medium.ttf", weight: "500", format: "truetype" },
  { name: "Satoshi-Bold.ttf", weight: "700", format: "truetype" },
  { name: "Satoshi-Black.ttf", weight: "900", format: "truetype" },
];

const missing = FILES.filter((f) => !existsSync(new URL(f.name, DIR)));
if (missing.length > 0) {
  try {
    await download(missing);
  } catch (error) {
    console.error(
      `satoshi: could not download ${missing.map((f) => f.name).join(", ")} from Fontshare: ${error instanceof Error ? error.message : String(error)}`
    );
    console.error(
      "satoshi: the site's font is fetched at build time and never committed. Check the network and run `node scripts/satoshi.ts` again."
    );
    process.exit(1);
  }
}

async function download(files: typeof FILES) {
  const css = await get(CSS).then((r) => r.text());
  // One @font-face per weight; its src lists woff2, woff and ttf as `url('//cdn...') format('...')`.
  const faces = css.split("@font-face").slice(1);
  await mkdir(DIR, { recursive: true });
  for (const file of files) {
    const face = faces.find((f) => f.includes(`font-weight: ${file.weight};`));
    const url = face?.match(
      new RegExp(`url\\('([^']+)'\\) format\\('${file.format}'\\)`)
    )?.[1];
    if (!url)
      throw new Error(`no ${file.format} for weight ${file.weight} in ${CSS}`);
    const body = await get(new URL(url, CSS)).then((r) => r.arrayBuffer());
    await writeFile(new URL(file.name, DIR), new Uint8Array(body));
    console.log(`satoshi: ${file.name}, ${body.byteLength} bytes`);
  }
}

async function get(url: string | URL) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok)
    throw new Error(`${url.toString()} answered ${response.status}`);
  return response;
}
