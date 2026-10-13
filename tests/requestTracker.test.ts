import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RequestTracker } from '../src/requestTracker.ts';

test('rapid repeats cannot start duplicate work; completion allows retry', () => {
  const tracker = new RequestTracker();
  tracker.update('project-a');
  const first = tracker.begin('ai')!;
  assert.equal(tracker.begin('ai'), null);
  tracker.finish(first);
  const retry = tracker.begin('ai')!;
  assert.ok(retry);
  tracker.finish(first); // Late cleanup must not release a different active request.
  assert.equal(tracker.begin('ai'), null);
  tracker.finish(retry);
  assert.ok(tracker.begin('ai'));
});
test('switching A to B and back to A invalidates old results', () => {
  const tracker = new RequestTracker();
  tracker.update('project-a');
  const old = tracker.begin('scan')!;
  tracker.update('project-b');
  tracker.update('project-a');
  assert.equal(tracker.current(old), false);
  tracker.finish(old);
  const fresh = tracker.begin('scan')!;
  assert.equal(tracker.current(fresh), true);
});
test('AI preflight and unrelated operations can run without unlocking each other', () => {
  const tracker = new RequestTracker();
  tracker.update('project-a');
  const ai = tracker.begin('ai')!;
  const preview = tracker.begin('preview')!;
  assert.ok(preview);
  tracker.finish(preview);
  assert.equal(tracker.begin('ai'), null);
  tracker.update('project-b');
  assert.equal(tracker.current(ai), false);
  tracker.finish(ai);
  assert.ok(tracker.begin('ai'));
});
