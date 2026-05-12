import React, { useState, useEffect, useCallback } from 'react';
import ContextInjector from './components/ContextInjector.jsx';
import ParaPulse from './components/ParaPulse.jsx';
import SystemHealth from './components/SystemHealth.jsx';

export default function App() {
  const [vaultOk, setVaultOk] = useState(true);
  const [context, setContext] = useState(null);
  const [activity, setActivity] = useState([]);
  const [rot, setRot] = useState([]);
  const [git, setGit] = useState(null);
  const [maps, setMaps] = useState([]);
  const [log, setLog] = useState([]);
  const [clock, setClock] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [vaultStatus, ctxRes, actRes, rotRes, gitRes, mapsRes, logRes] = await Promise.all([
        fetch('/api/vault-status').then(r => r.json()),
        fetch('/api/context').then(r => r.json()),
        fetch('/api/vault/activity').then(r => r.json()),
        fetch('/api/vault/rot').then(r => r.json()),
        fetch('/api/health/git').then(r => r.json()),
        fetch('/api/health/maps').then(r => r.json()),
        fetch('/api/health/log').then(r => r.json()),
      ]);
      setVaultOk(vaultStatus.ok);
      setContext(ctxRes);
      setActivity(Array.isArray(actRes) ? actRes : []);
      setRot(Array.isArray(rotRes) ? rotRes : []);
      setGit(gitRes);
      setMaps(Array.isArray(mapsRes) ? mapsRes : []);
      setLog(Array.isArray(logRes) ? logRes : []);
    } catch {
      setVaultOk(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const healthInterval = setInterval(async () => {
      try {
        const [gitRes, mapsRes] = await Promise.all([
          fetch('/api/health/git').then(r => r.json()),
          fetch('/api/health/maps').then(r => r.json()),
        ]);
        setGit(gitRes);
        setMaps(Array.isArray(mapsRes) ? mapsRes : []);
      } catch {}
    }, 60000);
    return () => clearInterval(healthInterval);
  }, [fetchAll]);

  useEffect(() => {
    const tick = () => setClock(new Date().toTimeString().slice(0, 8));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const rotCount = rot.length;
  const mapsOk = maps.every(m => m.exists);
  const gitAhead = git?.ahead ?? 0;

  return (
    <div className="app">
      {!vaultOk && (
        <div className="vault-error">
          ✗ Vault not found. Set <code>VAULT_PATH</code> in <code>.env</code> and restart the backend.
        </div>
      )}

      <header className="header">
        <div>
          <div className="logo">DashOS</div>
          <div className="logo-sub">AI Operating System · v1.0.0</div>
        </div>
        <div className="header-right">
          <div className="status-chip">
            <div className={`dot ${mapsOk ? 'ok' : 'err'}`} />
            maps {mapsOk ? 'ok' : 'error'}
          </div>
          {rotCount > 0 && (
            <div className="status-chip">
              <div className="dot warn" />
              {rotCount} stale
            </div>
          )}
          {gitAhead > 0 && (
            <div className="status-chip">
              <div className="dot warn" />
              ↑ {gitAhead} ahead
            </div>
          )}
          <div className="clock">{clock}</div>
        </div>
      </header>

      <div className="grid">
        <ContextInjector context={context} onInjected={fetchAll} />
        <div className="right-col">
          <ParaPulse activity={activity} rot={rot} onRefresh={fetchAll} />
          <SystemHealth git={git} maps={maps} log={log} onRefresh={fetchAll} />
        </div>
      </div>
    </div>
  );
}
