import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";

import type { Parent, Root } from "./types.js";

/**
 * Parses Markdown into a AST.
 *
 * @remarks
 * The function parses CommonMark and GFM. It does not rewrite the tree yet.
 * The function never throws.
 *
 * @param md - The Markdown source text.
 * @returns The mdast tree. `meta` is `{}` and `warnings` is `[]`.
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
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  }) as Parent;
  return { ...tree, type: "root", meta: {}, warnings: [] };
}
