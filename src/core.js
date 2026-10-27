(function (root) {
  const STORAGE_KEY = 'go-may:v1';
  const normalize = value => String(value).normalize('NFC').replace(/\s+/gu, ' ');
  function distance(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let diagonal = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const previous = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
        diagonal = previous;
      }
    }
    return row[b.length];
  }
  function analyze(target, input) {
    const expected = normalize(target).trim();
    const actual = normalize(input);
    const wanted = expected.split(' ');
    const typed = actual.split(' ');
    const finishedCount = actual.endsWith(' ') ? typed.length - 1 : Math.max(0, typed.length - 1);
    let correctChars = 0;
    const mistakes = [];
    const words = wanted.map((text, index) => {
      const value = typed[index];
      let status = 'pending';
      if (value === text) {
        status = 'correct';
        correctChars += text.length + (index < wanted.length - 1 && index < finishedCount ? 1 : 0);
      } else if (index < finishedCount) {
        status = 'incorrect';
        mistakes.push({ index, value, errors: distance(text, value || '') });
      } else if (index === finishedCount) status = 'current';
      return { text, status };
    });
    const extraWords = typed.slice(wanted.length).filter(Boolean);
    extraWords.forEach((value, index) => mistakes.push({ index: wanted.length + index, value, errors: value.length }));
    const complete = actual.trimEnd() === expected;
    return {
      words, mistakes, correctChars, complete, extraWords,
      progress: complete ? 100 : Math.min(99, Math.round(correctChars / Math.max(1, expected.length) * 100))
    };
  }
  function recordMistakes(analysis, seen) {
    let added = 0;
    for (const mistake of analysis.mistakes) {
      const key = `${mistake.index}:${mistake.value}`;
      if (!seen.has(key)) { seen.set(key, true); added += mistake.errors; }
    }
    return added;
  }
  function metrics(correctChars, errors, seconds) {
    return {
      wpm: seconds > 0 ? Math.round((correctChars / 5) / (seconds / 60)) : 0,
      accuracy: correctChars + errors > 0 ? Math.round(correctChars / (correctChars + errors) * 100) : 100
    };
  }
  function canAccess(lesson, plusPreview) {
    return Boolean(lesson && (lesson.tier === 'free' || (lesson.tier === 'plus' && plusPreview === true)));
  }
  function readState(storage, defaults) {
    const fallback = JSON.parse(JSON.stringify(defaults));
    try {
      const value = JSON.parse(storage.getItem(STORAGE_KEY));
      if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
      const state = { ...fallback, plusPreview: value.plusPreview === true };
      if ('settings' in fallback && value.settings && typeof value.settings === 'object') {
        for (const key of Object.keys(fallback.settings)) {
          if (typeof value.settings[key] === typeof fallback.settings[key]) state.settings[key] = value.settings[key];
        }
      }
      if ('history' in fallback && Array.isArray(value.history)) {
        state.history = value.history.filter(item => item && typeof item.lessonId === 'string' &&
          typeof item.at === 'string' && Number.isFinite(Date.parse(item.at)) &&
          Number.isFinite(item.wpm) && item.wpm >= 0 && item.wpm <= 1000 &&
          Number.isFinite(item.accuracy) && item.accuracy >= 0 && item.accuracy <= 100 &&
          Number.isFinite(item.seconds) && item.seconds >= 0).slice(-200);
      }
      return state;
    } catch { return fallback; }
  }
  function saveState(storage, state) {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
    catch { return false; }
  }
  const api = { analyze, recordMistakes, metrics, canAccess, readState, saveState };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GoMayCore = api;
})(globalThis);
