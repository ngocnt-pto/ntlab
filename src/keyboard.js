(function(root) {
  const trainer = root.GoMayTrainer, keys = new Map();
  const $ = selector => document.querySelector(selector);
  function hand(side) {
    const left = side === 'left';
    const base = left ? 'translate(18 0)' : 'translate(492 0) scale(-1 1)';
    const fingers = [['pinky',25,67,22,68],['ring',54,34,25,101],['middle',86,17,25,118],['index',118,36,25,99]];
    return `<g transform="${base}" class="hand"><path class="palm" d="M25 113Q24 105 39 107L143 107Q166 122 160 157L151 207H50L31 170Q23 147 25 113Z"/>${fingers.map(([name,x,y,w,h]) => `<rect data-finger="${side}-${name}" class="finger ${name}" x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/>`).join('')}<rect data-finger="${side}-thumb" class="finger thumb" x="156" y="103" width="25" height="78" rx="12" transform="rotate(32 168 142)"/><path class="palm-line" d="M56 154q30-15 65 0m-56 18q22-8 42 0"/></g>`;
  }
  function mount() {
    const rows = [
      [['`','Backquote'],...Array.from('1234567890').map(label => [label,`Digit${label}`]),['-','Minus'],['=','Equal'],['⌫','Backspace',1.7]],
      [['Tab','Tab',1.4],...Array.from('QWERTYUIOP').map(label => [label,`Key${label}`]),['[','BracketLeft'],[']','BracketRight'],['\\','Backslash',1.4]],
      [['Caps','CapsLock',1.7],...Array.from('ASDFGHJKL').map(label => [label,`Key${label}`]),[';','Semicolon'],["'",'Quote'],['Enter','Enter',2.1]],
      [['Shift','ShiftLeft',2.2],...Array.from('ZXCVBNM').map(label => [label,`Key${label}`]),[',','Comma'],['.','Period'],['/','Slash'],['Shift','ShiftRight',2.6]],
      [['Ctrl','ControlLeft',1.2],['⊞','MetaLeft'],['Alt','AltLeft'],['Dấu cách','Space',7],['Alt','AltRight'],['Fn','ContextMenu'],['Ctrl','ControlRight',1.2]]
    ];
    rows.forEach(row => {
      const element = document.createElement('div'); element.className = 'key-row';
      row.forEach(([label,code,weight = 1]) => {
        const key = document.createElement('button'); key.type = 'button'; key.tabIndex = -1;
        const meta = trainer.keyFor(code === 'Space' ? ' ' : label.length === 1 ? label.toLowerCase() : '');
        const finger = meta?.finger || (code === 'ShiftLeft' ? 'left-pinky' : code === 'ShiftRight' ? 'right-pinky' : null);
        key.className = `key ${finger ? finger.split('-')[1] : 'modifier'} ${['KeyF','KeyJ'].includes(code) ? 'home-key' : ''}`;
        key.style.flex = weight; key.textContent = label; key.dataset.code = code;
        key.setAttribute('aria-label',`${label}${finger ? ` — ${trainer.fingerNames[finger]}` : ''}`);
        key.addEventListener('click', () => explain({code,label,finger,shift:null},true));
        keys.set(code,key); element.append(key);
      });
      $('#keyboard').append(element);
    });
    $('#hands').innerHTML = `<svg viewBox="0 0 510 244" role="img" aria-label="Hai bàn tay nhìn từ trên xuống. Ngón cần dùng được tô sáng.">${hand('left')}${hand('right')}<text x="119" y="237" text-anchor="middle">TAY TRÁI</text><text x="391" y="237" text-anchor="middle">TAY PHẢI</text></svg>`;
  }
  function clear() {
    document.querySelectorAll('.key.suggested,.finger.active').forEach(node => node.classList.remove('suggested','active'));
  }
  function explain(meta, explore = false) {
    clear();
    if (!meta) {
      keys.get('KeyF')?.classList.add('suggested'); keys.get('KeyJ')?.classList.add('suggested');
      document.querySelectorAll('[data-finger="left-index"],[data-finger="right-index"]').forEach(node => node.classList.add('active'));
      $('#next-key').textContent = 'F / J'; $('#finger-name').textContent = 'Hai ngón trỏ tìm điểm tựa';
      $('#finger-instruction').textContent = 'F bên trái, J bên phải — có gờ nổi.'; return;
    }
    keys.get(meta.code)?.classList.add('suggested');
    if (meta.shift) keys.get(meta.shift)?.classList.add('suggested');
    if (meta.finger) $(`[data-finger="${meta.finger}"]`)?.classList.add('active');
    $('#next-key').textContent = meta.label;
    $('#finger-name').textContent = meta.finger ? trainer.fingerNames[meta.finger] : 'Phím chức năng';
    $('#finger-instruction').textContent = meta.shift ? `Giữ ${meta.shift === 'ShiftLeft' ? 'Shift trái' : 'Shift phải'} bằng ngón út tay còn lại.` : explore ? 'Đây là ngón phụ trách phím bạn vừa chọn.' : 'Gõ xong, đưa ngón về hàng phím cơ sở.';
  }
  function press(code) { keys.get(code)?.classList.add('pressed'); }
  function release(code) { keys.get(code)?.classList.remove('pressed'); }
  function releaseAll() { keys.forEach(key => key.classList.remove('pressed')); }
  root.GoMayKeyboard = { mount,explain,press,release,releaseAll };
})(globalThis);
