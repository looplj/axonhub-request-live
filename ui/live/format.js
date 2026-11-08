export const SPARE_HUES = ["#8b5cf6", "#22c55e", "#0d9488", "#0891b2", "#ca8a04", "#db2777", "#2563eb", "#65a30d"];

export const CLIENTS = [
  { id: "claude", name: "Claude Code", hue: "#d97757", aliases: ["claude-cli", "claude-code"] },
  { id: "codex", name: "Codex", hue: "#6366f1", aliases: ["codex", "acp-extension-codex"] },
  { id: "cursor", name: "Cursor", hue: "#14b8a6", aliases: ["cursor"] },
  { id: "gemini", name: "Gemini CLI", hue: "#0ea5e9", aliases: ["geminicli", "gemini-cli"] },
  { id: "copilot", name: "Copilot", hue: "#a855f7", aliases: ["copilot", "github-copilot"] },
  { id: "opencode", name: "OpenCode", hue: "#eab308", aliases: ["opencode"] },
  { id: "pi", name: "Pi", hue: "#10b981", aliases: ["pi", "pi-desktop"] },
  { id: "crush", name: "Crush", hue: "#ec4899", aliases: ["crush"] },
  { id: "goose", name: "Goose", hue: "#84cc16", aliases: ["goose"] },
  { id: "cline", name: "Cline", hue: "#22c55e", aliases: ["cline"] },
  { id: "zed", name: "Zed", hue: "#0d9488", aliases: ["zed"] },
  { id: "kimi", name: "Kimi CLI", hue: "#0891b2", aliases: ["kimicli", "kimi-cli"] },
  { id: "grok", name: "Grok", hue: "#ca8a04", aliases: ["grok-shell", "grok-pager", "xai-grok-build"] },
  { id: "droid", name: "Factory", hue: "#db2777", aliases: ["factory-cli"] },
  { id: "curl", name: "curl", hue: "#2563eb", aliases: ["curl"] },
  { id: "playground", name: "Playground", hue: "#8b5cf6", aliases: [] },
  { id: "test", name: "Test", hue: "#65a30d", aliases: [] },
  { id: "unknown", name: "未知客户端", hue: "#64748b", aliases: [] },
];

const LIVE_MS = 15 * 60 * 1000;
const CLIENT_CAP = 4;
const KEY_CAP = 4;
const CHANNEL_CAP = 8;

const byId = new Map(CLIENTS.map((client) => [client.id, client]));

function present(client) {
  return { id: client.id, name: client.name, hue: client.hue };
}

export function spareHue(id) {
  let hash = 0;
  const text = String(id);
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return SPARE_HUES[hash % SPARE_HUES.length];
}

function productOf(userAgent) {
  const trimmed = String(userAgent || "").trim();
  if (!trimmed) return { raw: "", token: "" };
  const cut = trimmed.search(/[/\s]/);
  const raw = cut === -1 ? trimmed : trimmed.slice(0, cut);
  return { raw, token: raw.toLowerCase() };
}

export function identifyClient(userAgent, source) {
  const origin = String(source || "").toLowerCase();
  if (origin === "playground") return present(byId.get("playground"));
  const { raw, token } = productOf(userAgent);
  if (!token) {
    if (origin === "test") return present(byId.get("test"));
    return present(byId.get("unknown"));
  }
  for (const client of CLIENTS) {
    if (token === client.id || client.aliases.includes(token)) return present(client);
  }
  let best = null;
  let bestLength = 0;
  for (const client of CLIENTS) {
    for (const alias of client.aliases) {
      if (alias && token.startsWith(alias) && alias.length > bestLength) {
        best = client;
        bestLength = alias.length;
      }
    }
  }
  if (best) return present(best);
  return { id: token, name: raw, hue: spareHue(token) };
}

export function isChinese(locale) {
  return String(locale || "").toLowerCase().startsWith("zh");
}

export function formatTime(date, locale) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "--:--:--";
  const pad = (part) => String(part).padStart(2, "0");
  void locale;
  return `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

export function formatLatency(ms) {
  if (ms == null || ms === "" || !Number.isFinite(Number(ms)) || Number(ms) < 0) return "—";
  const value = Number(ms);
  if (value < 1000) return `${Math.round(value)}ms`;
  const seconds = value / 1000;
  if (seconds < 60) {
    const rounded = seconds >= 10 ? String(Math.round(seconds)) : String(Math.round(seconds * 10) / 10);
    return `${rounded}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
}

function truncateError(message) {
  const text = String(message || "");
  const chars = Array.from(text);
  if (chars.length <= 80) return text;
  return `${chars.slice(0, 80).join("")}…`;
}

export function channelStatusText(kind, locale, extra) {
  const zh = isChinese(locale);
  const info = extra || {};
  if (kind === "answering") return zh ? "回答中…" : "Answering…";
  if (kind === "other") return zh ? "在回答另一个请求…" : "Answering another request…";
  if (kind === "pending") return zh ? "等待中" : "Waiting";
  if (kind === "completed") {
    const latency = formatLatency(info.latencyMs ?? info.latency);
    return zh ? `已完成 · ${latency}` : `Completed · ${latency}`;
  }
  if (kind === "failed") {
    const code = info.code ?? info.responseStatusCode ?? info.statusCode;
    const message = String(info.message ?? info.errorMessage ?? "").trim();
    const parts = [zh ? "失败" : "Failed"];
    if (code !== undefined && code !== null && code !== "") parts.push(String(code));
    if (message) parts.push(message);
    return parts.join(" · ");
  }
  return "";
}

export function clientLabel(client, locale) {
  if (!client) return "";
  if (client.id === "unknown") return isChinese(locale) ? "未知客户端" : "Unknown client";
  return client.name || client.id || "";
}

export function statusLine(view, locale) {
  const focus = view && view.focus;
  if (!focus) return "";
  const zh = isChinese(locale);
  const name = clientLabel({ id: focus.clientId, name: focus.clientName }, locale);
  const attempt = zh ? `第 ${focus.executionIndex} 次执行` : `attempt ${focus.executionIndex}`;
  const channel = focus.channelName || (zh ? "无渠道" : "no channel");
  const stream = focus.stream ? (zh ? "流式" : "streaming") : (zh ? "非流式" : "not streaming");
  const elapsed = formatLatency(focus.elapsedMs);
  const end = zh ? "。" : ".";
  return `${name} · ${focus.modelID} · ${attempt} · ${channel} · ${stream} · ${elapsed}${end}`;
}

function splitRow(rowId) {
  const text = String(rowId || "");
  const sep = text.lastIndexOf(":");
  if (sep === -1) return { id: text, suffix: "" };
  return { id: text.slice(0, sep), suffix: text.slice(sep + 1) };
}

// rowMotion distinguishes a real channel change from the suffix arriving
// on a later poll. "assign" is the first channel, "refine" fills in the
// key suffix, "switch" is a different channel or a different key.
export function rowMotion(prev, next) {
  if (!next || prev === next) return "same";
  if (!prev) return "assign";
  const from = splitRow(prev);
  const to = splitRow(next);
  if (!from.id || from.id !== to.id) return "switch";
  if (!from.suffix || !to.suffix || from.suffix === to.suffix) return "refine";
  return "switch";
}

function toTime(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function inFlightStatus(status) {
  return status === "pending" || status === "processing";
}

function inWindow(entry, mode, now) {
  if (inFlightStatus(entry.status)) return true;
  if (!Number.isFinite(entry.time)) return false;
  if (mode === "today") {
    const start = new Date(now.getTime());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime());
    end.setDate(end.getDate() + 1);
    return entry.time >= start.getTime() && entry.time < end.getTime();
  }
  return entry.time >= now.getTime() - LIVE_MS;
}

function keyIdOf(entry) {
  return entry.apiKey && entry.apiKey.id ? entry.apiKey.id : "none";
}

function listExecutions(request) {
  if (!Array.isArray(request.executions) || request.executions.length === 0) return [];
  return request.executions.filter(Boolean).map((execution) => ({
    id: execution.id,
    time: toTime(execution.createdAt),
    status: String(execution.status || "").toLowerCase(),
    modelID: execution.modelID || request.modelID || "",
    responseStatusCode: execution.responseStatusCode,
    errorMessage: execution.errorMessage || "",
    metricsLatencyMs: execution.metricsLatencyMs,
    channelAPIKeySuffix: execution.channelAPIKeySuffix || "",
    channel: execution.channel || null,
  })).sort((left, right) => {
    const delta = (Number.isFinite(left.time) ? left.time : 0) - (Number.isFinite(right.time) ? right.time : 0);
    if (delta) return delta;
    return String(left.id || "").localeCompare(String(right.id || ""));
  });
}

function channelName(channel) {
  if (!channel || !channel.id) return "";
  return channel.name || channel.id;
}

function rowsOf(entry) {
  const executions = listExecutions(entry);
  const rows = [];
  for (const execution of executions) {
    const channel = execution.channel;
    if (!channel || !channel.id) continue;
    const suffix = execution.channelAPIKeySuffix || "";
    rows.push({
      rowId: `${channel.id}:${suffix}`,
      channelId: channel.id,
      name: channelName(channel),
      suffix,
      modelID: execution.modelID || entry.modelID,
      status: execution.status,
      time: Number.isFinite(execution.time) ? execution.time : entry.time,
      code: execution.responseStatusCode,
      error: execution.errorMessage,
      latencyMs: numberOrNull(execution.metricsLatencyMs),
      requestLatencyMs: numberOrNull(entry.metricsLatencyMs),
      requestId: entry.id,
    });
  }
  if (rows.length) return rows;
  if (entry.channel && entry.channel.id) {
    return [{
      rowId: `${entry.channel.id}:`,
      channelId: entry.channel.id,
      name: channelName(entry.channel),
      suffix: "",
      modelID: entry.modelID,
      status: entry.status,
      time: entry.time,
      code: null,
      error: "",
      latencyMs: numberOrNull(entry.metricsLatencyMs),
      requestLatencyMs: numberOrNull(entry.metricsLatencyMs),
      requestId: entry.id,
    }];
  }
  return [];
}

export function currentRowId(request) {
  const entry = normalize(request);
  const rows = rowsOf(entry);
  return rows.length ? rows[rows.length - 1].rowId : "";
}

function normalize(request) {
  const status = String((request && request.status) || "").toLowerCase();
  return {
    id: request && request.id,
    createdAt: request && request.createdAt,
    time: toTime(request && request.createdAt),
    status,
    modelID: (request && request.modelID) || "",
    stream: Boolean(request && request.stream),
    source: (request && request.source) || "",
    userAgent: (request && request.userAgent) || "",
    metricsLatencyMs: request && request.metricsLatencyMs,
    metricsFirstTokenLatencyMs: request && request.metricsFirstTokenLatencyMs,
    apiKey: request && request.apiKey && request.apiKey.id ? {
      id: request.apiKey.id,
      name: request.apiKey.name || "",
      status: request.apiKey.status || "",
      type: request.apiKey.type || "",
    } : null,
    channel: request && request.channel && request.channel.id ? {
      id: request.channel.id,
      name: request.channel.name || "",
    } : null,
    executions: request && request.executions,
    client: identifyClient(request && request.userAgent, request && request.source),
  };
}

function capItems(items, limit, keepId) {
  const sorted = [...items].sort((left, right) => right.latestAt - left.latestAt || String(left.id).localeCompare(String(right.id)));
  if (sorted.length <= limit) return sorted;
  if (!keepId || sorted.slice(0, limit).some((item) => item.id === keepId)) return sorted.slice(0, limit);
  const kept = sorted.find((item) => item.id === keepId);
  if (!kept) return sorted.slice(0, limit);
  const others = sorted.filter((item) => item.id !== keepId).slice(0, limit - 1);
  return [...others, kept].sort((left, right) => right.latestAt - left.latestAt || String(left.id).localeCompare(String(right.id)));
}

function kindFor(status, requestId, focusId) {
  if (status === "processing") return requestId === focusId ? "answering" : "other";
  if (status === "pending") return "pending";
  if (status === "failed" || status === "canceled") return "failed";
  if (status === "completed") return "completed";
  return "pending";
}

function elapsedMs(entry, now) {
  const finished = entry.status === "completed" || entry.status === "failed" || entry.status === "canceled";
  if (finished) {
    const fromRequest = numberOrNull(entry.metricsLatencyMs);
    if (fromRequest != null) return fromRequest;
    const rows = rowsOf(entry);
    if (rows.length && rows[rows.length - 1].latencyMs != null) return rows[rows.length - 1].latencyMs;
  }
  if (!Number.isFinite(entry.time) || !Number.isFinite(now.getTime())) return 0;
  return Math.max(0, now.getTime() - entry.time);
}

function pickFocus(entries, focusId, pinned) {
  if (pinned && focusId && entries.some((entry) => entry.id === focusId)) return focusId;
  const live = entries.filter((entry) => inFlightStatus(entry.status))
    .sort((left, right) => right.time - left.time || String(right.id).localeCompare(String(left.id)));
  if (live.length) return live[0].id;
  const sorted = [...entries].sort((left, right) => right.time - left.time || String(right.id).localeCompare(String(left.id)));
  return sorted.length ? sorted[0].id : null;
}

export function buildStage({ requests, now, window: mode, focusId, pinned, clientFilter }) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const range = mode === "today" ? "today" : "live";
  const filter = clientFilter && clientFilter !== "all" ? clientFilter : "all";
  const all = (Array.isArray(requests) ? requests : []).filter(Boolean).map(normalize);
  const windowed = all.filter((entry) => inWindow(entry, range, nowDate));
  const availableClients = clientsFrom(windowed);
  const filtered = filter === "all" ? windowed : windowed.filter((entry) => entry.client.id === filter);
  const selectedId = pickFocus(filtered, focusId, Boolean(pinned));
  const focusEntry = filtered.find((entry) => entry.id === selectedId) || null;
  const focusClientId = focusEntry ? focusEntry.client.id : null;
  const focusKeyId = focusEntry ? keyIdOf(focusEntry) : null;
  const clients = capItems(clientsFrom(filtered), CLIENT_CAP, focusClientId);
  const visibleClientIds = new Set(clients.map((client) => client.id));
  const staged = filtered.filter((entry) => visibleClientIds.has(entry.client.id));
  const keys = capItems(keysFrom(staged), KEY_CAP, focusKeyId).map((key) => ({
    ...key,
    nodeId: `key:${key.id}`,
  }));
  const visibleKeyIds = new Set(keys.map((key) => key.id));
  const focusRows = focusEntry ? rowsOf(focusEntry) : [];
  const channels = capChannels(channelRows(staged, selectedId), focusRows.map((row) => row.rowId));
  const visibleRowIds = new Set(channels.map((row) => row.rowId));
  const focusWires = [];
  if (focusEntry) {
    const clientNode = `client:${focusEntry.client.id}`;
    const keyNode = `key:${keyIdOf(focusEntry)}`;
    focusWires.push({ from: clientNode, to: keyNode });
    focusWires.push({ from: keyNode, to: "hub" });
    const seen = new Set();
    for (const row of focusRows) {
      if (seen.has(row.rowId) || !visibleRowIds.has(row.rowId)) continue;
      seen.add(row.rowId);
      focusWires.push({ from: "hub", to: `channel:${row.rowId}` });
    }
  }
  const faint = [];
  const pairs = new Set();
  for (const entry of staged) {
    const key = keyIdOf(entry);
    if (!visibleKeyIds.has(key)) continue;
    const token = `${entry.client.id}|${key}`;
    if (pairs.has(token)) continue;
    pairs.add(token);
    faint.push({ from: `client:${entry.client.id}`, to: `key:${key}`, kind: "client-key" });
  }
  for (const row of channels) {
    faint.push({ from: "hub", to: row.nodeId, kind: "hub-channel" });
  }
  const latestRow = focusRows.length ? focusRows[focusRows.length - 1] : null;
  const focus = focusEntry ? {
    id: focusEntry.id,
    clientId: focusEntry.client.id,
    clientName: focusEntry.client.name,
    hue: focusEntry.client.hue,
    keyId: keyIdOf(focusEntry),
    modelID: focusEntry.modelID,
    stream: focusEntry.stream,
    status: focusEntry.status,
    executionIndex: listExecutions(focusEntry).length || 1,
    channelName: latestRow ? latestRow.name : "",
    rowId: latestRow ? latestRow.rowId : "",
    elapsedMs: elapsedMs(focusEntry, nowDate),
  } : null;
  const log = [...filtered].sort((left, right) => right.time - left.time || String(right.id).localeCompare(String(left.id)))
    .map((entry) => {
      const rows = rowsOf(entry);
      const latest = rows.length ? rows[rows.length - 1] : null;
      return {
        id: entry.id,
        createdAt: entry.createdAt,
        client: entry.client,
        apiKeyName: entry.apiKey ? entry.apiKey.name : "",
        modelID: entry.modelID,
        status: entry.status,
        channelName: latest ? latest.name : "",
        latencyMs: numberOrNull(entry.metricsLatencyMs),
      };
    });
  return {
    focusId: selectedId,
    focus,
    clients: clients.map((client) => ({ ...client, nodeId: `client:${client.id}` })),
    keys,
    channels,
    counts: {
      requests: filtered.length,
      inFlight: filtered.filter((entry) => inFlightStatus(entry.status)).length,
      failed: filtered.filter((entry) => entry.status === "failed").length,
    },
    log,
    wires: { focus: focusWires, faint },
    availableClients,
    windowCount: windowed.length,
  };
}

function clientsFrom(entries) {
  const groups = new Map();
  for (const entry of entries) {
    let group = groups.get(entry.client.id);
    if (!group) {
      group = {
        id: entry.client.id,
        name: entry.client.name,
        hue: entry.client.hue,
        latestAt: -1,
        latestModel: "",
        requestCount: 0,
      };
      groups.set(entry.client.id, group);
    }
    group.requestCount += 1;
    if (entry.time >= group.latestAt) {
      group.latestAt = entry.time;
      group.latestModel = entry.modelID;
    }
  }
  return [...groups.values()];
}

function keysFrom(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const id = keyIdOf(entry);
    let group = groups.get(id);
    if (!group) {
      group = {
        id,
        name: entry.apiKey ? entry.apiKey.name : "",
        status: entry.apiKey ? entry.apiKey.status : "",
        type: entry.apiKey ? entry.apiKey.type : "",
        latestAt: -1,
      };
      groups.set(id, group);
    }
    if (entry.time >= group.latestAt) {
      group.latestAt = entry.time;
      if (entry.apiKey) {
        group.name = entry.apiKey.name || "";
        group.status = entry.apiKey.status || "";
        group.type = entry.apiKey.type || "";
      }
    }
  }
  return [...groups.values()];
}

// A channel and key can serve several requests at once. The row shows the
// focused request's own attempt there when it has one, so the dot waiting at
// a row never sits beside "answering another request".
function channelRows(entries, focusId) {
  const groups = new Map();
  for (const entry of entries) {
    for (const row of rowsOf(entry)) {
      const current = groups.get(row.rowId);
      const mine = row.requestId === focusId;
      const theirs = Boolean(current) && current.requestId === focusId;
      if (!current || (mine && !theirs) || (mine === theirs && row.time >= current.time)) groups.set(row.rowId, row);
    }
  }
  return [...groups.values()].map((row) => {
    const kind = kindFor(row.status, row.requestId, focusId);
    const failed = kind === "failed";
    return {
      rowId: row.rowId,
      nodeId: `channel:${row.rowId}`,
      channelId: row.channelId,
      name: row.name,
      suffix: row.suffix,
      modelID: row.modelID,
      kind,
      responseStatusCode: failed ? row.code : null,
      errorMessage: failed ? truncateError(row.error) : "",
      latencyMs: kind === "completed" ? (row.latencyMs != null ? row.latencyMs : row.requestLatencyMs) : null,
      requestId: row.requestId,
      activeAt: row.time,
    };
  });
}

function capChannels(rows, focusRowIds) {
  const sorted = [...rows].sort((left, right) => right.activeAt - left.activeAt || String(left.rowId).localeCompare(String(right.rowId)));
  const focusSet = new Set(focusRowIds);
  const focusRows = sorted.filter((row) => focusSet.has(row.rowId)).slice(0, CHANNEL_CAP);
  const room = CHANNEL_CAP - focusRows.length;
  const others = sorted.filter((row) => !focusSet.has(row.rowId)).slice(0, Math.max(0, room));
  return [...focusRows, ...others].sort((left, right) => right.activeAt - left.activeAt || String(left.rowId).localeCompare(String(right.rowId)));
}
