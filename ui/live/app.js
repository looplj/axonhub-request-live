import {
  buildStage,
  channelStatusText,
  clientLabel,
  currentRowId,
  formatLatency,
  formatTime,
  isChinese,
  rowMotion,
  statusLine,
} from "./format.js";
import { iconSvg } from "./icons.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const KEY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="8.5" cy="9" r="3.25" stroke="currentColor" stroke-width="1.5"/><path d="M11.2 11.2 19 19M15.5 16.2h3.2V19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const HUB_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
// Where a waiting dot rests: on the wire, just short of the node it waits at.
const HOLD_GAP = 11;
const LIVE_MS = 15 * 60 * 1000;
const OUT_MS = 1100;
const BACK_MS = 1100;
const SWITCH_MS = 480;

const COPY = {
  zh: {
    title: "实时请求",
    filter: "客户端",
    allClients: "全部客户端",
    live: "近 15 分钟",
    today: "今天",
    loading: "正在读取…",
    updated: (time) => `更新于 ${time}`,
    emptyLive: "这 15 分钟里还没有请求。",
    emptyToday: "今天还没有请求。",
    emptyFilter: "这个客户端在当前窗口里没有请求。",
    requests: "请求",
    inFlight: "进行中",
    failed: "失败",
    noKey: "无密钥",
    unassigned: "未关联",
    time: "时间",
    client: "客户端",
    apiKey: "API 密钥",
    model: "模型",
    status: "状态",
    channel: "渠道",
    latency: "耗时",
    colClient: "客户端",
    colKey: "API 密钥",
    colChannel: "渠道",
    requestsN: (count) => `${count} 个请求`,
    statusPending: "等待中",
    statusProcessing: "处理中",
    statusCompleted: "已完成",
    statusFailed: "失败",
    statusCanceled: "已取消",
    keyEnabled: "启用",
    keyDisabled: "停用",
    keyArchived: "已归档",
    channelHint: "未授予 read_channels，渠道只显示 ID。",
    logTitle: "最近请求",
    pinHint: "点击一行固定查看",
    pinnedHint: "已固定，再次点击取消",
    tagPinned: "已固定",
    tagLive: "进行中",
    tagLatest: "最新",
    hubIdle: "空闲",
    hubBusy: (count) => `${count} 进行中`,
    requestFailed: (message) => (message ? `请求失败：${message}` : "请求失败。"),
    loadFailed: "请求列表没有加载。",
    bridgeMissing: "AxonHub bridge 没有加载。",
  },
  en: {
    title: "Live requests",
    filter: "Client",
    allClients: "All clients",
    live: "Last 15 min",
    today: "Today",
    loading: "Loading…",
    updated: (time) => `Updated ${time}`,
    emptyLive: "No requests in the last 15 minutes.",
    emptyToday: "No requests yet today.",
    emptyFilter: "No requests for this client in the current window.",
    requests: "Requests",
    inFlight: "In flight",
    failed: "Failed",
    noKey: "No API key",
    unassigned: "Unassigned",
    time: "Time",
    client: "Client",
    apiKey: "API key",
    model: "Model",
    status: "Status",
    channel: "Channel",
    latency: "Latency",
    colClient: "Client",
    colKey: "API key",
    colChannel: "Channels",
    requestsN: (count) => `${count} requests`,
    statusPending: "Waiting",
    statusProcessing: "Processing",
    statusCompleted: "Completed",
    statusFailed: "Failed",
    statusCanceled: "Canceled",
    keyEnabled: "Enabled",
    keyDisabled: "Disabled",
    keyArchived: "Archived",
    channelHint: "read_channels is not granted, so channel ids are shown.",
    logTitle: "Recent requests",
    pinHint: "Click a row to pin it",
    pinnedHint: "Pinned. Click it again to unpin",
    tagPinned: "Pinned",
    tagLive: "Live",
    tagLatest: "Latest",
    hubIdle: "Idle",
    hubBusy: (count) => `${count} in flight`,
    requestFailed: (message) => (message ? `Request failed: ${message}` : "Request failed."),
    loadFailed: "The request list could not be loaded.",
    bridgeMissing: "AxonHub bridge did not load.",
  },
};

const LIST_FIELDS = `id createdAt updatedAt status modelID stream source userAgent metricsLatencyMs metricsFirstTokenLatencyMs apiKey { id name status type }`;

const titleEl = document.querySelector("#title");
const filterLabel = document.querySelector("#filter-label");
const filterEl = document.querySelector("#client-filter");
const toggleEl = document.querySelector("#window-toggle");
const updatedEl = document.querySelector("#updated");
const hintEl = document.querySelector("#hint");
const statusEl = document.querySelector("#status");
const stageScroll = document.querySelector("#stage-scroll");
const stage = document.querySelector("#stage");
const wires = document.querySelector("#wires");
const dots = document.querySelector("#dots");
const tickEl = document.querySelector("#tick");
const summaryEl = document.querySelector("#summary");
const focusBar = document.querySelector("#focus-bar");
const focusTag = document.querySelector("#focus-tag");
const countsEl = document.querySelector("#counts");
const logPanel = document.querySelector("#log-panel");
const logTitle = document.querySelector("#log-title");
const logHint = document.querySelector("#log-hint");
const logWrap = document.querySelector("#log-wrap");
const emptyEl = document.querySelector("#empty");
const emptyText = document.querySelector("#empty-text");
const colClients = document.querySelector("#col-clients");
const colKeys = document.querySelector("#col-keys");
const colHub = document.querySelector("#col-hub");
const colChannels = document.querySelector("#col-channels");

const liveButton = document.createElement("button");
const todayButton = document.createElement("button");
liveButton.type = "button";
todayButton.type = "button";
liveButton.dataset.mode = "live";
todayButton.dataset.mode = "today";
toggleEl.append(liveButton, todayButton);

let locale = document.documentElement.lang || "en";
let text = copy(locale);
let mode = "live";
let clientFilter = "all";
let pinned = false;
let pinId = "";
let namesDenied = false;
let latestRequests = [];
let fetchedAt = null;
let hasInFlight = false;
let loadedOnce = false;
let primed = false;
let prevSnap = null;
let timer = 0;
let fetching = false;
let queued = false;
let generation = 0;
let playToken = 0;
let rafId = 0;
let flying = false;
let hold = null;
let paintedFocus = "";
let filterKey = "";
let barFocus = "";
let seenRows = null;
const flashes = new Map();
let stopTheme = () => {};

applyStaticCopy();
wireControls();

const bridge = window.axonhub;
if (!bridge || typeof bridge.ready !== "function") {
  statusEl.hidden = false;
  statusEl.textContent = text.bridgeMissing;
} else {
  const onPageHide = () => {
    stopTheme();
    clearTimeout(timer);
    cancelAnimationFrame(rafId);
  };
  window.addEventListener("pagehide", onPageHide, { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(timer);
      timer = 0;
      return;
    }
    poll();
  });
  window.addEventListener("resize", () => {
    if (loadedOnce) render({ loaded: true });
  });
  start().catch(showError);
}

function copy(nextLocale) {
  return isChinese(nextLocale) ? COPY.zh : COPY.en;
}

function applyStaticCopy() {
  text = copy(locale);
  filterKey = "";
  document.title = text.title;
  titleEl.textContent = text.title;
  logTitle.textContent = text.logTitle;
  filterLabel.textContent = text.filter;
  liveButton.textContent = text.live;
  todayButton.textContent = text.today;
  toggleEl.setAttribute("aria-label", `${text.live} / ${text.today}`);
  paintToggle();
  if (!fetchedAt) updatedEl.textContent = text.loading;
  if (!hintEl.hidden) hintEl.textContent = text.channelHint;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme && theme.theme ? theme.theme : "light";
}

async function start() {
  const init = await bridge.ready();
  locale = init.locale || "en";
  document.documentElement.lang = locale;
  applyTheme(init);
  stopTheme = bridge.onTheme(applyTheme);
  applyStaticCopy();
  poll();
}

function wireControls() {
  filterEl.addEventListener("change", () => {
    clientFilter = filterEl.value || "all";
    if (loadedOnce) render({ loaded: true });
  });
  toggleEl.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.dataset.mode === mode) return;
    mode = button.dataset.mode;
    paintToggle();
    if (loadedOnce) render({ loaded: true });
    poll();
  });
  logWrap.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (!row) return;
    const id = row.dataset.id;
    if (pinned && pinId === id) {
      pinned = false;
      pinId = "";
    } else {
      pinned = true;
      pinId = id;
    }
    render({ loaded: true });
  });
  logWrap.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest("tr[data-id]");
    if (!row) return;
    event.preventDefault();
    row.click();
  });
}

function paintToggle() {
  liveButton.setAttribute("aria-pressed", mode === "live" ? "true" : "false");
  todayButton.setAttribute("aria-pressed", mode === "today" ? "true" : "false");
}

function poll() {
  clearTimeout(timer);
  timer = 0;
  if (fetching) {
    queued = true;
    return;
  }
  fetching = true;
  const gen = ++generation;
  load(gen).catch((error) => {
    if (gen === generation) showError(error);
  }).finally(() => {
    fetching = false;
    if (queued) {
      queued = false;
      poll();
      return;
    }
    if (gen === generation) schedule();
  });
}

function schedule() {
  clearTimeout(timer);
  timer = 0;
  if (document.hidden) return;
  timer = setTimeout(poll, hasInFlight ? 2000 : 5000);
}

async function load(gen) {
  const now = new Date();
  const since = sinceFor(mode, now).toISOString();
  let list = await bridge.graphql(listQuery(!namesDenied), { since });
  if (gen !== generation) return;
  if (!namesDenied && channelSelectionForbidden(list && list.errors)) {
    namesDenied = true;
    list = await bridge.graphql(listQuery(false), { since });
    if (gen !== generation) return;
  }
  showHint(namesDenied);
  if (!list || !list.data || !list.data.requests) {
    showProblems((list && list.errors) || [], true);
    return;
  }
  let requests = nodesOf(list.data.requests).map(mapRequest).filter(Boolean);
  const preliminary = buildStage({
    requests,
    now,
    window: mode,
    focusId: pinId,
    pinned,
    clientFilter,
  });
  const ids = executionIds(requests, preliminary.focusId);
  let executionErrors = [];
  if (ids.length) {
    let result = await bridge.graphql(executionsQuery(ids, !namesDenied));
    if (gen !== generation) return;
    if (!namesDenied && channelSelectionForbidden(result && result.errors)) {
      namesDenied = true;
      showHint(true);
      result = await bridge.graphql(executionsQuery(ids, false));
      if (gen !== generation) return;
    }
    executionErrors = (result && result.errors) || [];
    requests = attachExecutions(requests, ids, (result && result.data) || {});
  }
  if (gen !== generation) return;
  showProblems([...(list.errors || []), ...executionErrors], false);
  latestRequests = requests;
  fetchedAt = now;
  hasInFlight = requests.some((item) => item.status === "pending" || item.status === "processing");
  render({ loaded: true });
  paintTick(true);
}

function listQuery(withChannel) {
  const channel = withChannel ? "channel { id name }" : "channelID";
  return `query LiveRequests($since: Time!) {
    requests(
      first: 40
      orderBy: { field: CREATED_AT, direction: DESC }
      where: { or: [ { statusIn: [pending, processing] }, { createdAtGTE: $since } ] }
    ) {
      edges { node { ${LIST_FIELDS} ${channel} } }
    }
  }`;
}

function executionsQuery(ids, withChannel) {
  const channel = withChannel ? "channel { id name }" : "channelID";
  const selection = `id createdAt status modelID responseStatusCode errorMessage metricsLatencyMs metricsFirstTokenLatencyMs channelAPIKeyIndex channelAPIKeySuffix ${channel}`;
  const fields = ids.map((id, index) => (
    `r${index}: node(id: ${gqlString(id)}) { ... on Request { id executions(first: 8, orderBy: { field: CREATED_AT, direction: ASC }) { edges { node { ${selection} } } } } }`
  ));
  return `query LiveExecutions { ${fields.join(" ")} }`;
}

function executionIds(requests, focusId) {
  const inflight = [];
  const seen = new Set();
  for (const item of requests) {
    if (item.status !== "pending" && item.status !== "processing") continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    inflight.push(item.id);
  }
  const ids = inflight.slice(0, 6);
  if (focusId && !ids.includes(focusId)) {
    if (ids.length < 6) ids.push(focusId);
    else ids[ids.length - 1] = focusId;
  }
  return ids.filter(Boolean);
}

function sinceFor(which, now) {
  if (which === "today") {
    const start = new Date(now.getTime());
    start.setHours(0, 0, 0, 0);
    return start;
  }
  return new Date(now.getTime() - LIVE_MS);
}

function gqlString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r")}"`;
}

function nodesOf(connection) {
  const edges = connection && Array.isArray(connection.edges) ? connection.edges : [];
  const nodes = [];
  for (const edge of edges) {
    if (edge && edge.node) nodes.push(edge.node);
  }
  return nodes;
}

function channelRef(node) {
  if (node && node.channel && node.channel.id) {
    return { id: node.channel.id, name: node.channel.name || node.channel.id };
  }
  if (node && node.channelID) return { id: node.channelID, name: node.channelID };
  return null;
}

function mapRequest(node) {
  if (!node || !node.id) return null;
  return {
    id: node.id,
    createdAt: node.createdAt,
    status: String(node.status || "").toLowerCase(),
    modelID: node.modelID || "",
    stream: Boolean(node.stream),
    source: node.source || "",
    userAgent: node.userAgent || "",
    metricsLatencyMs: node.metricsLatencyMs,
    metricsFirstTokenLatencyMs: node.metricsFirstTokenLatencyMs,
    apiKey: node.apiKey && node.apiKey.id ? {
      id: node.apiKey.id,
      name: node.apiKey.name || "",
      status: String(node.apiKey.status || "").toLowerCase(),
      type: node.apiKey.type || "",
    } : null,
    channel: channelRef(node),
  };
}

function mapExecution(node) {
  return {
    id: node.id,
    createdAt: node.createdAt,
    status: String(node.status || "").toLowerCase(),
    modelID: node.modelID || "",
    responseStatusCode: node.responseStatusCode,
    errorMessage: node.errorMessage || "",
    metricsLatencyMs: node.metricsLatencyMs,
    metricsFirstTokenLatencyMs: node.metricsFirstTokenLatencyMs,
    channelAPIKeyIndex: node.channelAPIKeyIndex,
    channelAPIKeySuffix: node.channelAPIKeySuffix || "",
    channel: channelRef(node),
  };
}

function attachExecutions(requests, ids, data) {
  const byId = new Map(requests.map((item) => [item.id, { ...item }]));
  ids.forEach((id, index) => {
    const node = data[`r${index}`];
    const current = byId.get(id);
    if (!current || !node) return;
    current.executions = nodesOf(node.executions).map(mapExecution);
  });
  return [...byId.values()];
}

function channelSelectionForbidden(errors) {
  if (!Array.isArray(errors)) return false;
  return errors.some((error) => {
    const message = String((error && error.message) || "").toLowerCase();
    const path = Array.isArray(error && error.path) ? error.path.map((part) => String(part).toLowerCase()) : [];
    const aboutChannel = path.includes("channel") || message.includes("channel") || message.includes("read_channels");
    const code = error && error.extensions && error.extensions.code;
    const forbidden = code === "FORBIDDEN" || message.includes("forbidden") || message.includes("permission") || message.includes("read_channels");
    return aboutChannel && forbidden;
  });
}

function showHint(denied) {
  hintEl.hidden = !denied;
  hintEl.textContent = denied ? text.channelHint : "";
}

function showProblems(errors, failed) {
  const messages = (errors || [])
    .filter((error) => error && !channelSelectionForbidden([error]))
    .map((error) => error.message)
    .filter(Boolean);
  if (!messages.length) {
    statusEl.textContent = failed ? text.loadFailed : "";
    statusEl.hidden = !failed;
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = messages.join(" ");
}

function showError(error) {
  paintTick(false);
  const message = error && error.message ? error.message : "";
  statusEl.hidden = false;
  statusEl.textContent = text.requestFailed(message);
}

function render(options) {
  const now = fetchedAt || new Date();
  const view = buildStage({
    requests: latestRequests,
    now,
    window: mode,
    focusId: pinId,
    pinned,
    clientFilter,
  });
  if (pinned && view.focusId !== pinId) {
    pinned = false;
    pinId = "";
  }
  let event = null;
  if (options && options.loaded) {
    loadedOnce = true;
    event = takeMotion(latestRequests, view);
  }
  if (event && event.type === "switch") flashes.set(event.fromRow, Date.now() + 1600);
  paintChrome(view);
  paintStage(view, event);
  paintLog(view);
}

function paintChrome(view) {
  fillFilter(view.availableClients);
  updatedEl.textContent = fetchedAt ? text.updated(formatTime(fetchedAt, locale)) : text.loading;
  const empty = view.counts.requests === 0;
  emptyEl.hidden = !empty;
  emptyText.textContent = view.windowCount === 0
    ? (mode === "today" ? text.emptyToday : text.emptyLive)
    : text.emptyFilter;
  paintStats(view, empty);
  paintFocusBar(view, empty);
  logPanel.hidden = empty;
  logHint.textContent = pinned ? text.pinnedHint : text.pinHint;
}

function paintStats(view, empty) {
  countsEl.hidden = empty;
  if (empty) return;
  countsEl.replaceChildren(
    stat(text.requests, view.counts.requests, ""),
    stat(text.inFlight, view.counts.inFlight, view.counts.inFlight ? "busy" : ""),
    stat(text.failed, view.counts.failed, view.counts.failed ? "bad" : ""),
  );
}

function stat(label, value, state) {
  const tile = document.createElement("div");
  tile.className = state ? `stat ${state}` : "stat";
  const head = document.createElement("span");
  head.className = "stat-label";
  const dot = document.createElement("span");
  dot.className = "tick";
  head.append(dot, label);
  const number = document.createElement("span");
  number.className = "stat-value";
  number.textContent = String(value);
  tile.append(head, number);
  return tile;
}

function paintFocusBar(view, empty) {
  const focus = view.focus;
  focusBar.hidden = empty || !focus;
  if (focusBar.hidden) {
    barFocus = "";
    return;
  }
  focusBar.style.setProperty("--client", focus.hue);
  const live = focus.status === "pending" || focus.status === "processing";
  focusTag.textContent = pinned ? text.tagPinned : (live ? text.tagLive : text.tagLatest);
  const line = statusLine(view, locale).replace(/[。.]$/, "");
  summaryEl.textContent = line;
  summaryEl.title = line;
  if (focus.id !== barFocus) {
    barFocus = focus.id;
    restartAnimation(focusBar, "in");
  }
}

function paintTick(ok) {
  tickEl.classList.toggle("on", ok);
  tickEl.classList.toggle("busy", ok && hasInFlight);
}

function fillFilter(clients) {
  const current = clientFilter;
  const nextKey = ["all", ...clients.map((client) => `${client.id}\t${clientLabel(client, locale)}`)].join("\n");
  if (nextKey === filterKey && [...filterEl.options].some((option) => option.value === current)) return;
  filterKey = nextKey;
  filterEl.replaceChildren();
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = text.allClients;
  filterEl.append(all);
  for (const client of clients) {
    const option = document.createElement("option");
    option.value = client.id;
    option.textContent = clientLabel(client, locale);
    filterEl.append(option);
  }
  if (current !== "all" && ![...filterEl.options].some((option) => option.value === current)) {
    const extra = document.createElement("option");
    extra.value = current;
    extra.textContent = current;
    filterEl.append(extra);
  }
  filterEl.value = current;
}

function paintStage(view, event) {
  const empty = view.counts.requests === 0;
  stage.hidden = empty;
  stageScroll.hidden = empty;
  if (empty) {
    paintedFocus = "";
    playToken += 1;
    cancelAnimationFrame(rafId);
    flying = false;
    hold = null;
    clearDots();
    wires.replaceChildren();
    return;
  }
  drawColumns(view);
  drawWires(view);
  const focusChanged = (view.focusId || "") !== paintedFocus;
  paintedFocus = view.focusId || "";
  if (event) play(event, view);
  else {
    if (focusChanged && flying) stopFlight();
    if (!flying) syncHold(view);
  }
}

function drawColumns(view) {
  colClients.replaceChildren(columnLabel(text.colClient, view.clients.length));
  for (const client of view.clients) colClients.append(clientCard(client, view));
  colKeys.replaceChildren(columnLabel(text.colKey, view.keys.length));
  for (const key of view.keys) colKeys.append(keyCard(key, view));
  colHub.replaceChildren(columnLabel(""), hubCard(view));
  colChannels.replaceChildren(columnLabel(text.colChannel, view.channels.length));
  for (const row of view.channels) colChannels.append(channelCard(row, view));
}

function columnLabel(value, count) {
  const label = document.createElement("div");
  label.className = "col-label";
  label.textContent = value;
  if (count != null) {
    const badge = document.createElement("span");
    badge.className = "col-count";
    badge.textContent = String(count);
    label.append(badge);
  }
  return label;
}

function clientCard(client, view) {
  const card = document.createElement("article");
  card.className = "card client";
  card.dataset.node = client.nodeId;
  card.style.setProperty("--client", client.hue);
  if (view.focus && view.focus.clientId === client.id) card.classList.add("lit");
  const label = clientLabel(client, locale);
  card.title = label;
  card.append(iconEl(iconSvg(client.id)), cardText(label, client.latestModel || text.requestsN(client.requestCount), true));
  return card;
}

function keyCard(key, view) {
  const card = document.createElement("article");
  card.className = "card key";
  card.dataset.node = key.nodeId;
  if (view.focus && view.focus.keyId === key.id) {
    card.classList.add("lit");
    card.style.setProperty("--client", view.focus.hue);
  }
  const name = key.id === "none" ? text.noKey : (key.name || key.id);
  const subtitle = key.id === "none" ? text.unassigned : keyStatus(key.status);
  card.title = name;
  card.append(iconEl(KEY_ICON), cardText(name, subtitle, false));
  return card;
}

function hubCard(view) {
  const slot = document.createElement("div");
  slot.className = "hub-slot";
  const card = document.createElement("article");
  card.className = "card hub";
  card.dataset.node = "hub";
  const busy = view.counts.inFlight > 0;
  if (busy) card.classList.add("busy");
  const mark = document.createElement("span");
  mark.className = "hub-mark";
  mark.innerHTML = HUB_ICON;
  const name = document.createElement("span");
  name.className = "hub-name";
  name.textContent = "AxonHub";
  const state = document.createElement("span");
  state.className = "hub-state";
  state.textContent = busy ? text.hubBusy(view.counts.inFlight) : text.hubIdle;
  card.append(mark, name, state);
  slot.append(card);
  return slot;
}

function channelCard(row, view) {
  const card = document.createElement("article");
  card.className = `channel ${row.kind}`;
  if (flashing(row.rowId)) card.classList.add("flash-failed");
  card.dataset.node = row.nodeId;
  if (row.kind === "answering" && view.focus) card.style.setProperty("--client", view.focus.hue);
  const main = document.createElement("div");
  main.className = "channel-main";
  const title = document.createElement("div");
  title.className = "channel-title";
  const name = document.createElement("span");
  name.className = "channel-name";
  name.textContent = row.name;
  name.title = row.name;
  title.append(name);
  if (row.suffix) {
    const suffix = document.createElement("span");
    suffix.className = "suffix mono";
    suffix.textContent = row.suffix;
    title.append(suffix);
  }
  main.append(title);
  if (row.modelID) {
    const model = document.createElement("div");
    model.className = "channel-model mono";
    model.textContent = row.modelID;
    main.append(model);
  }
  if (row.kind === "failed" && row.errorMessage) {
    const error = document.createElement("div");
    error.className = "channel-error";
    error.textContent = row.errorMessage;
    error.title = row.errorMessage;
    main.append(error);
  }
  const status = badge(row.kind, channelStatusText(row.kind, locale, {
    latencyMs: row.latencyMs,
    code: row.responseStatusCode,
  }));
  status.title = channelStatusText(row.kind, locale, {
    latencyMs: row.latencyMs,
    code: row.responseStatusCode,
    message: row.errorMessage,
  });
  card.append(main, status);
  return card;
}

function badge(kind, label) {
  const el = document.createElement("span");
  el.className = `badge ${kind}`;
  el.textContent = label;
  return el;
}

function iconEl(svg) {
  const icon = document.createElement("span");
  icon.className = "icon";
  icon.innerHTML = svg;
  return icon;
}

function cardText(name, sub, monoSub) {
  const box = document.createElement("div");
  box.className = "card-text";
  const title = document.createElement("div");
  title.className = "node-name";
  title.textContent = name;
  const line = document.createElement("div");
  line.className = monoSub ? "sub mono" : "sub";
  line.textContent = sub;
  line.title = sub;
  box.append(title, line);
  return box;
}

function keyStatus(status) {
  if (status === "enabled") return text.keyEnabled;
  if (status === "disabled") return text.keyDisabled;
  if (status === "archived") return text.keyArchived;
  return status || "—";
}

function requestStatus(status) {
  if (status === "pending") return text.statusPending;
  if (status === "processing") return text.statusProcessing;
  if (status === "completed") return text.statusCompleted;
  if (status === "failed") return text.statusFailed;
  if (status === "canceled") return text.statusCanceled;
  return status || "";
}

function flashing(rowId) {
  const until = flashes.get(rowId);
  if (!until) return false;
  if (Date.now() > until) {
    flashes.delete(rowId);
    return false;
  }
  return true;
}

function paintLog(view) {
  const scroll = logWrap.scrollTop;
  logWrap.replaceChildren();
  if (!view.counts.requests) return;
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  const headings = [text.time, text.client, text.apiKey, text.model, text.status, text.channel, text.latency];
  headings.forEach((heading, index) => {
    const cell = document.createElement("th");
    cell.textContent = heading;
    if (index === headings.length - 1) cell.className = "num";
    headRow.append(cell);
  });
  head.append(headRow);
  const body = document.createElement("tbody");
  const seen = new Set();
  for (const row of view.log) {
    seen.add(row.id);
    const tr = document.createElement("tr");
    tr.dataset.id = row.id;
    tr.tabIndex = 0;
    tr.style.setProperty("--client", row.client.hue);
    if (pinned && pinId === row.id) {
      tr.classList.add("pinned");
      tr.setAttribute("aria-current", "true");
    }
    if (seenRows && !seenRows.has(row.id)) tr.classList.add("fresh");
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = clientLabel(row.client, locale);
    tr.append(
      cell(formatTime(row.createdAt, locale), "time mono"),
      cell(who),
      cell(row.apiKeyName || text.noKey, row.apiKeyName ? "" : "muted"),
      cell(row.modelID, "model mono"),
      cell(badge(row.status, requestStatus(row.status))),
      cell(row.channelName || "—", row.channelName ? "" : "muted"),
      cell(row.latencyMs == null ? "—" : formatLatency(row.latencyMs), "num mono"),
    );
    body.append(tr);
  }
  seenRows = seen;
  table.append(head, body);
  logWrap.append(table);
  logWrap.scrollTop = scroll;
}

function cell(content, className) {
  const td = document.createElement("td");
  if (className) td.className = className;
  if (typeof content === "string") td.textContent = content;
  else td.append(content);
  return td;
}

function restartAnimation(el, className) {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

function takeMotion(requests, view) {
  const snap = new Map();
  for (const item of requests) {
    snap.set(item.id, {
      status: String(item.status || "").toLowerCase(),
      rowId: currentRowId(item),
    });
  }
  if (!primed) {
    primed = true;
    prevSnap = snap;
    return firstEvent(view);
  }
  const previous = prevSnap;
  prevSnap = snap;
  return diffEvent(previous, snap, view);
}

function firstEvent(view) {
  if (!view.focus) return null;
  if (view.focus.status === "pending" || view.focus.status === "processing") return { type: "out" };
  return null;
}

function diffEvent(previous, snap, view) {
  const focus = view.focus;
  if (!focus) return null;
  const next = snap.get(focus.id);
  if (!next) return null;
  const prev = previous && previous.get(focus.id);
  const live = next.status === "pending" || next.status === "processing";
  if (!prev) return live ? { type: "out" } : null;
  const was = prev.status === "pending" || prev.status === "processing";
  if (!was && live) return { type: "out" };
  const motion = rowMotion(prev.rowId, next.rowId);
  if (was && live && motion === "switch") {
    return { type: "switch", fromRow: prev.rowId, toRow: next.rowId };
  }
  if (was && live && motion === "assign") return { type: "assign", toRow: next.rowId };
  if (was && next.status === "completed") return { type: "back", style: "hollow", fromRow: prev.rowId };
  if (was && (next.status === "failed" || next.status === "canceled")) {
    return { type: "back", style: "red", fromRow: prev.rowId };
  }
  return null;
}

function play(event, view) {
  playToken += 1;
  const token = playToken;
  cancelAnimationFrame(rafId);
  const hue = view.focus ? view.focus.hue : "#64748b";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    flying = false;
    clearDots();
    hold = event.type === "back" ? null : { nodeId: destinationId(event, view), hue };
    return;
  }
  if (event.type === "out") {
    runPath(outIds(view), { token, kind: "filled", hue, duration: OUT_MS, hold: true });
    return;
  }
  if (event.type === "assign") {
    runPath(["hub", `channel:${event.toRow}`], { token, kind: "filled", hue, duration: SWITCH_MS, hold: true });
    return;
  }
  if (event.type === "back") {
    hold = null;
    runPath(backIds(view, event.fromRow), {
      token,
      kind: event.style === "hollow" ? "hollow" : "red",
      hue,
      duration: BACK_MS,
      hold: false,
    });
    return;
  }
  runPath([`channel:${event.fromRow}`, "hub"], {
    token,
    kind: "red",
    hue,
    duration: SWITCH_MS,
    hold: false,
    then() {
      if (token !== playToken) return;
      runPath(["hub", `channel:${event.toRow}`], { token, kind: "filled", hue, duration: SWITCH_MS, hold: true });
    },
  });
}

function stopFlight() {
  playToken += 1;
  cancelAnimationFrame(rafId);
  flying = false;
  clearDots();
}

function destinationId(event, view) {
  if (event.type === "switch" || event.type === "assign") return `channel:${event.toRow}`;
  if (view.focus && view.focus.rowId) return `channel:${view.focus.rowId}`;
  return "hub";
}

function outIds(view) {
  const focus = view.focus;
  const ids = [`client:${focus.clientId}`, `key:${focus.keyId}`, "hub"];
  if (focus.rowId) ids.push(`channel:${focus.rowId}`);
  return ids;
}

function backIds(view, fromRow) {
  const focus = view.focus;
  const ids = [];
  const channel = fromRow || focus.rowId;
  if (channel) ids.push(`channel:${channel}`);
  ids.push("hub", `key:${focus.keyId}`, `client:${focus.clientId}`);
  return ids;
}

function runPath(ids, options) {
  const nodes = nodesFrom(ids);
  clearDots();
  if (nodes.length < 2) {
    flying = false;
    if (options.hold && nodes[0]) {
      hold = { nodeId: nodes[0].nodeId, hue: options.hue };
      placeHold();
    }
    if (options.then) options.then();
    return;
  }
  const route = routeThrough(nodes, options.hold);
  flying = true;
  const dot = makeDot(options.kind, options.hue);
  dot.setAttribute("cx", String(route.points[0][0]));
  dot.setAttribute("cy", String(route.points[0][1]));
  dots.append(dot);
  const started = performance.now();
  let reached = 0;
  const step = (now) => {
    if (options.token !== playToken) {
      dot.remove();
      return;
    }
    // A frame timestamp can be earlier than performance.now() from when this
    // flight was scheduled. Negative elapsed used to compute index -1.
    const elapsed = Number.isFinite(now) ? Math.max(0, now - started) : 0;
    const duration = options.duration > 0 ? options.duration : 1;
    const progress = Math.min(1, elapsed / duration);
    const at = easeInOut(progress) * route.length;
    const [x, y] = pointAlong(route, at);
    dot.setAttribute("cx", String(x));
    dot.setAttribute("cy", String(y));
    while (reached < route.marks.length && at >= route.marks[reached].at - 1e-6) {
      pulse(route.marks[reached].el);
      reached += 1;
    }
    if (progress < 1) {
      rafId = requestAnimationFrame(step);
      return;
    }
    for (; reached < route.marks.length; reached += 1) pulse(route.marks[reached].el);
    flying = false;
    if (options.hold) {
      hold = { nodeId: nodes[nodes.length - 1].nodeId, fromId: nodes[nodes.length - 2].nodeId, hue: options.hue };
      dot.classList.add("dot-hold");
    } else {
      dot.remove();
    }
    if (options.then) options.then();
  };
  rafId = requestAnimationFrame(step);
}

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// routeThrough lays the way a dot flies, as magpie's routing stage does: out
// of the first node's side, along each wire, over each node it passes on a
// gentle arc, and into the last one — or, when it will wait there, to rest on
// the wire just short of it.
function routeThrough(nodes, resting) {
  const points = [];
  const marks = [];
  const lengths = [0];
  const push = (point) => {
    const last = points[points.length - 1];
    if (last) lengths.push(lengths[lengths.length - 1] + Math.hypot(point[0] - last[0], point[1] - last[1]));
    points.push(point);
  };
  const sample = (p0, p1, p2, p3, skipFirst) => {
    for (let index = skipFirst ? 1 : 0; index <= 24; index += 1) push(cubicAt(p0, p1, p2, p3, index / 24));
  };
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const from = nodes[index];
    const to = nodes[index + 1];
    const forward = to.cx >= from.cx;
    const start = [forward ? from.right : from.left, from.cy];
    const end = [forward ? to.left : to.right, to.cy];
    if (index > 0) {
      const enter = points[points.length - 1];
      const span = start[0] - enter[0];
      const bow = Math.min(14, Math.abs(span) * 0.12);
      sample(enter, [enter[0] + span * 0.38, enter[1] - bow], [start[0] - span * 0.38, start[1] - bow], start, true);
    }
    const [c1, c2] = wireBends(start, end);
    sample(start, c1, c2, end, index > 0);
    marks.push({ at: lengths[lengths.length - 1], el: to.el });
  }
  // A dot that will wait stops HOLD_GAP short along the wire itself, so it
  // rests on the curve rather than beside it.
  const total = lengths[lengths.length - 1];
  return { points, lengths, marks, length: resting ? Math.max(0, total - HOLD_GAP) : total };
}

function cubicAt(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

function pointAlong(route, at) {
  const { points, lengths } = route;
  if (at <= 0) return points[0];
  let low = 0;
  let high = lengths.length - 1;
  if (at >= lengths[high]) return points[high];
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (lengths[mid] <= at) low = mid;
    else high = mid;
  }
  const span = lengths[high] - lengths[low] || 1;
  const local = (at - lengths[low]) / span;
  return [
    points[low][0] + (points[high][0] - points[low][0]) * local,
    points[low][1] + (points[high][1] - points[low][1]) * local,
  ];
}

// A wire is an S from one node's side to the next's, its bends halfway.
function wireBends(start, end) {
  const mid = (start[0] + end[0]) / 2;
  return [[mid, start[1]], [mid, end[1]]];
}

function syncHold(view) {
  if (flying) return;
  const focus = view.focus;
  const live = focus && (focus.status === "pending" || focus.status === "processing");
  if (!live || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    hold = null;
    clearDots();
    return;
  }
  hold = focus.rowId
    ? { nodeId: `channel:${focus.rowId}`, fromId: "hub", hue: focus.hue }
    : { nodeId: "hub", fromId: `key:${focus.keyId}`, hue: focus.hue };
  placeHold();
}

function placeHold() {
  if (!hold || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const nodes = nodesFrom(hold.fromId ? [hold.fromId, hold.nodeId] : [hold.nodeId]);
  clearDots();
  const to = nodes[nodes.length - 1];
  if (!to || to.nodeId !== hold.nodeId) return;
  let at = [to.left - HOLD_GAP, to.cy];
  if (nodes.length === 2) {
    const route = routeThrough(nodes, true);
    at = pointAlong(route, route.length);
  }
  const dot = makeDot("filled", hold.hue);
  dot.classList.add("dot-hold");
  dot.setAttribute("cx", String(at[0]));
  dot.setAttribute("cy", String(at[1]));
  dots.append(dot);
}

function nodesFrom(ids) {
  const origin = stage.getBoundingClientRect();
  const nodes = [];
  for (const id of ids) {
    const found = pointOf(id, origin);
    if (found) nodes.push({ ...found, nodeId: id });
  }
  return nodes;
}

function pointOf(nodeId, origin) {
  if (!nodeId) return null;
  let el = null;
  for (const node of stage.querySelectorAll("[data-node]")) {
    if (node.getAttribute("data-node") === nodeId) {
      el = node;
      break;
    }
  }
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    el,
    left: rect.left - origin.left,
    right: rect.right - origin.left,
    cx: rect.left - origin.left + rect.width / 2,
    cy: rect.top - origin.top + rect.height / 2,
  };
}

function drawWires(view) {
  const origin = stage.getBoundingClientRect();
  syncSvg(wires, origin);
  syncSvg(dots, origin);
  wires.replaceChildren();
  const live = view.focus && (view.focus.status === "pending" || view.focus.status === "processing");
  for (const wire of view.wires.faint) drawLine(wire.from, wire.to, origin, "wire-faint", "");
  if (view.focus) {
    for (const wire of view.wires.focus) {
      drawLine(wire.from, wire.to, origin, live ? "wire-focus wire-live" : "wire-focus", view.focus.hue);
    }
  }
}

function drawLine(fromId, toId, origin, className, hue) {
  const from = pointOf(fromId, origin);
  const to = pointOf(toId, origin);
  if (!from || !to) return;
  const start = [from.right, from.cy];
  const end = [to.left, to.cy];
  const [c1, c2] = wireBends(start, end);
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", `M${start[0]} ${start[1]} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${end[0]} ${end[1]}`);
  path.setAttribute("class", className);
  if (hue) path.setAttribute("stroke", hue);
  wires.append(path);
}

function syncSvg(svg, rect) {
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
}

function makeDot(kind, hue) {
  const dot = document.createElementNS(SVG_NS, "circle");
  dot.setAttribute("class", "flight");
  dot.setAttribute("r", kind === "filled" ? "5" : "4.5");
  const glow = kind === "red" ? "var(--destructive, #b42318)" : (hue || "currentColor");
  dot.style.setProperty("--glow", `color-mix(in srgb, ${glow} 60%, transparent)`);
  if (kind === "filled") {
    dot.setAttribute("fill", hue || "currentColor");
    return dot;
  }
  dot.setAttribute("fill", "var(--card, #ffffff)");
  dot.setAttribute("stroke-width", "2.25");
  dot.setAttribute("stroke", kind === "hollow" ? (hue || "currentColor") : "var(--destructive, #b42318)");
  return dot;
}

function pulse(el) {
  if (el) restartAnimation(el, "arrive");
}

function clearDots() {
  dots.replaceChildren();
}
