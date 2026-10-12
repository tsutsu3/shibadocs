/**
 * A syntax tree node.
 *
 * @remarks
 * Narrow a node by its `type` field. For example `paragraph` or `table`.
 */
export interface Node {
  /** The node type. For example `paragraph` or `heading`. */
  type: string;

  /** The location of the node in the source text. */
  position?: Position;

  /** Extra data about the node. The values must be JSON values. */
  data?: Record<string, unknown>;
}

/** A node that contains other nodes. */
export interface Parent extends Node {
  /** The child nodes, in document order. */
  children: Node[];
}

/** A node that contains a text value. */
export interface Literal extends Node {
  /** The text content. It is not escaped for any output format. */
  value: string;
}

/** A range in the source text. */
export interface Position {
  /** The place of the first character of the node. */
  start: Point;

  /** The place after the last character of the node. */
  end: Point;
}

/** A place in the source text. */
export interface Point {
  /** The line number. It starts at 1. */
  line: number;

  /** The column number. It starts at 1. */
  column: number;

  /** The character offset from the start of the source. It starts at 0. */
  offset?: number;
}

/**
 * The document root. {@link parse} returns this node.
 */
export interface Root extends Parent {
  type: "root";

  /** The document metadata from the YAML frontmatter. It is `{}` when there is none. */
  meta: Record<string, unknown>;

  /** The problems found in the source. It is always `[]` for now. */
  warnings: unknown[];
}
