// Spring-Monitro admin UI — Vue 3 + VueRouter via CDN, no build step.
const { createApp, ref, computed, onMounted, onUnmounted, watch } = Vue;
const { createRouter, createWebHashHistory, useRoute } = VueRouter;

// ── API client ────────────────────────────────────────────────────────────────

const BASE = 'api';

async function apiFetch(path) {
  const resp = await fetch(`${BASE}/${path}`, { credentials: 'include' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

async function apiPost(path, body) {
  const resp = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function statusBadgeClass(status) {
  if (!status) return 'badge-unknown';
  const s = status.toUpperCase();
  if (s === 'UP') return 'badge-up';
  if (s === 'DOWN') return 'badge-down';
  if (s === 'OUT_OF_SERVICE') return 'badge-down';
  if (s === 'WARN' || s === 'WARNING') return 'badge-warn';
  return 'badge-unknown';
}

function dotClass(status) {
  if (!status) return 'dot-unknown';
  const s = status.toUpperCase();
  if (s === 'UP') return 'dot-up';
  if (s === 'DOWN' || s === 'OUT_OF_SERVICE') return 'dot-down';
  if (s === 'WARN') return 'dot-warn';
  return 'dot-unknown';
}

function fmtBytes(bytes) {
  if (bytes == null) return '—';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function fmtUptime(ms) {
  if (ms == null || ms === '') return '—';
  if (typeof ms === 'string') return ms;
  const numeric = Number(ms);
  if (!Number.isFinite(numeric) || numeric <= 0) return '—';
  const s = Math.floor(numeric / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
        m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function fmtPercent(v, digits = 1) {
  if (v == null) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

function fmtInteger(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toString();
}

function ratioPercent(part, whole) {
  const p = Number(part);
  const w = Number(whole);
  if (!Number.isFinite(p) || !Number.isFinite(w) || w <= 0) return null;
  return (p / w) * 100;
}

function statusToneClass(status) {
  if (!status) return 'tone-unknown';
  const s = status.toUpperCase();
  if (s === 'UP') return 'tone-up';
  if (s === 'DOWN' || s === 'OUT_OF_SERVICE') return 'tone-down';
  if (s === 'WARN' || s === 'WARNING') return 'tone-warn';
  return 'tone-unknown';
}

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// ── Dashboard realtime constants ──────────────────────────────────────────────

const DEFAULT_REFRESH_MS = 2000;
const CHART_WINDOW = 45;
const STATIC_POLL_EVERY = 6;
const THEME_STORAGE_KEY = 'monitro-theme';

function pushWindow(arr, val) {
  arr.push(val);
  if (arr.length > CHART_WINDOW) arr.shift();
}

function chartTheme() {
  return {
    axis:       cssVar('--chart-axis',  '#8ba3cb'),
    grid:       cssVar('--chart-grid',  'rgba(139,163,203,0.18)'),
    tooltip:    cssVar('--tooltip-bg',  '#0d1323'),
    gaugeTrack: cssVar('--gauge-track', 'rgba(139,163,203,0.2)'),
  };
}

// ── Thread Dump helpers ───────────────────────────────────────────────────────

const TD_STATES = ['RUNNABLE','BLOCKED','WAITING','TIMED_WAITING','NEW','TERMINATED'];
const TD_STATE_COLORS = {
  RUNNABLE: '#31d28f', BLOCKED: '#ff6c79', WAITING: '#f7bf57',
  TIMED_WAITING: '#a2b5d6', NEW: '#56d0ff', TERMINATED: '#555e7a',
};
const TD_POOL_PATTERNS = [
  [/http-nio/i,'http-nio'],[/HikariPool/i,'HikariPool'],[/ForkJoinPool/i,'ForkJoinPool'],
  [/kafka/i,'kafka'],[/reactor-http/i,'reactor-http'],[/grpc/i,'grpc'],
  [/lettuce/i,'lettuce'],[/scheduler/i,'scheduler'],[/executor/i,'executor'],
  [/worker/i,'worker'],[/RMI/,'RMI'],[/GC/,'GC'],
];
const TD_SNAP_MAX = 60;
const TD_TREND_WIN = 40;

function tdPool(name) {
  for (const [re, label] of TD_POOL_PATTERNS) if (re.test(name)) return label;
  return 'other';
}
function tdSig(stack) { return stack.slice(0, 3).join('|'); }
function tdIsApp(frame) { return /com\.(spring|example)|io\.github/i.test(frame); }

function tdNormalize(raw, ts) {
  return {
    threadId: raw.threadId,
    threadName: raw.threadName,
    state: raw.threadState || 'UNKNOWN',
    daemon: !!raw.daemon,
    priority: raw.priority ?? 5,
    stack: raw.stackTrace || [],
    lockName: raw.lockName || null,
    lockOwnerId: raw.lockOwnerId ?? -1,
    lockOwnerName: raw.lockOwnerName || null,
    blockedCount: raw.blockedCount || 0,
    waitedCount: raw.waitedCount || 0,
    pool: tdPool(raw.threadName),
    sig: tdSig(raw.stackTrace || []),
    seenAt: ts,
    suspicion: { score: 0, severity: 'none', reasons: [] },
  };
}

function tdScore(thread, prevSnaps) {
  let score = 0;
  const reasons = [];
  if (thread.state === 'BLOCKED') { score += 40; reasons.push('BLOCKED'); }
  else if (thread.state === 'WAITING') score += 3;
  else if (thread.state === 'TIMED_WAITING') score += 2;
  if (thread.stack.length > 25) { score += 8; reasons.push('deep stack'); }
  if (thread.lockName) { score += 15; reasons.push('lock contention'); }
  if (/http|request|worker|servlet|dispatcher/i.test(thread.threadName) && thread.state !== 'RUNNABLE') {
    score += 15; reasons.push('request worker stuck');
  }
  let unch = 0;
  for (const s of prevSnaps) {
    const p = s.threadMap && s.threadMap.get(thread.threadId);
    if (p && p.sig === thread.sig && p.state === thread.state) unch++;
    else break;
  }
  if (unch >= 10) { score += 35; reasons.push(`stuck ${unch} polls`); }
  else if (unch >= 5) { score += 20; reasons.push(`stuck ${unch} polls`); }
  else if (unch >= 3) { score += 10; reasons.push(`stuck ${unch} polls`); }
  const severity = score >= 70 ? 'critical' : score >= 40 ? 'high' : score >= 20 ? 'medium' : score > 0 ? 'low' : 'none';
  return { score, severity, reasons };
}

function tdDeadlocks(threads) {
  const byId = new Map(threads.map(t => [t.threadId, t]));
  const deadlocks = [], visited = new Set();
  for (const start of threads) {
    if (start.state !== 'BLOCKED' || start.lockOwnerId <= 0 || visited.has(start.threadId)) continue;
    const chain = [], inChain = new Set();
    let cur = start;
    while (cur && cur.state === 'BLOCKED' && cur.lockOwnerId > 0) {
      if (inChain.has(cur.threadId)) {
        const idx = chain.findIndex(c => c.threadId === cur.threadId);
        const cycle = chain.slice(idx);
        deadlocks.push(cycle);
        cycle.forEach(c => visited.add(c.threadId));
        break;
      }
      inChain.add(cur.threadId); chain.push(cur);
      cur = byId.get(cur.lockOwnerId);
    }
  }
  return deadlocks;
}

function tdBlockedChains(threads) {
  const byId = new Map(threads.map(t => [t.threadId, t]));
  return threads
    .filter(t => t.state === 'BLOCKED' && t.lockOwnerId > 0)
    .map(t => {
      const chain = [t], seen = new Set([t.threadId]);
      let owner = byId.get(t.lockOwnerId);
      while (owner && !seen.has(owner.threadId)) {
        chain.push(owner); seen.add(owner.threadId);
        owner = (owner.state === 'BLOCKED' && owner.lockOwnerId > 0) ? byId.get(owner.lockOwnerId) : null;
      }
      return chain;
    })
    .filter(c => c.length > 1);
}

function tdPools(threads) {
  const groups = {};
  for (const t of threads) {
    const g = groups[t.pool] || (groups[t.pool] = { total:0, states:{}, suspicious:0, stacks:{} });
    g.total++;
    g.states[t.state] = (g.states[t.state] || 0) + 1;
    if (t.suspicion.severity !== 'none') g.suspicious++;
    if (t.sig) g.stacks[t.sig] = (g.stacks[t.sig] || 0) + 1;
  }
  for (const g of Object.values(groups)) {
    const top = Object.entries(g.stacks).sort((a,b) => b[1]-a[1])[0];
    g.topStack = top ? top[0].split('|')[0] : null;
    delete g.stacks;
  }
  return groups;
}

// ── Dashboard page ────────────────────────────────────────────────────────────

const DashboardPage = {
  template: `
    <div class="dashboard-page">
      <section class="card dashboard-head">
        <div>
          <div class="page-title" style="margin-bottom:6px">System Dashboard</div>
          <div class="dashboard-subtitle">{{ appLabel }}</div>
        </div>
        <div class="dashboard-actions">
          <span class="live-indicator" :class="{ active: refreshing }">{{ autoRefresh ? 'live' : 'paused' }}</span>
          <button class="btn" @click="refreshNow" :disabled="refreshing">Refresh now</button>
          <button class="btn" @click="toggleAutoRefresh">{{ autoRefresh ? 'Pause' : 'Resume' }}</button>
          <label class="control-inline">
            Interval
            <select v-model.number="refreshMs">
              <option :value="1000">1s</option>
              <option :value="2000">2s</option>
              <option :value="5000">5s</option>
              <option :value="10000">10s</option>
            </select>
          </label>
          <span class="refresh-meta">{{ lastUpdatedText }}</span>
        </div>
      </section>

      <div v-if="loading" class="loading">Loading…</div>
      <template v-else>
        <div v-if="loadError" class="error-msg">{{ loadError }}</div>

        <section class="overview-grid">
          <div class="quick-card">
            <div class="stat-label">Health</div>
            <div class="metric-value"><span class="badge" :class="statusBadgeClass(health?.status)">{{ health?.status || 'UNKNOWN' }}</span></div>
            <div class="stat-sub">{{ healthComponents.length }} components</div>
          </div>
          <div class="quick-card">
            <div class="stat-label">Uptime</div>
            <div class="metric-value">{{ fmtUptime(info?.uptime) }}</div>
            <div class="stat-sub">Started {{ startedAt }}</div>
          </div>
          <div class="quick-card">
            <div class="stat-label">Heap Used</div>
            <div class="metric-value">{{ fmtBytes(latestSnap?.heapUsed) }}</div>
            <div class="stat-sub">{{ heapUsedPercentText }} of {{ fmtBytes(latestSnap?.heapMax) }}</div>
          </div>
          <div class="quick-card">
            <div class="stat-label">CPU</div>
            <div class="metric-value">{{ fmtPercent(latestSnap?.cpuProcess) }}</div>
            <div class="stat-sub">System {{ fmtPercent(latestSnap?.cpuSystem) }}</div>
          </div>
          <div class="quick-card">
            <div class="stat-label">Threads</div>
            <div class="metric-value">{{ fmtInteger(latestSnap?.threadsLive) }}</div>
            <div class="stat-sub">Daemon {{ fmtInteger(latestSnap?.threadsDaemon) }} · Peak {{ fmtInteger(latestSnap?.threadsPeak) }}</div>
          </div>
          <div class="quick-card">
            <div class="stat-label">Alerts</div>
            <div class="metric-value">{{ activeAlertsCount }}</div>
            <div class="stat-sub">{{ alertsUnavailable ? 'Alert endpoint unavailable' : 'Firing rules' }}</div>
          </div>
        </section>

        <section class="gauge-grid">
          <div class="card gauge-card">
            <div class="card-title">Heap Pressure</div>
            <div class="gauge-wrap">
              <canvas ref="heapGaugeCanvas"></canvas>
              <div class="gauge-center">{{ heapUsedPercentText }}</div>
            </div>
          </div>
          <div class="card gauge-card">
            <div class="card-title">CPU Pressure</div>
            <div class="gauge-wrap">
              <canvas ref="cpuGaugeCanvas"></canvas>
              <div class="gauge-center">{{ fmtPercent(latestSnap?.cpuProcess) }}</div>
            </div>
          </div>
          <div class="card gauge-card status-board">
            <div class="card-title">Subsystem Status</div>
            <div class="status-board-grid">
              <div v-for="[name, comp] in healthComponents" :key="name" class="status-tile" :class="statusToneClass(comp.status)">
                <span class="status-tile-name">{{ name }}</span>
                <span class="status-tile-state">{{ comp.status || 'UNKNOWN' }}</span>
              </div>
              <div v-if="!healthComponents.length" class="status-empty">No health component details available.</div>
            </div>
          </div>
        </section>

        <section class="dashboard-chart-grid">
          <div class="card chart-card chart-card-wide">
            <div class="card-title-row">
              <div class="card-title">Heap Memory Trend</div>
              <button class="btn btn-xs" @click="resetZoom('heap')">Reset zoom</button>
            </div>
            <div class="chart-stage chart-stage-lg">
              <canvas ref="heapCanvas"></canvas>
            </div>
          </div>
          <div class="card chart-card">
            <div class="card-title-row">
              <div class="card-title">CPU Trend</div>
              <button class="btn btn-xs" @click="resetZoom('cpu')">Reset zoom</button>
            </div>
            <div class="chart-stage chart-stage-md">
              <canvas ref="cpuCanvas"></canvas>
            </div>
          </div>
          <div class="card chart-card">
            <div class="card-title-row">
              <div class="card-title">Thread Trend</div>
              <button class="btn btn-xs" @click="resetZoom('thread')">Reset zoom</button>
            </div>
            <div class="chart-stage chart-stage-md">
              <canvas ref="threadCanvas"></canvas>
            </div>
          </div>
        </section>

        <div class="card" v-if="info">
          <div class="card-title">Runtime Metadata</div>
          <table>
            <tbody>
              <tr v-for="(val, key) in runtimeMeta" :key="key">
                <td style="width:200px;color:var(--text-muted)">{{ key }}</td>
                <td class="code">{{ val }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  `,
  setup() {
    const loading = ref(true);
    const refreshing = ref(false);
    const health = ref(null);
    const info = ref(null);
    const alerts = ref([]);
    const alertsUnavailable = ref(false);
    const latestSnap = ref(null);
    const loadError = ref('');
    const lastUpdated = ref(null);
    const refreshMs = ref(DEFAULT_REFRESH_MS);
    const autoRefresh = ref(true);

    const appLabel = computed(() => {
      if (!info.value) return 'Spring Application · pending metadata';
      const appName = info.value.appName || info.value.build?.name || 'Spring Application';
      const version = info.value.build?.version || info.value.git?.commit?.id || 'unknown version';
      return `${appName} · ${version}`;
    });

    const startedAt = computed(() => {
      const start = info.value?.startTime;
      return start ? new Date(start).toLocaleString() : '—';
    });

    const healthComponents = computed(() => Object.entries(health.value?.components || {}));
    const activeAlertsCount = computed(() => (alerts.value || []).filter(a => !!a.firing).length);
    const heapUsedPercent = computed(() => ratioPercent(latestSnap.value?.heapUsed, latestSnap.value?.heapMax));
    const heapUsedPercentText = computed(() => heapUsedPercent.value == null ? '—' : `${heapUsedPercent.value.toFixed(1)}%`);
    const lastUpdatedText = computed(() => lastUpdated.value ? `updated ${lastUpdated.value.toLocaleTimeString()}` : 'awaiting first update');

    const runtimeMeta = computed(() => {
      const i = info.value || {};
      const j = i.jvm || {};
      return {
        'Application': i.appName || i.build?.name || '—',
        'Version': i.build?.version || '—',
        'Git Commit': i.git?.commit?.id || '—',
        'JVM Vendor': j.vendor || '—',
        'JVM': j.vmName || '—',
        'Java Version': j.version || '—',
        'Start Time': startedAt.value,
      };
    });

    // Rolling arrays — plain arrays, not reactive refs (Chart.js reads by reference)
    const chartLabels = [];
    const heapUsedData = [];
    const heapCommittedData = [];
    const threadLiveData = [];
    const threadDaemonData = [];
    const cpuProcessData = [];
    const cpuSystemData = [];

    const heapCanvas = ref(null);
    const threadCanvas = ref(null);
    const cpuCanvas = ref(null);
    const heapGaugeCanvas = ref(null);
    const cpuGaugeCanvas = ref(null);

    let heapChart = null;
    let threadChart = null;
    let cpuChart = null;
    let heapGaugeChart = null;
    let cpuGaugeChart = null;
    let pollTimer = null;
    let inFlight = false;
    let staticCycle = 0;

    function makeLineChart(canvas, datasets, formatTick, yOptions = {}) {
      const palette = chartTheme();
      return new Chart(canvas, {
        type: 'line',
        data: { labels: chartLabels, datasets },
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, color: palette.axis } },
            tooltip: { backgroundColor: palette.tooltip, callbacks: { label: ctx => `${ctx.dataset.label}: ${formatTick(ctx.parsed.y)}` } },
            zoom: {
              zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
              pan: { enabled: true, mode: 'x' },
            },
          },
          scales: {
            x: { ticks: { maxTicksLimit: 8, font: { size: 10 }, color: palette.axis }, grid: { color: palette.grid } },
            y: { beginAtZero: true, ticks: { callback: formatTick, font: { size: 10 }, color: palette.axis }, grid: { color: palette.grid }, ...yOptions },
          },
        },
      });
    }

    function makeGaugeChart(canvas, color) {
      const palette = chartTheme();
      return new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: ['active', 'remaining'],
          datasets: [{ data: [0, 100], backgroundColor: [color, palette.gaugeTrack], borderWidth: 0 }],
        },
        options: {
          animation: false,
          cutout: '74%',
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed.toFixed(1)}%` } },
          },
        },
      });
    }

    function lineStyle(color, fill) {
      return {
        borderColor: color,
        backgroundColor: `${color}35`,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.36,
        fill: !!fill,
      };
    }

    function missingCanvasRefs() {
      const refs = {
        heapCanvas: heapCanvas.value,
        cpuCanvas: cpuCanvas.value,
        threadCanvas: threadCanvas.value,
        heapGaugeCanvas: heapGaugeCanvas.value,
        cpuGaugeCanvas: cpuGaugeCanvas.value,
      };
      return Object.entries(refs)
        .filter(([, val]) => !val)
        .map(([key]) => key);
    }

    async function initCharts() {
      let missing = missingCanvasRefs();
      if (missing.length > 0) {
        await Vue.nextTick();
        missing = missingCanvasRefs();
      }

      if (missing.length > 0) {
        const msg = `Chart initialization skipped (missing canvas refs: ${missing.join(', ')})`;
        console.warn(msg);
        if (!loadError.value) loadError.value = msg;
        return false;
      }

      heapChart = makeLineChart(heapCanvas.value, [
        { label: 'Used', data: heapUsedData, ...lineStyle('#4dd3ff', true) },
        { label: 'Committed', data: heapCommittedData, ...lineStyle('#36c76f') },
      ], v => v == null ? '—' : fmtBytes(v), { grace: '10%' });
      cpuChart = makeLineChart(cpuCanvas.value, [
        { label: 'Process', data: cpuProcessData, ...lineStyle('#ff5f6d') },
        { label: 'System', data: cpuSystemData, ...lineStyle('#f4c15f') },
      ], v => v == null ? '—' : fmtPercent(v));
      threadChart = makeLineChart(threadCanvas.value, [
        { label: 'Live', data: threadLiveData, ...lineStyle('#31d28f') },
        { label: 'Daemon', data: threadDaemonData, ...lineStyle('#ffc857') },
      ], v => v == null ? '—' : Math.round(v));
      heapGaugeChart = makeGaugeChart(heapGaugeCanvas.value, '#4dd3ff');
      cpuGaugeChart = makeGaugeChart(cpuGaugeCanvas.value, '#ff5f6d');
      applyChartTheme();
      return true;
    }

    function applyChartTheme() {
      const palette = chartTheme();
      const charts = [heapChart, threadChart, cpuChart];
      charts.forEach((chart) => {
        if (!chart) return;
        chart.options.plugins.legend.labels.color = palette.axis;
        chart.options.plugins.tooltip.backgroundColor = palette.tooltip;
        chart.options.scales.x.ticks.color = palette.axis;
        chart.options.scales.y.ticks.color = palette.axis;
        chart.options.scales.x.grid.color = palette.grid;
        chart.options.scales.y.grid.color = palette.grid;
        chart.update('none');
      });
      [heapGaugeChart, cpuGaugeChart].forEach((chart) => {
        if (!chart) return;
        chart.data.datasets[0].backgroundColor[1] = palette.gaugeTrack;
        chart.update('none');
      });
    }

    function setGaugeValue(chart, value) {
      if (!chart) return;
      const clamped = Math.max(0, Math.min(100, Number(value) || 0));
      chart.data.datasets[0].data[0] = clamped;
      chart.data.datasets[0].data[1] = 100 - clamped;
      chart.update('none');
    }

    function applySnapshot(snap) {
      pushWindow(chartLabels,      new Date(snap.timestamp).toLocaleTimeString());
      pushWindow(heapUsedData,     snap.heapUsed     ?? null);
      pushWindow(heapCommittedData, snap.heapCommitted ?? null);
      pushWindow(threadLiveData,   snap.threadsLive  ?? null);
      pushWindow(threadDaemonData, snap.threadsDaemon ?? null);
      pushWindow(cpuProcessData,   snap.cpuProcess   ?? null);
      pushWindow(cpuSystemData,    snap.cpuSystem    ?? null);
      latestSnap.value = snap;

      if (heapChart)   heapChart.update('none');
      if (threadChart) threadChart.update('none');
      if (cpuChart)    cpuChart.update('none');

      const heapP = ratioPercent(snap.heapUsed, snap.heapMax);
      setGaugeValue(heapGaugeChart, heapP == null ? 0 : heapP);
      setGaugeValue(cpuGaugeChart, (Number(snap.cpuProcess) || 0) * 100);
    }

    const loadStatic = async () => {
      const [hRes, iRes, aRes] = await Promise.allSettled([
        apiFetch('health'),
        apiFetch('info'),
        apiFetch('alerts'),
      ]);

      if (hRes.status === 'fulfilled' && hRes.value.status === 'ok') {
        health.value = hRes.value.data;
      }
      if (iRes.status === 'fulfilled' && iRes.value.status === 'ok') {
        info.value = iRes.value.data;
      }
      if (aRes.status === 'fulfilled') {
        if (aRes.value.status === 'ok') {
          alerts.value = aRes.value.data || [];
          alertsUnavailable.value = false;
        } else {
          alerts.value = [];
          alertsUnavailable.value = true;
        }
      } else {
        alertsUnavailable.value = true;
      }
    };

    const loadSnapshot = async () => {
      const r = await apiFetch('snapshot');
      if (r.status !== 'ok' || !r.data) {
        throw new Error('snapshot endpoint unavailable');
      }
      applySnapshot(r.data);
    };

    const scheduleNextPoll = () => {
      clearTimeout(pollTimer);
      if (!autoRefresh.value || loading.value) return;
      pollTimer = setTimeout(() => { void poll(false); }, refreshMs.value);
    };

    const poll = async (forceStatic) => {
      if (inFlight) return;
      inFlight = true;
      refreshing.value = true;
      try {
        await loadSnapshot();
        if (forceStatic || staticCycle % STATIC_POLL_EVERY === 0) {
          await loadStatic();
        }
        staticCycle += 1;
        lastUpdated.value = new Date();
        if (!loadError.value || !loadError.value.startsWith('Chart initialization skipped')) {
          loadError.value = '';
        }
      } catch (e) {
        loadError.value = `Live refresh failed: ${e.message}`;
      } finally {
        refreshing.value = false;
        inFlight = false;
        scheduleNextPoll();
      }
    };

    const refreshNow = async () => {
      clearTimeout(pollTimer);
      await poll(true);
    };

    const toggleAutoRefresh = () => {
      autoRefresh.value = !autoRefresh.value;
      if (autoRefresh.value) scheduleNextPoll();
      else clearTimeout(pollTimer);
    };

    function resetZoom(which) {
      if (which === 'heap'   && heapChart)   heapChart.resetZoom();
      if (which === 'cpu'    && cpuChart)    cpuChart.resetZoom();
      if (which === 'thread' && threadChart) threadChart.resetZoom();
    }

    const themeHandler = () => applyChartTheme();

    onMounted(async () => {
      window.addEventListener('monitro-theme-change', themeHandler);
      loading.value = true;
      try {
        await Promise.all([loadStatic(), loadSnapshot()]);
        lastUpdated.value = new Date();
      } catch (e) {
        loadError.value = `Dashboard bootstrap failed: ${e.message}`;
      } finally {
        loading.value = false;
      }

      await Vue.nextTick();
      await initCharts();
      scheduleNextPoll();
    });

    onUnmounted(() => {
      window.removeEventListener('monitro-theme-change', themeHandler);
      clearTimeout(pollTimer);
      if (heapChart)   { heapChart.destroy();   heapChart   = null; }
      if (threadChart) { threadChart.destroy();  threadChart = null; }
      if (cpuChart)    { cpuChart.destroy();     cpuChart    = null; }
      if (heapGaugeChart) { heapGaugeChart.destroy(); heapGaugeChart = null; }
      if (cpuGaugeChart) { cpuGaugeChart.destroy(); cpuGaugeChart = null; }
    });

    watch(refreshMs, () => {
      if (autoRefresh.value && !loading.value) scheduleNextPoll();
    });

    return {
      loading, refreshing, health, info, latestSnap, runtimeMeta,
      heapCanvas, threadCanvas, cpuCanvas, heapGaugeCanvas, cpuGaugeCanvas,
      refreshMs, autoRefresh, lastUpdatedText, loadError,
      appLabel, startedAt, healthComponents, activeAlertsCount, alertsUnavailable, heapUsedPercentText,
      statusBadgeClass, statusToneClass, fmtUptime, fmtBytes, fmtPercent, fmtInteger,
      refreshNow, toggleAutoRefresh, resetZoom,
    };
  },
};

// ── Health page ───────────────────────────────────────────────────────────────

const HealthPage = {
  template: `
    <div>
      <div class="page-title">Health</div>
      <div v-if="loading" class="loading">Loading…</div>
      <div v-else-if="unavailable" class="unavailable">Health endpoint is not available.</div>
      <template v-else>
        <div class="card" style="display:flex;align-items:center;gap:16px;padding:16px 20px">
          <span class="status-dot" :class="dotClass(data?.status)" style="width:14px;height:14px"></span>
          <span style="font-size:18px;font-weight:700">{{ data?.status }}</span>
        </div>
        <div v-for="(comp, name) in data?.components" :key="name" class="card">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span class="status-dot" :class="dotClass(comp.status)"></span>
            <span style="font-weight:600">{{ name }}</span>
            <span class="badge" :class="statusBadgeClass(comp.status)" style="margin-left:auto">{{ comp.status }}</span>
          </div>
          <div v-if="comp.details && Object.keys(comp.details).length > 0">
            <table>
              <tbody>
                <tr v-for="(val, key) in comp.details" :key="key">
                  <td style="width:200px;color:var(--text-muted)">{{ key }}</td>
                  <td class="code">{{ JSON.stringify(val) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>
  `,
  setup() {
    const loading = ref(true), data = ref(null), unavailable = ref(false);
    onMounted(async () => {
      loading.value = true;
      try {
        const r = await apiFetch('health');
        if (r.status === 'unavailable') { unavailable.value = true; }
        else { data.value = r.data; }
      } catch (e) { console.error(e); unavailable.value = true; }
      loading.value = false;
    });
    return { loading, data, unavailable, dotClass, statusBadgeClass };
  },
};

// ── Metrics page ──────────────────────────────────────────────────────────────

const MetricsPage = {
  template: `
    <div>
      <div class="page-title">Metrics</div>
      <div v-if="loading" class="loading">Loading…</div>
      <div v-else-if="unavailable" class="unavailable">Metrics endpoint is not available.</div>
      <template v-else>
        <div class="search-bar">
          <input class="search-input" v-model="q" placeholder="Filter metrics…" />
          <span style="font-size:12px;color:var(--text-muted)">{{ filtered.length }} / {{ names.length }}</span>
        </div>
        <div class="card" style="padding:0">
          <table>
            <thead><tr><th>Name</th><th>Value</th></tr></thead>
            <tbody>
              <tr v-for="name in filtered" :key="name" @click="select(name)" style="cursor:pointer">
                <td class="code">{{ name }}</td>
                <td>
                  <span v-if="selected === name && detail">
                    <span v-for="m in detail.measurements" :key="m.statistic">
                      {{ m.statistic }}: <strong>{{ fmtMetricValue(m.value, detail.baseUnit) }}</strong>
                    </span>
                  </span>
                  <span v-else-if="selected === name && detailLoading" style="color:var(--text-muted)">…</span>
                  <span v-else style="color:var(--text-muted)">click to load</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  `,
  setup() {
    const loading = ref(true), names = ref([]), q = ref(''), unavailable = ref(false);
    const selected = ref(null), detail = ref(null), detailLoading = ref(false);
    const filtered = computed(() =>
      q.value ? names.value.filter(n => n.includes(q.value)) : names.value);
    const select = async (name) => {
      if (selected.value === name) { selected.value = null; detail.value = null; return; }
      selected.value = name; detail.value = null; detailLoading.value = true;
      try {
        const r = await apiFetch(`metrics/${name}`);
        detail.value = r.data;
      } catch (_) {}
      detailLoading.value = false;
    };
    const fmtMetricValue = (val, unit) => {
      if (unit === 'bytes') return fmtBytes(val);
      if (unit === 'seconds') return val < 1 ? (val * 1000).toFixed(1) + 'ms' : val.toFixed(2) + 's';
      return typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(4)) : val;
    };
    onMounted(async () => {
      loading.value = true;
      try {
        const r = await apiFetch('metrics');
        if (r.status === 'unavailable') { unavailable.value = true; }
        else { names.value = r.data || []; }
      } catch (e) { unavailable.value = true; }
      loading.value = false;
    });
    return { loading, names, filtered, q, unavailable, selected, detail, detailLoading, select, fmtMetricValue, fmtBytes };
  },
};

// ── Environment page ──────────────────────────────────────────────────────────

const EnvironmentPage = {
  template: `
    <div>
      <div class="page-title">Environment</div>
      <div v-if="loading" class="loading">Loading…</div>
      <div v-else-if="unavailable" class="unavailable">Environment endpoint is not available.</div>
      <template v-else>
        <div class="search-bar">
          <input class="search-input" v-model="q" placeholder="Filter properties…" />
        </div>
        <div v-for="src in filteredSources" :key="src.name" class="prop-source">
          <div class="prop-source-header" @click="toggle(src.name)">
            <span>{{ src.name }}</span>
            <span style="font-size:11px;color:var(--text-muted)">
              {{ src.properties ? Object.keys(src.properties).length : 0 }} props
              {{ collapsed.has(src.name) ? '▶' : '▼' }}
            </span>
          </div>
          <div class="prop-source-body" v-if="!collapsed.has(src.name)">
            <table>
              <thead><tr><th>Key</th><th>Value</th></tr></thead>
              <tbody>
                <tr v-for="(prop, key) in src.properties" :key="key">
                  <td class="code" style="width:40%">{{ key }}</td>
                  <td class="code">{{ prop.value }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>
  `,
  setup() {
    const loading = ref(true), sources = ref([]), q = ref(''), unavailable = ref(false);
    const collapsed = ref(new Set());
    const toggle = (name) => {
      const s = new Set(collapsed.value);
      s.has(name) ? s.delete(name) : s.add(name);
      collapsed.value = s;
    };
    const filteredSources = computed(() => {
      if (!q.value) return sources.value;
      return sources.value.map(src => {
        const props = {};
        Object.entries(src.properties || {}).forEach(([k, v]) => {
          if (k.includes(q.value) || String(v.value).includes(q.value)) props[k] = v;
        });
        return { ...src, properties: props };
      }).filter(src => Object.keys(src.properties).length > 0);
    });
    onMounted(async () => {
      loading.value = true;
      try {
        const r = await apiFetch('environment');
        if (r.status === 'unavailable') { unavailable.value = true; }
        else { sources.value = r.data?.propertySources || []; }
      } catch (e) { unavailable.value = true; }
      loading.value = false;
    });
    return { loading, sources, filteredSources, q, unavailable, collapsed, toggle };
  },
};

// ── Loggers page ──────────────────────────────────────────────────────────────

const LOG_LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'OFF', null];

const LoggersPage = {
  template: `
    <div>
      <div class="page-title">Loggers</div>
      <div v-if="loading" class="loading">Loading…</div>
      <div v-else-if="unavailable" class="unavailable">Loggers endpoint is not available.</div>
      <template v-else>
        <div class="search-bar">
          <input class="search-input" v-model="q" placeholder="Filter loggers…" />
          <span style="font-size:12px;color:var(--text-muted)">{{ filtered.length }} loggers</span>
        </div>
        <div class="card" style="padding:0">
          <table>
            <thead><tr><th>Logger</th><th>Configured</th><th>Effective</th><th>Set Level</th></tr></thead>
            <tbody>
              <tr v-for="[name, info] in filtered" :key="name">
                <td class="code">{{ name }}</td>
                <td><span v-if="info.configuredLevel" class="badge badge-info">{{ info.configuredLevel }}</span><span v-else style="color:var(--text-muted)">—</span></td>
                <td><span v-if="info.effectiveLevel" class="badge badge-info">{{ info.effectiveLevel }}</span><span v-else style="color:var(--text-muted)">—</span></td>
                <td>
                  <select @change="setLevel(name, $event.target.value)">
                    <option value="">— set —</option>
                    <option v-for="l in levels" :key="l" :value="l">{{ l }}</option>
                  </select>
                  <span v-if="saving === name" style="font-size:11px;color:var(--text-muted);margin-left:6px">Saved</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  `,
  setup() {
    const loading = ref(true), loggers = ref({}), q = ref(''), unavailable = ref(false), saving = ref(null);
    const levels = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'OFF'];
    const filtered = computed(() => {
      const entries = Object.entries(loggers.value);
      return q.value ? entries.filter(([n]) => n.toLowerCase().includes(q.value.toLowerCase())) : entries;
    });
    const setLevel = async (name, level) => {
      if (!level) return;
      saving.value = name;
      try { await apiPost(`loggers/${name}`, { configuredLevel: level }); }
      catch (e) { console.error(e); }
      setTimeout(() => { if (saving.value === name) saving.value = null; }, 1500);
    };
    onMounted(async () => {
      loading.value = true;
      try {
        const r = await apiFetch('loggers');
        if (r.status === 'unavailable') { unavailable.value = true; }
        else { loggers.value = r.data?.loggers || {}; }
      } catch (e) { unavailable.value = true; }
      loading.value = false;
    });
    return { loading, loggers, filtered, q, unavailable, levels, saving, setLevel };
  },
};

// ── Thread Dump page ──────────────────────────────────────────────────────────

const ThreadDumpPage = {
  template: `
<div class="td-page">

  <!-- control bar -->
  <section class="card dashboard-head">
    <div>
      <div class="page-title" style="margin-bottom:4px">Thread Dump</div>
      <div class="dashboard-subtitle">{{ currentThreads.length }} threads · {{ snapshots.length }} snapshots</div>
    </div>
    <div class="dashboard-actions">
      <span class="live-indicator" :class="{ active: polling }">{{ polling ? 'live' : 'paused' }}</span>
      <button class="btn" @click="pollNow" :disabled="fetching">Refresh</button>
      <button class="btn" @click="togglePoll">{{ polling ? 'Pause' : 'Resume' }}</button>
      <label class="control-inline">Interval
        <select v-model.number="pollMs">
          <option :value="2000">2s</option>
          <option :value="3000">3s</option>
          <option :value="5000">5s</option>
          <option :value="10000">10s</option>
        </select>
      </label>
      <span class="refresh-meta">{{ lastUpdatedText }}</span>
    </div>
  </section>

  <div v-if="fetching && !currentThreads.length" class="loading">Loading thread dump…</div>
  <div v-if="loadError" class="error-msg">{{ loadError }}</div>

  <template v-if="currentThreads.length">

    <!-- summary cards -->
    <section class="overview-grid td-summary-grid">
      <div v-for="c in summaryCards" :key="c.label" class="quick-card" :class="c.urgent ? 'quick-card-urgent':''">
        <div class="stat-label">{{ c.label }}</div>
        <div class="metric-value" :class="c.cls || ''">{{ c.value }}</div>
        <div class="stat-sub">{{ c.sub }}</div>
      </div>
    </section>

    <!-- deadlock alert -->
    <section v-if="deadlocks.length" class="card td-deadlock-alert">
      <div class="td-dl-header">⚠ {{ deadlocks.length }} Deadlock Cycle{{ deadlocks.length > 1 ? 's' : '' }} Detected</div>
      <div v-for="(cycle, ci) in deadlocks" :key="ci" class="td-dl-cycle">
        <template v-for="(t, ti) in cycle" :key="t.threadId">
          <span class="td-chip td-chip-blocked" @click="selectThread(t)" style="cursor:pointer">{{ t.threadName }}</span>
          <span v-if="ti < cycle.length-1" class="td-dl-arrow"> ⟶ blocked by ⟶ </span>
        </template>
      </div>
    </section>

    <!-- charts row -->
    <section class="td-charts-row">
      <div class="card td-donut-card">
        <div class="card-title">State Distribution</div>
        <div class="td-donut-stage"><canvas ref="stateDonutCanvas"></canvas></div>
      </div>
      <div class="card td-trend-card">
        <div class="card-title-row">
          <div class="card-title">Thread Count Trend</div>
          <button class="btn btn-xs" @click="resetTrendZoom">Reset zoom</button>
        </div>
        <div class="td-trend-stage"><canvas ref="stateTrendCanvas"></canvas></div>
      </div>
    </section>

    <!-- thread table -->
    <section class="card td-table-section">
      <div class="td-filters">
        <input class="search-input td-search" v-model="search" placeholder="Search name or stack…"/>
        <select class="td-select" v-model="filterState">
          <option value="">All states</option>
          <option v-for="s in TD_STATES" :key="s" :value="s">{{ s }}</option>
        </select>
        <select class="td-select" v-model="filterPool">
          <option value="">All pools</option>
          <option v-for="p in poolNames" :key="p" :value="p">{{ p }}</option>
        </select>
        <label class="control-inline"><input type="checkbox" v-model="filterSuspicious"/> Suspicious</label>
        <label class="control-inline"><input type="checkbox" v-model="filterBlocked"/> Blocked only</label>
        <span class="td-count">{{ filteredThreads.length }} / {{ currentThreads.length }}</span>
      </div>

      <div class="td-table-wrap">
        <table class="td-table">
          <thead>
            <tr>
              <th class="td-th-sort" @click="toggleSort('threadName')">Name <span class="td-sort-icon">{{ sortIcon('threadName') }}</span></th>
              <th class="td-th-sort" @click="toggleSort('threadId')">ID <span class="td-sort-icon">{{ sortIcon('threadId') }}</span></th>
              <th class="td-th-sort" @click="toggleSort('state')">State <span class="td-sort-icon">{{ sortIcon('state') }}</span></th>
              <th title="Daemon">D</th>
              <th class="td-th-sort" @click="toggleSort('pool')">Pool <span class="td-sort-icon">{{ sortIcon('pool') }}</span></th>
              <th class="td-th-sort" @click="toggleSort('priority')" title="Priority">Pri <span class="td-sort-icon">{{ sortIcon('priority') }}</span></th>
              <th>Lock</th>
              <th class="td-th-sort" @click="toggleSort('suspicionScore')">Risk <span class="td-sort-icon">{{ sortIcon('suspicionScore') }}</span></th>
              <th class="td-th-sort" @click="toggleSort('stackDepth')" title="Stack depth">Stk <span class="td-sort-icon">{{ sortIcon('stackDepth') }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in pagedThreads" :key="t.threadId"
                class="td-row"
                :class="[t.suspicion.severity !== 'none' ? 'td-row-'+t.suspicion.severity : '',
                         selectedThread && selectedThread.threadId === t.threadId ? 'td-row-selected' : '']"
                @click="selectThread(t)">
              <td class="td-name-cell" :title="t.threadName">{{ t.threadName }}</td>
              <td class="td-id-cell">{{ t.threadId }}</td>
              <td><span :class="'thread-state-'+t.state.toLowerCase()">{{ t.state }}</span></td>
              <td class="td-center">{{ t.daemon ? '●' : '' }}</td>
              <td><span class="td-pool-chip">{{ t.pool }}</span></td>
              <td class="td-center">{{ t.priority }}</td>
              <td class="td-lock-cell" :title="t.lockName||''">{{ t.lockName ? t.lockName.replace(/<.*>/,'').slice(0,28) : '—' }}</td>
              <td><span :class="'td-risk td-risk-'+t.suspicion.severity">{{ riskLabel(t) }}</span></td>
              <td class="td-center">{{ t.stack.length }}</td>
            </tr>
            <tr v-if="!pagedThreads.length">
              <td colspan="9" class="td-empty">No threads match the current filters</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="td-pagination">
        <button class="btn btn-xs" :disabled="page===0" @click="page--">‹ Prev</button>
        <span class="td-page-info">Page {{ page+1 }} / {{ totalPages||1 }}</span>
        <button class="btn btn-xs" :disabled="page>=totalPages-1" @click="page++">Next ›</button>
        <label class="control-inline" style="margin-left:8px">Per page
          <select v-model.number="pageSize">
            <option :value="25">25</option><option :value="50">50</option><option :value="100">100</option>
          </select>
        </label>
      </div>
    </section>

    <!-- pool analysis -->
    <section class="card">
      <div class="card-title">Thread Pool Analysis</div>
      <div class="td-pool-grid">
        <div v-for="(g, name) in poolGroups" :key="name" class="td-pool-card">
          <div class="td-pool-name">{{ name }}</div>
          <div class="td-pool-total">{{ g.total }} thread{{ g.total !== 1 ? 's' : '' }}</div>
          <div class="td-pool-states">
            <span v-for="(cnt, st) in g.states" :key="st" :class="'thread-state-'+st.toLowerCase()" style="font-size:11px;margin-right:6px">
              {{ st.slice(0,1) }}:{{ cnt }}
            </span>
          </div>
          <div v-if="g.suspicious" class="td-pool-risk">⚠ {{ g.suspicious }} suspicious</div>
          <div v-if="g.topStack" class="td-pool-top-stack" :title="g.topStack">{{ g.topStack }}</div>
        </div>
      </div>
    </section>

    <!-- blocked chains -->
    <section v-if="blockedChains.length" class="card">
      <div class="card-title">Blocked Thread Chains ({{ blockedChains.length }})</div>
      <div v-for="(chain, ci) in blockedChains" :key="ci" class="td-chain">
        <template v-for="(t, ti) in chain" :key="t.threadId">
          <span class="td-chip" :class="t.state==='BLOCKED'?'td-chip-blocked':'td-chip-owner'"
                @click="selectThread(t)" style="cursor:pointer">
            {{ t.threadName }} <span style="font-size:10px;opacity:0.65">[{{ t.state }}]</span>
          </span>
          <span v-if="ti < chain.length-1" class="td-chain-arrow"> ← blocked by ← </span>
        </template>
      </div>
    </section>

  </template>

  <!-- detail drawer -->
  <transition name="td-slide">
    <div v-if="selectedThread" class="td-overlay" @click.self="selectedThread=null">
      <div class="td-drawer">
        <div class="td-drawer-hd">
          <div>
            <div class="td-drawer-title">{{ selectedThread.threadName }}</div>
            <div style="font-size:11px;color:var(--text-muted)">#{{ selectedThread.threadId }} · {{ selectedThread.pool }}</div>
          </div>
          <button class="btn" @click="selectedThread=null">✕</button>
        </div>
        <div class="td-drawer-body">

          <div class="td-section-hd">Metadata</div>
          <table class="td-meta">
            <tr><td>State</td><td><span :class="'thread-state-'+selectedThread.state.toLowerCase()">{{ selectedThread.state }}</span></td></tr>
            <tr><td>Daemon</td><td>{{ selectedThread.daemon }}</td></tr>
            <tr><td>Priority</td><td>{{ selectedThread.priority }}</td></tr>
            <tr><td>Blocked count</td><td>{{ selectedThread.blockedCount }}</td></tr>
            <tr><td>Waited count</td><td>{{ selectedThread.waitedCount }}</td></tr>
            <tr v-if="selectedThread.lockName"><td>Waiting on</td><td class="code" style="font-size:11px;word-break:break-all">{{ selectedThread.lockName }}</td></tr>
            <tr v-if="selectedThread.lockOwnerName"><td>Lock owner</td><td>{{ selectedThread.lockOwnerName }} (#{{ selectedThread.lockOwnerId }})</td></tr>
            <tr><td>Risk</td><td><span :class="'td-risk td-risk-'+selectedThread.suspicion.severity">{{ selectedThread.suspicion.severity }} ({{ selectedThread.suspicion.score }})</span></td></tr>
            <tr v-if="selectedThread.suspicion.reasons.length"><td>Signals</td><td style="font-size:11px">{{ selectedThread.suspicion.reasons.join(' · ') }}</td></tr>
            <tr><td>Unchanged polls</td><td>{{ unchangedPolls(selectedThread) }}</td></tr>
          </table>

          <div class="td-section-hd">State History <span style="font-weight:400;opacity:0.6">(newest → oldest)</span></div>
          <div class="td-hist-row">
            <span v-for="(h, hi) in stateHistory(selectedThread)" :key="hi"
                  class="td-hist-dot" :class="'td-hist-'+h.state.toLowerCase()" :title="h.state+' @ '+h.time"></span>
          </div>

          <div class="td-section-hd">Stack Trace <span style="font-weight:400;opacity:0.6">({{ selectedThread.stack.length }} frames)</span></div>
          <div class="td-stack">
            <div v-for="(fr, fi) in selectedThread.stack" :key="fi"
                 class="td-frame" :class="{'td-frame-app': isAppFrame(fr)}">{{ fr }}</div>
          </div>
          <button class="btn" style="margin-top:8px;align-self:flex-start" @click="copyStack">Copy stack trace</button>
        </div>
      </div>
    </div>
  </transition>

</div>
  `,

  setup() {
    const fetching    = ref(false);
    const loadError   = ref('');
    const polling     = ref(true);
    const pollMs      = ref(3000);
    const lastUpdated = ref(null);
    const snapshots   = ref([]);
    const selectedThread = ref(null);
    const search      = ref('');
    const filterState = ref('');
    const filterPool  = ref('');
    const filterSuspicious = ref(false);
    const filterBlocked    = ref(false);
    const sortField   = ref('suspicionScore');
    const sortDir     = ref('desc');
    const page        = ref(0);
    const pageSize    = ref(50);

    const stateDonutCanvas = ref(null);
    const stateTrendCanvas = ref(null);
    let stateDonut = null, stateTrend = null, pollTimer = null;

    // trend rolling arrays (plain, not reactive — Chart.js reads by ref)
    const trendLabels = [], trendR = [], trendB = [], trendW = [], trendT = [];

    // ── computed ────────────────────────────────────────────────────────────
    const currentThreads = computed(() => snapshots.value.length ? snapshots.value[0].threads : []);
    const deadlocks      = computed(() => tdDeadlocks(currentThreads.value));
    const blockedChains  = computed(() => tdBlockedChains(currentThreads.value));
    const poolGroups     = computed(() => tdPools(currentThreads.value));
    const poolNames      = computed(() => Object.keys(poolGroups.value));
    const lastUpdatedText = computed(() => lastUpdated.value ? `updated ${lastUpdated.value.toLocaleTimeString()}` : '—');

    const filteredThreads = computed(() => {
      let list = currentThreads.value;
      if (filterState.value)    list = list.filter(t => t.state === filterState.value);
      if (filterPool.value)     list = list.filter(t => t.pool  === filterPool.value);
      if (filterBlocked.value)  list = list.filter(t => t.state === 'BLOCKED');
      if (filterSuspicious.value) list = list.filter(t => t.suspicion.severity !== 'none');
      if (search.value) {
        const q = search.value.toLowerCase();
        list = list.filter(t => t.threadName.toLowerCase().includes(q) ||
                                t.stack.some(f => f.toLowerCase().includes(q)));
      }
      const f = sortField.value, d = sortDir.value === 'asc' ? 1 : -1;
      return [...list].sort((a, b) => {
        const av = f === 'suspicionScore' ? a.suspicion.score : f === 'stackDepth' ? a.stack.length : a[f] ?? '';
        const bv = f === 'suspicionScore' ? b.suspicion.score : f === 'stackDepth' ? b.stack.length : b[f] ?? '';
        return typeof av === 'string' ? d * av.localeCompare(bv) : d * (av - bv);
      });
    });

    const totalPages   = computed(() => Math.ceil(filteredThreads.value.length / pageSize.value));
    const pagedThreads = computed(() => filteredThreads.value.slice(page.value * pageSize.value, (page.value + 1) * pageSize.value));

    const summaryCards = computed(() => {
      const ts = currentThreads.value;
      const prev = snapshots.value[1] || null;
      const counts = {};
      let daemon = 0, suspicious = 0;
      for (const t of ts) {
        counts[t.state] = (counts[t.state] || 0) + 1;
        if (t.daemon) daemon++;
        if (t.suspicion.severity !== 'none') suspicious++;
      }
      const changed = prev ? ts.filter(t => { const p = prev.threadMap.get(t.threadId); return !p || p.state !== t.state; }).length : 0;
      const newCnt  = prev ? ts.filter(t => !prev.threadMap.has(t.threadId)).length : 0;
      return [
        { label:'Total', value:ts.length, sub: newCnt ? `+${newCnt} new` : 'no new threads' },
        { label:'Runnable', value:counts.RUNNABLE||0, sub:'actively executing' },
        { label:'Blocked', value:counts.BLOCKED||0, sub:'waiting for monitor',
          cls:counts.BLOCKED?'text-danger':'', urgent:!!(counts.BLOCKED) },
        { label:'Waiting', value:(counts.WAITING||0)+(counts.TIMED_WAITING||0), sub:'WAITING + TIMED_WAITING' },
        { label:'Daemon', value:daemon, sub:'background threads' },
        { label:'Deadlocked', value:deadlocks.value.length, sub:deadlocks.value.length?'cycles detected!':'none detected',
          cls:deadlocks.value.length?'text-danger':'', urgent:!!deadlocks.value.length },
        { label:'Changed', value:changed, sub:'state changes this poll' },
        { label:'Suspicious', value:suspicious, sub:'risk score > 0',
          cls:suspicious?'text-warn':'', urgent:!!suspicious },
      ];
    });

    // ── charts ──────────────────────────────────────────────────────────────
    function initCharts() {
      if (!stateDonutCanvas.value || !stateTrendCanvas.value) return;
      const p = chartTheme();
      stateDonut = new Chart(stateDonutCanvas.value, {
        type: 'doughnut',
        data: {
          labels: TD_STATES,
          datasets: [{ data: TD_STATES.map(()=>0), backgroundColor: TD_STATES.map(s => TD_STATE_COLORS[s]||'#888'), borderWidth: 0 }],
        },
        options: {
          animation: false, cutout: '62%', responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position:'right', labels:{ boxWidth:10, font:{size:10}, color:p.axis } },
            tooltip: { callbacks:{ label: ctx => `${ctx.label}: ${ctx.parsed}` } },
          },
        },
      });
      stateTrend = new Chart(stateTrendCanvas.value, {
        type: 'line',
        data: {
          labels: trendLabels,
          datasets: [
            { label:'Runnable',      data:trendR, borderColor:'#31d28f', backgroundColor:'transparent', borderWidth:2, pointRadius:0, tension:0.3 },
            { label:'Blocked',       data:trendB, borderColor:'#ff6c79', backgroundColor:'transparent', borderWidth:2, pointRadius:0, tension:0.3 },
            { label:'Waiting',       data:trendW, borderColor:'#f7bf57', backgroundColor:'transparent', borderWidth:2, pointRadius:0, tension:0.3 },
            { label:'Timed Waiting', data:trendT, borderColor:'#a2b5d6', backgroundColor:'transparent', borderWidth:2, pointRadius:0, tension:0.3 },
          ],
        },
        options: {
          animation:false, responsive:true, maintainAspectRatio:false,
          interaction:{ mode:'index', intersect:false },
          plugins: {
            legend:{ position:'bottom', labels:{ boxWidth:10, font:{size:10}, color:p.axis } },
            tooltip:{ backgroundColor:p.tooltip },
            zoom:{ zoom:{wheel:{enabled:true},pinch:{enabled:true},mode:'x'}, pan:{enabled:true,mode:'x'} },
          },
          scales:{
            x:{ ticks:{maxTicksLimit:8,font:{size:10},color:p.axis}, grid:{color:p.grid} },
            y:{ beginAtZero:true, ticks:{font:{size:10},color:p.axis}, grid:{color:p.grid} },
          },
        },
      });
    }

    function updateCharts(threads) {
      if (!stateDonut || !stateTrend) return;
      const c = {};
      for (const s of TD_STATES) c[s] = 0;
      for (const t of threads) c[t.state] = (c[t.state]||0)+1;
      stateDonut.data.datasets[0].data = TD_STATES.map(s => c[s]);
      stateDonut.update('none');
      const time = new Date().toLocaleTimeString();
      [trendLabels,trendR,trendB,trendW,trendT].forEach(a => { if(a.length >= TD_TREND_WIN) a.shift(); });
      trendLabels.push(time); trendR.push(c.RUNNABLE||0); trendB.push(c.BLOCKED||0);
      trendW.push(c.WAITING||0); trendT.push(c.TIMED_WAITING||0);
      stateTrend.update('none');
    }

    function applyChartTheme() {
      const p = chartTheme();
      if (stateDonut) { stateDonut.options.plugins.legend.labels.color = p.axis; stateDonut.update('none'); }
      if (stateTrend) {
        stateTrend.options.plugins.legend.labels.color = p.axis;
        stateTrend.options.plugins.tooltip.backgroundColor = p.tooltip;
        ['x','y'].forEach(ax => { stateTrend.options.scales[ax].ticks.color = p.axis; stateTrend.options.scales[ax].grid.color = p.grid; });
        stateTrend.update('none');
      }
    }

    function resetTrendZoom() { if (stateTrend) stateTrend.resetZoom(); }

    // ── polling ─────────────────────────────────────────────────────────────
    async function doFetch() {
      if (fetching.value) return;
      fetching.value = true;
      try {
        const r = await apiFetch('threaddump');
        if (r.status !== 'ok' || !r.data) throw new Error('thread dump unavailable');
        const ts = Date.now();
        const prev = snapshots.value.slice(0, 10);
        const threads = (r.data.threads || []).map(raw => {
          const t = tdNormalize(raw, ts);
          t.suspicion = tdScore(t, prev);
          return t;
        });
        const threadMap = new Map(threads.map(t => [t.threadId, t]));
        const snap = { ts, time: new Date(ts).toLocaleTimeString(), threads, threadMap };
        snapshots.value = [snap, ...snapshots.value].slice(0, TD_SNAP_MAX);
        lastUpdated.value = new Date(ts);
        loadError.value = '';
        updateCharts(threads);
      } catch(e) {
        loadError.value = `Poll failed: ${e.message}`;
      } finally {
        fetching.value = false;
      }
    }

    function schedule() {
      clearTimeout(pollTimer);
      if (!polling.value) return;
      pollTimer = setTimeout(async () => { await doFetch(); schedule(); }, pollMs.value);
    }

    async function pollNow() { clearTimeout(pollTimer); await doFetch(); schedule(); }
    function togglePoll() { polling.value = !polling.value; polling.value ? schedule() : clearTimeout(pollTimer); }

    // ── interactions ────────────────────────────────────────────────────────
    function selectThread(t) {
      selectedThread.value = selectedThread.value?.threadId === t.threadId ? null : t;
    }

    function toggleSort(field) {
      if (sortField.value === field) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
      else { sortField.value = field; sortDir.value = field === 'suspicionScore' ? 'desc' : 'asc'; }
      page.value = 0;
    }

    function sortIcon(f) {
      if (sortField.value !== f) return '⇅';
      return sortDir.value === 'asc' ? '↑' : '↓';
    }

    function riskLabel(t) {
      return t.suspicion.severity === 'none' ? '—' : `${t.suspicion.severity} (${t.suspicion.score})`;
    }

    function unchangedPolls(t) {
      let n = 0;
      for (const s of snapshots.value.slice(1)) {
        const p = s.threadMap && s.threadMap.get(t.threadId);
        if (p && p.sig === t.sig && p.state === t.state) n++;
        else break;
      }
      return n;
    }

    function stateHistory(t) {
      return [...snapshots.value].slice(0, 20).reverse().map(s => {
        const f = s.threadMap && s.threadMap.get(t.threadId);
        return { state: f ? f.state : 'GONE', time: s.time };
      });
    }

    async function copyStack() {
      if (!selectedThread.value) return;
      const t = selectedThread.value;
      const txt = `"${t.threadName}" id=${t.threadId} ${t.state}\n` + t.stack.join('\n');
      try { await navigator.clipboard.writeText(txt); } catch(_) {}
    }

    const isAppFrame = tdIsApp;

    watch([search, filterState, filterPool, filterSuspicious, filterBlocked], () => { page.value = 0; });
    watch(pollMs, () => { if (polling.value) schedule(); });

    const themeHandler = applyChartTheme;

    onMounted(async () => {
      window.addEventListener('monitro-theme-change', themeHandler);
      await doFetch();
      await Vue.nextTick();
      initCharts();
      schedule();
    });

    onUnmounted(() => {
      window.removeEventListener('monitro-theme-change', themeHandler);
      clearTimeout(pollTimer);
      if (stateDonut) { stateDonut.destroy(); stateDonut = null; }
      if (stateTrend) { stateTrend.destroy(); stateTrend = null; }
    });

    return {
      fetching, loadError, polling, pollMs, lastUpdatedText,
      snapshots, currentThreads, selectedThread,
      search, filterState, filterPool, filterSuspicious, filterBlocked,
      sortField, sortDir, page, pageSize, totalPages,
      filteredThreads, pagedThreads, summaryCards,
      deadlocks, blockedChains, poolGroups, poolNames,
      stateDonutCanvas, stateTrendCanvas,
      TD_STATES,
      pollNow, togglePoll, selectThread, toggleSort, sortIcon,
      riskLabel, unchangedPolls, stateHistory, copyStack,
      resetTrendZoom, isAppFrame,
    };
  },
};

// ── Alerts page ───────────────────────────────────────────────────────────────

const AlertsPage = {
  template: `
    <div>
      <div class="page-title">Alerts</div>
      <div v-if="loading" class="loading">Loading…</div>
      <div v-else-if="unavailable" class="unavailable">Alerting is not configured or not enabled.</div>
      <template v-else>
        <div class="card">
          <div class="card-title">Active Alerts</div>
          <div v-if="!alerts.length" style="color:var(--text-muted);font-size:13px">No active alerts — all clear.</div>
          <table v-else>
            <thead><tr><th>Rule</th><th>Severity</th><th>State</th><th>Since</th></tr></thead>
            <tbody>
              <tr v-for="a in alerts" :key="a.ruleId">
                <td>{{ a.ruleName || a.ruleId }}</td>
                <td><span class="badge" :class="'badge-' + (a.severity || 'info').toLowerCase()">{{ a.severity }}</span></td>
                <td><span class="badge" :class="a.firing ? 'badge-down' : 'badge-up'">{{ a.firing ? 'FIRING' : 'OK' }}</span></td>
                <td style="font-size:12px;color:var(--text-muted)">{{ a.since ? new Date(a.since).toLocaleTimeString() : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="card">
          <div class="card-title">Configured Rules</div>
          <div v-if="!rules.length" style="color:var(--text-muted);font-size:13px">No alert rules configured.</div>
          <table v-else>
            <thead><tr><th>ID</th><th>Name</th><th>Metric</th><th>Condition</th><th>Severity</th></tr></thead>
            <tbody>
              <tr v-for="r in rules" :key="r.id">
                <td class="code">{{ r.id }}</td>
                <td>{{ r.name }}</td>
                <td class="code">{{ r.metric }}</td>
                <td class="code">{{ r.operator }} {{ r.threshold }}</td>
                <td><span class="badge" :class="'badge-' + (r.severity || 'info').toLowerCase()">{{ r.severity }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  `,
  setup() {
    const loading = ref(true), alerts = ref([]), rules = ref([]), unavailable = ref(false);
    onMounted(async () => {
      loading.value = true;
      try {
        const [ar, rr] = await Promise.all([apiFetch('alerts'), apiFetch('alerts/rules')]);
        if (ar.status === 'unavailable') { unavailable.value = true; }
        else { alerts.value = ar.data || []; rules.value = rr.data || []; }
      } catch (e) { unavailable.value = true; }
      loading.value = false;
    });
    return { loading, alerts, rules, unavailable };
  },
};

// ── Router ────────────────────────────────────────────────────────────────────

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: DashboardPage },
    { path: '/health', component: HealthPage },
    { path: '/metrics', component: MetricsPage },
    { path: '/environment', component: EnvironmentPage },
    { path: '/loggers', component: LoggersPage },
    { path: '/threaddump', component: ThreadDumpPage },
    { path: '/alerts', component: AlertsPage },
  ],
});

// ── Root app ──────────────────────────────────────────────────────────────────

const App = {
  template: `
    <div class="layout">
      <aside class="nav">
        <div class="nav-brand">
          <div class="nav-logo">Spring<span>-Monitro</span></div>
          <div class="nav-caption">Runtime observability panel</div>
        </div>
        <div class="nav-links">
          <router-link v-for="item in navItems" :key="item.path"
            :to="item.path" class="nav-link" active-class="active" exact-active-class="active">
            <span class="nav-icon">{{ item.icon }}</span>
            {{ item.label }}
          </router-link>
        </div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div>
            <div class="topbar-title">{{ activeRouteLabel }}</div>
            <div class="topbar-subtitle">Live monitoring, diagnostics and controls</div>
          </div>
          <button class="btn theme-btn" @click="toggleTheme">{{ themeButtonLabel }}</button>
        </header>
        <main class="main">
          <router-view />
        </main>
      </div>
    </div>
  `,
  setup() {
    const route = useRoute();
    const navItems = [
      { path: '/', label: 'Dashboard', icon: '◉' },
      { path: '/health', label: 'Health', icon: '♥' },
      { path: '/metrics', label: 'Metrics', icon: '≋' },
      { path: '/environment', label: 'Environment', icon: '⊞' },
      { path: '/loggers', label: 'Loggers', icon: '≡' },
      { path: '/threaddump', label: 'Thread Dump', icon: '⊘' },
      { path: '/alerts', label: 'Alerts', icon: '⚑' },
    ];

    const activeRouteLabel = computed(() => {
      const item = navItems.find(n => n.path === route.path);
      return item ? item.label : 'Dashboard';
    });

    const readStoredTheme = () => {
      try {
        const value = localStorage.getItem(THEME_STORAGE_KEY);
        return value === 'dark' || value === 'light' ? value : null;
      } catch (_) {
        return null;
      }
    };

    const defaultTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    const theme = ref(readStoredTheme() || defaultTheme);
    const themeButtonLabel = computed(() => theme.value === 'dark' ? 'Switch to light' : 'Switch to dark');

    const applyTheme = (next) => {
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch (_) {}
      window.dispatchEvent(new Event('monitro-theme-change'));
    };

    const toggleTheme = () => {
      theme.value = theme.value === 'dark' ? 'light' : 'dark';
    };

    watch(theme, applyTheme, { immediate: true });

    return {
      navItems,
      activeRouteLabel,
      themeButtonLabel,
      toggleTheme,
    };
  },
};

createApp(App).use(router).mount('#app');
