import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CLIENTS,
  SPARE_HUES,
  buildStage,
  channelStatusText,
  formatTime,
  clientLabel,
  identifyClient,
  rowMotion,
  statusLine,
} from "./ui/live/format.js";
import { iconSvg } from "./ui/live/icons.js";

function isNearPureRed(hex) {
  const raw = String(hex).trim().toLowerCase();
  if (raw === "#f00" || raw === "#ff0000") return true;
  const body = raw.replace(/^#/, "");
  const full = body.length === 3 ? body.split("").map((char) => char + char).join("") : body;
  if (full === "ff0000") return true;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (!delta) return false;
  let hue;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  const light = (max + min) / 2;
  const sat = delta / (255 - Math.abs(2 * light - 255));
  return (hue <= 8 || hue >= 352) && sat > 0.85;
}

function stage(requests, extra) {
  return buildStage({
    requests,
    now: extra.now,
    window: extra.window,
    focusId: extra.focusId ?? null,
    pinned: extra.pinned ?? false,
    clientFilter: extra.clientFilter ?? "all",
  });
}

function request(partial) {
  return {
    status: "completed",
    modelID: "m",
    stream: false,
    source: "api",
    userAgent: "cursor/1",
    apiKey: { id: "k", name: "key", status: "enabled", type: "user" },
    channel: { id: "c", name: "ch" },
    ...partial,
  };
}

test("identifyClient matches known agents, playground, and unknown products", () => {
  const claude = identifyClient("claude-cli/1.2.3", "api");
  assert.deepEqual(claude, { id: "claude", name: "Claude Code", hue: "#d97757" });
  assert.equal(identifyClient("claude-cli-extra/9", "api").id, "claude");

  const cursor = identifyClient("cursor/0.50", "api");
  assert.equal(cursor.id, "cursor");
  assert.equal(cursor.name, "Cursor");
  assert.equal(cursor.hue, "#14b8a6");

  const playground = identifyClient(
    "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "playground",
  );
  assert.deepEqual(playground, { id: "playground", name: "Playground", hue: "#8b5cf6" });

  const unknown = identifyClient("", "api");
  assert.deepEqual(unknown, { id: "unknown", name: "未知客户端", hue: "#64748b" });
  assert.equal(identifyClient("   ", "api").id, "unknown");
  assert.equal(identifyClient("", "test").id, "test");

  const python = identifyClient("Python-urllib/3.11", "api");
  const again = identifyClient("Python-urllib/3.11", "api");
  assert.equal(python.id, "python-urllib");
  assert.equal(python.name, "Python-urllib");
  assert.ok(SPARE_HUES.includes(python.hue));
  assert.equal(python.hue, again.hue);
  assert.equal(isNearPureRed(python.hue), false);
});

test("unknown client name follows the locale and a suffix is not a failover", () => {
  const unknown = identifyClient("", "api");
  assert.equal(clientLabel(unknown, "en"), "Unknown client");
  assert.equal(clientLabel(unknown, "zh-CN"), "未知客户端");
  assert.equal(clientLabel(identifyClient("cursor/1", "api"), "zh-CN"), "Cursor");
  assert.equal(rowMotion("ch1:", "ch1:abcd"), "refine");
  assert.equal(rowMotion("", "ch1:abcd"), "assign");
  assert.equal(rowMotion("ch1:abcd", "ch2:abcd"), "switch");
  assert.equal(rowMotion("ch1:aaaa", "ch1:bbbb"), "switch");
  assert.equal(rowMotion("ch1:abcd", "ch1:abcd"), "same");
});

test("known and spare hues are not red", () => {
  for (const client of CLIENTS) assert.equal(isNearPureRed(client.hue), false, client.id);
  for (const hue of SPARE_HUES) assert.equal(isNearPureRed(hue), false, hue);
});

test("live window keeps old in-flight work and drops stale completed requests", () => {
  const now = new Date(2026, 5, 1, 12, 0, 0);
  const at = (minutes) => new Date(now.getTime() - minutes * 60 * 1000).toISOString();
  const view = stage([
    request({ id: "processing-old", createdAt: at(120), status: "processing" }),
    request({ id: "completed-stale", createdAt: at(16), status: "completed" }),
    request({ id: "completed-fresh", createdAt: at(10), status: "completed" }),
  ], { now, window: "live" });
  const ids = view.log.map((row) => row.id);
  assert.ok(ids.includes("processing-old"));
  assert.ok(ids.includes("completed-fresh"));
  assert.equal(ids.includes("completed-stale"), false);
});

test("today window uses the local day boundary", () => {
  const now = new Date(2026, 10, 8, 0, 10, 0);
  const start = new Date(2026, 10, 8, 0, 0, 0);
  const view = stage([
    request({ id: "yesterday-done", createdAt: new Date(2026, 10, 7, 23, 50, 0).toISOString(), status: "completed" }),
    request({ id: "yesterday-live", createdAt: new Date(2026, 10, 7, 22, 0, 0).toISOString(), status: "processing" }),
    request({ id: "before-midnight", createdAt: new Date(start.getTime() - 1).toISOString(), status: "completed" }),
    request({ id: "at-midnight", createdAt: start.toISOString(), status: "completed" }),
    request({ id: "today-done", createdAt: new Date(2026, 10, 8, 0, 1, 0).toISOString(), status: "completed" }),
  ], { now, window: "today" });
  const ids = view.log.map((row) => row.id);
  assert.deepEqual(ids.slice().sort(), ["at-midnight", "today-done", "yesterday-live"]);
});

test("stage keeps four clients and the focused client", () => {
  const now = new Date(2026, 5, 1, 12, 0, 0);
  const at = (minutes) => new Date(now.getTime() - minutes * 60 * 1000).toISOString();
  const specs = [
    ["c-cursor", "cursor/1", 1],
    ["c-claude", "claude-cli/1", 2],
    ["c-codex", "codex/1", 3],
    ["c-gemini", "geminicli/1", 4],
    ["c-copilot", "copilot/1", 5],
  ];
  const view = stage(specs.map(([id, userAgent, minutes]) => request({
    id,
    userAgent,
    createdAt: at(minutes),
    channel: { id: `ch-${id}`, name: id },
  })), { now, window: "live", focusId: "c-copilot", pinned: true });
  const ids = view.clients.map((client) => client.id);
  assert.equal(ids.length, 4);
  assert.ok(ids.includes("copilot"));
  assert.ok(ids.includes("cursor"));
  assert.equal(ids.includes("gemini"), false);
  assert.equal(view.focusId, "c-copilot");
});

test("channel rows split on suffix and keep the latest execution", () => {
  const now = new Date(2026, 5, 1, 12, 0, 0);
  const split = stage([request({
    id: "split",
    createdAt: now.toISOString(),
    executions: [
      {
        id: "e1",
        createdAt: new Date(now.getTime() - 2000).toISOString(),
        status: "failed",
        modelID: "m",
        channel: { id: "c1", name: "Alpha" },
        channelAPIKeySuffix: "aaaa",
        errorMessage: "old",
        responseStatusCode: 500,
      },
      {
        id: "e2",
        createdAt: new Date(now.getTime() - 1000).toISOString(),
        status: "completed",
        modelID: "m",
        metricsLatencyMs: 321,
        channel: { id: "c1", name: "Alpha" },
        channelAPIKeySuffix: "bbbb",
      },
    ],
  })], { now, window: "live" });
  assert.equal(split.channels.length, 2);
  assert.deepEqual(split.channels.map((row) => row.suffix).sort(), ["aaaa", "bbbb"]);

  const merged = stage([request({
    id: "merged",
    createdAt: now.toISOString(),
    metricsLatencyMs: 999,
    executions: [
      {
        id: "e1",
        createdAt: new Date(now.getTime() - 2000).toISOString(),
        status: "failed",
        modelID: "m",
        metricsLatencyMs: 50,
        channel: { id: "c1", name: "Alpha" },
        channelAPIKeySuffix: "aaaa",
        errorMessage: "x".repeat(90),
        responseStatusCode: 500,
      },
      {
        id: "e2",
        createdAt: new Date(now.getTime() - 1000).toISOString(),
        status: "completed",
        modelID: "mapped",
        metricsLatencyMs: 321,
        channel: { id: "c1", name: "Alpha" },
        channelAPIKeySuffix: "aaaa",
      },
    ],
  })], { now, window: "live" });
  assert.equal(merged.channels.length, 1);
  assert.equal(merged.channels[0].kind, "completed");
  assert.equal(merged.channels[0].latencyMs, 321);
  assert.equal(merged.channels[0].errorMessage, "");
});

test("answering follows the focused request and other in-flight work stays other", () => {
  const now = new Date(2026, 5, 1, 12, 0, 0);
  const view = stage([
    request({
      id: "older",
      createdAt: new Date(now.getTime() - 60 * 1000).toISOString(),
      status: "processing",
      channel: { id: "ch-old", name: "Old" },
    }),
    request({
      id: "newer",
      createdAt: now.toISOString(),
      status: "processing",
      channel: { id: "ch-new", name: "New" },
    }),
  ], { now, window: "live", focusId: "older", pinned: false });
  assert.equal(view.focusId, "newer");
  assert.equal(view.counts.inFlight, 2);
  assert.equal(view.channels.find((row) => row.channelId === "ch-new").kind, "answering");
  assert.equal(view.channels.find((row) => row.channelId === "ch-old").kind, "other");
});

test("a channel key shared by two in-flight requests shows the focused one", () => {
  const now = new Date(2026, 5, 1, 12, 0, 0);
  const attempt = (id, offset) => ({
    id,
    createdAt: new Date(now.getTime() - offset).toISOString(),
    status: "processing",
    modelID: "m",
    channel: { id: "c1", name: "Alpha" },
    channelAPIKeySuffix: "c946",
  });
  const view = stage([
    request({
      id: "older",
      createdAt: new Date(now.getTime() - 30 * 1000).toISOString(),
      status: "processing",
      executions: [attempt("e-old", 500)],
    }),
    request({
      id: "newer",
      createdAt: now.toISOString(),
      status: "processing",
      executions: [attempt("e-new", 2000)],
    }),
  ], { now, window: "live" });
  assert.equal(view.focusId, "newer");
  assert.equal(view.channels.length, 1);
  assert.equal(view.channels[0].kind, "answering");
  assert.equal(view.channels[0].requestId, "newer");
});

test("failed errors truncate at 80 characters", () => {
  const now = new Date(2026, 5, 1, 12, 0, 0);
  const message = "e".repeat(81);
  const view = stage([request({
    id: "bad",
    createdAt: now.toISOString(),
    status: "failed",
    executions: [{
      id: "e",
      createdAt: now.toISOString(),
      status: "failed",
      modelID: "m",
      responseStatusCode: 429,
      errorMessage: message,
      channel: { id: "c9", name: "Nine" },
      channelAPIKeySuffix: "zzzz",
    }],
  })], { now, window: "live" });
  assert.equal(view.channels[0].kind, "failed");
  assert.equal(view.channels[0].errorMessage, `${"e".repeat(80)}…`);
  assert.equal(view.channels[0].responseStatusCode, 429);

  const exact = stage([request({
    id: "exact",
    createdAt: now.toISOString(),
    status: "canceled",
    executions: [{
      id: "e",
      createdAt: now.toISOString(),
      status: "canceled",
      modelID: "m",
      errorMessage: "e".repeat(80),
      channel: { id: "c8", name: "Eight" },
    }],
  })], { now, window: "live" });
  assert.equal(exact.channels[0].kind, "failed");
  assert.equal(exact.channels[0].errorMessage, "e".repeat(80));
});

test("channel status copy omits empty parts", () => {
  assert.equal(channelStatusText("answering", "zh-CN"), "回答中…");
  assert.equal(channelStatusText("other", "en"), "Answering another request…");
  assert.equal(channelStatusText("pending", "zh-Hant"), "等待中");
  assert.equal(channelStatusText("pending", "en-US"), "Waiting");
  assert.equal(channelStatusText("completed", "zh", { latencyMs: 1200 }), "已完成 · 1.2s");
  assert.equal(channelStatusText("failed", "en", { code: 500, message: "boom" }), "Failed · 500 · boom");
  assert.equal(channelStatusText("failed", "en", { code: 500, message: "" }), "Failed · 500");
  assert.equal(channelStatusText("failed", "zh-CN", { message: "boom" }), "失败 · boom");
  assert.equal(channelStatusText("failed", "en", {}), "Failed");
});

test("focus follows the newest in-flight request unless a pin is still visible", () => {
  const now = new Date(2026, 5, 1, 12, 0, 0);
  const at = (minutes) => new Date(now.getTime() - minutes * 60 * 1000).toISOString();
  const pinned = stage([
    request({ id: "kept", createdAt: at(5), status: "completed", modelID: "old-model" }),
    request({ id: "live", createdAt: at(1), status: "processing", modelID: "new-model" }),
  ], { now, window: "live", focusId: "kept", pinned: true });
  assert.equal(pinned.focusId, "kept");

  const released = stage([
    request({ id: "gone", createdAt: at(120), status: "completed" }),
    request({ id: "stay", createdAt: at(1), status: "processing" }),
  ], { now, window: "live", focusId: "gone", pinned: true });
  assert.equal(released.focusId, "stay");
});

test("status line names the client and model without a routing reason", () => {
  const now = new Date(2026, 5, 1, 12, 0, 0);
  const view = stage([request({
    id: "s1",
    createdAt: new Date(now.getTime() - 1000).toISOString(),
    status: "completed",
    modelID: "gpt-4o",
    stream: true,
    userAgent: "cursor/0.50",
    metricsLatencyMs: 1200,
    channel: { id: "c", name: "west" },
    executions: [
      {
        id: "e1",
        createdAt: new Date(now.getTime() - 900).toISOString(),
        status: "failed",
        modelID: "gpt-4o",
        channel: { id: "c", name: "west" },
        channelAPIKeySuffix: "aa",
      },
      {
        id: "e2",
        createdAt: new Date(now.getTime() - 500).toISOString(),
        status: "completed",
        modelID: "gpt-4o",
        metricsLatencyMs: 800,
        channel: { id: "c", name: "west" },
        channelAPIKeySuffix: "aa",
      },
    ],
  })], { now, window: "live" });
  const line = statusLine(view, "en");
  assert.match(line, /Cursor/);
  assert.match(line, /gpt-4o/);
  assert.match(line, /attempt 2/);
  const chinese = statusLine(view, "zh-CN");
  assert.match(chinese, /第 2 次执行/);
  assert.match(chinese, /gpt-4o/);
  for (const sentence of [line, chinese]) {
    const folded = sentence.toLowerCase();
    for (const word of ["路由", "route", "because", "why"]) {
      assert.equal(folded.includes(word), false, word);
    }
  }
  assert.equal(formatTime(new Date(2026, 0, 2, 3, 4, 5), "zh-CN"), "03:04:05");
});

test("format and page sources stay inside the plugin boundary", () => {
  const formatSource = readFileSync(new URL("./ui/live/format.js", import.meta.url), "utf8");
  assert.equal(formatSource.includes("document"), false);
  assert.equal(formatSource.includes("axonhub"), false);
  assert.equal(formatSource.includes("Date.now"), false);
  assert.equal(/new Date\(\s*\)/.test(formatSource), false);

  const appSource = readFileSync(new URL("./ui/live/app.js", import.meta.url), "utf8");
  for (const word of ["requestBody", "responseBody", "requestHeaders", "responseHeaders", "responseChunks", "requestURL", "usageLogs"]) {
    assert.equal(appSource.includes(word), false, word);
  }
  assert.equal(appSource.includes("alert("), false);

  const claude = iconSvg("claude");
  assert.match(claude, /<svg/);
  assert.match(claude, /currentColor/);
  assert.equal(claude.includes("<script"), false);
  assert.equal(/\son[a-z]+=/i.test(claude), false);
  assert.match(iconSvg("python-urllib"), />P</);
});
