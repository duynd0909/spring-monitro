// Spring-Monitro admin UI — Vue 3 + VueRouter via CDN, no build step.
const { createApp, ref, computed, onMounted, onUnmounted, watch } = Vue;
const { createRouter, createWebHashHistory } = VueRouter;

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
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
        m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// ── Dashboard page ────────────────────────────────────────────────────────────

const DashboardPage = {
  template: `
    <div>
      <div class="page-title">Dashboard</div>
      <div v-if="loading" class="loading">Loading…</div>
      <template v-else>
        <div class="grid-4" style="margin-bottom:16px">
          <div class="stat-card">
            <div class="stat-label">Health</div>
            <div class="stat-value">
              <span class="badge" :class="statusBadgeClass(health?.status)">
                {{ health?.status || 'Unknown' }}
              </span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Uptime</div>
            <div class="stat-value" style="font-size:18px">{{ fmtUptime(info?.uptimeMs) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Heap Used</div>
            <div class="stat-value" style="font-size:18px">{{ fmtBytes(heapUsed) }}</div>
            <div class="stat-sub">of {{ fmtBytes(heapMax) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">App Version</div>
            <div class="stat-value" style="font-size:16px">{{ info?.version || '—' }}</div>
            <div class="stat-sub">{{ info?.name || '' }}</div>
          </div>
        </div>
        <div class="card" v-if="health?.components">
          <div class="card-title">Components</div>
          <table>
            <thead><tr><th>Component</th><th>Status</th></tr></thead>
            <tbody>
              <tr v-for="(comp, name) in health.components" :key="name">
                <td>{{ name }}</td>
                <td><span class="badge" :class="statusBadgeClass(comp.status)">{{ comp.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="card" v-if="info">
          <div class="card-title">JVM Info</div>
          <table>
            <tbody>
              <tr v-for="(val, key) in jvmInfo" :key="key">
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
    const loading = ref(true), health = ref(null), info = ref(null);
    const heapUsed = ref(null), heapMax = ref(null);
    const jvmInfo = computed(() => {
      if (!info.value) return {};
      const i = info.value;
      return {
        'JVM Vendor': i.jvmVendor, 'JVM Version': i.jvmVersion,
        'Java Version': i.javaVersion, 'OS': i.osName + ' ' + i.osVersion,
        'Processors': i.availableProcessors, 'PID': i.pid,
      };
    });
    const load = async () => {
      loading.value = true;
      try {
        const [h, inf] = await Promise.all([apiFetch('health'), apiFetch('info')]);
        health.value = h.data; info.value = inf.data;
        try {
          const mu = await apiFetch('metrics/jvm.memory.used?tag=area:heap');
          heapUsed.value = mu.data?.measurements?.[0]?.value;
          const mm = await apiFetch('metrics/jvm.memory.max?tag=area:heap');
          heapMax.value = mm.data?.measurements?.[0]?.value;
        } catch (_) {}
      } catch (e) { console.error(e); }
      loading.value = false;
    };
    onMounted(load);
    return { loading, health, info, heapUsed, heapMax, jvmInfo, statusBadgeClass, fmtUptime, fmtBytes };
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
    <div>
      <div class="page-title">Thread Dump</div>
      <div v-if="loading" class="loading">Loading…</div>
      <div v-else-if="unavailable" class="unavailable">Thread dump endpoint is not available.</div>
      <template v-else>
        <div class="search-bar">
          <input class="search-input" v-model="q" placeholder="Filter threads by name or state…" />
          <span style="font-size:12px;color:var(--text-muted)">{{ filtered.length }} / {{ threads.length }} threads</span>
          <button class="btn" @click="load">Refresh</button>
        </div>
        <div class="card" style="padding:0">
          <table>
            <thead><tr><th>Thread</th><th>State</th><th>Blocked / Waited</th></tr></thead>
            <tbody>
              <tr v-for="t in filtered" :key="t.threadId">
                <td>
                  <div style="font-weight:500">{{ t.threadName }}</div>
                  <div style="font-size:11px;color:var(--text-muted)">ID: {{ t.threadId }}</div>
                  <div v-if="expanded.has(t.threadId)">
                    <div v-for="(frame, i) in t.stackTrace" :key="i" class="stack-frame">{{ frame }}</div>
                  </div>
                  <button class="btn" style="margin-top:4px;font-size:10px;padding:2px 8px" @click="toggleExpand(t.threadId)">
                    {{ expanded.has(t.threadId) ? 'hide stack' : 'show stack' }}
                  </button>
                </td>
                <td><span :class="'thread-state-' + t.threadState?.toLowerCase()">{{ t.threadState }}</span></td>
                <td style="font-size:12px;color:var(--text-muted)">
                  <div>blocked: {{ t.blockedCount }}</div>
                  <div>waited: {{ t.waitedCount }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  `,
  setup() {
    const loading = ref(true), threads = ref([]), q = ref(''), unavailable = ref(false);
    const expanded = ref(new Set());
    const filtered = computed(() => {
      if (!q.value) return threads.value;
      const lq = q.value.toLowerCase();
      return threads.value.filter(t =>
        t.threadName?.toLowerCase().includes(lq) || t.threadState?.toLowerCase().includes(lq));
    });
    const toggleExpand = (id) => {
      const s = new Set(expanded.value);
      s.has(id) ? s.delete(id) : s.add(id);
      expanded.value = s;
    };
    const load = async () => {
      loading.value = true;
      try {
        const r = await apiFetch('threaddump');
        if (r.status === 'unavailable') { unavailable.value = true; }
        else { threads.value = r.data?.threads || []; }
      } catch (e) { unavailable.value = true; }
      loading.value = false;
    };
    onMounted(load);
    return { loading, threads, filtered, q, unavailable, expanded, toggleExpand, load };
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
      <nav class="nav">
        <div class="nav-logo">Spring<span>-Monitro</span></div>
        <div class="nav-links">
          <router-link v-for="item in navItems" :key="item.path"
            :to="item.path" class="nav-link" active-class="active" exact-active-class="active">
            <span class="nav-icon">{{ item.icon }}</span>
            {{ item.label }}
          </router-link>
        </div>
      </nav>
      <main class="main">
        <router-view />
      </main>
    </div>
  `,
  setup() {
    const navItems = [
      { path: '/', label: 'Dashboard', icon: '◉' },
      { path: '/health', label: 'Health', icon: '♥' },
      { path: '/metrics', label: 'Metrics', icon: '≋' },
      { path: '/environment', label: 'Environment', icon: '⊞' },
      { path: '/loggers', label: 'Loggers', icon: '≡' },
      { path: '/threaddump', label: 'Thread Dump', icon: '⊘' },
      { path: '/alerts', label: 'Alerts', icon: '⚑' },
    ];
    return { navItems };
  },
};

createApp(App).use(router).mount('#app');
