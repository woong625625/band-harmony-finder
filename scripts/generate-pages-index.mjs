import { copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outputDir = ".output/public";
const basePath = "/band-harmony-finder/";
const pagesUrl = `https://woong625625.github.io${basePath}`;

const { default: server } = await import("../.output/server/index.mjs");
const response = await server.fetch(new Request(pagesUrl), {}, { waitUntil() {} });

if (!response.ok) {
  throw new Error(`Could not render Pages HTML: ${response.status} ${response.statusText}`);
}

const html = await response.text();

if (!html.includes("$_TSR")) {
  throw new Error("Rendered HTML is missing TanStack Start bootstrap data");
}

await writeFile(join(outputDir, "index.html"), html);
await copyFile(join(outputDir, "index.html"), join(outputDir, "404.html"));

console.log(`Generated ${outputDir}/index.html from ${pagesUrl}`);
