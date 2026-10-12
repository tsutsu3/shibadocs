import type { DocMeta, Revision } from "../types.js";

/** The result of {@link toDocMeta}. */
export interface DocMetaResult {
  /** The metadata with typed values. */
  meta: DocMeta;

  /** The keys that were left out because their value has a wrong form. */
  invalid: string[];
}

const STRING_KEYS = [
  "title",
  "subtitle",
  "author",
  "version",
  "date",
  "template",
] as const;

/**
 * Checks the frontmatter values and gives each known key its type.
 *
 * @param values - The frontmatter with YAML types. `version: 1.0` is the number 1 here.
 * @param strings - The same frontmatter with every value as its source text.
 * @returns The typed metadata and the names of the keys that were left out.
 * Unknown keys are copied as they are.
 */
export function toDocMeta(
  values: Readonly<Record<string, unknown>>,
  strings: Readonly<Record<string, unknown>>,
): DocMetaResult {
  const meta: DocMeta = {};
  const invalid: string[] = [];

  for (const [key, value] of Object.entries(values)) {
    if (value === null) continue;

    const typed = toTyped(key, value, strings[key]);
    if (typed === undefined) {
      invalid.push(key);
    } else {
      meta[key] = typed;
    }
  }

  return { meta, invalid };
}

/** Returns the typed value of one key, or `undefined` when the value has a wrong form. */
function toTyped(key: string, value: unknown, source: unknown): unknown {
  if ((STRING_KEYS as readonly string[]).includes(key)) {
    // The source text is used. YAML reads `1.0` as the number 1.
    return typeof source === "string" ? source : undefined;
  }

  switch (key) {
    case "revisions":
      return toRevisions(source);
    default:
      return value;
  }
}

function toRevisions(source: unknown): Revision[] | undefined {
  if (!Array.isArray(source)) return undefined;

  const revisions: Revision[] = [];
  for (const item of source) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return undefined;
    }

    const row = item as Record<string, unknown>;
    const field = (key: string): string => {
      const text = row[key];
      return typeof text === "string" ? text : "";
    };

    revisions.push({
      ver: field("ver"),
      date: field("date"),
      by: field("by"),
      note: field("note"),
    });
  }

  return revisions;
}
