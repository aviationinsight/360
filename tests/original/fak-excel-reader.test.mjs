import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../private/dashboard-source.html", import.meta.url), "utf8");

function embeddedDashboard(key) {
  const match = source.match(new RegExp(`<script type="application/json" id="data-${key}">([\\s\\S]*?)<\\/script>`));
  assert.ok(match, `missing ${key} dashboard payload`);
  return JSON.parse(match[1]);
}

function excelReader(html) {
  const start = html.indexOf("<script>");
  const end = html.indexOf("</script>", start);
  assert.ok(start >= 0 && end > start, "missing embedded Excel reader");
  return html.slice(start + "<script>".length, end);
}

test("FAK keeps the working Excel reader used by AMOS", () => {
  const amosReader = excelReader(embeddedDashboard("amos"));
  const fakReader = excelReader(embeddedDashboard("fak"));

  assert.equal(fakReader, amosReader);
  assert.doesNotThrow(() => new vm.Script(fakReader));
  assert.doesNotMatch(fakReader, /SheetJS Table Export<\/title><style>/);
});
