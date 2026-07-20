import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const repoRoot = new URL("../../", import.meta.url).pathname;
const renderScript = join(repoRoot, "skills/facio-user-journey/scripts/render_report.py");

test("renders user cost attribution and remotion trace mix", () => {
  const dir = mkdtempSync(join(tmpdir(), "facio-user-journey-"));
  const journeyPath = join(dir, "journey.json");
  const outPath = join(dir, "report.html");

  writeFileSync(
    journeyPath,
    JSON.stringify({
      meta: {
        title: "成本测试报告",
        verdict: "测试",
        timeline_note: "测试",
        privacy_note: "local only",
        tier: 2,
      },
      identity: {
        email: "user@example.com",
        account_id: "acct_1",
        last_seen: "2026-07-17",
        active_span: "1 day",
        persona: "tester",
      },
      engagement: {
        export_ratio: "0 / 0",
        agent_ratio: "1 / 1",
        sessions: 1,
        copilot_messages: 1,
        timeline_edits: 1,
        events: [{ name: "Client.Agent.TaskStarted", count: 1 }],
      },
      findings: [{ icon: "OK", lead: "已查询", text: "测试" }],
      timeline: [{ t: "2026-07-17", title: "测试", detail: "测试" }],
      trajectory: { note: "测试", days: [{ date: "2026-07-17", tasks: 1, exports: 0 }] },
      credits: { summary: "0 / 1000" },
      ai: null,
      costs: {
        summary: "$1.00 total · remotion 60% · 素材分析 25% · chat 15%",
        note: "Langfuse facio-production",
        categories: [
          { name: "remotion", cost: "$0.60", share: "60%", traces: 4, value: 0.6 },
          { name: "素材分析", cost: "$0.25", share: "25%", traces: 1, value: 0.25 },
          { name: "chat", cost: "$0.15", share: "15%", traces: 3, value: 0.15 },
        ],
        remotion_trace_names: [
          { name: "effect_generator", cost: "$0.30", share: "50%", traces: 2, value: 0.3 },
          { name: "remotion_coordinator", cost: "$0.18", share: "30%", traces: 1, value: 0.18 },
          { name: "pace_planner", cost: "$0.12", share: "20%", traces: 1, value: 0.12 },
        ],
        trace_names: [
          { name: "server_agent", cost: "$0.32", share: "32%", traces: 5, value: 0.32 },
          { name: "effect_generator", cost: "$0.30", share: "30%", traces: 2, value: 0.3 },
          { name: "title_generation", cost: "$0.01", share: "1%", traces: 1, value: 0.01 },
        ],
      },
      recommendations: [],
      sources: { list: "fixture" },
    }),
  );

  execFileSync("python", [renderScript, "--journey", journeyPath, "--out", outPath], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  const html = readFileSync(outPath, "utf8");
  assert.match(html, /用户成本归因/);
  assert.match(html, /Langfuse facio-production/);
  assert.match(html, /remotion/);
  assert.match(html, /素材分析/);
  assert.match(html, /chat/);
  assert.match(html, /effect_generator/);
  assert.match(html, /remotion_coordinator/);
  assert.match(html, /pace_planner/);
  assert.match(html, /全部 trace_name 成本分布/);
  assert.match(html, /server_agent/);
  assert.match(html, /title_generation/);
  assert.match(html, /title_generation[\s\S]*width:3%/);
  assert.doesNotMatch(html, /使用规模统计/);
  assert.doesNotMatch(html, /每个客户端工程与产出/);
});

test("renders usage summary and per-project output evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "facio-user-journey-"));
  const journeyPath = join(dir, "journey.json");
  const outPath = join(dir, "report.html");

  writeFileSync(
    journeyPath,
    JSON.stringify({
      meta: {
        title: "用户行为报告",
        verdict: "已完成统计",
        timeline_note: "测试",
        privacy_note: "local only",
        tier: 2,
      },
      identity: {
        email: "user@example.com",
        account_id: "acct_1",
        last_seen: "2026-07-17",
        active_span: "95 分 13 秒，单日",
      },
      engagement: { events: [] },
      usage_summary: {
        active_span: "95 分 13 秒，单日",
        projects: "2（可观测）",
        assets: "3（已确认）",
        asset_duration: "915.69 秒（15:15.69）",
        chat: "18 条业务消息 / 77 generation",
        remotion: "2 套完整流程 / 45 generation",
        note: "业务次数与 Langfuse generation 分开计数。",
      },
      projects: [
        {
          project_id: "proj-example-1",
          evidence: "Client.Project.Created ×1；Editor.Entered ×2 <unsafe>",
          assets: "2",
          asset_duration: "1,277.30 秒（21:17.30）",
          output_duration: "647.90 秒（10:47.90）",
          export_result: "成功：Export.Started ×1，Export.Completed ×1，Failed ×0",
        },
        {
          project_id: "proj-example-2",
          evidence: "Project.Reopened ×3；Editor.Entered ×4",
          assets: "1",
          asset_duration: "146.40 秒（2:26.40）",
          output_duration: "未观察到导出开始，无法获取",
          export_result: "未观察到导出成功或失败",
        },
      ],
      findings: [],
      timeline: [],
      trajectory: { days: [] },
      credits: null,
      ai: null,
      costs: null,
      recommendations: [],
      sources: { list: "fixture" },
    }),
  );

  execFileSync("python", [renderScript, "--journey", journeyPath, "--out", outPath], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  const html = readFileSync(outPath, "utf8");
  assert.match(html, /使用规模统计/);
  assert.match(html, /统计跨度/);
  assert.match(html, /2（可观测）/);
  assert.match(html, /18 条业务消息 \/ 77 generation/);
  assert.match(html, /2 套完整流程 \/ 45 generation/);
  assert.match(html, /每个客户端工程与产出/);
  assert.match(html, /proj-example-1/);
  assert.match(html, /工程证据/);
  assert.match(html, /素材总时长/);
  assert.match(html, /成片时长/);
  assert.match(html, /成功：Export\.Started ×1/);
  assert.match(html, /&lt;unsafe&gt;/);
  assert.doesNotMatch(html, /<unsafe>/);
});

test("redacts direct identifiers inside cost notes", () => {
  const dir = mkdtempSync(join(tmpdir(), "facio-user-journey-"));
  const journeyPath = join(dir, "journey.json");
  const outPath = join(dir, "report.html");

  writeFileSync(
    journeyPath,
    JSON.stringify({
      meta: { title: "redaction", verdict: "test", privacy_note: "local", tier: 2 },
      identity: {
        email: "user@example.com",
        account_id: "31d2fda6-f162-4c50-9a1f-d4e6859e2682",
        last_seen: "2026-07-17",
        active_span: "1 day",
      },
      engagement: { events: [] },
      findings: [],
      timeline: [],
      trajectory: { days: [] },
      credits: null,
      ai: null,
      costs: {
        summary: "$1.00 total",
        note: "Langfuse userId=31d2fda6-f162-4c50-9a1f-d4e6859e2682 email=user@example.com",
        categories: [],
        remotion_trace_names: [],
      },
      recommendations: [],
      sources: { list: "fixture" },
    }),
  );

  execFileSync("python", [renderScript, "--journey", journeyPath, "--out", outPath, "--redact"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  const html = readFileSync(outPath, "utf8");
  assert.doesNotMatch(html, /31d2fda6-f162-4c50-9a1f-d4e6859e2682/);
  assert.doesNotMatch(html, /user@example\\.com/);
  assert.match(html, /31d2fda6…/);
  assert.match(html, /u\*\*\*@example\.com/);
  assert.doesNotMatch(html, /SECTION:costs\.remotion_trace_names/);
});
