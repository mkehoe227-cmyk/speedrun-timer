import React, { useState } from 'react';

const PROJECTS = ['Atlas', 'FitnessApp', 'PGA Model', 'ObsidianTag', 'JobActivity', 'AI-OS'];
const VIBES = ['Productive', 'Deep Work', 'Frustrated', 'Exploring', 'Stuck', 'Debugging'];

export default function ContextInjector({ context, onInjected }) {
  const [project, setProject] = useState(context?.active_project || '');
  const [focus, setFocus] = useState(context?.focus || '');
  const [vibe, setVibe] = useState(context?.vibe || '');
  const [blocker, setBlocker] = useState(context?.blocker || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastInjected, setLastInjected] = useState(
    context?.updated ? `${context.active_project} · ${context.focus} · ${context.vibe}` : ''
  );

  async function handleInject() {
    if (!project) { setError('Select a project first.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_project: project, focus, vibe, blocker })
      });
      if (!res.ok) throw new Error('Write failed');
      const data = await res.json();
      setLastInjected(`${project} · ${focus} · ${vibe}`);
      onInjected?.(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel" style={{ gridRow: 'span 2' }}>
      <div className="panel-title">
        <span>Context Injector</span>
        <span style={{ fontSize: '9px', color: 'var(--green)', fontFamily: 'var(--stamp)' }}>● live</span>
      </div>

      <div className="active-box">
        <div className="active-box-label">Active Project</div>
        <div className="active-box-val">{project || '—'}</div>
      </div>

      <div className="proj-grid">
        {PROJECTS.map(p => (
          <button
            key={p}
            className={`proj-chip${project === p ? ' active' : ''}`}
            onClick={() => setProject(p)}
          >{p}</button>
        ))}
      </div>

      <div className="field">
        <div className="field-label">Current Focus</div>
        <input
          className="field-input"
          type="text"
          placeholder="What are you working on?"
          value={focus}
          onChange={e => setFocus(e.target.value)}
        />
      </div>

      <div className="field">
        <div className="field-label">Vibe Check</div>
        <div className="vibe-row">
          {VIBES.map(v => (
            <div
              key={v}
              className={`vibe-tag${vibe === v ? ' active' : ''}`}
              onClick={() => setVibe(vibe === v ? '' : v)}
            >{v}</div>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="field-label">Frustration Note</div>
        <input
          className="field-input"
          type="text"
          placeholder="What's blocking you?"
          value={blocker}
          onChange={e => setBlocker(e.target.value)}
        />
      </div>

      {error && <div className="inline-error">{error}</div>}

      <button className="btn-primary" onClick={handleInject} disabled={loading} style={{ marginTop: '12px' }}>
        {loading ? 'Injecting...' : 'Inject Context'}
      </button>

      {lastInjected && (
        <div className="last-inject">
          Last injected · {lastInjected}
        </div>
      )}
    </div>
  );
}
