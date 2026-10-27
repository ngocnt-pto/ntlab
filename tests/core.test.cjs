const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core.js');

test('unfinished Vietnamese accents are provisional, not incorrect', () => {
  const result = core.analyze('Em yêu trường em.', 'Em ye');
  assert.equal(result.words[1].status, 'current');
  assert.equal(result.mistakes.length, 0);
  assert.equal(result.complete, false);
});
test('wrong completed words are marked only after a delimiter', () => {
  const result = core.analyze('Em yêu trường em.', 'Em yeu ');
  assert.equal(result.words[1].status, 'incorrect');
  assert.equal(result.mistakes[0].errors, 1);
});
test('equivalent decomposed Vietnamese completes the lesson', () => {
  const result = core.analyze('Bé gõ chữ ở nhà.', 'Bé gõ chữ ở nhà.'.normalize('NFD'));
  assert.equal(result.complete, true);
  assert.equal(result.progress, 100);
});
test('final incomplete word is never accepted and extra words block completion', () => {
  assert.equal(core.analyze('Tôi yêu em.', 'Tôi yêu e').complete, false);
  assert.equal(core.analyze('Tôi yêu em.', 'Tôi yêu em. nhé').complete, false);
  assert.equal(core.analyze('Tôi yêu em.', 'Tôi yêu em. ').complete, true);
});
test('an exactly typed current word advances without requiring a space', () => {
  const result = core.analyze('Em yêu mẹ.', 'Em yêu');
  assert.equal(result.words[1].status, 'correct');
  assert.ok(result.progress > 40 && result.progress < 100);
});
test('correcting an earlier word restores completion', () => {
  assert.equal(core.analyze('Bé yêu mẹ.', 'Be yêu mẹ.').complete, false);
  assert.equal(core.analyze('Bé yêu mẹ.', 'Bé yêu mẹ.').complete, true);
});
test('mistakes remain in accuracy after correction, without repeat counting', () => {
  const seen = new Map();
  const wrong = core.analyze('Em yêu mẹ.', 'Em yeu ');
  assert.equal(core.recordMistakes(wrong, seen), 1);
  assert.equal(core.recordMistakes(wrong, seen), 0);
  assert.equal(core.recordMistakes(core.analyze('Em yêu mẹ.', 'Em yêu mẹ.'), seen), 0);
  assert.deepEqual(core.metrics(10, 1, 60), { wpm: 2, accuracy: 91 });
});
test('metrics stay finite for empty input and zero elapsed time', () => {
  assert.deepEqual(core.metrics(0, 0, 0), { wpm: 0, accuracy: 100 });
});
test('free users cannot open Plus lessons and preview can be revoked', () => {
  assert.equal(core.canAccess({ tier: 'free' }, false), true);
  assert.equal(core.canAccess({ tier: 'plus' }, false), false);
  assert.equal(core.canAccess({ tier: 'plus' }, true), true);
});
test('corrupt and unavailable storage recover to usable defaults', () => {
  const defaults = { history: [], plusPreview: false };
  assert.deepEqual(core.readState({ getItem: () => '{broken' }, defaults), defaults);
  assert.deepEqual(core.readState({ getItem: () => { throw Error('Denied'); } }, defaults), defaults);
  assert.equal(core.saveState({ setItem: () => { throw Error('Full'); } }, defaults), false);
});
test('stored history is bounded and invalid fields are discarded', () => {
  const storage = { getItem: () => JSON.stringify({ history: [{ lessonId: 'a', at: 'bad' }], plusPreview: 'yes', settings: null }) };
  const state = core.readState(storage, { history: [], plusPreview: false, settings: { calm: false } });
  assert.deepEqual(state.history, []);
  assert.equal(state.plusPreview, false);
  assert.deepEqual(state.settings, { calm: false });
});
