import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { canOpenStage, shouldPollTask, filterHistory } = await load("../src/lib/task-workflow.ts");
const { resultsCsv } = await load("../src/lib/export-results.ts");
const detail = (status, calls = [], summary = null) => ({ task: { status }, calls, summary });

test("approval and results steps reflect task state", () => {
  assert.equal(canOpenStage("preview", detail("awaiting_approval")), true);
  assert.equal(canOpenStage("results", detail("calling", [{ status: "calling" }])), false);
  assert.equal(canOpenStage("preview", detail("calling", [{ status: "calling" }])), false);
  assert.equal(canOpenStage("results", detail("completed", [], { final_summary: "Done" })), true);
});

test("stopped runs never poll or automatically summarize", () => {
  for (const status of ["cancelled", "failed", "completed"]) {
    assert.equal(shouldPollTask(detail(status, [{ status: "completed" }])), false);
  }
  assert.equal(shouldPollTask(detail("calling", [{ status: "completed" }])), true);
});

test("history combines case-insensitive search with status groups", () => {
  const tasks = [
    { original_request: "Dinner tonight", status: "completed" },
    { original_request: "Dinner tomorrow", status: "awaiting_approval" },
    { original_request: "Appointment", status: "calling" }
  ];
  assert.equal(filterHistory(tasks, " DINNER ", "all").length, 2);
  assert.deepEqual(filterHistory(tasks, "dinner", "approval"), [tasks[1]]);
  assert.deepEqual(filterHistory(tasks, "", "active"), [tasks[2]]);
  assert.deepEqual(filterHistory(tasks, "missing", "all"), []);
});

test("CSV quotes multiline content and neutralizes spreadsheet formulas", () => {
  const csv = resultsCsv([{ target: '=HYPERLINK("evil")', phone_number: "+14165550100", notes: 'Line 1, "yes"\nLine 2', recommended: true }]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=HYPERLINK(""evil"")"'));
  assert.ok(csv.includes('"\'+14165550100"'));
  assert.ok(csv.includes('"Line 1, ""yes""\nLine 2"'));
});
