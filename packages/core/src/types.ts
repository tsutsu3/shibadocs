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
  meta: DocMeta;

  /** The problems found in the source. It is `[]` when there is none. */
  warnings: Warning[];

  /**
   * Extra data about the document.
   *
   * @remarks
   * `data.frontmatter` is the complete frontmatter with YAML types. It includes
   *  the site settings that are not in `meta`, such as `sidebar_position`.
   * The field is absent when the source has no frontmatter that can be read.
   */
  data?: Record<string, unknown>;
}

/**
 * The document metadata from the YAML frontmatter.
 *
 * @remarks
 * A known key with a value of a wrong form is left out and reported as a
 * warning. A key without a value is left out without a warning.
 *
 * Keys that configure a Docusaurus or Starlight site are left out too.
 * Examples are `sidebar_position`, `slug` and `tags`. The complete
 * frontmatter is in `root.data.frontmatter`.
 *
 * @example
 * ```ts
 * const { meta } = parse("---\ntitle: Design\nversion: 1.0\nslug: /a\n---\n");
 * // { title: "Design", version: "1.0" }
 * ```
 */
export interface DocMeta {
  /** The document title. */
  title?: string;

  /** The second line of the title. */
  subtitle?: string;

  /** The name of the author. */
  author?: string;

  /**
   * The document version.
   *
   * @remarks
   * Any single value is accepted, for example `1`, `1.2`, `1.2.3` or `v2.0-rc1`.
   * The value is the source text. `version: 1.0` gives `"1.0"`, not `"1"`.
   */
  version?: string;

  /** The document date, as written in the source. The parser does not parse it. */
  date?: string;

  /**
   * The name of the document template. For example `ja-report`.
   *
   * @remarks
   * The key is not `template`. Starlight uses that name for its page layout.
   */
  doc_template?: string;

  /** The revision history, in source order. */
  revisions?: Revision[];

  /**
   * Any other frontmatter key.
   *
   * @remarks
   * The parser copies unknown keys as they are. The values have YAML types.
   */
  [key: string]: unknown;
}

/** One row of the revision history. Every field is the source text. */
export interface Revision {
  /** The version of this revision. For example `"1.0"`. */
  ver: string;

  /** The date of this revision. */
  date: string;

  /** The name of the person who made this revision. */
  by: string;

  /** The description of the change. It is `""` when the source has none. */
  note: string;
}

/**
 * A problem in the source text.
 * {@link parse} returns these in the `warnings` field of the root node.
 *
 * @example
 * ```ts
 * for (const w of parse(md).warnings) {
 *   console.warn(`line ${w.line} [${w.kind}] ${w.message}`);
 * }
 * ```
 */
export interface Warning {
  /** The line number in the Markdown source. It starts at 1. */
  line: number;

  /** The column number in the Markdown source. It starts at 1. */
  column?: number;

  /** The category of the problem. Use it to filter or to count warnings. */
  kind: WarningKind;

  /** The text for the user, in English. */
  message: string;
}

/**
 * The category of a warning.
 *
 * @remarks
 * - `invalid-frontmatter` : The frontmatter is not valid YAML, it is not a
 *   set of keys and values, or a known key has a value of a wrong form.
 * - `unknown-directive` : The source has a directive that the parser does not
 *   know, such as `:::name`.
 */
export type WarningKind = "invalid-frontmatter" | "unknown-directive";

/**
 * A directive that the parser does not know.
 *
 * @remarks
 * The parser keeps unknown input in this node and never drops it.
 * A warning of kind `unknown-directive` exists at the same line and column.
 * A renderer prints `children` as normal content.
 *
 * @example
 * ```ts
 * const root = parse(':::mystery{level="2"}\nText\n:::\n');
 * // { type: "unknownDirective", name: "mystery", options: { level: "2" },
 * //   value: ':::mystery{level="2"}\nText\n:::', children: [{ type: "paragraph", … }] }
 * ```
 */
export interface UnknownDirective extends Parent {
  type: "unknownDirective";

  /** The directive name, without the colons. */
  name: string;

  /**
   * The attributes of the directive, as source strings.
   *
   * @remarks
   * An attribute without a value is `""`. A number is a string.
   */
  options: Record<string, string>;

  /** The complete source text of the directive, with its markers. */
  value: string;

  /**
   * The parsed content of the directive.
   *
   * @remarks
   * The label of `:::name[label]` is the first paragraph. Its
   * `data.directiveLabel` is `true`.
   */
  children: Node[];
}
