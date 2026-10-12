import { YAMLParseError, parse as parseYaml } from "yaml";

import type { Literal, Node, Warning } from "../types.js";

/** The result of {@link extractFrontmatter}. */
export interface Frontmatter {
  /** The nodes of the document without the `yaml` node. */
  children: Node[];

  /** The frontmatter as an object. `{}` when the document has none. */
  meta: Record<string, unknown>;

  /** The problems found in the frontmatter. `[]` when there is none. */
  warnings: Warning[];
}

/**
 * Moves the YAML frontmatter out of the tree.
 *
 * @param children - The top-level nodes from the Markdown parser. The array is not changed.
 * @returns The remaining nodes in a new array, the metadata and the warnings.
 * The nodes themselves are shared with the input. They are not copied.
 */
export function extractFrontmatter(children: readonly Node[]): Frontmatter {
  // The frontmatter is valid only at the top of a document.
  const [first, ...rest] = children;
  if (first?.type !== "yaml")
    return { children: [...children], meta: {}, warnings: [] };

  const node = first as Literal;
  const startLine = node.position?.start.line ?? 1;

  let meta;
  try {
    meta = parseYaml(node.value) ?? {};
  } catch (error) {
    // The YAML text starts one line below the opening `---`.
    const yamlLine =
      error instanceof YAMLParseError ? (error.linePos?.[0].line ?? 0) : 0;

    return keepAsCode(node, rest, {
      line: startLine + yamlLine,
      kind: "invalid-frontmatter",
      message:
        "The frontmatter is not valid YAML. It appears in the output as a code block.",
    });
  }

  // A list or a plain string is valid YAML, but it is not metadata.
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) {
    return keepAsCode(node, rest, {
      line: startLine,
      kind: "invalid-frontmatter",
      message:
        "The frontmatter is not a set of keys and values. It appears in the output as a code block.",
    });
  }

  return {
    children: rest,
    meta: meta as Record<string, unknown>,
    warnings: [],
  };
}

/**
 * Replaces the `yaml` node with a code block and reports the problem.
 *
 * The text must stay visible, and a renderer has no case for a `yaml` node.
 */
function keepAsCode(
  node: Literal,
  rest: Node[],
  warning: Warning,
): Frontmatter {
  const code = {
    type: "code",
    lang: "yaml",
    meta: null,
    value: node.value,
    position: node.position,
  } as Literal;
  return { children: [code, ...rest], meta: {}, warnings: [warning] };
}
