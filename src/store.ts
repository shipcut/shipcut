// `publish`, `list`, `rm`: the Vercel Blob side. Layout is in README, "Data layout".
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { del, get, list, put } from "@vercel/blob";
import { indexEntry, markdown, withEntry, withoutEntry } from "./lib.ts";
import type { IndexEntry, Manifest, Run } from "./types.ts";

const YEAR = 31_536_000;
// Blob's minimum. The manifest and the index are the only paths ever rewritten.
const MINUTE = 60;

/** The store's token: the environment, else `~/.config/shots/env`. Never printed. */
function token(): string {
  const fromEnv = process.env.BLOB_READ_WRITE_TOKEN;
  if (fromEnv) return fromEnv;
  const file = join(homedir(), ".config/shots/env");
  if (existsSync(file)) {
    const found = /^BLOB_READ_WRITE_TOKEN=["']?([^"'\n]+)/m.exec(readFileSync(file, "utf8"));
    if (found?.[1]) return found[1];
  }
  throw new Error("no BLOB_READ_WRITE_TOKEN in the environment or in ~/.config/shots/env");
}

function projectName(name: string | undefined): string {
  if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name))
    throw new Error("--project wants a name of lowercase letters, digits and dashes");
  return name;
}

const putJson = (path: string, value: unknown) =>
  put(path, `${JSON.stringify(value, null, 2)}\n`, {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: MINUTE,
    token: token(),
  });

async function readIndex(project: string): Promise<IndexEntry[]> {
  // Past the CDN: a copy up to a minute old would drop whatever was published since.
  const found = await get(`${project}/index.json`, { access: "public", useCache: false, token: token() });
  if (!found || found.statusCode !== 200) return [];
  return (await new Response(found.stream).json()) as IndexEntry[];
}

// ponytail: read-modify-write with no lock. Two publishes (or a publish and an
// rm) to one project within the same second or so can each read the old index,
// and the later write drops the other's entry; its files and manifest.json stay
// in the store, only the listing misses it, and publishing that run again puts
// it back. Fine for one person and a few agents. Upgrade path: keep the etag
// `get` returns, pass it to `put` as `ifMatch`, retry on
// BlobPreconditionFailedError.
async function updateIndex(project: string, change: (index: IndexEntry[]) => IndexEntry[]) {
  await putJson(`${project}/index.json`, change(await readIndex(project)));
}

export async function publish(dir: string, project: string | undefined, title: string | undefined) {
  const name = projectName(project);
  const run = JSON.parse(await readFile(join(dir, "run.json"), "utf8")) as Run;
  const prefix = `${name}/${run.id}`;
  const files = await Promise.all(
    run.files.map(async (f) => {
      const { url } = await put(`${prefix}/${f.name}`, await readFile(join(dir, f.name)), {
        access: "public",
        // A run id is unique, so its files never change; a second publish of
        // the same run (after `shots clip`) rewrites them with the same bytes.
        allowOverwrite: true,
        contentType: f.contentType,
        cacheControlMaxAge: YEAR,
        token: token(),
      });
      return { ...f, url };
    }),
  );
  const manifest: Manifest = { ...run, project: name, title, files };
  const { url } = await putJson(`${prefix}/manifest.json`, manifest);
  await updateIndex(name, (index) => withEntry(index, indexEntry(manifest, url)));

  console.log(markdown(manifest));
  console.error(`\nmanifest: ${url}`);
  if (files.some((f) => f.contentType.startsWith("video/")))
    console.error(
      "note: an mp4 link plays inline on no Markdown host (GitHub only inlines videos uploaded through its own editor);\n" +
        "X and Threads want the file uploaded. For motion inline, `shots clip --gif` and publish again: a GIF is an image.",
    );
}

export async function listRuns(project: string | undefined, limit: number) {
  const projects = project
    ? [projectName(project)]
    : (await list({ mode: "folded", token: token() })).folders.map((f) => f.replace(/\/$/, ""));
  const rows = (
    await Promise.all(projects.map(async (p) => (await readIndex(p)).map((e) => ({ ...e, project: p }))))
  )
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
  if (!rows.length) console.log("no runs");
  for (const r of rows)
    console.log(`${r.project}/${r.id}  ${r.createdAt}  ${r.files} files  ${r.title ?? ""}\n  ${r.manifest}`);
}

export async function remove(target: string | undefined, yes: boolean) {
  const [project, id, ...rest] = (target ?? "").split("/");
  if (!id || rest.length) throw new Error("usage: shots rm <project>/<run-id> [--yes]");
  const name = projectName(project);
  // The trailing slash keeps a run id that is a prefix of another one apart.
  const { blobs } = await list({ prefix: `${name}/${id}/`, token: token() });
  const listed = (await readIndex(name)).some((e) => e.id === id);
  if (!blobs.length && !listed) throw new Error(`nothing stored as ${name}/${id}`);

  if (!yes) {
    const prompt = createInterface({ input: process.stdin, output: process.stderr });
    const answer = await prompt.question(`delete ${blobs.length} files of ${name}/${id}? [y/N] `);
    prompt.close();
    if (!/^y(es)?$/i.test(answer.trim())) throw new Error("not deleted");
  }
  if (blobs.length) await del(blobs.map((b) => b.url), { token: token() });
  await updateIndex(name, (index) => withoutEntry(index, id));
  console.log(`deleted ${name}/${id} (${blobs.length} files)`);
}
