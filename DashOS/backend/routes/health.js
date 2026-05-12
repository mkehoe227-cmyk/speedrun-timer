import express from 'express';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getVaultPath } from '../vault-path.js';

export const healthRouter = express.Router();

const MAP_NAMES = ['me.md', 'vault_map.md', 'skills_map.md'];
const WARN_SIZE_BYTES = 10 * 1024;

healthRouter.get('/git', (req, res) => {
  try {
    const vault = getVaultPath();
    const ahead = parseInt(
      execSync('git rev-list @{u}..HEAD --count', { cwd: vault }).toString().trim(), 10
    );
    const status = execSync('git status --porcelain', { cwd: vault }).toString().trim();
    res.json({ git: true, ahead, hasChanges: status.length > 0 });
  } catch {
    res.json({ git: false, ahead: 0, hasChanges: false });
  }
});

healthRouter.get('/maps', (req, res) => {
  try {
    const vault = getVaultPath();
    const maps = MAP_NAMES.map(name => {
      const filePath = path.join(vault, 'AI OS', name);
      try {
        const stat = fs.statSync(filePath);
        return { name, exists: true, sizeBytes: stat.size, warn: stat.size > WARN_SIZE_BYTES };
      } catch {
        return { name, exists: false, sizeBytes: 0, warn: false };
      }
    });
    res.json(maps);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

healthRouter.get('/log', (req, res) => {
  try {
    const vault = getVaultPath();
    const logFile = path.join(vault, '📥 Inbox', 'AI Generated', 'hallucination-log.md');
    if (!fs.existsSync(logFile)) return res.json([]);
    const lines = fs.readFileSync(logFile, 'utf8')
      .split('\n')
      .filter(l => l.startsWith('- '))
      .slice(-10)
      .map(parsLogLine);
    res.json(lines);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

healthRouter.post('/log', (req, res) => {
  const { tag = 'general', message = '' } = req.body;
  try {
    const vault = getVaultPath();
    const logFile = path.join(vault, '📥 Inbox', 'AI Generated', 'hallucination-log.md');
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const entry = `- ${date} · ${tag} · ${message}\n`;
    fs.appendFileSync(logFile, entry, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

function parsLogLine(line) {
  // Format: "- YYYY-MM-DD · tag · message"
  const match = line.match(/^- (\S+) · (\S+) · (.+)$/);
  if (!match) return { date: '', tag: 'general', message: line };
  return { date: match[1], tag: match[2], message: match[3] };
}
