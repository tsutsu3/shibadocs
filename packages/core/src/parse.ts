import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { frontmatter } from "micromark-extension-frontmatter";
import { gfm } from "micromark-extension-gfm";

import { extractFrontmatter } from "./normalize/frontmatter.js";
import type { Parent, Root } from "./types.js";

/**
 * Parses Markdown into a AST.
 *
 * @remarks
 * The function parses CommonMark, GFM and YAML frontmatter.
 *
 * @param md - The Markdown source text.
 * @returns The mdast tree without the frontmatter. `meta` is `{}` when the
 * source has no frontmatter. `warnings` is always `[]` for now.
 * @throws Error
 * When the frontmatter is not valid YAML.
 *
 * @example
 * ```ts
 * const root = parse("# Title\n");
 * console.log(root.children[0]?.type); // "heading"
 * ```
 */
export function parse(md: string): Root {
  // GFM is required. Without it a table becomes a plain paragraph.
  const tree = fromMarkdown(md, {
    extensions: [gfm(), frontmatter(["yaml"])],
    mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown(["yaml"])],
  }) as Parent;
  const meta = extractFrontmatter(tree);
  return { ...tree, type: "root", meta, warnings: [] };
}
