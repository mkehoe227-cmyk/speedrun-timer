// ── State ─────────────────────────────────────────────────────────────────────

let routes = [];       // { id, name, splitNames, pb, goldSplits }[]
let activeRoute = null;
let editingRouteId = null; // null = new route, string = editing existing

let state = 'home';    // 'home' | 'setup' | 'running' | 'finished'
let currentSplitIndex = 0;
let runStartTime = null;
let splitStartTime = null;
let completedSplits = []; // individual ms per completed split
let splitRows = [];        // <tr> element refs, indexed by split position
let rafId = null;

// ── Storage ───────────────────────────────────────────────────────────────────

function loadRoutes() {
  try {
    const raw = localStorage.getItem('speedrun_routes');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    routes = parsed.map(r => {
      // Validate / repair mismatched arrays
      const len = r.splitNames.length;
      const pb = Array.isArray(r.pb) && r.pb.length === len ? r.pb : null;
      const gold = Array.isArray(r.goldSplits) && r.goldSplits.length === len
        ? r.goldSplits
        : Array(len).fill(null);
      return { id: r.id, name: r.name, splitNames: r.splitNames, pb, goldSplits: gold, runCount: r.runCount || 0, history: Array.isArray(r.history) ? r.history : [] };
    });
  } catch (_) {
    routes = [];
  }
}

function saveRoutes() {
  localStorage.setItem('speedrun_routes', JSON.stringify(routes));
}

function generateId() {
  return Date.now().toString();
}

// ── Formatting ────────────────────────────────────────────────────────────────

function formatTime(ms, forceHours) {
  if (ms == null || isNaN(ms)) return '--:--.---';
  const totalSec = Math.floor(ms / 1000);
  const millis   = Math.floor(ms % 1000);
  const secs     = totalSec % 60;
  const mins     = Math.floor(totalSec / 60) % 60;
  const hours    = Math.floor(totalSec / 3600);

  const mm  = String(millis).padStart(3, '0');
  const ss  = String(secs).padStart(2, '0');

  if (hours > 0 || forceHours) {
    const hh = String(hours);
    const mn = String(mins).padStart(2, '0');
    return `${hh}:${mn}:${ss}.${mm}`;
  }
  return `${mins}:${ss}.${mm}`;
}

function formatDelta(ms) {
  if (ms == null) return '';
  const sign  = ms < 0 ? '-' : '+';
  const abs   = Math.abs(ms);
  const totalSec = Math.floor(abs / 1000);
  const tenths   = Math.floor((abs % 1000) / 100);
  const secs  = totalSec % 60;
  const mins  = Math.floor(totalSec / 60);
  const ss    = String(secs).padStart(2, '0');
  return mins > 0
    ? `${sign}${mins}:${ss}.${tenths}`
    : `${sign}0:${ss}.${tenths}`;
}

// ── Screen switching ──────────────────────────────────────────────────────────

function showOnly(id) {
  ['screen-home', 'screen-setup', 'screen-run', 'screen-finish', 'screen-stats'].forEach(s => {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  });
}

// ── HOME SCREEN ───────────────────────────────────────────────────────────────

function renderHome() {
  state = 'home';
  showOnly('screen-home');
  const list = document.getElementById('route-list');
  list.innerHTML = '';

  if (routes.length === 0) {
    list.innerHTML = '<div class="empty-state">No routes yet — click "+ New Route" to get started.</div>';
    return;
  }

  routes.forEach(route => list.appendChild(buildRouteCard(route)));
}

function buildRouteCard(route) {
  const card = document.createElement('div');
  card.className = 'route-card';

  const top = document.createElement('div');
  top.className = 'route-card-top';

  const info = document.createElement('div');
  info.className = 'route-card-info';

  const name = document.createElement('div');
  name.className = 'route-card-name';
  name.textContent = route.name;

  const meta = document.createElement('div');
  meta.className = 'route-card-meta';
  const splitWord = route.splitNames.length === 1 ? 'split' : 'splits';
  const runWord = route.runCount === 1 ? 'run' : 'runs';
  meta.textContent = `${route.splitNames.length} ${splitWord} · ${route.runCount || 0} ${runWord}`;

  const pb = document.createElement('div');
  if (route.pb) {
    pb.className = 'route-card-pb';
    pb.textContent = 'PB: ' + formatTime(route.pb[route.pb.length - 1]);
  } else {
    pb.className = 'route-card-pb no-pb';
    pb.textContent = 'No PB yet';
  }

  info.appendChild(name);
  info.appendChild(meta);
  info.appendChild(pb);

  const actions = document.createElement('div');
  actions.className = 'route-card-actions';

  const btnRun = document.createElement('button');
  btnRun.className = 'btn-primary';
  btnRun.textContent = 'Run';
  btnRun.addEventListener('click', () => startRun(route));

  const btnEdit = document.createElement('button');
  btnEdit.className = 'btn-secondary';
  btnEdit.textContent = 'Edit';
  btnEdit.addEventListener('click', () => renderSetup(route));

  const btnStats = document.createElement('button');
  btnStats.className = 'btn-secondary';
  btnStats.textContent = 'Stats';
  btnStats.addEventListener('click', () => renderStats(route));

  const btnDel = document.createElement('button');
  btnDel.className = 'btn-danger';
  btnDel.textContent = '✕';
  btnDel.title = 'Delete route';
  btnDel.addEventListener('click', () => handleDeleteRoute(route.id));

  const btnShare = document.createElement('button');
  btnShare.className = 'btn-secondary';
  btnShare.textContent = 'Share';
  btnShare.title = 'Copy shareable link';
  btnShare.addEventListener('click', () => {
    handleShare(route);
    btnShare.textContent = 'Copied!';
    setTimeout(() => { btnShare.textContent = 'Share'; }, 1500);
  });

  actions.appendChild(btnRun);
  actions.appendChild(btnStats);
  actions.appendChild(btnEdit);
  actions.appendChild(btnShare);
  actions.appendChild(btnDel);

  top.appendChild(info);
  top.appendChild(actions);
  card.appendChild(top);

  // HUD corner brackets
  ['tl', 'tr', 'bl', 'br'].forEach(pos => {
    const c = document.createElement('span');
    c.className = `corner corner-${pos}`;
    card.appendChild(c);
  });

  return card;
}

function handleShare(route) {
  const payload = btoa(JSON.stringify({ name: route.name, splitNames: route.splitNames }));
  const url = `${location.origin}${location.pathname}#r=${payload}`;
  navigator.clipboard.writeText(url).catch(() => {});
}

function buildHistoryChart(history) {
  const ns = 'http://www.w3.org/2000/svg';
  const W = 300, H = 44, PX = 8, PY = 8;

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;

  const toX = i => history.length === 1
    ? W / 2
    : PX + (i / (history.length - 1)) * (W - PX * 2);
  const toY = ms => PY + (1 - (ms - min) / range) * (H - PY * 2);

  const pts = history.map((ms, i) => ({ x: toX(i), y: toY(ms), ms }));

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(H));
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('history-chart');

  if (pts.length >= 2) {
    const polyline = document.createElementNS(ns, 'polyline');
    polyline.setAttribute('points', pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', '#00AACC');
    polyline.setAttribute('stroke-width', '1.5');
    svg.appendChild(polyline);
  }

  const D = 4;
  pts.forEach(p => {
    const g = document.createElementNS(ns, 'g');
    const diamond = document.createElementNS(ns, 'polygon');
    diamond.setAttribute('points', [
      `${p.x},${p.y - D}`,
      `${p.x + D},${p.y}`,
      `${p.x},${p.y + D}`,
      `${p.x - D},${p.y}`
    ].join(' '));
    diamond.setAttribute('fill', '#00D4FF');
    const title = document.createElementNS(ns, 'title');
    title.textContent = formatTime(p.ms);
    g.appendChild(diamond);
    g.appendChild(title);
    svg.appendChild(g);
  });

  return svg;
}

// ── STATS SCREEN ──────────────────────────────────────────────────────────────

function renderStats(route) {
  state = 'stats';
  showOnly('screen-stats');

  document.getElementById('stats-route-name').textContent = route.name;

  const noData = document.getElementById('stats-no-data');
  const chartWrap = document.getElementById('stats-chart-wrap');
  const summary = document.getElementById('stats-summary');

  summary.innerHTML = '';
  chartWrap.innerHTML = '';

  if (!route.history || route.history.length === 0) {
    noData.classList.remove('hidden');
    chartWrap.classList.add('hidden');
    return;
  }

  noData.classList.add('hidden');
  chartWrap.classList.remove('hidden');

  // Summary stats
  const pb = Math.min(...route.history);
  const worst = Math.max(...route.history);
  const avg = route.history.reduce((a, b) => a + b, 0) / route.history.length;

  const stats = [
    { label: 'Runs', value: route.history.length },
    { label: 'PB', value: formatTime(pb) },
    { label: 'Worst', value: formatTime(worst) },
    { label: 'Average', value: formatTime(avg) },
  ];

  stats.forEach(({ label, value }) => {
    const cell = document.createElement('div');
    cell.className = 'stats-cell';
    cell.innerHTML = `<div class="stats-value">${value}</div><div class="stats-label">${label}</div>`;
    summary.appendChild(cell);
  });

  // Large chart
  const CHART_LIMIT = 10;
  const visibleHistory = route.history.slice(-CHART_LIMIT);
  const runOffset = route.history.length - visibleHistory.length;
  chartWrap.appendChild(buildLargeHistoryChart(visibleHistory, pb, runOffset));
}

function formatTimeAxis(ms) {
  const totalSec = Math.round(ms / 1000);
  const secs = totalSec % 60;
  const mins = Math.floor(totalSec / 60);
  const hours = Math.floor(mins / 60);
  if (hours > 0) {
    return `${hours}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function buildLargeHistoryChart(history, pbMs, runOffset = 0) {
  const ns = 'http://www.w3.org/2000/svg';
  const W = 500, H = 200, PX_L = 52, PX_R = 20, PY = 16;

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;

  // Add 10% padding above/below
  const pad = range * 0.1;
  const yMin = min - pad;
  const yMax = max + pad;
  const yRange = yMax - yMin;

  const toX = i => history.length === 1
    ? PX_L + (W - PX_L - PX_R) / 2
    : PX_L + (i / (history.length - 1)) * (W - PX_L - PX_R);
  const toY = ms => PY + (1 - (ms - yMin) / yRange) * (H - PY * 2);

  const pts = history.map((ms, i) => ({ x: toX(i), y: toY(ms), ms }));

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(H));
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('history-chart-large');

  // Y-axis grid lines and labels (4 ticks)
  const TICKS = 4;
  for (let t = 0; t <= TICKS; t++) {
    const tickMs = min + (t / TICKS) * range;
    const tickY = toY(tickMs);

    const gridLine = document.createElementNS(ns, 'line');
    gridLine.setAttribute('x1', PX_L);
    gridLine.setAttribute('x2', W - PX_R);
    gridLine.setAttribute('y1', tickY);
    gridLine.setAttribute('y2', tickY);
    gridLine.setAttribute('stroke', '#1C2A3A');
    gridLine.setAttribute('stroke-width', '1');
    svg.appendChild(gridLine);

    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', PX_L - 6);
    label.setAttribute('y', tickY + 4);
    label.setAttribute('fill', '#a8dadc99');
    label.setAttribute('font-size', '11');
    label.setAttribute('text-anchor', 'end');
    label.textContent = formatTimeAxis(tickMs);
    svg.appendChild(label);
  }

  // PB reference line
  const pbY = toY(pbMs);
  const pbLine = document.createElementNS(ns, 'line');
  pbLine.setAttribute('x1', PX_L);
  pbLine.setAttribute('x2', W - PX_R);
  pbLine.setAttribute('y1', pbY);
  pbLine.setAttribute('y2', pbY);
  pbLine.setAttribute('stroke', '#00D4FF44');
  pbLine.setAttribute('stroke-width', '1');
  pbLine.setAttribute('stroke-dasharray', '4 3');
  svg.appendChild(pbLine);

  // PB label
  const pbLabel = document.createElementNS(ns, 'text');
  pbLabel.setAttribute('x', W - PX_R + 2);
  pbLabel.setAttribute('y', pbY + 4);
  pbLabel.setAttribute('fill', '#4caf5088');
  pbLabel.setAttribute('font-size', '9');
  pbLabel.textContent = 'PB';
  svg.appendChild(pbLabel);

  // Connecting line
  if (pts.length >= 2) {
    const polyline = document.createElementNS(ns, 'polyline');
    polyline.setAttribute('points', pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', '#00AACC');
    polyline.setAttribute('stroke-width', '2');
    svg.appendChild(polyline);
  }

  // Diamonds
  const D = 6;
  pts.forEach((p, i) => {
    const g = document.createElementNS(ns, 'g');
    const isPb = p.ms === pbMs;

    const diamond = document.createElementNS(ns, 'polygon');
    diamond.setAttribute('points', [
      `${p.x},${p.y - D}`,
      `${p.x + D},${p.y}`,
      `${p.x},${p.y + D}`,
      `${p.x - D},${p.y}`
    ].join(' '));
    diamond.setAttribute('fill', isPb ? '#00FF88' : '#00D4FF');

    const title = document.createElementNS(ns, 'title');
    title.textContent = `Run ${runOffset + i + 1}: ${formatTime(p.ms)}`;

    g.appendChild(diamond);
    g.appendChild(title);
    svg.appendChild(g);
  });

  return svg;
}

// ── SPLIT COMPARISON CHART ────────────────────────────────────────────────────

function buildSplitComparisonChart(completedSplits, pbSplits, splitNames) {
  const ns = 'http://www.w3.org/2000/svg';
  const W = 500, H = 200, LABEL_H = 58;
  const PX_L = 52, PX_R = 60, PY_T = 16, PY_B = 20;
  const N = splitNames.length;

  const allTimes = [...completedSplits, ...pbSplits];
  const min = Math.min(...allTimes);
  const max = Math.max(...allTimes);
  const range = max - min || 1;
  const pad = range * 0.1;
  const yMin = min - pad;
  const yMax = max + pad;
  const yRange = yMax - yMin;

  const toX = i => N === 1
    ? PX_L + (W - PX_L - PX_R) / 2
    : PX_L + (i / (N - 1)) * (W - PX_L - PX_R);
  const toY = ms => PY_T + (1 - (ms - yMin) / yRange) * (H - PY_T - PY_B);

  const pbPts  = pbSplits.map((ms, i)         => ({ x: toX(i), y: toY(ms), ms }));
  const runPts = completedSplits.map((ms, i)   => ({ x: toX(i), y: toY(ms), ms }));

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H + LABEL_H}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(H + LABEL_H));
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('history-chart-large');

  // Y-axis grid lines and labels
  const TICKS = 4;
  for (let t = 0; t <= TICKS; t++) {
    const tickMs = min + (t / TICKS) * range;
    const tickY = toY(tickMs);

    const gridLine = document.createElementNS(ns, 'line');
    gridLine.setAttribute('x1', PX_L);
    gridLine.setAttribute('x2', W - PX_R);
    gridLine.setAttribute('y1', tickY);
    gridLine.setAttribute('y2', tickY);
    gridLine.setAttribute('stroke', '#1C2A3A');
    gridLine.setAttribute('stroke-width', '1');
    svg.appendChild(gridLine);

    const lbl = document.createElementNS(ns, 'text');
    lbl.setAttribute('x', PX_L - 6);
    lbl.setAttribute('y', tickY + 4);
    lbl.setAttribute('fill', '#a8dadc99');
    lbl.setAttribute('font-size', '11');
    lbl.setAttribute('text-anchor', 'end');
    lbl.textContent = formatTimeAxis(tickMs);
    svg.appendChild(lbl);
  }

  // PB polyline
  if (pbPts.length >= 2) {
    const poly = document.createElementNS(ns, 'polyline');
    poly.setAttribute('points', pbPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', '#00AACC');
    poly.setAttribute('stroke-width', '2');
    svg.appendChild(poly);
  }

  // This run polyline
  if (runPts.length >= 2) {
    const poly = document.createElementNS(ns, 'polyline');
    poly.setAttribute('points', runPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', '#00AACC');
    poly.setAttribute('stroke-opacity', '0.55');
    poly.setAttribute('stroke-width', '2');
    svg.appendChild(poly);
  }

  const D = 6;

  // PB diamonds
  pbPts.forEach((p, i) => {
    const g = document.createElementNS(ns, 'g');
    const diamond = document.createElementNS(ns, 'polygon');
    diamond.setAttribute('points', [
      `${p.x},${p.y - D}`, `${p.x + D},${p.y}`,
      `${p.x},${p.y + D}`, `${p.x - D},${p.y}`
    ].join(' '));
    diamond.setAttribute('fill', '#0099CC');
    const title = document.createElementNS(ns, 'title');
    title.textContent = `PB – ${splitNames[i]}: ${formatTime(p.ms)}`;
    g.appendChild(diamond);
    g.appendChild(title);
    svg.appendChild(g);
  });

  // This run diamonds — colored per split
  runPts.forEach((p, i) => {
    const g = document.createElementNS(ns, 'g');
    const faster = completedSplits[i] < pbSplits[i];
    const diamond = document.createElementNS(ns, 'polygon');
    diamond.setAttribute('points', [
      `${p.x},${p.y - D}`, `${p.x + D},${p.y}`,
      `${p.x},${p.y + D}`, `${p.x - D},${p.y}`
    ].join(' '));
    diamond.setAttribute('fill', faster ? '#00FF88' : '#FF3366');
    const title = document.createElementNS(ns, 'title');
    title.textContent = `${splitNames[i]}: ${formatTime(p.ms)}`;
    g.appendChild(diamond);
    g.appendChild(title);
    svg.appendChild(g);
  });

  // Split name labels — rotated -45° to handle long names
  splitNames.forEach((name, i) => {
    const x = toX(i).toFixed(1);
    const y = H + 14;
    const lbl = document.createElementNS(ns, 'text');
    lbl.setAttribute('x', x);
    lbl.setAttribute('y', y);
    lbl.setAttribute('fill', '#a8dadc99');
    lbl.setAttribute('font-size', '10');
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('transform', `rotate(45, ${x}, ${y})`);
    lbl.textContent = name;
    svg.appendChild(lbl);
  });

  const wrap = document.createElement('div');

  const legend = document.createElement('div');
  legend.className = 'split-chart-legend';
  legend.innerHTML =
    '<span style="color:#0099CC">\u25c6</span> PB' +
    '<span style="color:#00FF88">\u25c6</span> Faster' +
    '<span style="color:#FF3366">\u25c6</span> Slower';

  wrap.appendChild(legend);
  wrap.appendChild(svg);
  return wrap;
}

// ── SETUP SCREEN ──────────────────────────────────────────────────────────────

function renderSetup(route, prefill) {
  editingRouteId = route ? route.id : null;
  showOnly('screen-setup');

  const isImport = !route && prefill;
  document.getElementById('setup-title').textContent =
    route ? 'Edit Route' : (isImport ? 'Import Route' : 'New Route');
  document.getElementById('route-name-input').value =
    route ? route.name : (prefill ? prefill.name : '');
  document.getElementById('split-list').innerHTML = '';
  hideSetupError();

  const splits = route ? route.splitNames : (prefill ? prefill.splitNames : []);
  if (splits.length > 0) splits.forEach(n => addSplitRow(n));
  else addSplitRow('');
}

function addSplitRow(name) {
  const row = document.createElement('div');
  row.className = 'split-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'split-name-input';
  input.placeholder = 'Split name';
  input.value = name || '';

  const del = document.createElement('button');
  del.className = 'btn-delete-split';
  del.title = 'Remove split';
  del.textContent = '×';
  del.addEventListener('click', () => {
    row.remove();
  });

  row.appendChild(input);
  row.appendChild(del);
  document.getElementById('split-list').appendChild(row);
  return input;
}

function collectSetupData() {
  const name = document.getElementById('route-name-input').value.trim();
  const inputs = document.querySelectorAll('#split-list .split-name-input');
  const splitNames = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
  return { name, splitNames };
}

function showSetupError(msg) {
  const el = document.getElementById('setup-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideSetupError() {
  document.getElementById('setup-error').classList.add('hidden');
}

function handleSaveRoute(andRun) {
  const { name, splitNames } = collectSetupData();
  if (!name) { showSetupError('Please enter a route name.'); return; }
  if (splitNames.length === 0) { showSetupError('Please add at least one split.'); return; }

  if (editingRouteId) {
    const idx = routes.findIndex(r => r.id === editingRouteId);
    if (idx !== -1) {
      const existing = routes[idx];
      // Reset PB and gold if split count changed
      const pbReset = existing.splitNames.length !== splitNames.length;
      routes[idx] = {
        id: existing.id,
        name,
        splitNames,
        pb: pbReset ? null : existing.pb,
        goldSplits: pbReset ? Array(splitNames.length).fill(null) : existing.goldSplits,
        runCount: pbReset ? 0 : existing.runCount,
        history: pbReset ? [] : existing.history,
      };
      activeRoute = routes[idx];
    }
  } else {
    const newRoute = {
      id: generateId(),
      name,
      splitNames,
      pb: null,
      goldSplits: Array(splitNames.length).fill(null),
      runCount: 0,
      history: [],
    };
    routes.push(newRoute);
    activeRoute = newRoute;
  }

  saveRoutes();

  if (andRun) {
    startRun(activeRoute);
  } else {
    renderHome();
  }
}

function handleDeleteRoute(id) {
  if (!confirm('Delete this route? This cannot be undone.')) return;
  routes = routes.filter(r => r.id !== id);
  saveRoutes();
  renderHome();
}

// ── RUN SCREEN ────────────────────────────────────────────────────────────────

function buildSplitsTable() {
  const tbody = document.getElementById('splits-tbody');
  tbody.innerHTML = '';
  splitRows = [];

  activeRoute.splitNames.forEach((splitName, i) => {
    const tr = document.createElement('tr');
    tr.dataset.i = i;

    const tdName  = document.createElement('td');
    tdName.className = 'col-name';
    tdName.textContent = splitName;

    const tdGold  = document.createElement('td');
    tdGold.className = 'col-gold';
    tdGold.textContent = formatTime(activeRoute.goldSplits[i]);

    const tdTime  = document.createElement('td');
    tdTime.className = 'col-time';
    tdTime.textContent = '';

    const tdDelta = document.createElement('td');
    tdDelta.className = 'col-delta';
    tdDelta.textContent = '';

    tr.appendChild(tdName);
    tr.appendChild(tdGold);
    tr.appendChild(tdTime);
    tr.appendChild(tdDelta);
    tbody.appendChild(tr);
    splitRows.push(tr);
  });
}

function startRun(route) {
  activeRoute = route;
  state = 'running';
  currentSplitIndex = 0;
  completedSplits = [];

  document.getElementById('route-name-display').textContent = route.name;
  buildSplitsTable();
  showOnly('screen-run');

  if (splitRows[0]) splitRows[0].classList.add('active-split');

  const now = performance.now();
  runStartTime  = now;
  splitStartTime = now;
  scheduleFrame();
}

function scheduleFrame() {
  rafId = requestAnimationFrame(onFrame);
}

function onFrame(timestamp) {
  if (state !== 'running') return;

  const totalElapsed = timestamp - runStartTime;
  const splitElapsed = timestamp - splitStartTime;

  document.getElementById('total-timer').textContent = formatTime(totalElapsed);

  const row = splitRows[currentSplitIndex];
  if (row) {
    row.cells[2].textContent = formatTime(splitElapsed);
    const delta = computeDelta(currentSplitIndex, splitElapsed);
    updateDeltaCell(row.cells[3], delta);
  }

  scheduleFrame();
}

function computeDelta(splitIndex, elapsedMs) {
  if (!activeRoute.pb) return null;
  const cumNow = completedSplits.reduce((a, b) => a + b, 0) + elapsedMs;
  return cumNow - activeRoute.pb[splitIndex];
}

function updateDeltaCell(cell, deltaMs) {
  if (deltaMs == null) {
    cell.textContent = '';
    cell.className = 'col-delta';
    return;
  }
  cell.textContent = formatDelta(deltaMs);
  if (deltaMs < 0) {
    cell.className = 'col-delta ahead';
  } else {
    cell.className = 'col-delta behind';
  }
}

function advanceSplit() {
  const now = performance.now();
  const splitElapsed = now - splitStartTime;
  completedSplits.push(splitElapsed);

  const row = splitRows[currentSplitIndex];
  if (row) {
    // Freeze the time cell
    row.cells[2].textContent = formatTime(splitElapsed);

    // Compute final delta for this split
    const delta = computeDelta(currentSplitIndex, splitElapsed);
    updateDeltaCell(row.cells[3], delta);

    // Gold split detection
    const prevGold = activeRoute.goldSplits[currentSplitIndex];
    if (prevGold == null || splitElapsed < prevGold) {
      row.classList.add('gold-split');
      row.cells[2].classList.add('gold');
    }

    row.classList.remove('active-split');
    row.classList.add('split-done');
  }

  currentSplitIndex++;

  if (currentSplitIndex >= activeRoute.splitNames.length) {
    finishRun();
    return;
  }

  splitStartTime = now;
  if (splitRows[currentSplitIndex]) {
    splitRows[currentSplitIndex].classList.add('active-split');
  }
}

function resetRun() {
  cancelAnimationFrame(rafId);
  rafId = null;
  completedSplits = [];
  renderHome();
}

// ── FINISH SCREEN ─────────────────────────────────────────────────────────────

function finishRun() {
  cancelAnimationFrame(rafId);
  rafId = null;
  state = 'finished';

  const totalMs = completedSplits.reduce((a, b) => a + b, 0);

  document.getElementById('finish-route-name').textContent = activeRoute.name;
  document.getElementById('finish-total-time').textContent = formatTime(totalMs);

  // PB comparison
  const cmpEl = document.getElementById('finish-pb-comparison');
  if (!activeRoute.pb) {
    cmpEl.textContent = 'First completed run!';
    cmpEl.className = 'no-prev';
  } else {
    const prevTotal = activeRoute.pb[activeRoute.pb.length - 1];
    const diff = totalMs - prevTotal;
    if (diff < 0) {
      cmpEl.textContent = 'New PB! ' + formatDelta(diff);
      cmpEl.className = 'new-pb';
    } else {
      cmpEl.textContent = formatDelta(diff) + ' off PB';
      cmpEl.className = 'off-pb';
    }
  }

  // Build finish splits table
  const tbody = document.getElementById('finish-splits-tbody');
  tbody.innerHTML = '';
  let cumulative = 0;

  completedSplits.forEach((splitMs, i) => {
    cumulative += splitMs;
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    tdName.className = 'col-name';
    tdName.textContent = activeRoute.splitNames[i];

    const tdGold = document.createElement('td');
    tdGold.className = 'col-gold';
    tdGold.textContent = formatTime(activeRoute.goldSplits[i]);

    const tdTime = document.createElement('td');
    tdTime.className = 'col-time';
    tdTime.textContent = formatTime(splitMs);

    const tdDelta = document.createElement('td');
    tdDelta.className = 'col-delta';
    if (activeRoute.pb) {
      const delta = cumulative - activeRoute.pb[i];
      tdDelta.textContent = formatDelta(delta);
      tdDelta.classList.add(delta < 0 ? 'ahead' : 'behind');
    }

    // Highlight gold splits
    tr.appendChild(tdName);
    tr.appendChild(tdGold);
    tr.appendChild(tdTime);
    tr.appendChild(tdDelta);
    tbody.appendChild(tr);
  });

  document.getElementById('btn-save').disabled = false;

  // Split comparison chart (only when a PB exists to compare against)
  const chartWrap = document.getElementById('finish-split-chart');
  if (activeRoute.pb) {
    const pbSplits = activeRoute.pb.map((c, i) => i === 0 ? c : c - activeRoute.pb[i - 1]);
    chartWrap.innerHTML = '';
    chartWrap.appendChild(buildSplitComparisonChart(completedSplits, pbSplits, activeRoute.splitNames));
    chartWrap.classList.remove('hidden');
  } else {
    chartWrap.innerHTML = '';
    chartWrap.classList.add('hidden');
  }

  showOnly('screen-finish');
}

function saveCurrentRun() {
  document.getElementById('btn-save').disabled = true;

  const totalMs = completedSplits.reduce((a, b) => a + b, 0);

  // Build cumulative array
  const cumulatives = [];
  let acc = 0;
  completedSplits.forEach(ms => { acc += ms; cumulatives.push(acc); });

  // Update PB only if faster (or no previous PB)
  const prevTotal = activeRoute.pb ? activeRoute.pb[activeRoute.pb.length - 1] : Infinity;
  if (totalMs < prevTotal) {
    activeRoute.pb = cumulatives;
  }

  // Always update gold splits
  completedSplits.forEach((ms, i) => {
    if (activeRoute.goldSplits[i] == null || ms < activeRoute.goldSplits[i]) {
      activeRoute.goldSplits[i] = ms;
    }
  });

  // Increment run count and record history
  activeRoute.runCount = (activeRoute.runCount || 0) + 1;
  activeRoute.history = activeRoute.history || [];
  activeRoute.history.push(totalMs);

  // Sync back to routes array
  const idx = routes.findIndex(r => r.id === activeRoute.id);
  if (idx !== -1) routes[idx] = activeRoute;

  saveRoutes();
}

function handleSave() {
  saveCurrentRun();
  renderHome();
}

function handleDiscard() {
  renderHome();
}

function handleRunAgain() {
  saveCurrentRun();
  startRun(activeRoute);
}

// ── Keyboard ──────────────────────────────────────────────────────────────────

function handleKeydown(e) {
  if (e.code === 'Space') {
    if (state === 'running') {
      e.preventDefault();
      advanceSplit();
    }
  } else if (e.code === 'Escape') {
    if (state === 'running') {
      resetRun();
    } else if (state === 'finished' || state === 'stats') {
      renderHome();
    }
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

function wireEvents() {
  document.addEventListener('keydown', handleKeydown);

  // Home
  document.getElementById('btn-new-route').addEventListener('click', () => renderSetup(null));
  document.getElementById('btn-back-stats').addEventListener('click', renderHome);

  // Setup
  document.getElementById('btn-add-split').addEventListener('click', () => {
    if (editingRouteId) {
      const route = routes.find(r => r.id === editingRouteId);
      if (route && route.pb) {
        if (!confirm('Adding a split will reset all run data (PB, gold splits, and run count) for this route. Continue?')) return;
      }
    }
    const input = addSplitRow('');
    input.focus();
  });
  document.getElementById('btn-save-route').addEventListener('click', () => handleSaveRoute(false));
  document.getElementById('btn-start-run').addEventListener('click', () => handleSaveRoute(true));
  document.getElementById('btn-cancel-setup').addEventListener('click', renderHome);

  // Finish
  document.getElementById('btn-save').addEventListener('click', handleSave);
  document.getElementById('btn-discard').addEventListener('click', handleDiscard);
  document.getElementById('btn-run-again').addEventListener('click', handleRunAgain);
}

function init() {
  loadRoutes();

  const hash = location.hash;
  if (hash.startsWith('#r=')) {
    try {
      const prefill = JSON.parse(atob(hash.slice(3)));
      if (prefill.name && Array.isArray(prefill.splitNames)) {
        history.replaceState(null, '', location.pathname);
        wireEvents();
        renderSetup(null, prefill);
        return;
      }
    } catch (_) {}
  }

  wireEvents();
  renderHome();
}

init();
