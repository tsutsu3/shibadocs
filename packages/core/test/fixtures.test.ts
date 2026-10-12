import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import { parse } from "../src/index.js";

const FIXTURES = fileURLToPath(new URL("../../../fixtures", import.meta.url));

const files = readdirSync(FIXTURES, { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".md"))
  .sort();

// Each `foo.md` has two expected files next to it.
//
// - `foo.ast.json` has no positions. Read this file to check the structure.
// - `foo.ast.full.json` is the real output of `parse`. It checks the positions.
it.each(files)("%s", async (file) => {
  const path = join(FIXTURES, file);
  const root = parse(readFileSync(path, "utf8"));

  const short = JSON.stringify(
    root,
    (key, value) => (key === "position" ? undefined : value),
    2,
  );
  await expect(short + "\n").toMatchFileSnapshot(
    path.replace(/\.md$/, ".ast.json"),
  );

  const full = JSON.stringify(root, null, 2);
  await expect(full + "\n").toMatchFileSnapshot(
    path.replace(/\.md$/, ".ast.full.json"),
  );
});
