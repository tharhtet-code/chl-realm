#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const distDir = resolve(process.cwd(), 'dist');
if (!existsSync(join(distDir, 'index.html'))) {
  console.error('Error: dist/index.html not found. Run `npm run build` first.');
  process.exit(1);
}

const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
const tempDir = mkdtempSync(join(tmpdir(), 'chl-realm-pages-'));

try {
  cpSync(distDir, tempDir, { recursive: true });
  writeFileSync(join(tempDir, '.nojekyll'), '');
  copyFileSync(join(tempDir, 'index.html'), join(tempDir, '404.html'));

  const run = (cmd) => execSync(cmd, { cwd: tempDir, stdio: 'inherit' });
  run('git init -b gh-pages');
  run('git add -A');
  run('git -c user.name="CHL Realm Bot" -c user.email="noreply@github.com" commit -m "Deploy CHL Realm to GitHub Pages"');
  run(`git remote add origin "${remoteUrl}"`);
  run('git push -f origin gh-pages');
  console.log('\nSuccessfully pushed dist/ to gh-pages branch!');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
