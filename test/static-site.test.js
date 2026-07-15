import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const html = readFileSync(join(root, 'index.html'), 'utf8');

function isLocal(reference) {
  return reference && !/^(?:[a-z]+:|#|\/\/)/i.test(reference);
}

test('HTML asset references stay relative and exist for project Pages', () => {
  const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(match => match[1])
    .filter(isLocal);
  assert.ok(references.length >= 4);
  references.forEach(reference => {
    assert.equal(reference.startsWith('/'), false, `${reference} must not be root-relative`);
    const path = join(root, reference.split(/[?#]/)[0]);
    assert.equal(existsSync(path), true, `${reference} must exist`);
  });
});

test('all relative JavaScript module imports resolve', () => {
  const pending = [join(root, 'js', 'app.js')];
  const checked = new Set();
  while (pending.length) {
    const file = normalize(pending.pop());
    if (checked.has(file)) continue;
    checked.add(file);
    const source = readFileSync(file, 'utf8');
    const references = [
      ...source.matchAll(/from\s+['"](\.[^'"]+)['"]/g),
      ...source.matchAll(/new URL\(['"](\.[^'"]+)['"]/g)
    ].map(match => match[1]);
    references.forEach(reference => {
      const resolved = normalize(join(dirname(file), reference));
      assert.equal(existsSync(resolved), true, `${reference} imported by ${file} must exist`);
      if (resolved.endsWith('.js')) pending.push(resolved);
    });
  }
  assert.ok(checked.size >= 7);
});

test('install metadata is valid and scoped to the repository path', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  manifest.icons.forEach(icon => assert.equal(existsSync(join(root, icon.src)), true));
});
