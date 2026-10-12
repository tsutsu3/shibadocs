// The parser leaves the keys in this file out of `meta`. They set how the
// web page looks and where it appears. A printed document does not need them.
//
// Docusaurus has three kinds of content. Each kind has its own list of keys.
// A key that belongs to several kinds is written in each list.
//
// Each list follows the table in the Docusaurus documentation, in the same
// order. A key that is commented out is in that table, but it stays in
// `meta`, because it describes the document itself.

/**
 * The site settings of a docs page.
 *
 * @see https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs#markdown-front-matter
 */
const DOCS_KEYS = [
  "id",
  // "title", // Kept in `meta`. It is the document title.
  "pagination_label",
  "sidebar_label",
  "sidebar_position",
  "sidebar_class_name",
  "sidebar_key",
  "sidebar_custom_props",
  "displayed_sidebar",
  "hide_title",
  "hide_table_of_contents",
  "toc_min_heading_level",
  "toc_max_heading_level",
  "pagination_next",
  "pagination_prev",
  "parse_number_prefixes",
  "custom_edit_url",
  "keywords",
  // "description", // Kept in `meta`. It is the document summary.
  "image",
  "slug",
  "tags",
  "draft",
  "unlisted",
  "last_update",
];

/**
 * The site settings of a blog post.
 *
 * @see https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#markdown-front-matter
 */
const BLOG_KEYS = [
  "authors",
  // "author", // Kept in `meta`. It is the document author.
  "author_url",
  "author_image_url",
  "author_title",
  // "title", // Kept in `meta`. It is the document title.
  "title_meta",
  "sidebar_label",
  // "date", // Kept in `meta`. It is the document date.
  "tags",
  "draft",
  "unlisted",
  "hide_table_of_contents",
  "toc_min_heading_level",
  "toc_max_heading_level",
  "keywords",
  // "description", // Kept in `meta`. It is the document summary.
  "image",
  "slug",
  "last_update",
];

/**
 * The site settings of a standalone page.
 *
 * @see https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-pages#markdown-front-matter
 */
const PAGE_KEYS = [
  // "title", // Kept in `meta`. It is the document title.
  // "description", // Kept in `meta`. It is the document summary.
  "keywords",
  "image",
  "slug",
  "wrapperClassName",
  "hide_table_of_contents",
  "draft",
  "unlisted",
];

/** Every frontmatter key that configures a Docusaurus site. */
export const DOCUSAURUS_SITE_KEYS: ReadonlySet<string> = new Set([
  ...DOCS_KEYS,
  ...BLOG_KEYS,
  ...PAGE_KEYS,
]);
