import fs from 'fs';
import os from 'os';
import path from 'path';

export function getVaultPath() {
  const raw = process.env.VAULT_PATH || '';
  if (!raw) throw new Error('VAULT_PATH not set in .env');
  return raw.startsWith('~') ? path.join(os.homedir(), raw.slice(1)) : raw;
}

export function vaultExists() {
  try {
    const p = getVaultPath();
    return fs.existsSync(p) ? { ok: true, path: p } : { ok: false, path: p };
  } catch {
    return { ok: false, path: null };
  }
}
