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
      return { id: r.id, name: r.name, splitNames: r.splitNames, pb, goldSplits: gold };
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
  ['screen-home', 'screen-setup', 'screen-run', 'screen-finish'].forEach(s => {
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

  const info = document.createElement('div');
  info.className = 'route-card-info';

  const name = document.createElement('div');
  name.className = 'route-card-name';
  name.textContent = route.name;

  const meta = document.createElement('div');
  meta.className = 'route-card-meta';
  const splitWord = route.splitNames.length === 1 ? 'split' : 'splits';
  meta.textContent = `${route.splitNames.length} ${splitWord}`;

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

  const btnDel = document.createElement('button');
  btnDel.className = 'btn-danger';
  btnDel.textContent = '✕';
  btnDel.title = 'Delete route';
  btnDel.addEventListener('click', () => handleDeleteRoute(route.id));

  actions.appendChild(btnRun);
  actions.appendChild(btnEdit);
  actions.appendChild(btnDel);

  card.appendChild(info);
  card.appendChild(actions);
  return card;
}

// ── SETUP SCREEN ──────────────────────────────────────────────────────────────

function renderSetup(route) {
  editingRouteId = route ? route.id : null;
  showOnly('screen-setup');

  document.getElementById('setup-title').textContent = route ? 'Edit Route' : 'New Route';
  document.getElementById('route-name-input').value = route ? route.name : '';
  document.getElementById('split-list').innerHTML = '';
  hideSetupError();

  if (route && route.splitNames.length > 0) {
    route.splitNames.forEach(n => addSplitRow(n));
  } else {
    addSplitRow('');
  }
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
    const prevGold = activeRoute.goldSplits[i];
    if (prevGold == null || splitMs < prevGold) {
      tdTime.classList.add('gold');
    }

    tr.appendChild(tdName);
    tr.appendChild(tdGold);
    tr.appendChild(tdTime);
    tr.appendChild(tdDelta);
    tbody.appendChild(tr);
  });

  document.getElementById('btn-save').disabled = false;
  showOnly('screen-finish');
}

function handleSave() {
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

  // Sync back to routes array
  const idx = routes.findIndex(r => r.id === activeRoute.id);
  if (idx !== -1) routes[idx] = activeRoute;

  saveRoutes();
}

function handleDiscard() {
  renderHome();
}

function handleRunAgain() {
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
    } else if (state === 'finished') {
      renderHome();
    }
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  loadRoutes();
  renderHome();

  document.addEventListener('keydown', handleKeydown);

  // Home
  document.getElementById('btn-new-route').addEventListener('click', () => renderSetup(null));

  // Setup
  document.getElementById('btn-add-split').addEventListener('click', () => {
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

init();
