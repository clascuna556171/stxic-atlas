import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { analyzeRepository } from '../server/analyze.ts';
import { previewChanges } from '../server/review.ts';
import { runGit } from '../server/repository.ts';

for (const helperType of ['clean', 'process'] as const) {
  test(`configured Git ${helperType} filters never execute during preview`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'atlas-helper-test-'));
    try {
      await runGit(directory, ['init']);
      await writeFile(join(directory, 'a.ts'), 'export const a = 1;\n');
      await writeFile(join(directory, '.gitattributes'), 'a.ts filter=fixture\n');
      await runGit(directory, ['add', '--', 'a.ts', '.gitattributes']);
      await runGit(directory, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Synthetic baseline']);
      await writeFile(join(directory, 'a.ts'), 'export const a = 2;\n');
      const marker = join(directory, 'helper-ran');
      const helper = join(directory, 'helper.cjs');
      await writeFile(helper, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'synthetic marker'); process.stdin.pipe(process.stdout);`);
      const command = `"${process.execPath.replaceAll('\\', '/')}" "${helper.replaceAll('\\', '/')}"`;
      await runGit(directory, ['config', `filter.fixture.${helperType}`, command]);
      await runGit(directory, ['config', 'filter.fixture.required', 'true']);
      await assert.rejects(previewChanges({ repoPath: directory }), /configured Git clean\/process filters/);
      await assert.rejects(access(marker));
      assert.equal((await analyzeRepository(directory)).nodes[0].id, 'a.ts');
      // The user's configuration is preserved; this test alone removes its fixture setting.
      assert.equal((await runGit(directory, ['config', '--get', `filter.fixture.${helperType}`])).stdout.trim(), command);
      await runGit(directory, ['config', '--unset', `filter.fixture.${helperType}`]);
      await runGit(directory, ['config', '--unset', 'filter.fixture.required']);
      await runGit(directory, ['config', `filter.unused.${helperType}`, command]);
      assert.match((await previewChanges({ repoPath: directory })).diff, /a = 2/);
      await assert.rejects(access(marker));
    } finally {
      assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
      await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
}
