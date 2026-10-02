// `publish`, `list`, `rm`: the Vercel Blob side. Layout is in README, "Data layout".
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { del, get, list, put } from "@vercel/blob";
import { buildIndex, indexEntry, markdown } from "./lib.ts";
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

async function getJson<T>(path: string): Promise<{ value: T; url: string } | undefined> {
  const found = await get(path, { access: "public", token: token() });
  if (!found || found.statusCode !== 200) return undefined;
  return { value: (await new Response(found.stream).json()) as T, url: new URL(found.blob.url).href };
}

/**
 * A project's index as the store has it now, with one run added or dropped.
 *
 * A public store is read through a CDN that serves an overwritten file's old
 * copy for a minute or more, so `index.json` cannot be trusted as its own
 * source: two publishes a few seconds apart would each start from the copy
 * without the other. The listing API is not cached, so the run folders it
 * returns decide which runs exist; `index.json` only supplies their entries,
 * and a run it does not know is read from its own `manifest.json`.
 */
async function currentIndex(project: string, change: { add?: IndexEntry; drop?: string } = {}) {
  // ponytail: one listing page, so 1000 runs per project. Follow `cursor` past that.
  const { folders } = await list({ prefix: `${project}/`, mode: "folded", token: token() });
  const ids = new Set(folders.map((f) => f.slice(project.length + 1, -1)));
  if (change.add) ids.add(change.add.id);
  if (change.drop) ids.delete(change.drop);

  const known = (await getJson<IndexEntry[]>(`${project}/index.json`))?.value ?? [];
  if (change.add) known.push(change.add);
  const manifests = await Promise.all(
    buildIndex([...ids], known).missing.map((id) => getJson<Manifest>(`${project}/${id}/manifest.json`)),
  );
  // A folder with no manifest is a publish that died half way; it is left out.
  for (const m of manifests) if (m) known.push(indexEntry(m.value, m.url));
  return buildIndex([...ids], known).index;
}

// ponytail: no lock, the last writer wins. Two publishes that overlap can each
// write an index without the other's run. Nothing is lost for good: the files
// and manifest.json are there, `shots list` reads the listing and shows both,
// and the next publish or rm in the project rebuilds index.json with both.
// Until then a reader of index.json alone misses one run. Upgrade path: take
// the etag from `get`, pass it to `put` as `ifMatch`, retry on
// BlobPreconditionFailedError.
async function writeIndex(project: string, change: { add?: IndexEntry; drop?: string }) {
  const index = await currentIndex(project, change);
  if (index.length) await putJson(`${project}/index.json`, index);
  // The last run gone, the project goes too, so `shots list` stops naming it.
  else await del(`${project}/index.json`, { token: token() });
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
  await writeIndex(name, { add: indexEntry(manifest, url) });

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
    await Promise.all(projects.map(async (p) => (await currentIndex(p)).map((e) => ({ ...e, project: p }))))
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
  if (!blobs.length) throw new Error(`nothing stored as ${name}/${id}`);

  if (!yes) {
    const prompt = createInterface({ input: process.stdin, output: process.stderr });
    const answer = await prompt.question(`delete ${blobs.length} files of ${name}/${id}? [y/N] `);
    prompt.close();
    if (!/^y(es)?$/i.test(answer.trim())) throw new Error("not deleted");
  }
  await del(blobs.map((b) => b.url), { token: token() });
  await writeIndex(name, { drop: id });
  console.log(`deleted ${name}/${id} (${blobs.length} files)`);
  console.error("note: the CDN can serve a deleted file's cached copy for some minutes more");
}
