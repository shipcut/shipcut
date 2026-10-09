// `publish`, `list`, `rm`: the Cloudflare R2 side, through its S3 API. Layout is in README, "Data layout".
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseEnv } from "node:util";
import { authorization, buildIndex, canonicalQuery, indexEntry, keyPath, markdown, parseListing, sha256 } from "./lib.ts";
import type { IndexEntry, Manifest, Run } from "./types.ts";

const YEAR = "public, max-age=31536000, immutable";
// The manifest and the index are the only keys ever rewritten.
const MINUTE = "public, max-age=60";

const KEYS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"] as const;

/** The bucket and its keys: each from the environment, else from `~/.config/shipcut/env`. Never printed. */
function credentials() {
  const file = join(homedir(), ".config/shipcut/env");
  const fromFile = existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {};
  const value = (key: (typeof KEYS)[number]) => process.env[key] || fromFile[key] || "";
  const missing = KEYS.filter((key) => !value(key));
  if (missing.length) throw new Error(`no ${missing.join(", ")} in the environment or in ~/.config/shipcut/env`);
  return {
    account: value("R2_ACCOUNT_ID"),
    id: value("R2_ACCESS_KEY_ID"),
    secret: value("R2_SECRET_ACCESS_KEY"),
    bucket: value("R2_BUCKET"),
    publicUrl: value("R2_PUBLIC_URL").replace(/\/+$/, ""),
  };
}

const publicUrl = (key: string) => `${credentials().publicUrl}/${keyPath(key)}`;

/**
 * One signed request to the bucket, path-style. With `missing`, a 404 comes
 * back as a status; any other failure throws with R2's error code and the
 * key, never the account, the bucket or a credential.
 */
async function r2(
  method: string,
  key: string,
  o: { query?: Record<string, string>; body?: string | Uint8Array<ArrayBuffer>; headers?: Record<string, string>; missing?: boolean } = {},
) {
  const c = credentials();
  const host = `${c.account}.r2.cloudflarestorage.com`;
  const path = key ? `/${c.bucket}/${keyPath(key)}` : `/${c.bucket}`;
  const query = o.query ?? {};
  const amzDate = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
  const payloadHash = sha256(o.body ?? "");
  const headers = { ...o.headers, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  const signed = authorization(
    { method, path, query, headers: { ...headers, host }, payloadHash },
    { id: c.id, secret: c.secret, region: "auto", service: "s3" },
    amzDate,
  );
  const search = canonicalQuery(query);
  const res = await fetch(`https://${host}${path}${search ? `?${search}` : ""}`, {
    method,
    headers: { ...headers, authorization: signed },
    body: o.body,
  });
  // Every answer here is small, and read whole so the connection is let go.
  const text = await res.text();
  if (res.ok || (o.missing && res.status === 404)) return { status: res.status, text };
  const code = /<Code>([^<]*)<\/Code>/.exec(text)?.[1] ?? res.statusText;
  throw new Error(`R2 answered ${res.status} ${code} to ${method} ${key || `a listing of ${query.prefix ?? "the bucket"}`}`);
}

async function put(key: string, body: string | Uint8Array<ArrayBuffer>, contentType: string, cacheControl: string) {
  await r2("PUT", key, { body, headers: { "cache-control": cacheControl, "content-type": contentType } });
  return publicUrl(key);
}

const putJson = (key: string, value: unknown) => put(key, `${JSON.stringify(value, null, 2)}\n`, "application/json", MINUTE);

async function getJson<T>(key: string): Promise<{ value: T; url: string } | undefined> {
  const { status, text } = await r2("GET", key, { missing: true });
  return status === 404 ? undefined : { value: JSON.parse(text) as T, url: publicUrl(key) };
}

/** Every key under `prefix`, or with `folded` the folders one level down, across all pages of the listing. */
async function listAll(prefix: string, folded = false) {
  const keys: string[] = [];
  const folders: string[] = [];
  let next: string | undefined;
  do {
    const query: Record<string, string> = { "list-type": "2" };
    if (prefix) query.prefix = prefix;
    if (folded) query.delimiter = "/";
    if (next) query["continuation-token"] = next;
    const page = parseListing((await r2("GET", "", { query })).text);
    keys.push(...page.keys);
    folders.push(...page.prefixes);
    next = page.next;
  } while (next);
  return { keys, folders };
}

function projectName(name: string | undefined): string {
  if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name))
    throw new Error("--project wants a name of lowercase letters, digits and dashes");
  return name;
}

/**
 * A project's index as the store has it now, with one run added or dropped.
 *
 * `index.json` is not its own source. Two publishes a few seconds apart would
 * each start from a copy without the other's run, and a reader of the public
 * URL can get a cached copy up to a minute old. The listing is fresh, so the
 * run folders it returns decide which runs exist; `index.json`, read through
 * the S3 API rather than the public URL, only supplies their entries, and a
 * run it does not know is read from its own `manifest.json`.
 */
async function currentIndex(project: string, change: { add?: IndexEntry; drop?: string } = {}) {
  const { folders } = await listAll(`${project}/`, true);
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
// and manifest.json are there, `shipcut list` reads the listing and shows both,
// and the next publish or rm in the project rebuilds index.json with both.
// Until then a reader of index.json alone misses one run. Upgrade path: take
// the ETag from the GET of index.json, PUT with `If-Match`, retry on a 412.
async function writeIndex(project: string, change: { add?: IndexEntry; drop?: string }) {
  const index = await currentIndex(project, change);
  if (index.length) await putJson(`${project}/index.json`, index);
  // The last run gone, the project goes too, so `shipcut list` stops naming it.
  else await r2("DELETE", `${project}/index.json`);
}

export async function publish(dir: string, project: string | undefined, title: string | undefined) {
  const name = projectName(project);
  const run = JSON.parse(await readFile(join(dir, "run.json"), "utf8")) as Run;
  const prefix = `${name}/${run.id}`;
  const files = await Promise.all(
    // A run id is unique, so its files never change; a second publish of the
    // same run (after `shipcut clip`) rewrites them with the same bytes.
    run.files.map(async (f) => ({
      ...f,
      url: await put(`${prefix}/${f.name}`, await readFile(join(dir, f.name)), f.contentType, YEAR),
    })),
  );
  const manifest: Manifest = { ...run, project: name, title, files };
  const url = await putJson(`${prefix}/manifest.json`, manifest);
  await writeIndex(name, { add: indexEntry(manifest, url) });

  console.log(markdown(manifest));
  console.error(`\nmanifest: ${url}`);
  if (files.some((f) => f.contentType.startsWith("video/")))
    console.error(
      "note: an mp4 link plays inline on no Markdown host (GitHub only inlines videos uploaded through its own editor);\n" +
        "X and Threads want the file uploaded. For motion inline, `shipcut clip --gif` and publish again: a GIF is an image.",
    );
}

export async function listRuns(project: string | undefined, limit: number) {
  const projects = project
    ? [projectName(project)]
    : (await listAll("", true)).folders.map((f) => f.replace(/\/$/, ""));
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
  if (!id || rest.length) throw new Error("usage: shipcut rm <project>/<run-id> [--yes]");
  const name = projectName(project);
  // The trailing slash keeps a run id that is a prefix of another one apart.
  const { keys } = await listAll(`${name}/${id}/`);
  if (!keys.length) throw new Error(`nothing stored as ${name}/${id}`);

  if (!yes) {
    const prompt = createInterface({ input: process.stdin, output: process.stderr });
    const answer = await prompt.question(`delete ${keys.length} files of ${name}/${id}? [y/N] `);
    prompt.close();
    if (!/^y(es)?$/i.test(answer.trim())) throw new Error("not deleted");
  }
  await Promise.all(keys.map((key) => r2("DELETE", key)));
  await writeIndex(name, { drop: id });
  console.log(`deleted ${name}/${id} (${keys.length} files)`);
  // ponytail: no cache purge, which would need a Cloudflare token for the
  // domain's zone beside the R2 keys. Add it when an rm has to be instant.
  console.error(
    "note: Cloudflare's cache and a browser that already fetched a file can serve it until it expires, a year for a run's files;\n" +
      "purge the URLs in the Cloudflare dashboard if they must be gone now",
  );
}
