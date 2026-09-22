// A plain Docusaurus site holding the same Japanese document, for the PDF
// tools that work from a rendered site (Prince and Puppeteer based ones).
export default {
  title: "在庫管理システム",
  url: "http://localhost",
  baseUrl: "/",
  i18n: { defaultLocale: "ja", locales: ["ja"] },
  onBrokenLinks: "warn",
  presets: [
    [
      "classic",
      {
        docs: { routeBasePath: "/docs", sidebarPath: undefined },
        blog: false,
        theme: { customCss: "./src/css/custom.css" },
      },
    ],
  ],
  themeConfig: {
    navbar: { title: "在庫管理システム" },
  },
};
