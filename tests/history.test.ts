import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHistory } from '../server/analyze.ts';

test('history preserves whitespace and quoted characters in NUL-delimited Git filenames', () => {
  const paths = [' leading space.ts', 'déjà vu.ts', 'line\nbreak.ts', 'tab\tname.ts', 'quote"name.ts'];
  const log = `\x1eabc\x1fFixture\0\n${paths.join('\0')}\0\x1edef\x1fSecond author\0\nnormal.ts\0`;
  assert.deepEqual(parseHistory(log), [
    { author: 'Fixture', files: paths },
    { author: 'Second author', files: ['normal.ts'] },
  ]);
  assert.deepEqual(parseHistory(''), []);
});
