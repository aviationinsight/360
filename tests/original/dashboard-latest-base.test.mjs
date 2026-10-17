import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../private/dashboard-source.html", import.meta.url),
  "utf8",
);

test("AMOS, AOG, FAK and Marshaling replace the base with each latest workbook", () => {
  assert.match(source, /const previousRows=rows\.slice\(\);\s*rows=\[\];\s*mergeNewData\(grid\)/);
  assert.match(source, /const previousRows=rows\.slice\(\);\s*rows=\[\];\s*mergeNewData\(normalizedGrid\)/);
  assert.match(source, /serviceUrl='\/api\/dashboard-sync\/aog'/);
  assert.match(source, /name\.trim\(\)\.toLowerCase\(\)==='automated'/);
  assert.match(source, /serviceUrl='\/api\/dashboard-sync\/marshaling'/);
  assert.match(source, /normalized==='summry'\|\|normalized==='summary'/);
});

test("returning to each live dashboard forces a latest-file refresh", () => {
  assert.match(source, /const wasLoaded=Boolean\(loaded\[key\]\)/);
  assert.match(source, /key==='amos'\?'refreshAmosData':key==='aog'\?'refreshAogData':key==='fak'\?'refreshFakData':'refreshMarshalingData'/);
  assert.match(source, /if\(typeof refresh==='function'\) refresh\(\)/);
});
