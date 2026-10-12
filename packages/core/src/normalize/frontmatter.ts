import { YAMLParseError, parse as parseYaml } from "yaml";

import type { DocMeta, Literal, Node, Warning } from "../types.js";
import { toDocMeta } from "./docmeta.js";

/** The result of {@link extractFrontmatter}. */
export interface Frontmatter {
  /** The nodes of the document without the `yaml` node. */
  children: Node[];

  /** The typed frontmatter. `{}` when the document has none. */
  meta: DocMeta;

  /**
   * The complete frontmatter with YAML types. It includes the site settings.
   * `undefined` when the document has no frontmatter that can be read.
   */
  raw: Record<string, unknown> | undefined;

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
    return { children: [...children], meta: {}, raw: undefined, warnings: [] };

  const node = first as Literal;
  const startLine = node.position?.start.line ?? 1;

  let values: unknown;
  let strings: unknown;

  try {
    values = parseYaml(node.value) ?? {};
    strings = parseYaml(node.value, { schema: "failsafe" }) ?? {};
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
  if (!isRecord(values) || !isRecord(strings)) {
    return keepAsCode(node, rest, {
      line: startLine,
      kind: "invalid-frontmatter",
      message:
        "The frontmatter is not a set of keys and values. It appears in the output as a code block.",
    });
  }

  const { meta, invalid } = toDocMeta(values, strings);
  const warnings: Warning[] = [];
  if (invalid.length > 0) {
    warnings.push({
      line: startLine,
      kind: "invalid-frontmatter",
      message: `These frontmatter keys have an invalid value and are ignored. ${invalid.join(", ")}`,
    });
  }

  return { children: rest, meta, raw: values, warnings };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  return {
    children: [code, ...rest],
    meta: {},
    raw: undefined,
    warnings: [warning],
  };
}
