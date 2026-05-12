import express from 'express';
import fs from 'fs';
import path from 'path';
import { getVaultPath } from '../vault-path.js';

export const contextRouter = express.Router();

function contextFilePath() {
  return path.join(getVaultPath(), 'AI OS', 'current_context.md');
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { active_project: '', focus: '', vibe: '', blocker: '', updated: null };
  const obj = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const idx = line.indexOf(': ');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 2).replace(/^"|"$/g, '');
    obj[k] = v;
  }
  return obj;
}

contextRouter.get('/', (req, res) => {
  try {
    const raw = fs.readFileSync(contextFilePath(), 'utf8');
    res.json(parseFrontmatter(raw));
  } catch {
    res.json({ active_project: '', focus: '', vibe: '', blocker: '', updated: null });
  }
});

contextRouter.post('/', (req, res) => {
  const { active_project = '', focus = '', vibe = '', blocker = '' } = req.body;
  const updated = new Date().toISOString().slice(0, 19);
  const content = [
    '---',
    `active_project: ${active_project}`,
    `focus: ${focus}`,
    `vibe: ${vibe}`,
    `blocker: "${blocker}"`,
    `updated: ${updated}`,
    '---',
    ''
  ].join('\n');
  try {
    const filePath = contextFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ ok: true, updated });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
