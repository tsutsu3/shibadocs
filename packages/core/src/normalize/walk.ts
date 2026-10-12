import type { Node, Parent } from "../types.js";

/**
 * Checks whether a node has a `children` array.
 *
 * @param node - Any node.
 * @returns True when the node is a parent.
 */
export function isParent(node: Node): node is Parent {
  return Array.isArray((node as Parent).children);
}

/**
 * Rebuilds a list of nodes, from the deepest nodes up to the top.
 *
 * @param nodes - The nodes to rebuild. Neither the array nor the nodes are changed.
 * @param visit - Receives each node after its children are rebuilt. It
 * returns the node to keep at that place. This can be the same node or a new one.
 * @returns A new array. A parent in it is a new object with new children.
 */
export function mapNodes(
  nodes: readonly Node[],
  visit: (node: Node) => Node,
): Node[] {
  return nodes.map((node) => {
    if (!isParent(node)) return visit(node);

    const rebuilt: Parent = {
      ...node,
      children: mapNodes(node.children, visit),
    };

    return visit(rebuilt);
  });
}
