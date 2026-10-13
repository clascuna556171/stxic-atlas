import { basename, dirname, posix } from 'node:path';
import type { AtlasData, AtlasEdge } from '../src/types.js';
import { readRepositoryFile, repositoryRoot, runGit } from './repository.js';
import { isGeneratedPath } from './sourceScope.js';

export function parseHistory(log: string) {
  return log.split('\x1e').filter((entry) => entry.length > 0).map((entry) => {
    const [header, ...paths] = entry.split('\0');
    // Git inserts one newline before the first filename; preserve the filename itself.
    if (paths.length) paths[0] = paths[0].replace(/^\r?\n/, '');
    return { author: header.split('\x1f')[1], files: paths.filter((path) => path.length > 0) };
  });
}

export async function analyzeRepository(value: unknown): Promise<AtlasData> {
  const root = await repositoryRoot(value);
  const hasHistory = await runGit(root, ['rev-parse', '--verify', 'HEAD']).then(() => true, () => false);
  const [{ stdout: log }, { stdout: files }, { stdout: branch }] = await Promise.all([
    hasHistory ? runGit(root, ['log', '-n', '400', '-z', '--format=%x1e%H%x1f%an', '--name-only', '--']) : Promise.resolve({ stdout: '' }),
    runGit(root, ['ls-files', '-z']),
    runGit(root, ['branch', '--show-current']),
  ]);
  const commits = parseHistory(log);
  const paths = files.split('\0').filter((path) => /\.(dart|ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|php|vue|svelte)$/.test(path))
    .filter((path) => !isGeneratedPath(path)).slice(0, 140);
  if (!paths.length) throw new Error('This project has no supported code saved in Git yet. Choose the app’s source folder or ask its developer to add the source files to Git. Flutter/Dart, JavaScript, TypeScript, Python, Go, Rust, Java, Kotlin, Ruby, PHP, Vue, and Svelte are supported.');
  const scope = new Set(paths);
  const counts = new Map<string, number>();
  const cochanges = new Map<string, number>();
  for (const commit of commits) {
    const changed = [...new Set(commit.files)].filter((path) => scope.has(path)).slice(0, 60);
    for (const path of changed) counts.set(path, (counts.get(path) ?? 0) + 1);
    for (let a = 0; a < changed.length; a++) for (let b = a + 1; b < changed.length; b++) {
      const key = [changed[a], changed[b]].sort().join('\0');
      cochanges.set(key, (cochanges.get(key) ?? 0) + 1);
    }
  }
  const included = [...paths].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)).slice(0, 28);
  const nodeIds = new Set(included);
  const edges: AtlasEdge[] = [];
  const extensions = ['.dart', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'];
  const dartPackages = new Map<string, string>();
  const dartRoots = [...new Set(paths.filter((path) => path.endsWith('.dart')).flatMap((path) => { const match = path.match(/^((?:.*\/)?)lib\//); return match ? [match[1]] : []; }))].slice(0, 8);
  for (const prefix of dartRoots) {
    try { const pubspec = await readRepositoryFile(root, prefix + 'pubspec.yaml', 25_000); const name = pubspec.match(/^name:\s*([a-zA-Z0-9_]+)/m)?.[1]; if (name) dartPackages.set(name, prefix + 'lib/'); } catch { /* Optional package metadata. */ }
  }
  for (const source of included) {
    if (!extensions.some((extension) => source.endsWith(extension))) continue;
    try {
      const content = await readRepositoryFile(root, source, 250_000);
      const pattern = /(?:\bfrom\s*|\b(?:import|export|part)\s*(?:\(\s*)?|\brequire\s*\(\s*)["']([^"']+)["']/g;
      for (const match of content.matchAll(pattern)) {
        const specifier = match[1];
        const packageImport = source.endsWith('.dart') ? specifier.match(/^package:([^/]+)\/(.+)$/) : null;
        const localDart = source.endsWith('.dart') && !specifier.includes(':');
        if (!specifier.startsWith('.') && !localDart && !(packageImport && dartPackages.has(packageImport[1]))) continue;
        const base = packageImport ? posix.join(dartPackages.get(packageImport[1])!, packageImport[2]) : posix.join(posix.dirname(source), specifier);
        const candidates = [base, ...extensions.map((ext) => `${base}${ext}`), ...extensions.map((ext) => `${base}/index${ext}`)];
        if (/\.[mc]?js$/.test(base)) candidates.push(base.replace(/\.[mc]?js$/, '.ts'), base.replace(/\.js$/, '.tsx'));
        const target = candidates.find((path) => nodeIds.has(path));
        if (target && target !== source && !edges.some((edge) => edge.kind === 'imports' && edge.from === source && edge.to === target)) {
          edges.push({ from: source, to: target, kind: 'imports', strength: 0.8, evidence: `${packageImport ? 'Local Dart package import' : 'Relative import'} ${specifier} in ${source}` });
        }
      }
    } catch { /* skipped source files provide no import evidence */ }
  }
  for (const [key, count] of cochanges) {
    const [from, to] = key.split('\0');
    if (count >= 2 && nodeIds.has(from) && nodeIds.has(to)) edges.push({ from, to, kind: 'cochange', strength: Math.min(1, count / 10), evidence: `Changed together in ${count} commits` });
  }
  return {
    repoPath: root, repository: basename(root), branch: branch.trim() || 'detached HEAD', scannedAt: new Date().toISOString(), synthetic: false,
    summary: { commits: commits.length, files: paths.length, contributors: new Set(commits.map((commit) => commit.author)).size, hotspots: [...counts.values()].filter((count) => count > 8).length },
    nodes: included.map((path, i) => ({ id: path, label: posix.basename(path), kind: /(?:test|spec)\./.test(path) ? 'test' : 'file', x: 35 + (i % 4) * 210, y: 40 + Math.floor(i / 4) * 68, commits: counts.get(path) ?? 0, churn: 0, group: dirname(path) === '.' ? 'root' : dirname(path) })),
    edges, findings: edges.slice(0, 8).map((edge) => ({ severity: 'medium', title: edge.kind === 'imports' ? `${edge.from} imports ${edge.to}` : `${edge.from} and ${edge.to} share change history`, detail: edge.kind === 'imports' ? 'An import between files in this project, found in the current source.' : 'These files appeared together in commits in the analyzed window.', evidence: edge.evidence, node: edge.to })), suggestedChecks: [],
  };
}
