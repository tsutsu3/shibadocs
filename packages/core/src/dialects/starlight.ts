// The parser leaves the keys in this file out of `meta`. They set how the
// web page looks and where it appears. A printed document does not need them.
//
// The list follows the Starlight documentation, in the same order. A key
// that is commented out is in that documentation, but it stays in `meta`,
// because it describes the document itself.

/**
 * Every frontmatter key that configures a Starlight site.
 *
 * @see https://starlight.astro.build/reference/frontmatter/
 */
export const STARLIGHT_SITE_KEYS: ReadonlySet<string> = new Set([
  // "title", // Kept in `meta`. It is the document title.
  // "description", // Kept in `meta`. It is the document summary.
  "slug",
  "editUrl",
  "head",
  "tableOfContents",
  "template",
  "hero",
  "banner",
  "lastUpdated",
  "prev",
  "next",
  "pagefind",
  "draft",
  "sidebar",
]);
