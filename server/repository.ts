import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isAbsolute, relative, resolve, sep, join } from 'node:path';
import { lstat, readFile, realpath } from 'node:fs/promises';

const exec = promisify(execFile);
export function runGit(repoPath: string, args: string[], maxBuffer = 8 * 1024 * 1024) {
  return exec('git', ['-c', 'core.quotePath=false', '-c', 'core.fsmonitor=false', ...args], { cwd: repoPath, maxBuffer, timeout: 20000, windowsHide: true });
}

export async function repositoryRoot(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw.length > 2048 || raw.includes('\0') || !isAbsolute(raw)) throw new Error('Enter an absolute local Git repository folder path.');
  const selected = await realpath(resolve(raw));
  const { stdout } = await runGit(selected, ['rev-parse', '--show-toplevel']);
  const root = await realpath(stdout.trim());
  if (root !== selected) throw new Error('Choose the repository root folder.');
  return root;
}

// Check every path component: a regular file inside a symlinked directory is unsafe too.
export async function readRepositoryFile(root: string, path: string, maxBytes: number) {
  const full = resolve(root, path);
  const rel = relative(root, full);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('File is outside the repository.');
  let current = root;
  for (const part of rel.split(sep)) {
    current = join(current, part);
    if ((await lstat(current)).isSymbolicLink()) throw new Error('Symlinks are excluded.');
  }
  const stat = await lstat(full);
  if (!stat.isFile() || stat.size > maxBytes) throw new Error('File is not a bounded source file.');
  const content = await readFile(full, 'utf8');
  if (Buffer.byteLength(content) > maxBytes || content.includes('\0')) throw new Error('File is oversized or binary.');
  return content;
}
