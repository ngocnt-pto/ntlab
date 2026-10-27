(function(root) {
  const groups = {
    'left-pinky':'1qaz`', 'left-ring':'2wsx', 'left-middle':'3edc', 'left-index':'45rtfgvb',
    'right-index':'67yuhjnm', 'right-middle':'8ik,', 'right-ring':'9ol.', 'right-pinky':"0p;/'[]\\-=", 'right-thumb':' '
  };
  const codes = { ' ':'Space', '`':'Backquote', '-':'Minus', '=':'Equal', '[':'BracketLeft', ']':'BracketRight', '\\':'Backslash', ';':'Semicolon', "'":'Quote', ',':'Comma', '.':'Period', '/':'Slash' };
  const shifts = { '~':'`', '!':'1', '@':'2', '#':'3', '$':'4', '%':'5', '^':'6', '&':'7', '*':'8', '(':'9', ')':'0', '_':'-', '+':'=', '{':'[', '}':']', '|':'\\', ':':';', '"':"'", '<':',', '>':'.', '?':'/' };
  function keyFor(char) {
    if (typeof char !== 'string' || char.length !== 1) return null;
    const base = shifts[char] || char.toLowerCase();
    const entry = Object.entries(groups).find(([,keys]) => keys.includes(base));
    if (!entry) return null;
    const finger = entry[0];
    const code = codes[base] || (/^[a-z]$/.test(base) ? `Key${base.toUpperCase()}` : `Digit${base}`);
    const shifted = Boolean(shifts[char]) || /^[A-Z]$/.test(char);
    return { code, label:base === ' ' ? 'Dấu cách' : base.toUpperCase(), finger, shift:shifted ? (finger.startsWith('left') ? 'ShiftRight' : 'ShiftLeft') : null };
  }
  function step(sequence, position, key) {
    position = Math.max(0,Math.min(sequence.length,position));
    if (key === 'Backspace') return { position:Math.max(0,position - 1), accepted:false, error:false };
    if (key.length !== 1 || position === sequence.length) return { position, accepted:false, error:false };
    const accepted = sequence[position] === key;
    return { position:position + (accepted ? 1 : 0), accepted, error:!accepted };
  }
  function diagnose(wpm, accuracy, wrongWords) { return { wpm, accuracy, review:[...new Set(wrongWords)].slice(0,5) }; }
  const fingerNames = { 'left-pinky':'Ngón út trái', 'left-ring':'Ngón áp út trái', 'left-middle':'Ngón giữa trái', 'left-index':'Ngón trỏ trái', 'left-thumb':'Ngón cái trái', 'right-pinky':'Ngón út phải', 'right-ring':'Ngón áp út phải', 'right-middle':'Ngón giữa phải', 'right-index':'Ngón trỏ phải', 'right-thumb':'Ngón cái phải' };
  const api = { step, keyFor, diagnose, fingerNames };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GoMayTrainer = api;
})(globalThis);
