import express from 'express';
import fs from 'fs';
import path from 'path';
import { getVaultPath } from '../vault-path.js';

export const vaultRouter = express.Router();

const HOURS_48 = 48 * 60 * 60 * 1000;
const DAYS_14  = 14 * 24 * 60 * 60 * 1000;

function walkDir(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, results);
    else if (entry.name.endsWith('.md')) results.push(full);
  }
  return results;
}

function getProjectDirs(vault) {
  const areas = path.join(vault, '🗺️ Areas');
  if (!fs.existsSync(areas)) return [];
  return fs.readdirSync(areas, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => ({ name: e.name, dir: path.join(areas, e.name) }));
}

vaultRouter.get('/activity', (req, res) => {
  try {
    const vault = getVaultPath();
    const now = Date.now();
    const projects = getProjectDirs(vault);
    const result = [];

    for (const { name, dir } of projects) {
      const files = walkDir(dir);
      const recent = files.filter(f => {
        try { return now - fs.statSync(f).mtime.getTime() < HOURS_48; }
        catch { return false; }
      });
      if (recent.length > 0) result.push({ project: name, count: recent.length });
    }

    result.sort((a, b) => b.count - a.count);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

vaultRouter.get('/rot', (req, res) => {
  try {
    const vault = getVaultPath();
    const now = Date.now();
    const projects = getProjectDirs(vault);
    const result = [];

    for (const { name, dir } of projects) {
      const files = walkDir(dir);
      if (files.length === 0) continue;
      const newest = files.reduce((max, f) => {
        try { return Math.max(max, fs.statSync(f).mtime.getTime()); } catch { return max; }
      }, 0);
      const age = now - newest;
      if (age >= DAYS_14) {
        result.push({
          project: name,
          daysStale: Math.floor(age / (24 * 60 * 60 * 1000)),
          lastModified: new Date(newest).toISOString().slice(0, 10)
        });
      }
    }

    result.sort((a, b) => b.daysStale - a.daysStale);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

vaultRouter.post('/rot/flag', (req, res) => {
  const { project } = req.body;
  if (!project) return res.status(400).json({ ok: false, error: 'project required' });
  try {
    const vault = getVaultPath();
    const flagFile = path.join(vault, '📥 Inbox', 'AI Generated', 'rot-flagged.md');
    fs.mkdirSync(path.dirname(flagFile), { recursive: true });
    const entry = `- ${new Date().toISOString().slice(0, 10)} · ${project} flagged for archiving\n`;
    fs.appendFileSync(flagFile, entry, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
