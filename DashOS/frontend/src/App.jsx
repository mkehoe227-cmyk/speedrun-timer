import React from 'react';

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="logo">DashOS</div>
          <div className="logo-sub">AI Operating System · v1.0.0</div>
        </div>
      </header>
      <main className="grid">
        <p style={{ padding: '20px', color: 'var(--ink-3)' }}>Loading...</p>
      </main>
    </div>
  );
}
