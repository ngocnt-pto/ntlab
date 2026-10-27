(() => {
  'use strict';
  const core = GoMayCore, trainer = GoMayTrainer, course = GoMayCourse, service = GoMayServices;
  const keyboard = GoMayKeyboard, audio = GoMayAudio;
  const $ = selector => document.querySelector(selector);
  const input = $('#typing-input'), modal = $('#modal');
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const escape = value => String(value).replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const formatTime = seconds => `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  const profileNames = { thock:'Thock · Trầm & êm',click:'Click · Giòn & rõ',soft:'Soft · Nhẹ & dịu',pop:'Pop · Vui & gọn',typewriter:'Retro · Máy đánh chữ' };
  let lesson = course.quick, channel = 'quick', view = 'practice', text = lesson.text;
  let analysis = core.analyze(text,''), position = 0, errors = 0, elapsed = 0, started = false, complete = false, composing = false;
  let lastTick = performance.now(), windowActive = true, toastTimer, composeTimer;
  let seen = new Map(), wrongWords = [], activeViewBeforeModal, lastStats = { wpm: 0, accuracy: 100 };
  const hubBar = typeof NTLabUI !== 'undefined' ? NTLabUI.mountBar('go-may', scope => showCheckout(scope)) : null;

  function toast(message) {
    $('#toast').textContent = message; $('#toast').classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'),4200);
  }
  function save() { if (!service.save()) toast('Chưa lưu được vào trình duyệt. Bạn vẫn có thể luyện trong phiên này.'); }
  function showModal(html) {
    $('#modal-content').innerHTML = html;
    const heading = $('#modal-content h2'); if (heading) heading.id = 'modal-title';
    activeViewBeforeModal = view;
    if (!modal.open) modal.showModal();
    lastTick = performance.now();
  }
  function closeModal() { modal.close(); lastTick = performance.now(); }
  $('.modal-close').addEventListener('click',closeModal);
  modal.addEventListener('close',() => { lastTick = performance.now(); });
  modal.addEventListener('click',event => {
    if (event.target !== modal) return;
    const rect = modal.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeModal();
  });
  function setView(name,hash = true) {
    if (!['practice','roadmap','progress'].includes(name)) name = 'practice';
    view = name;
    document.querySelectorAll('.view').forEach(node => { node.hidden = node.id !== `view-${name}`; });
    document.querySelectorAll('.nav-link').forEach(node => {
      const active = node.dataset.view === name; node.classList.toggle('active',active);
      if (active) node.setAttribute('aria-current','page'); else node.removeAttribute('aria-current');
    });
    if (name === 'roadmap') renderDays();
    if (name === 'progress') renderHistory();
    if (hash) try { history.replaceState(null,'',`#${name}`); } catch { /* file URL */ }
    lastTick = performance.now(); window.scrollTo({top:0,behavior:'instant'});
  }
  function applySettings() {
    service.syncPlatform?.();
    const settings = service.state.settings;
    if (!['office','kids'].includes(settings.audience)) settings.audience = 'office';
    if (!audio.profiles.includes(settings.soundProfile)) settings.soundProfile = 'thock';
    if (!service.state.plusPreview && settings.soundProfile !== 'thock') settings.soundProfile = 'thock';
    $('#sound-toggle').setAttribute('aria-pressed',String(settings.sound));
    $('#sound-toggle').setAttribute('aria-label',settings.sound ? 'Tắt âm thanh' : 'Bật âm thanh');
    $('#sound-profile').value = settings.soundProfile;
    $('#coach-card').hidden = !settings.keyboard;
    document.querySelectorAll('[data-audience]').forEach(button => {
      const active = button.dataset.audience === settings.audience;
      button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active));
    });
    const mode = service.platform ? service.platform.unlockStatus('go-may') : (service.state.plusPreview ? 'preview-single' : 'free');
    $('#plan-badge').textContent = mode.startsWith('license') ? 'Plus · Đã mở khóa' : service.state.plusPreview ? 'Plus · Xem thử local' : 'Học thử miễn phí';
    hubBar?.render();
  }
  function selectLesson(id,source = 'course',focus = true) {
    const candidate = id === 'quick-test' ? course.quick : course.lessons.find(item => item.id === id);
    if (!candidate) return;
    if (!service.access(candidate)) { showCheckout(); return; }
    lesson = candidate; channel = source; resetPractice(focus); setView('practice');
  }
  function resetPractice(focus = false) {
    clearTimeout(composeTimer);
    text = service.state.settings.audience === 'office' && lesson.officeText ? lesson.officeText : lesson.text;
    analysis = core.analyze(text,''); position = 0; errors = 0; elapsed = 0; started = false; complete = false; composing = false;
    seen = new Map(); wrongWords = []; lastTick = performance.now();
    input.value = ''; input.disabled = false; input.readOnly = lesson.mode === 'keys'; input.maxLength = Math.min(2000,text.length*3);
    input.placeholder = lesson.mode === 'keys' ? 'Bấm vào đây, rồi gõ phím đang sáng. Mây sẽ dẫn đường…' : 'Bấm vào đây, gõ câu tiếng Việt ở trên…';
    $('#exercise-kicker').textContent = channel === 'quick' ? 'GÕ THỬ · MỘT CÂU NGẮN' : channel === 'magic' ? 'TRẢI NGHIỆM · ĐẶT ĐÚNG NGÓN' : `NGÀY ${lesson.day} · BÀI ${lesson.part}/3`;
    $('#exercise-title').textContent = channel === 'quick' ? 'Bạn gõ tiếng Việt nhanh đến đâu?' : lesson.title;
    $('#mode-hint').textContent = lesson.mode === 'keys' ? 'Theo phím sáng và ngón được tô màu. Gõ đúng để tiến lên; gõ sai, bạn được thử lại.' : 'Bật bộ gõ tiếng Việt trên máy, rồi gõ câu bên dưới theo nhịp của bạn.';
    $('#input-note').textContent = lesson.mode === 'keys' ? 'Bài này nhận phím trực tiếp. Nếu bộ gõ can thiệp, chuyển sang chế độ tiếng Anh.' : 'Thêm dấu xong, nhấn cách để chốt từ. Có thể quay lại sửa.';
    $('#exercise-feedback').textContent = 'Cứ bắt đầu. Chưa cần nhanh, chỉ cần đúng.';
    $('#exercise-feedback').classList.remove('error');
    $('#telex-output').hidden = !lesson.output;
    $('#telex-output').innerHTML = lesson.output ? `<span>${/[à-ỹđ]/i.test(lesson.output) ? 'Gõ chuỗi mẫu để luyện:' : 'Mục tiêu:'}</span> ${escape(lesson.output)}` : '';
    $('#lesson-tabs').hidden = channel !== 'course';
    if (channel === 'course') $('#lesson-tabs').innerHTML = course.lessons.filter(item => item.day === lesson.day).map(item => `<button data-lesson="${item.id}" class="${item.id === lesson.id ? 'active' : ''}" ${item.id === lesson.id ? 'aria-current="step"' : ''}>Bài ${item.part} · ${escape(item.title)}</button>`).join('');
    $('#step-quick').classList.toggle('active',channel === 'quick'); $('#step-magic').classList.toggle('active',channel === 'magic'); $('#step-course').classList.toggle('active',channel === 'course');
    renderTarget(); renderStats(); keyboard.explain(lesson.mode === 'keys' ? trainer.keyFor(text[0]) : null);
    if (focus) requestAnimationFrame(() => input.focus({preventScroll:true}));
  }
  function renderTarget() {
    const target = $('#target-text'); target.replaceChildren(); target.classList.toggle('key-mode',lesson.mode === 'keys');
    if (lesson.mode === 'keys') {
      Array.from(text).forEach((char,index) => {
        const span = document.createElement('span'); span.textContent = char === ' ' ? '␣' : char;
        span.className = `target-char ${char === ' ' ? 'space' : ''} ${index < position ? 'correct' : index === position ? 'current' : ''}`;
        target.append(span);
      });
    } else analysis.words.forEach((word,index) => {
      if (index) target.append(document.createTextNode(' '));
      const span = document.createElement('span'); span.className = `target-word ${word.status}`; span.textContent = word.text; target.append(span);
    });
  }
  function values() {
    const correctChars = lesson.mode === 'keys' ? position : analysis.correctChars;
    return { ...core.metrics(correctChars,errors,elapsed/1000),progress:lesson.mode === 'keys' ? Math.round(position/text.length*100) : analysis.progress };
  }
  function renderStats() {
    const stats = values();
    $('#stat-wpm').textContent = started ? stats.wpm : '—'; $('#stat-accuracy').textContent = started ? `${stats.accuracy}%` : '—';
    $('#stat-time').textContent = formatTime(elapsed/1000); $('#stat-progress').textContent = `${stats.progress}%`;
    $('#progress-fill').style.width = `${stats.progress}%`;
  }
  function tick() {
    const now = performance.now();
    if (started && !complete && !document.hidden && windowActive && view === 'practice' && !modal.open && document.activeElement === input) elapsed += Math.min(1000,now-lastTick);
    lastTick = now; if (started && !complete) renderStats();
  }
  function begin() { if (!started) { started = true; lastTick = performance.now(); } }
  function play(low = false) { if (service.state.settings.sound) audio.play(service.state.settings.soundProfile,low); }
  function feedback(message,error = false) { $('#exercise-feedback').textContent = message; $('#exercise-feedback').classList.toggle('error',error); }
  function evaluateText() {
    if (lesson.mode === 'keys' || composing || complete) return;
    if (input.value) begin();
    analysis = core.analyze(text,input.value);
    errors += core.recordMistakes(analysis,seen);
    analysis.mistakes.forEach(item => { if (analysis.words[item.index]) wrongWords.push(analysis.words[item.index].text); });
    if (analysis.extraWords.length) feedback('Có từ thừa ở cuối. Xóa từ thừa để hoàn thành nhé.',true);
    else if (analysis.mistakes.length) feedback('Có từ chưa đúng được đánh dấu. Bạn có thể quay lại sửa.',true);
    else feedback('Đang đi đúng nhịp rồi. Bình tĩnh thêm dấu và chốt từng từ nhé.');
    renderTarget(); renderStats();
    if (analysis.complete && started) finish();
  }
  function keyFromEvent(event) {
    const letters = /^Key([A-Z])$/.exec(event.code);
    if (letters) {
      const uppercase = event.shiftKey !== Boolean(event.getModifierState?.('CapsLock'));
      return uppercase ? letters[1] : letters[1].toLowerCase();
    }
    if (event.code === 'Space') return ' ';
    const number = /^Digit([0-9])$/.exec(event.code);
    if (number) return event.shiftKey ? ')!@#$%^&*('[Number(number[1])] : number[1];
    const punctuation = {Backquote:['`','~'],Minus:['-','_'],Equal:['=','+'],BracketLeft:['[','{'],BracketRight:[']','}'],Backslash:['\\','|'],Semicolon:[';',':'],Quote:["'",'"'],Comma:[',','<'],Period:['.','>'],Slash:['/','?']};
    if (punctuation[event.code]) return punctuation[event.code][event.shiftKey ? 1 : 0];
    return event.key;
  }
  input.addEventListener('keydown',event => {
    if (complete || modal.open) return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.key === 'Tab') return;
    keyboard.press(event.code);
    if (event.repeat) { if (lesson.mode === 'keys') event.preventDefault(); return; }
    if (lesson.mode === 'keys') {
      event.preventDefault(); const char = keyFromEvent(event);
      if (char.length === 1 || char === 'Backspace') begin();
      const result = trainer.step(text,position,char); position = result.position;
      if (result.error) {
        errors++; play(true);
        const node = $(`[data-code="${event.code}"]`); node?.classList.add('wrong'); setTimeout(() => node?.classList.remove('wrong'),220);
        feedback(`Thử lại nhé: phím ${trainer.keyFor(text[position])?.label || ''} — ${trainer.fingerNames[trainer.keyFor(text[position])?.finger] || ''}.`,true);
      } else if (result.accepted) { play(); feedback('Đúng rồi! Nhớ đưa ngón về vị trí nghỉ sau khi gõ.'); }
      input.value = text.slice(0,position); renderTarget(); renderStats(); keyboard.explain(trainer.keyFor(text[position]));
      if (position === text.length) finish();
    } else {
      if (!composing && !event.isComposing && event.key === 'Enter') {
        event.preventDefault(); if (input.value && !input.value.endsWith(' ')) { input.setRangeText(' ',input.selectionStart,input.selectionEnd,'end'); evaluateText(); }
      }
      if (event.code.startsWith('Key') || event.code.startsWith('Digit') || event.code === 'Space') {
        const char = keyFromEvent(event); const meta = trainer.keyFor(char);
        if (meta) keyboard.explain(meta);
        play();
      }
    }
  });
  document.addEventListener('keyup',event => keyboard.release(event.code));
  input.addEventListener('compositionstart',() => { if (lesson.mode !== 'keys') { composing = true; begin(); feedback('Đang ghép dấu tiếng Việt…'); } });
  input.addEventListener('compositionend',() => { composing = false; clearTimeout(composeTimer); composeTimer = setTimeout(evaluateText,0); });
  input.addEventListener('input',event => { if (!event.isComposing && !composing) evaluateText(); });
  input.addEventListener('paste',event => { event.preventDefault(); toast('Tự gõ từng từ để đôi tay nhớ lâu hơn nhé.'); });
  input.addEventListener('drop',event => { event.preventDefault(); toast('Bài luyện cần bạn tự gõ, không kéo thả văn bản nhé.'); });
  input.addEventListener('beforeinput',event => { if (lesson.mode === 'keys' || ['insertFromPaste','insertFromDrop'].includes(event.inputType)) event.preventDefault(); });
  input.addEventListener('focus',() => { lastTick = performance.now(); });
  window.addEventListener('blur',() => { windowActive = false; keyboard.releaseAll(); lastTick = performance.now(); });
  window.addEventListener('focus',() => { windowActive = true; lastTick = performance.now(); });
  document.addEventListener('visibilitychange',() => { lastTick = performance.now(); });

  function finish() {
    if (complete) return;
    tick(); complete = true; input.disabled = true; keyboard.releaseAll();
    const stats = core.metrics(text.length,errors,Math.max(1,elapsed/1000));
    lastStats = stats;
    const result = {lessonId:lesson.id,mode:lesson.mode,at:new Date().toISOString(),seconds:Math.round(elapsed/1000),...stats};
    const saved = service.addResult(result);
    $('#stat-wpm').textContent = stats.wpm; $('#stat-accuracy').textContent = `${stats.accuracy}%`;
    const statHtml = `<div class="result-stats"><div><strong>${stats.wpm}</strong><small>WPM · ${lesson.mode === 'keys' ? 'BÀI PHÍM' : 'BÀI VĂN BẢN'}</small></div><div><strong>${stats.accuracy}%</strong><small>ĐỘ CHÍNH XÁC</small></div><div><strong>${formatTime(result.seconds)}</strong><small>THỜI GIAN</small></div></div>`;
    const shareBtn = typeof NTLabUI !== 'undefined' ? `<button class="button secondary" data-action="share-card">${icon('download')}Tải Thẻ Tốc Độ</button>` : '';
    if (channel === 'quick') {
      const diagnostic = trainer.diagnose(stats.wpm,stats.accuracy,wrongWords);
      showModal(`<div class="modal-eyebrow">NHỊP GÕ HIỆN TẠI CỦA BẠN</div><h2>Một câu ngắn.<br>Một điểm bắt đầu rõ ràng.</h2>${statHtml}${diagnostic.review.length ? `<div class="review-note"><strong>Những từ bạn đã phải sửa:</strong> ${diagnostic.review.map(escape).join(', ')}.<br>Đây là gợi ý ôn từ chính bài bạn vừa gõ.</div>` : `<div class="positive-note">Bạn đã hoàn thành câu mẫu mà không có lỗi ở các từ đã chốt. Thử đặt đúng ngón để làm quen một cách gõ có hệ thống nhé.</div>`}<p class="modal-copy">Tiếp theo, thử gõ <strong>5 từ có nghĩa chỉ với hàng phím cơ sở</strong>. Bàn phím và đôi tay sẽ chỉ đường cho bạn.</p><div class="modal-actions"><button class="button secondary" data-action="retry">Gõ thử lại</button>${shareBtn}<button class="button primary" data-action="magic">Thử đặt đúng ngón ${icon('arrow')}</button></div><p class="modal-footnote">Bài ngắn chỉ phản ánh lượt gõ này, chưa đánh giá đầy đủ kỹ năng hoặc ngón tay bạn đang dùng. ${saved ? 'Đã lưu kết quả trên máy.' : 'Chưa lưu được do trình duyệt chặn lưu trữ.'}</p>`);
    } else {
      const magic = channel === 'magic';
      showModal(`<div class="modal-eyebrow">${magic ? 'ĐÚNG NGÓN, RA CHỮ NGAY' : `NGÀY ${lesson.day} · BÀI ${lesson.part} ĐÃ HOÀN THÀNH`}</div><h2>${magic ? 'Thấy dễ hơn rồi chứ?' : 'Thêm một bước vững tay.'}</h2><p class="modal-copy">${magic ? 'Bạn vừa gõ “da ga ha la sa” theo hướng dẫn ngón. Tiếp tục với 45 bài, từ vị trí tay đến tiếng Việt có dấu.' : `Đã xong bài “${escape(lesson.title)}”. Bạn có thể luyện lại để nhớ đường đi của các ngón.`}</p>${statHtml}<div class="modal-actions"><button class="button secondary" data-action="${magic ? 'day-one' : 'retry'}">${magic ? 'Học tiếp ngày 1 miễn phí' : 'Luyện lại'}</button>${shareBtn}<button class="button ${magic ? 'warm' : 'primary'}" data-action="${magic ? 'checkout' : 'next'}">${magic ? 'Mở trọn lộ trình · 39k' : 'Bài tiếp theo'} ${icon('arrow')}</button></div><p class="modal-footnote">Bài có hướng dẫn dùng để luyện vị trí ngón; không so trực tiếp tốc độ với bài văn bản. ${saved ? 'Đã lưu kết quả.' : 'Chưa lưu được kết quả.'}</p>`);
    }
  }
  function completedIds() { return new Set(service.state.history.map(item => item.lessonId)); }
  function renderDays() {
    const done = completedIds(); const count = course.lessons.filter(item => done.has(item.id)).length;
    $('#course-completion').textContent = `${count}/45`; $('#course-progress').style.width = `${count/45*100}%`;
    $('#day-grid').innerHTML = course.days.map(day => {
      const items = course.lessons.filter(item => item.day === day.day), unlocked = service.access(items[0]);
      const finished = items.filter(item => done.has(item.id)).length;
      return `<button class="day-card" data-day="${day.day}"><div class="day-card-top"><span class="day-number">NGÀY ${String(day.day).padStart(2,'0')}</span><span class="day-status ${day.day === 1 ? 'free' : ''}">${finished === 3 ? icon('check')+'ĐÃ XONG' : day.day === 1 ? 'HỌC MIỄN PHÍ' : unlocked ? 'ĐÃ MỞ PLUS' : icon('lock')+'GÓI 39K'}</span></div><h3>${escape(day.title)}</h3><p>${escape(day.description)}</p><div class="day-card-footer"><span>${finished}/3 bài</span><span class="day-meter">${items.map(item => `<i class="${done.has(item.id) ? 'done' : ''}"></i>`).join('')}</span>${icon(unlocked ? 'arrow' : 'lock')}</div></button>`;
    }).join('');
  }
  function renderHistory() {
    const history = service.state.history, texts = history.filter(item => item.mode !== 'keys');
    const average = texts.length ? Math.round(texts.reduce((sum,item) => sum+item.accuracy,0)/texts.length) : null;
    const best = texts.length ? Math.max(...texts.map(item => item.wpm)) : null;
    $('#overview-stats').innerHTML = [[history.length,'Lượt luyện hoàn thành'],[best === null ? '—' : `${best} WPM`,'Tốt nhất · Chỉ bài văn bản'],[average === null ? '—' : `${average}%`,'Chính xác · Chỉ bài văn bản']].map(([value,label]) => `<div class="overview-stat"><strong>${value}</strong><small>${label}</small></div>`).join('');
    $('#history-content').innerHTML = history.length ? `<div class="history-scroll"><table class="history-table"><thead><tr><th>BÀI LUYỆN</th><th>THỜI ĐIỂM</th><th>TỐC ĐỘ</th><th>CHÍNH XÁC</th><th>THỜI GIAN</th></tr></thead><tbody>${[...history].reverse().map(item => `<tr><td>${escape(item.lessonId === 'quick-test' ? 'Gõ thử tiếng Việt' : course.lessons.find(lesson => lesson.id === item.lessonId)?.title || 'Bài luyện bản trước')}<small>${item.mode === 'keys' ? 'Bài phím có hướng dẫn' : 'Bài văn bản tiếng Việt'}</small></td><td>${escape(new Date(item.at).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}))}</td><td>${item.wpm} WPM</td><td>${item.accuracy}%</td><td>${formatTime(item.seconds)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty-history"><h3>Bước đầu tiên đang chờ bạn.</h3><p>Gõ thử một câu tiếng Việt, rồi quay lại đây<br>để xem kết quả của chính mình.</p><button class="button primary" data-action="quick">Gõ thử ngay ${icon('arrow')}</button></div>`;
  }
  function showCheckout(scope = 'go-may') {
    if (typeof NTLabUI !== 'undefined') {
      showModal(NTLabUI.buildCheckoutHtml('go-may', scope === 'all-access' ? 'all-access' : 'go-may'));
      return;
    }
    const reference = `GM-DEMO-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    showModal(`<div class="modal-eyebrow">MỞ TRỌN HÀNH TRÌNH GÕ 10 NGÓN</div><h2>Một lần mở khóa.<br>Luyện theo nhịp của bạn.</h2><div class="checkout-head"><strong>39.000đ</strong><span>15 ngày · 45 bài · 2 chủ đề<br>5 chất âm + bảng hướng dẫn PDF</span></div><div class="checkout-grid"><div class="qr-placeholder" role="img" aria-label="Khung VietQR demo, chưa có mã chuyển tiền">${icon('lock')}<strong>VietQR</strong><small>KHUNG THANH TOÁN DEMO<br>Chưa có mã để chuyển tiền</small></div><div class="payment-details"><div>Số tiền<strong>39.000 VND</strong></div><div>Ngân hàng & người nhận<strong>Chưa được cấu hình</strong></div><div>Mã tham chiếu minh họa<code>${reference}</code></div><div>Trạng thái<strong>Chưa phát sinh giao dịch</strong></div></div></div><div class="demo-notice"><strong>Bản demo chưa nhận thanh toán.</strong> Nút bên dưới chỉ mở khóa thử trên trình duyệt này. Không phải xác nhận chuyển khoản, không phát sinh phí.</div><div class="modal-actions"><button class="button secondary" data-action="close">Tiếp tục học thử</button><button class="button primary" data-action="unlock-demo">${service.state.plusPreview ? 'Tiếp tục xem thử Plus' : 'Mô phỏng mở khóa Plus'} ${icon('arrow')}</button></div><p class="modal-footnote">Khi bán thật: tạo đơn → hiển thị VietQR → backend xác nhận giao dịch → cấp quyền. Đăng nhập Google sẽ là bước tùy chọn để đồng bộ quyền đã mua. Hiện chưa có quy trình này.</p>`);
  }
  function setPreview(enabled) {
    service.setPreview(enabled); applySettings();
    if (!service.access(lesson)) { lesson = course.lessons[0]; channel = 'course'; resetPractice(false); }
    if (view === 'roadmap') renderDays();
    toast(enabled ? 'Đã mở chế độ xem thử Plus local.' : 'Đã tắt xem thử Plus. Kết quả luyện vẫn được giữ.');
  }
  function showHelp() {
    showModal(`<div class="modal-eyebrow">VIẾT TIẾNG VIỆT, TỪ NHỮNG PHÍM QUEN</div><h2>Telex ngay bên tay.</h2><p class="modal-copy">Bài hướng dẫn phím nhận chuỗi Telex trực tiếp. Khi luyện câu và đoạn văn, hãy bật bộ gõ Unicode trên máy (UniKey, EVKey hoặc bộ gõ hệ điều hành).</p><div class="telex-grid">${[['aa','â'],['aw','ă'],['ee','ê'],['oo','ô'],['ow','ơ'],['uw','ư'],['dd','đ'],['s','sắc ◌́'],['f','huyền ◌̀'],['r','hỏi ◌̉'],['x','ngã ◌̃'],['j','nặng ◌̣']].map(([a,b]) => `<div><kbd>${a}</kbd><span>${b}</span></div>`).join('')}</div><ul class="help-list"><li><b>Hai chế độ khác nhau:</b> bài phím chấm từng phím theo chuỗi mẫu; bài văn bản chờ bạn ghép dấu rồi mới chấm từ.</li><li><b>Ví dụ:</b> <code>dda → đa</code>, <code>laf → là</code>, <code>khas → khá</code>. Với bài mẫu Telex, gõ đúng chuỗi đang hiện để luyện ngón.</li><li>Ở bài văn bản, dùng Telex hoặc VNI theo bộ gõ trên máy. Giữ đúng chữ hoa, dấu câu; có thể quay lại sửa từ sai.</li><li>WPM dùng quy ước 5 ký tự bằng một đơn vị từ. Không dùng điểm bài phím để kết luận bạn đã tăng tốc khi gõ văn bản.</li></ul><div class="modal-actions"><a class="button secondary" href="assets/huong-dan-go-may.pdf" download>${icon('download')}Tải bảng PDF</a><button class="button primary" data-action="close">Mình hiểu rồi</button></div>`);
  }
  function showFingerMap() {
    showModal(`<div class="modal-eyebrow">BẢN ĐỒ NHỎ CHO ĐÔI TAY</div><h2>Mỗi ngón có phần việc riêng.</h2><table class="finger-table"><thead><tr><th>NGÓN</th><th>TAY TRÁI</th><th>TAY PHẢI</th></tr></thead><tbody><tr><td>Ngón út</td><td>Q A Z</td><td>P ; /</td></tr><tr><td>Áp út</td><td>W S X</td><td>O L .</td></tr><tr><td>Ngón giữa</td><td>E D C</td><td>I K ,</td></tr><tr><td>Ngón trỏ</td><td>R T F G V B</td><td>Y U H J N M</td></tr><tr><td>Ngón cái</td><td colspan="2">Dấu cách</td></tr></tbody></table><p class="modal-copy">Vị trí nghỉ: <b>A S D F</b> và <b>J K L ;</b>. Khi cần chữ hoa, giữ Shift bằng ngón út tay đối diện. Ở hình bàn phím, chọn một phím để xem hướng dẫn cụ thể.</p><p class="modal-footnote">Đây là sơ đồ QWERTY thường dùng. Web hướng dẫn vị trí ngón, không xác định bạn thực sự đang dùng ngón nào.</p><div class="modal-actions"><button class="button primary" data-action="close">Quay lại luyện ${icon('arrow')}</button></div>`);
  }
  function showAccount() {
    const settings = service.state.settings;
    const cloudSt = service.cloud ? service.cloud.getStatus() : { configured: false, user: null };
    const details = service.platform ? service.platform.licenseDetails('go-may') : { unlocked: false, remainingText: 'Chưa kích hoạt' };
    const googleBtn = cloudSt.user
      ? `<button class="google-button" data-action="google-auth"><span>☁️</span>Đang đồng bộ: ${escape(cloudSt.user.email)} · Bấm để đăng xuất</button>`
      : cloudSt.configured
        ? `<button class="google-button" data-action="google-auth"><span>G</span>Đăng nhập bằng Google · Đồng bộ Cloud Firestore</button>`
        : `<button class="google-button" disabled><span>G</span>Đăng nhập bằng Google · Điền shared/firebase-config.js để bật</button>`;
    showModal(`<div class="modal-eyebrow">ĐỒNG BỘ FIREBASE CLOUD & CÀI ĐẶT</div><h2>Góc luyện tập của bạn.</h2><p class="modal-copy">${cloudSt.user ? `Kết quả và gói VIP đang được đồng bộ tự động lên Google Cloud Firestore (${escape(cloudSt.user.email)}).` : 'Bạn đang dùng hồ sơ khách. Kết quả được giữ trên trình duyệt này và sẽ tự động gộp lên Cloud ngay khi bạn đăng nhập Google.'}</p>${googleBtn}<label class="setting-row"><span><strong>Âm thanh bàn phím</strong><p>Bật tiếng gõ nhẹ, tắt khi cần yên tĩnh.</p></span><input type="checkbox" data-setting="sound" ${settings.sound ? 'checked' : ''}></label><label class="setting-row"><span><strong>Bàn phím & bàn tay minh họa</strong><p>Hướng dẫn trực quan khi luyện từng phím.</p></span><input type="checkbox" data-setting="keyboard" ${settings.keyboard ? 'checked' : ''}></label><div class="setting-row"><span><strong>Trạng thái Gói VIP</strong><p>${details.unlocked ? `Đang hoạt động (${escape(details.remainingText)})` : 'Đang dùng thử miễn phí'}</p></span></div><p class="modal-footnote">Bạn có thể xuất bản sao JSON ở mục Tiến bộ bất cứ lúc nào.</p><div class="modal-actions"><button class="button secondary" data-action="checkout">Mở khóa VIP / Gia hạn</button><button class="button primary" data-action="close">Xong rồi ${icon('check')}</button></div>`);
  }
  function nextLesson() {
    const next = course.lessons[course.lessons.findIndex(item => item.id === lesson.id)+1];
    closeModal();
    if (next) selectLesson(next.id); else { setView('roadmap'); toast('Đã đến cuối lộ trình. Bạn có thể chọn bài để tiếp tục ôn luyện.'); }
  }
  const actions = {
    close:closeModal,help:showHelp,map:showFingerMap,account:showAccount,
    async 'google-auth'() {
      if (!service.cloud) return;
      const st = service.cloud.getStatus();
      if (st.user) {
        await service.cloud.signOut();
        toast('Đã đăng xuất khỏi tài khoản Google.');
      } else {
        const res = await service.cloud.signInWithGoogle();
        if (res.ok) {
          await service.pullAndMergeCloud();
          applySettings();
          if (view === 'progress') renderHistory();
          if (view === 'roadmap') renderDays();
          toast('Đã đăng nhập Google và đồng bộ dữ liệu Firestore!');
        } else {
          toast(res.reason);
        }
      }
      if (modal.open) showAccount();
    },
    checkout() { showCheckout('go-may'); },
    'checkout-bundle'() { showCheckout('all-access'); },
    'share-card'() {
      if (typeof NTLabUI !== 'undefined') {
        const rank = lastStats.wpm >= 70 ? 'Đôi tay tia chớp ⚡' : lastStats.wpm >= 45 ? 'Đôi tay lướt mây ☁️' : 'Khởi đầu vững chắc 🌱';
        NTLabUI.downloadShareCard({
          title: 'Gõ Mây · Luyện Gõ 10 Ngón Tiếng Việt',
          primaryStat: `${lastStats.wpm} WPM`,
          secondaryStat: `Độ chính xác: ${lastStats.accuracy}%`,
          badge: `Hạng: ${rank}`,
          subtitle: `Bài: ${lesson.title}`,
          filename: `go-may-${lastStats.wpm}wpm.png`
        });
        toast('Đã tải ảnh Thẻ Tốc Độ để bạn chia sẻ lên Facebook / TikTok!');
      }
    },
    quick() { if (modal.open) closeModal(); selectLesson('quick-test','quick'); },
    magic() { if (modal.open) closeModal(); selectLesson(course.lessons[0].id,'magic'); },
    'day-one'() { closeModal(); selectLesson(course.lessons[1].id); },
    retry() { closeModal(); resetPractice(true); }, next:nextLesson,
    'unlock-demo'() { setPreview(true); closeModal(); setView('roadmap'); },
    continue() { const done = completedIds(); const next = course.lessons.find(item => !done.has(item.id)) || course.lessons[0]; selectLesson(next.id); }
  };
  document.addEventListener('click',event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.ntlabPlan) { showCheckout(button.dataset.ntlabPlan); return; }
    if (button.dataset.ntlabAction === 'activate-key') {
      const inputEl = $('#ntlab-license-input'), msgEl = $('#ntlab-license-msg');
      const codeVal = inputEl?.value || '';
      Promise.resolve(
        service.cloud ? service.cloud.activateLicense(codeVal) : (service.platform ? service.platform.activateLicense(codeVal) : { valid: false, reason: 'Chưa tải module bản quyền.' })
      ).then(res => {
        if (msgEl) {
          msgEl.textContent = res.valid ? `Kích hoạt thành công mã ${res.code}! Đã mở khóa Plus.` : res.reason;
          msgEl.className = `ntlab-license-msg ${res.valid ? 'ok' : 'err'}`;
        }
        if (res.valid) {
          service.syncPlatform(); save(); applySettings();
          if (view === 'roadmap') renderDays();
          toast('Đã kích hoạt mã VIP thành công!');
        }
      });
      return;
    }
    if (button.dataset.action) actions[button.dataset.action]?.();
    if (button.dataset.view) { if (modal.open) closeModal(); setView(button.dataset.view); }
    if (button.dataset.lesson) selectLesson(button.dataset.lesson);
    if (button.dataset.day) {
      const done = completedIds(), items = course.lessons.filter(item => item.day === Number(button.dataset.day));
      selectLesson((items.find(item => !done.has(item.id)) || items[0]).id);
    }
    if (button.dataset.audience && button.dataset.audience !== service.state.settings.audience) {
      service.state.settings.audience = button.dataset.audience; applySettings(); save();
      if (lesson.officeText) { resetPractice(); toast('Đã đổi chủ đề và bắt đầu lại bài hiện tại.'); }
      else toast('Đã chọn chủ đề. Các bài văn bản từ ngày 7 sẽ đổi theo lựa chọn này.');
    }
  });
  document.addEventListener('change',event => {
    const key = event.target.dataset.setting; if (!key) return;
    if (key === 'plusPreview') setPreview(event.target.checked);
    else { service.state.settings[key] = event.target.checked; applySettings(); save(); }
  });
  $('#sound-toggle').addEventListener('click',() => { service.state.settings.sound = !service.state.settings.sound; applySettings(); save(); if (service.state.settings.sound) play(); });
  $('#sound-preview').addEventListener('click',() => {
    if (!service.state.settings.sound) { service.state.settings.sound = true; applySettings(); save(); }
    audio.play(service.state.settings.soundProfile);
  });
  $('#sound-profile').addEventListener('change',event => {
    const profile = event.target.value;
    if (profile !== 'thock' && !service.state.plusPreview) { event.target.value = service.state.settings.soundProfile; showCheckout(); return; }
    service.state.settings.soundProfile = profile; save(); audio.play(profile);
  });
  $('#restart').addEventListener('click',() => resetPractice(true));
  $('#export-progress').addEventListener('click',() => {
    const blob = new Blob([JSON.stringify({app:'Gõ Mây',version:2,exportedAt:new Date().toISOString(),history:service.state.history},null,2)],{type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'go-may-tien-do.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000); toast('Đã xuất một bản sao tiến độ.');
  });
  window.addEventListener('hashchange',() => setView(location.hash.slice(1),false));
  keyboard.mount(); applySettings(); resetPractice(false); setView(location.hash.slice(1) || 'practice',false); setInterval(tick,200);
})();
