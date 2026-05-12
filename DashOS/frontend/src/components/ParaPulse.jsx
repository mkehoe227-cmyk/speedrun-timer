import React, { useState } from 'react';

const BAR_COLORS = ['#c8d8b0','#b8c8d8','#d8cbb0','#d0c0d8','#c8d0c0','#d8c8b0'];
const MAX_HEIGHT = 56;

export default function ParaPulse({ activity, rot, onRefresh }) {
  const [flagging, setFlagging] = useState({});
  const [flagError, setFlagError] = useState('');

  const maxCount = Math.max(...(activity || []).map(p => p.count), 1);

  async function handleFlag(project) {
    setFlagging(f => ({ ...f, [project]: true }));
    setFlagError('');
    try {
      const res = await fetch('/api/vault/rot/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project })
      });
      if (!res.ok) throw new Error('Flag failed');
    } catch (e) {
      setFlagError(e.message);
    } finally {
      setFlagging(f => ({ ...f, [project]: false }));
    }
  }

  return (
    <div className="panel">
      <div className="panel-title">
        <span>PARA Pulse — File Velocity (48h)</span>
        <button className="btn-ghost" onClick={onRefresh}>↻ Refresh</button>
      </div>

      {(activity || []).length === 0 ? (
        <p style={{ fontSize: '11px', color: 'var(--ink-3)', fontStyle: 'italic' }}>No file activity in last 48h.</p>
      ) : (
        <div className="heatmap">
          {(activity || []).map((p, i) => (
            <div key={p.project} className="hm-col">
              <div
                className="hm-bar"
                style={{
                  height: `${Math.max(4, Math.round((p.count / maxCount) * MAX_HEIGHT))}px`,
                  background: BAR_COLORS[i % BAR_COLORS.length]
                }}
                title={`${p.project}: ${p.count} files`}
              />
              <div className="hm-label">{p.project.slice(0, 7)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="rot-heading">⚠ Rot Detected — Stale 14+ Days</div>

      {flagError && <div className="inline-error">{flagError}</div>}

      {(rot || []).length === 0 ? (
        <p style={{ fontSize: '11px', color: 'var(--green)', fontStyle: 'italic' }}>No stale projects.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Days Stale</th>
              <th>Last Modified</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(rot || []).map(r => (
              <tr key={r.project}>
                <td className="cell-name">{r.project}</td>
                <td className="cell-age">{r.daysStale}d</td>
                <td className="cell-date">{r.lastModified}</td>
                <td>
                  <span
                    className="cell-action"
                    onClick={() => !flagging[r.project] && handleFlag(r.project)}
                  >
                    {flagging[r.project] ? 'flagging...' : '→ archive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
