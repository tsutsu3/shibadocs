import type { Node, Parent, Root } from "../src/index.js";

const LEFTOVER_TYPES = [
  "containerDirective",
  "leafDirective",
  "textDirective",
  "yaml",
];

/**
 * Checks the rules that must hold for every document.
 *
 * A renderer relies on these rules. A snapshot cannot check them, because a
 * snapshot only compares the output with the saved output.
 *
 * @param root - The result of `parse`.
 * @returns One line for each broken rule. `[]` when the tree is valid.
 */
export function findViolations(root: Root): string[] {
  const violations: string[] = [];

  for (const node of allNodes(root)) {
    const where = `${node.type} at line ${node.position?.start.line}`;

    // A renderer has no case for these node types.
    if (LEFTOVER_TYPES.includes(node.type)) {
      violations.push(`leftover node: ${where}`);
    }

    // A warning needs the line number of the node.
    if (!node.position) {
      violations.push(`no position: ${where}`);
    }

    // Unknown input must be reported. It must not disappear without a trace.
    if (
      node.type === "unknownDirective" &&
      !hasWarning(root, node, "unknown-directive")
    ) {
      violations.push(`no warning: ${where}`);
    }
  }

  return violations;
}

/** Returns the node and every node below it. */
function allNodes(node: Node): Node[] {
  const children = (node as Parent).children ?? [];
  return [node, ...children.flatMap(allNodes)];
}

/** Checks whether a warning of the kind exists at the start of the node. */
function hasWarning(root: Root, node: Node, kind: string): boolean {
  const start = node.position?.start;
  return root.warnings.some(
    (w) =>
      w.kind === kind && w.line === start?.line && w.column === start?.column,
  );
}
