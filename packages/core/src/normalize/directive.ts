import type {
  Literal,
  Node,
  Parent,
  UnknownDirective,
  Warning,
} from "../types.js";
import { isParent, mapNodes } from "./walk.js";

/** The result of {@link convertDirectives}. */
export interface Directives {
  /** The nodes without any directive node. */
  children: Node[];

  /** One warning for each unknown directive. */
  warnings: Warning[];
}

/** The mdast shape of a container or leaf directive. */
interface DirectiveNode extends Parent {
  /** The directive name, without the colons. */
  name: string;

  /** The raw attributes. An attribute without a value is `""`. */
  attributes?: Record<string, string | null | undefined> | null;
}

/**
 * Replaces every directive node.
 *
 * A renderer has no case for a directive node. So no directive node may be
 * left in the tree after this step.
 *
 * @param children - The top-level nodes. The array and the nodes are not changed.
 * @param source - The complete Markdown source text.
 * @returns The rebuilt nodes and the warnings.
 */
export function convertDirectives(
  children: readonly Node[],
  source: string,
): Directives {
  const warnings: Warning[] = [];

  const converted = mapNodes(children, (node) => {
    switch (node.type) {
      case "textDirective":
        return restoreText(node, source);
      case "containerDirective":
      case "leafDirective": {
        const directive = node as DirectiveNode;
        warnings.push(unknownWarning(directive));
        return toUnknownDirective(directive, source);
      }
      default:
        return node;
    }
  });

  return { children: mergeAdjacentText(converted), warnings };
}

/**
 * Turns an inline directive back into its source text.
 *
 * The inline syntax is `:name`. It also matches normal text such as `10:30`
 * or `a:b`. A warning for each match would be noise, so the text is restored
 * and nothing is reported.
 */
function restoreText(node: Node, source: string): Literal {
  return {
    type: "text",
    value: sourceText(node, source),
    position: node.position,
  } as Literal;
}

/**
 * Keeps an unknown directive as a typed node.
 *
 * Unknown input must not be dropped. The node keeps the parsed content and
 * the source text, so a renderer can still print the content.
 */
function toUnknownDirective(
  node: DirectiveNode,
  source: string,
): UnknownDirective {
  const options: Record<string, string> = {};
  for (const [key, value] of Object.entries(node.attributes ?? {})) {
    if (typeof value === "string") {
      options[key] = value;
    }
  }

  // The label of `::name[label]` is inline content. Block content needs a paragraph.
  const isLeaf = node.type === "leafDirective";
  const children =
    isLeaf && node.children.length > 0
      ? [
          {
            type: "paragraph",
            children: node.children,
            position: node.position,
          } as Parent,
        ]
      : node.children;

  return {
    type: "unknownDirective",
    name: node.name,
    options,
    value: sourceText(node, source),
    children,
    position: node.position,
  } as UnknownDirective;
}

function unknownWarning(node: DirectiveNode): Warning {
  const marker = node.type === "leafDirective" ? "::" : ":::";
  const warning: Warning = {
    line: node.position?.start.line ?? 1,
    kind: "unknown-directive",
    message: `The directive "${marker}${node.name}" is unknown. Its content appears in the output as normal text.`,
  };
  const column = node.position?.start.column;
  if (column !== undefined) {
    warning.column = column;
  }

  return warning;
}

/**
 * Joins text nodes that next to each other.
 *
 * A restored directive splits one sentence into several text nodes.
 * A renderer needs one node to handle line breaks inside Japanese text.
 */
function mergeAdjacentText(nodes: readonly Node[]): Node[] {
  const merged: Node[] = [];

  for (const node of nodes) {
    const last = merged[merged.length - 1];
    if (node.type === "text" && last?.type === "text") {
      merged[merged.length - 1] = joinText(last as Literal, node as Literal);
    } else if (isParent(node)) {
      const rebuilt: Parent = {
        ...node,
        children: mergeAdjacentText(node.children),
      };
      merged.push(rebuilt);
    } else {
      merged.push(node);
    }
  }

  return merged;
}

function joinText(first: Literal, second: Literal): Literal {
  const joined: Literal = { ...first, value: first.value + second.value };
  if (first.position && second.position) {
    joined.position = { start: first.position.start, end: second.position.end };
  }
  return joined;
}

/** Returns the source text that a node covers, or `""` when it has no offsets. */
function sourceText(node: Node, source: string): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return "";
  return source.slice(start, end);
}
