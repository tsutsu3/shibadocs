import { directiveFromMarkdown } from "mdast-util-directive";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { directive } from "micromark-extension-directive";
import { frontmatter } from "micromark-extension-frontmatter";
import { gfm } from "micromark-extension-gfm";

import { convertDirectives } from "./normalize/directive.js";
import { extractFrontmatter } from "./normalize/frontmatter.js";
import type { Parent, Root } from "./types.js";

/**
 * Parses Markdown into a AST.
 *
 * @remarks
 * The function parses CommonMark, GFM, directives and YAML frontmatter.
 * It never throws.
 *
 * Input that the function cannot use is never dropped. An unknown directive
 * such as `:::name` becomes an `unknownDirective` node. A frontmatter that
 * cannot be read becomes a `code` node. Each case adds one entry to `warnings`.
 *
 * @param md - The Markdown source text.
 * @returns The tree without the frontmatter and without directive nodes.
 * `meta` is `{}` when the source has no frontmatter. `warnings` is `[]` when
 * the source has no problem.
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
    extensions: [gfm(), directive(), frontmatter(["yaml"])],
    mdastExtensions: [
      gfmFromMarkdown(),
      directiveFromMarkdown(),
      frontmatterFromMarkdown(["yaml"]),
    ],
  }) as Parent;

  const front = extractFrontmatter(tree.children);
  const directives = convertDirectives(front.children, md);

  const root: Root = {
    ...tree,
    type: "root",
    children: directives.children,
    meta: front.meta,
    warnings: [...front.warnings, ...directives.warnings],
  };

  if (front.raw !== undefined) {
    root.data = { frontmatter: front.raw };
  }

  return root;
}
