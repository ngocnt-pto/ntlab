const { test } = require('node:test');
const assert = require('node:assert/strict');
const trainer = require('../src/trainer.js');
const course = require('../src/lessons.js');

test('a wrong physical key cannot advance the guided exercise', () => {
  assert.deepEqual(trainer.step('da ga', 0, 'f'), { position: 0, accepted: false, error: true });
  assert.deepEqual(trainer.step('da ga', 0, 'd'), { position: 1, accepted: true, error: false });
});
test('backspace returns to previous key, modifiers do not count as mistakes', () => {
  assert.equal(trainer.step('da', 1, 'Backspace').position, 0);
  assert.equal(trainer.step('da', 0, 'Backspace').position, 0);
  assert.equal(trainer.step('da', 0, 'Shift').error, false);
  assert.equal(trainer.step('da', 0, 'ArrowLeft').error, false);
});
test('finger guidance names the actual hand and standard assigned finger', () => {
  assert.equal(trainer.keyFor('f').finger, 'left-index');
  assert.equal(trainer.keyFor('j').finger, 'right-index');
  assert.equal(trainer.keyFor('d').finger, 'left-middle');
  assert.equal(trainer.keyFor('k').finger, 'right-middle');
  assert.equal(trainer.keyFor('b').finger, 'left-index');
  assert.equal(trainer.keyFor(' ').finger, 'right-thumb');
});
test('uppercase and punctuation show the correct base key and opposite Shift', () => {
  assert.deepEqual(trainer.keyFor('A'), { code:'KeyA', label:'A', finger:'left-pinky', shift:'ShiftRight' });
  assert.equal(trainer.keyFor('?').code, 'Slash');
  assert.equal(trainer.keyFor('?').shift, 'ShiftLeft');
  assert.equal(trainer.keyFor('ế'), null);
});
test('Telex exercise shows fixed physical sequences instead of inventing a key for accents', () => {
  assert.equal(trainer.keyFor('s').code, 'KeyS');
  assert.deepEqual(trainer.step('dda', 1, 'd'), { position: 2, accepted: true, error: false });
  assert.equal(trainer.step('dda', 2, 'đ').error, true);
});
test('course has 15 ordered days, real exercises and only day 1 is free', () => {
  assert.equal(course.days.length, 15);
  assert.equal(course.lessons.length, 45);
  assert.deepEqual(course.days.map(day => day.day), [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
  assert.equal(course.lessons.filter(item => item.tier === 'free').length, 3);
  for (const lesson of course.lessons) {
    assert.ok(lesson.text.length > 5);
    if (lesson.mode === 'keys') for (const char of lesson.text) assert.ok(trainer.keyFor(char), `Unmapped key: ${char}`);
  }
});
test('first meaningful-word demo only uses advertised home-row keys', () => {
  const first = course.lessons[0];
  assert.equal(first.text, 'da ga ha la sa');
  for (const char of first.text) assert.ok('asdfghjkl; '.includes(char));
});
test('diagnosis sticks to observed errors and never infers fingers or daily savings', () => {
  const result = trainer.diagnose(24, 96, ['gõ', 'gõ', 'Việt']);
  assert.equal(result.wpm, 24);
  assert.equal(result.accuracy, 96);
  assert.deepEqual(result.review, ['gõ','Việt']);
  assert.equal(result.fingerDiagnosis, undefined);
  assert.equal(result.hoursSaved, undefined);
});
