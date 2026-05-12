import React, { useState } from 'react';

export default function SystemHealth({ git, maps, log, onRefresh }) {
  const [message, setMessage] = useState('');
  const [tag, setTag] = useState('general');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [localLog, setLocalLog] = useState(log || []);

  const ahead = git?.ahead ?? 0;
  const gitOk = git?.git && ahead === 0;

  async function handleFlag() {
    if (!message.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/health/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag, message })
      });
      if (!res.ok) throw new Error('Flag failed');
      const date = new Date().toISOString().slice(0, 10);
      setLocalLog(l => [{ date, tag, message }, ...l].slice(0, 10));
      setMessage('');
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-title">
        <span>System Health</span>
        <button className="btn-ghost" onClick={onRefresh}>↻ Refresh</button>
      </div>

      <div className={`git-bar${gitOk ? ' ok' : ''}`}>
        <span className="arrow">{ahead > 0 ? '↑' : '✓'}</span>
        <span className="repo">Private vault · origin/main</span>
        <span className="ahead">
          {!git?.git ? 'no git' : ahead > 0 ? `${ahead} commits ahead` : 'synced'}
        </span>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-l">Vault</div>
          <div className={`stat-v ${git?.git !== false ? 'ok' : 'warn'}`}>
            {git?.git !== false ? 'OK' : '—'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-l">Maps</div>
          <div className={`stat-v ${(maps || []).every(m => m.exists) ? 'ok' : 'err'}`}>
            {(maps || []).filter(m => m.exists).length} / {(maps || []).length || 3}
          </div>
        </div>
        <div className="stat">
          <div className="stat-l">Skills</div>
          <div className="stat-v ok">40</div>
        </div>
      </div>

      <div className="map-list">
        {(maps || []).map(m => (
          <div key={m.name} className="map-item">
            <span className={`map-indicator ${m.exists ? (m.warn ? 'warn' : 'ok') : 'err'}`}>
              {m.exists ? (m.warn ? '!' : '✓') : '✗'}
            </span>
            <span className="map-name">{m.name}</span>
            <span className="map-meta">
              {m.exists ? `${(m.sizeBytes / 1024).toFixed(1)} KB · ${m.warn ? 'large' : 'valid'}` : 'missing'}
            </span>
          </div>
        ))}
      </div>

      <hr className="divider" />

      <div className="log-section-title">Hallucination Log</div>

      <div className="log-entries">
        {localLog.length === 0 ? (
          <p style={{ fontSize: '11px', color: 'var(--ink-3)', fontStyle: 'italic', padding: '4px 8px' }}>No entries yet.</p>
        ) : localLog.map((e, i) => (
          <div key={i} className="log-entry">
            <span className="log-ts">{e.date}</span>
            <span className="log-msg">{e.message}</span>
            <span className={`log-tag ${e.tag}`}>{e.tag}</span>
          </div>
        ))}
      </div>

      {submitError && <div className="inline-error">{submitError}</div>}

      <div className="log-add">
        <select
          value={tag}
          onChange={e => setTag(e.target.value)}
          className="field-input"
          style={{ width: 'auto', flex: '0 0 auto' }}
        >
          <option value="yes-man">yes-man</option>
          <option value="identity">identity</option>
          <option value="general">general</option>
        </select>
        <input
          className="field-input"
          type="text"
          placeholder="Describe the failure..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleFlag()}
        />
        <button className="btn-danger" onClick={handleFlag} disabled={submitting}>
          {submitting ? '...' : 'Flag'}
        </button>
      </div>
    </div>
  );
}
