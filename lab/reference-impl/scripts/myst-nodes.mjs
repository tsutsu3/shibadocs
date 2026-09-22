/**
 * List the node types myst-spec defines.
 *
 * Read as a checklist, not as a schema to adopt: the package says it is still
 * in development and may change without notice. What matters is which
 * concepts it names that a Markdown-only AST does not.
 */
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const schemaPath = require.resolve("myst-spec/dist/myst.schema.json");
const schema = JSON.parse(await readFile(schemaPath, "utf8"));

/** Collect every `type` constant the schema fixes. */
const types = new Set();
function walk(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item);
    return;
  }
  const t = node.properties?.type;
  if (t?.const) types.add(t.const);
  if (Array.isArray(t?.enum)) for (const v of t.enum) types.add(v);
  for (const value of Object.values(node)) walk(value);
}
walk(schema);

// Everything CommonMark and GFM already give you.
const MARKDOWN = new Set([
  "root", "paragraph", "heading", "thematicBreak", "blockquote", "list",
  "listItem", "code", "html", "text", "emphasis", "strong", "inlineCode",
  "break", "link", "image", "linkReference", "imageReference", "definition",
  "footnoteDefinition", "footnoteReference", "table", "tableRow", "tableCell",
  "delete", "yaml",
]);

const sorted = [...types].sort();
const extra = sorted.filter((t) => !MARKDOWN.has(t));

console.log(`myst-spec のノード型: ${sorted.length} 種\n`);
console.log(`Markdown / GFM と共通: ${sorted.length - extra.length} 種`);
console.log(`MyST が足しているもの: ${extra.length} 種\n`);
for (const t of extra) console.log(`  ${t}`);

await writeFile(
  path.join(ROOT, "out", "myst-spec-nodes.json"),
  JSON.stringify({ all: sorted, beyondMarkdown: extra }, null, 2) + "\n",
);
