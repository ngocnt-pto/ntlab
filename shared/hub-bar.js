(function (root) {
  'use strict';

  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  function statusLabel(client, appId) {
    const mode = client.unlockStatus(appId || 'all-access');
    if (mode === 'license-bundle') return { text: 'VIP · Đã mở Trọn Bộ', unlocked: true };
    if (mode === 'license-single') return { text: 'Plus · Đã kích hoạt mã', unlocked: true };
    if (mode === 'preview-bundle') return { text: 'Trọn Bộ · Xem thử local', unlocked: true };
    if (mode === 'preview-single') return { text: 'Plus · Xem thử local', unlocked: true };
    return { text: 'Bản miễn phí', unlocked: false };
  }

  function mountBar(activeAppId, onOpenCheckout) {
    const catalog = root.NTLabCatalog;
    const platform = root.NTLabPlatform;
    if (!catalog || !platform || typeof document === 'undefined') return null;

    const client = platform.createClient();
    let bar = document.getElementById('ntlab-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'ntlab-bar';
      bar.className = 'ntlab-bar';
      document.body.prepend(bar);
    }

    function render() {
      client.reload();
      const status = statusLabel(client, activeAppId);
      const cloudStatus = root.NTLabCloud ? root.NTLabCloud.getStatus() : { configured: false, user: null };
      const readyApps = catalog.apps.filter(app => app.status === 'ready');
      const homeHref = activeAppId ? '../' : './';
      bar.innerHTML = `
        <div class="ntlab-bar-inner">
          <div class="ntlab-bar-links" role="navigation" aria-label="Hệ sinh thái phần mềm NTLab">
            <a href="${homeHref}" class="ntlab-bar-link ${!activeAppId ? 'active' : ''}">
              <span class="ntlab-bar-dot"></span>Kho phần mềm
            </a>
            ${readyApps.map(app => {
              const appHref = activeAppId ? `../${app.slug}/` : `./${app.slug}/`;
              return `
              <a href="${escape(appHref)}" class="ntlab-bar-link ${activeAppId === app.id ? 'active' : ''}">
                ${escape(app.name)}
              </a>
            `;}).join('')}
          </div>
          <div class="ntlab-bar-right">
            <button type="button" class="ntlab-auth-btn ${cloudStatus.user ? 'logged-in' : ''}" data-ntlab-auth="toggle">
              ${cloudStatus.user
                ? `☁️ ${escape(cloudStatus.user.displayName)} (Thoát)`
                : cloudStatus.configured
                  ? '☁️ Đăng nhập Google'
                  : '☁️ Đồng bộ Cloud (Chờ cấu hình)'}
            </button>
            <span class="ntlab-status-pill ${status.unlocked ? 'unlocked' : ''}">${escape(status.text)}</span>
            <button type="button" class="ntlab-bundle-btn" data-ntlab-checkout="${escape(activeAppId || 'all-access')}">
              ${status.unlocked ? 'Quản lý mã / Gói 99k' : 'Mở khóa · Từ 39k'}
            </button>
          </div>
        </div>
      `;
    }

    bar.addEventListener('click', async event => {
      const authBtn = event.target.closest('[data-ntlab-auth]');
      if (authBtn && root.NTLabCloud) {
        const st = root.NTLabCloud.getStatus();
        if (st.user) {
          await root.NTLabCloud.signOut();
        } else {
          const res = await root.NTLabCloud.signInWithGoogle();
          if (!res.ok && typeof onOpenCheckout === 'function') {
            onOpenCheckout(activeAppId || 'all-access');
          }
        }
        render();
        return;
      }
      const btn = event.target.closest('[data-ntlab-checkout]');
      if (!btn) return;
      if (typeof onOpenCheckout === 'function') {
        onOpenCheckout(btn.dataset.ntlabCheckout);
      }
    });

    if (root.NTLabCloud) {
      root.NTLabCloud.onChange(() => render());
    }

    render();
    return { render, client };
  }

  function buildCheckoutHtml(appId, selectedScope) {
    const catalog = root.NTLabCatalog;
    const platform = root.NTLabPlatform;
    const client = platform.createClient();
    const app = catalog.getApp(appId) || catalog.apps[0];
    const bundle = catalog.bundle;
    const scope = selectedScope === 'all-access' ? 'all-access' : app.id;
    const isBundle = scope === 'all-access';

    const price = isBundle ? bundle.price : app.price;
    const prefix = isBundle ? bundle.codePrefix : app.codePrefix;
    const ref = `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const qrUrl = catalog.buildVietQrUrl(price, ref);
    const unlocked = client.hasAccess(app.id);
    const bundleUnlocked = client.hasAccess('all-access');

    return `
      <div class="modal-eyebrow">KHO PHẦN MỀM NTLAB · MUA 1 LẦN DÙNG MÃI MÃI</div>
      <h2>Chọn gói mở khóa phù hợp với bạn.</h2>
      <div class="ntlab-plan-tabs" role="tablist" aria-label="Chọn gói mở khóa">
        <button type="button" class="ntlab-plan-tab ${!isBundle ? 'active' : ''}" data-ntlab-plan="${escape(app.id)}">
          <div class="ntlab-plan-tab-top">
            <strong>Mua lẻ: ${escape(app.name)}</strong>
            <span class="ntlab-plan-price">${catalog.formatCurrency(app.price)}</span>
          </div>
          <small>${escape(app.plusSummary)}</small>
        </button>
        <button type="button" class="ntlab-plan-tab ${isBundle ? 'active' : ''}" data-ntlab-plan="all-access">
          <div class="ntlab-plan-tab-top">
            <strong>🌟 ${escape(bundle.shortName)} (Tất cả App)</strong>
            <span class="ntlab-plan-price">${catalog.formatCurrency(bundle.price)}</span>
          </div>
          <small>${escape(bundle.summary)}</small>
        </button>
      </div>

      <div class="checkout-grid">
        ${qrUrl
          ? `<div class="qr-placeholder"><img src="${escape(qrUrl)}" alt="Mã VietQR thanh toán" style="max-width:160px;border-radius:8px;"></div>`
          : `<div class="qr-placeholder" role="img" aria-label="Khung VietQR demo, chưa có mã chuyển tiền">
              <strong>VietQR</strong>
              <small>KHUNG THANH TOÁN DEMO<br>Điền STK trong shared/catalog.js để hiện QR thật</small>
            </div>`
        }
        <div class="payment-details">
          <div>Gói đang chọn<strong>${escape(isBundle ? bundle.name : `Mở khóa ${app.name} Plus`)}</strong></div>
          <div>Số tiền ưu đãi<strong>${catalog.formatCurrency(price)} <span style="text-decoration:line-through;color:#64748b;font-weight:400;font-size:12px;">${catalog.formatCurrency(isBundle ? bundle.originalPrice : app.originalPrice)}</span></strong></div>
          <div>Nội dung chuyển khoản<code>${escape(ref)}</code></div>
          <div>Trạng thái hiện tại<strong>${bundleUnlocked ? 'Đã mở khóa Trọn Bộ' : unlocked ? `Đã mở khóa ${escape(app.name)}` : 'Đang dùng bản Miễn phí'}</strong></div>
        </div>
      </div>

      <div class="ntlab-license-box">
        <label for="ntlab-license-input">Đã có Mã Kích Hoạt? Nhập mã tại đây (mở lẻ ${escape(app.codePrefix)}-... hoặc trọn bộ ALL-...):</label>
        <div class="ntlab-license-row">
          <input id="ntlab-license-input" type="text" placeholder="Ví dụ: ${escape(prefix)}-234567-ABCD" autocomplete="off" spellcheck="false">
          <button type="button" class="button primary" data-ntlab-action="activate-key">Kích hoạt mã</button>
        </div>
        <div id="ntlab-license-msg" class="ntlab-license-msg" role="status" aria-live="polite"></div>
        <small style="display:block;margin-top:6px;color:#475569;font-size:12px;">
          ${root.NTLabCloud?.getStatus().user
            ? `☁️ Đang kết nối tài khoản Google <b>${escape(root.NTLabCloud.getStatus().user.email)}</b>: Mã kích hoạt sẽ được khóa bảo vệ 1-1 và đồng bộ trên Firestore.`
            : root.NTLabCloud?.getStatus().configured
              ? `☁️ Bấm <b>Đăng nhập Google</b> trên thanh trên cùng để gắn mã kích hoạt vĩnh viễn vào tài khoản Cloud của bạn.`
              : `💡 Hiện đang lưu trên trình duyệt. Khi bạn dán cấu hình vào <code>shared/firebase-config.js</code>, mã kích hoạt & lịch sử học sẽ tự động đồng bộ lên Google Cloud Firestore.`}
        </small>
      </div>

      <div class="demo-notice" style="margin-top:12px;">
        <strong>Chế độ xem thử minh bạch:</strong> Bạn có thể bấm nút bên dưới để mở khóa thử trên trình duyệt này mà chưa cần chuyển khoản.
      </div>
      <div class="modal-actions">
        <button type="button" class="button secondary" data-action="close" data-ntlab-action="close">Đóng</button>
        <button type="button" class="button primary" data-ntlab-action="toggle-preview" data-ntlab-scope="${escape(scope)}">
          ${(isBundle ? bundleUnlocked : unlocked) ? 'Tắt chế độ xem thử local' : `Mô phỏng mở khóa ${isBundle ? 'Trọn Bộ 99k' : `${escape(app.name)} (${catalog.formatCurrency(app.price)})`}`}
        </button>
      </div>
    `;
  }

  function downloadShareCard(opts = {}) {
    if (typeof document === 'undefined') return false;
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const grad = ctx.createLinearGradient(0, 0, 1200, 630);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.55, '#1e3a8a');
    grad.addColorStop(1, '#1e40af');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 630);

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.arc(1060, 110, 220, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 24px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText((opts.eyebrow || 'CHỨNG NHẬN KỸ NĂNG SỐ · NTLAB').toUpperCase(), 72, 88);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 56px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(opts.title || 'Gõ Mây · Luyện Gõ 10 Ngón Tiếng Việt', 72, 162);

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect?.(72, 210, 1056, 230, 24) || ctx.rect(72, 210, 1056, 230);
    ctx.fill();

    ctx.fillStyle = '#fbbf24';
    ctx.font = '900 92px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(opts.primaryStat || '60 WPM', 112, 335);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 34px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(opts.secondaryStat || 'Độ chính xác: 98%', 112, 398);

    ctx.fillStyle = '#93c5fd';
    ctx.font = '600 28px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(opts.badge || 'Hạng: Đôi tay lướt mây ⚡', 620, 335);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 24px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(opts.subtitle || 'Lộ trình 15 ngày gõ 10 ngón tiếng Việt có dấu chuẩn xác.', 620, 395);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 26px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(opts.footerLeft || 'Thử thách tốc độ của bạn tại: /go-may', 72, 545);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 22px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(new Date().toLocaleDateString('vi-VN'), 1010, 545);

    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = opts.filename || 'thanh-tich-ntlab.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
    return true;
  }

  const api = { statusLabel, mountBar, buildCheckoutHtml, downloadShareCard };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NTLabUI = api;
})(globalThis);
