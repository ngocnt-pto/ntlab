(() => {
  'use strict';

  const APP_ID = 'man-hinh-desktop';
  const STORAGE_KEY = 'ntlab:app:man-hinh-desktop:v1';
  const platform = window.NTLabPlatform ? window.NTLabPlatform.createClient() : null;
  const $ = sel => document.querySelector(sel);
  const modal = $('#modal');

  const defaultState = {
    completedSessions: 0,
    focusMinutes: 0,
    todos: [
      { done: false, text: 'Hoàn thành 1 phiên tập trung 25 phút không mở mạng xã hội' },
      { done: false, text: 'Luyện 1 bài gõ 10 ngón tại /go-may' },
      { done: false, text: 'Tổng kết 3 việc quan trọng trước khi rời bàn làm việc' }
    ]
  };

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!raw || typeof raw !== 'object') return structuredClone(defaultState);
      return {
        completedSessions: Number(raw.completedSessions) || 0,
        focusMinutes: Number(raw.focusMinutes) || 0,
        todos: Array.isArray(raw.todos) && raw.todos.length === 3 ? raw.todos : structuredClone(defaultState.todos)
      };
    } catch {
      return JSON.parse(JSON.stringify(defaultState));
    }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
    if (window.NTLabCloud && window.NTLabCloud.getStatus().user) {
      window.NTLabCloud.syncAppState(APP_ID, state).catch(() => {});
    }
  }

  const state = loadState();
  let modeMinutes = 25;
  let remainingSeconds = 25 * 60;
  let running = false;
  let activeSound = null;
  let audioCtx = null;
  let noiseNode = null;

  const hubBar = window.NTLabUI ? window.NTLabUI.mountBar(APP_ID, scope => openCheckout(scope)) : null;

  function isUnlocked() {
    platform?.reload();
    return platform ? platform.hasAccess(APP_ID) : false;
  }

  function updateClock() {
    const now = new Date();
    $('#live-clock').textContent = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    $('#live-date').textContent = now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }

  function formatTimer(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function renderUI() {
    const unlocked = isUnlocked();
    const details = platform ? platform.licenseDetails(APP_ID) : { remainingText: '' };
    const priceLabel = window.NTLabCatalog
      ? window.NTLabCatalog.formatCurrency(window.NTLabCatalog.getApp(APP_ID)?.price || 39000)
      : '39.000đ';
    $('#plan-status').textContent = unlocked
      ? `👑 VIP Plus · ${details.remainingText}`
      : `Dùng thử · Mở VIP ${priceLabel}`;
    const checkoutBtn = $('#open-checkout');
    if (checkoutBtn) {
      checkoutBtn.textContent = unlocked ? 'Quản lý VIP / Gia hạn' : `Mở khóa VIP · ${priceLabel}`;
    }
    $('#pomo-timer').textContent = formatTimer(remainingSeconds);
    $('#pomo-toggle').textContent = running ? 'Tạm dừng' : 'Bắt đầu tập trung';
    $('#session-stats').textContent = `Đã hoàn thành: ${state.completedSessions} phiên (${state.focusMinutes} phút sâu)`;

    document.querySelectorAll('[data-minutes]').forEach(btn => {
      const m = Number(btn.dataset.minutes);
      const locked = btn.dataset.tier === 'plus' && !unlocked;
      btn.classList.toggle('active', m === modeMinutes);
      btn.textContent = `${m} phút${locked ? ' 🔒' : ''}`;
    });

    document.querySelectorAll('[data-sound]').forEach(btn => {
      const id = btn.dataset.sound;
      const locked = btn.dataset.tier === 'plus' && !unlocked;
      btn.classList.toggle('active', activeSound === id);
      const baseLabel = btn.dataset.label;
      btn.textContent = `${activeSound === id ? '🔊 ' : ''}${baseLabel}${locked ? ' 🔒' : ''}`;
    });

    const todoWrap = $('#todo-list');
    todoWrap.innerHTML = state.todos.map((item, idx) => `
      <div class="todo-row">
        <input type="checkbox" data-todo-check="${idx}" ${item.done ? 'checked' : ''} aria-label="Hoàn thành việc ${idx + 1}">
        <input type="text" data-todo-text="${idx}" value="${item.text.replace(/"/g, '&quot;')}" aria-label="Nội dung việc ${idx + 1}">
      </div>
    `).join('');

    hubBar?.render();
  }

  function toggleAmbient(type) {
    if (activeSound === type) {
      stopAmbient();
      renderUI();
      return;
    }
    stopAmbient();
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioCtx ||= new AudioContext();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const bufferSize = audioCtx.sampleRate * 2;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = type === 'rain' ? 750 : type === 'waves' ? 380 : 1100;

      const gain = audioCtx.createGain();
      gain.gain.value = 0.04;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      source.start();
      noiseNode = source;
      activeSound = type;
    } catch {
      activeSound = null;
    }
    renderUI();
  }

  function stopAmbient() {
    if (noiseNode) {
      try { noiseNode.stop(); } catch { /* ignore */ }
      noiseNode = null;
    }
    activeSound = null;
  }

  function openCheckout(scope = APP_ID) {
    if (!window.NTLabUI) return;
    $('#modal-content').innerHTML = window.NTLabUI.buildCheckoutHtml(APP_ID, scope);
    if (!modal.open) modal.showModal();
  }

  function closeModal() {
    if (modal.open) modal.close();
  }

  setInterval(() => {
    updateClock();
    if (running && remainingSeconds > 0) {
      remainingSeconds--;
      $('#pomo-timer').textContent = formatTimer(remainingSeconds);
      if (remainingSeconds === 0) {
        running = false;
        state.completedSessions += 1;
        state.focusMinutes += modeMinutes;
        saveState();
        renderUI();
      }
    }
  }, 1000);

  document.addEventListener('click', event => {
    const btn = event.target.closest('button');
    if (!btn) return;

    if (btn.classList.contains('modal-close') || btn.dataset.ntlabAction === 'close') {
      closeModal();
      return;
    }
    if (btn.dataset.ntlabPlan) {
      openCheckout(btn.dataset.ntlabPlan);
      return;
    }
    if (btn.dataset.ntlabAction === 'activate-key') {
      const inputEl = $('#ntlab-license-input');
      const msgEl = $('#ntlab-license-msg');
      const codeVal = inputEl?.value || '';
      Promise.resolve(
        window.NTLabCloud ? window.NTLabCloud.activateLicense(codeVal) : (platform ? platform.activateLicense(codeVal) : { valid: false, reason: 'Lỗi module' })
      ).then(res => {
        if (msgEl) {
          msgEl.textContent = res.valid ? `🎉 Đã kích hoạt mã ${res.code} (${res.remainingText || 'Đang hoạt động'})!` : res.reason;
          msgEl.className = `ntlab-license-msg ${res.valid ? 'ok' : 'err'}`;
        }
        if (res.valid) renderUI();
      });
      return;
    }
    if (btn.id === 'open-checkout') {
      openCheckout(APP_ID);
      return;
    }
    if (btn.id === 'pomo-toggle') {
      running = !running;
      renderUI();
      return;
    }
    if (btn.id === 'pomo-reset') {
      running = false;
      remainingSeconds = modeMinutes * 60;
      renderUI();
      return;
    }
    if (btn.id === 'share-focus' && window.NTLabUI) {
      window.NTLabUI.downloadShareCard({
        title: 'Màn Hình Desktop · Không Gian Tập Trung',
        primaryStat: `${state.focusMinutes} Phút`,
        secondaryStat: `Hoàn thành ${state.completedSessions} phiên Pomodoro`,
        badge: 'Trạng thái: Deep Work 🔥',
        subtitle: 'Làm việc sâu không xao nhãng cùng bộ công cụ NTLab.',
        footerLeft: 'Trải nghiệm tại: /man-hinh-desktop',
        filename: 'man-hinh-desktop-focus.png'
      });
      return;
    }
    if (btn.dataset.minutes) {
      if (btn.dataset.tier === 'plus' && !isUnlocked()) {
        openCheckout(APP_ID);
        return;
      }
      running = false;
      modeMinutes = Number(btn.dataset.minutes);
      remainingSeconds = modeMinutes * 60;
      renderUI();
      return;
    }
    if (btn.dataset.sound) {
      if (btn.dataset.tier === 'plus' && !isUnlocked()) {
        openCheckout(APP_ID);
        return;
      }
      toggleAmbient(btn.dataset.sound);
    }
  });

  document.addEventListener('change', event => {
    if (event.target.dataset.todoCheck !== undefined) {
      const idx = Number(event.target.dataset.todoCheck);
      state.todos[idx].done = event.target.checked;
      saveState();
    }
  });

  document.addEventListener('input', event => {
    if (event.target.dataset.todoText !== undefined) {
      const idx = Number(event.target.dataset.todoText);
      state.todos[idx].text = event.target.value;
      saveState();
    }
  });

  updateClock();
  renderUI();
})();
