import { parse as parseYaml } from "yaml";

import type { Literal, Parent } from "../types.js";

/**
 * Moves the YAML frontmatter out of the tree.
 *
 * @param tree - The tree from the Markdown parser. The `yaml` node is removed from it.
 * @returns The frontmatter as an object. `{}` when the document has none.
 */
export function extractFrontmatter(tree: Parent): Record<string, unknown> {
  // The frontmatter is valid only at the top of a document.
  const first = tree.children[0];
  if (first?.type !== "yaml") return {};

  const meta: unknown = parseYaml((first as Literal).value);
  if (typeof meta !== "object" || meta === null || Array.isArray(meta))
    return {};

  tree.children.shift();
  return meta as Record<string, unknown>;
}
