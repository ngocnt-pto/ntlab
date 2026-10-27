(function (root) {
  'use strict';

  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  let activeOrderSession = null;

  function statusLabel(client, appId) {
    const details = client.licenseDetails ? client.licenseDetails(appId || 'all-access') : {
      unlocked: client.hasAccess(appId || 'all-access'),
      mode: client.unlockStatus(appId || 'all-access'),
      remainingText: ''
    };
    if (details.mode === 'license-bundle') {
      return {
        text: `👑 VIP Trọn Bộ · ${details.remainingText || 'Đang hoạt động'}`,
        unlocked: true,
        expired: false
      };
    }
    if (details.mode === 'license-single') {
      return {
        text: `✨ VIP Plus · ${details.remainingText || 'Đã kích hoạt'}`,
        unlocked: true,
        expired: false
      };
    }
    if (details.mode === 'expired') {
      return {
        text: '⚠️ Gói VIP đã hết hạn · Bấm gia hạn',
        unlocked: false,
        expired: true
      };
    }
    return { text: '🎁 Đang dùng thử miễn phí', unlocked: false, expired: false };
  }

  async function downloadSoftwarePackage(appId = 'go-may') {
    if (typeof document === 'undefined') return false;
    const catalog = root.NTLabCatalog;
    const app = catalog ? (catalog.getApp(appId) || catalog.apps[0]) : { id: 'go-may', name: 'Tập Gõ Máy Tính', path: '/go-may/' };

    if (root.NTLabCloud) {
      root.NTLabCloud.trackSoftwareDownload(app.id, 'offline-launcher').catch(() => {});
    } else if (root.NTLabPlatform) {
      root.NTLabPlatform.createClient().incrementDownload();
    }

    const origin = (typeof location !== 'undefined' && location.origin && location.origin !== 'null')
      ? location.origin
      : 'https://ntlab-apps.web.app';
    const targetUrl = `${origin}${app.path || '/go-may/'}`;

    const htmlContent = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escape(app.name)} — Bộ Khởi Động Nhanh NTLab</title>
  <style>
    body { margin:0; font-family: system-ui, sans-serif; background:#0f172a; color:#f8fafc; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; }
    .card { max-width:520px; background:#1e293b; border:1px solid #334155; border-radius:20px; padding:28px; text-align:center; box-shadow:0 20px 50px rgba(0,0,0,0.4); }
    h1 { font-size:22px; color:#fbbf24; margin:0 0 10px; }
    p { font-size:14px; color:#cbd5e1; line-height:1.5; margin-bottom:20px; }
    a.btn { display:inline-block; background:linear-gradient(135deg,#2563eb,#1d4ed8); color:#fff; text-decoration:none; font-weight:800; padding:12px 24px; border-radius:10px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 ${escape(app.name)} (NTLab)</h1>
    <p>File khởi động nhanh trên máy tính của bạn. Bấm nút bên dưới để mở ứng dụng và đồng bộ dữ liệu VIP qua Google Cloud:</p>
    <a class="btn" href="${escape(targetUrl)}">Mở ${escape(app.name)} Ngay →</a>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NTLab-${app.id}-Launcher.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
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
      const cloudStatus = root.NTLabCloud ? root.NTLabCloud.getStatus() : { configured: false, user: null, isAdmin: false };
      const readyApps = catalog.apps.filter(app => app.status === 'ready');
      const homeHref = activeAppId ? '../' : './';
      const minPrice = catalog.formatCurrency(catalog.getApp(activeAppId)?.price || catalog.apps[0]?.price || 39000);
      const bundlePrice = catalog.formatCurrency(catalog.bundle.price || 99000);

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
            `;
            }).join('')}
          </div>
          <div class="ntlab-bar-right">
            ${cloudStatus.isAdmin ? `
              <button type="button" class="ntlab-admin-btn" data-ntlab-admin="open" title="Chỉ hiển thị cho Admin tuanngocpt@gmail.com">
                🛡️ Quản Trị Hệ Thống
              </button>
            ` : ''}
            <button type="button" class="ntlab-dl-btn" data-ntlab-download="${escape(activeAppId || 'go-may')}" title="Tải bộ khởi động phần mềm về máy">
              ⬇️ Tải phần mềm
            </button>
            <button type="button" class="ntlab-auth-btn ${cloudStatus.user ? 'logged-in' : ''}" data-ntlab-auth="toggle">
              ${cloudStatus.user
                ? `☁️ ${escape(cloudStatus.user.displayName)} (Thoát)`
                : cloudStatus.configured
                  ? '☁️ Đăng nhập Google'
                  : '☁️ Đồng bộ Cloud'}
            </button>
            <span class="ntlab-status-pill ${status.unlocked ? 'unlocked' : status.expired ? 'expired' : ''}">${escape(status.text)}</span>
            <button type="button" class="ntlab-bundle-btn" data-ntlab-checkout="${escape(activeAppId || 'all-access')}">
              ${status.unlocked ? `Quản lý VIP / Gia hạn` : `Mở khóa VIP · Từ ${escape(minPrice)} / Trọn bộ ${escape(bundlePrice)}`}
            </button>
          </div>
        </div>
      `;
    }

    bar.addEventListener('click', async event => {
      const adminBtn = event.target.closest('[data-ntlab-admin]');
      if (adminBtn) {
        openAdminDashboard();
        return;
      }
      const dlBtn = event.target.closest('[data-ntlab-download]');
      if (dlBtn) {
        await downloadSoftwarePackage(dlBtn.dataset.ntlabDownload || 'go-may');
        return;
      }
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

  function buildCheckoutHtml(appId, selectedScope, existingOrderCode = '') {
    const catalog = root.NTLabCatalog;
    const platform = root.NTLabPlatform;
    const client = platform.createClient();
    const app = catalog.getApp(appId) || catalog.apps[0];
    const bundle = catalog.bundle;
    const scope = selectedScope === 'all-access' ? 'all-access' : app.id;
    const isBundle = scope === 'all-access';

    const price = isBundle ? bundle.price : app.price;
    const originalPrice = isBundle ? bundle.originalPrice : app.originalPrice;
    const durationDays = isBundle ? bundle.durationDays : app.durationDays;
    const durationLabel = catalog.formatDuration(durationDays);
    const prefix = isBundle ? bundle.codePrefix : app.codePrefix;
    const ref = existingOrderCode || platform.generateOrderCode(prefix);
    const qrUrl = catalog.buildVietQrUrl(price, ref);

    const details = client.licenseDetails(scope);
    const bundleDetails = client.licenseDetails('all-access');
    const isAdmin = root.NTLabCloud ? root.NTLabCloud.getStatus().isAdmin : false;

    // Tự động đăng ký đơn hàng chờ thanh toán tự động trên Firestore nếu đang chạy trên trình duyệt
    if (typeof window !== 'undefined' && root.NTLabCloud) {
      setTimeout(() => {
        bindLiveOrderToModal(scope, ref);
      }, 30);
    }

    return `
      <div class="modal-eyebrow">KHO PHẦN MỀM NTLAB · THANH TOÁN VIETQR TỰ ĐỘNG 24/7</div>
      <h2>Chọn gói VIP để mở khóa toàn bộ tính năng.</h2>
      <div class="ntlab-plan-tabs" role="tablist" aria-label="Chọn gói mở khóa">
        <button type="button" class="ntlab-plan-tab ${!isBundle ? 'active' : ''}" data-ntlab-plan="${escape(app.id)}">
          <div class="ntlab-plan-tab-top">
            <strong>Mua lẻ: ${escape(app.name)}</strong>
            <span class="ntlab-plan-price">${catalog.formatCurrency(app.price)}</span>
          </div>
          <small>${escape(app.plusSummary)} · <b>Thời hạn: ${escape(catalog.formatDuration(app.durationDays))}</b></small>
        </button>
        <button type="button" class="ntlab-plan-tab ${isBundle ? 'active' : ''}" data-ntlab-plan="all-access">
          <div class="ntlab-plan-tab-top">
            <strong>🌟 ${escape(bundle.shortName)} (Tất cả App)</strong>
            <span class="ntlab-plan-price">${catalog.formatCurrency(bundle.price)}</span>
          </div>
          <small>${escape(bundle.summary)} · <b>Thời hạn: ${escape(catalog.formatDuration(bundle.durationDays))}</b></small>
        </button>
      </div>

      <div class="checkout-grid">
        ${qrUrl
          ? `<div class="qr-placeholder"><img id="ntlab-checkout-qr" src="${escape(qrUrl)}" alt="Mã VietQR thanh toán tự động" style="max-width:160px;border-radius:8px;margin:0 auto;"></div>`
          : `<div class="qr-placeholder" role="img" aria-label="Khung VietQR">
              <strong>VietQR Tự Động</strong>
              <small>${isAdmin
                ? 'Bấm nút "🛡️ Quản Trị Hệ Thống" để điền STK Ngân hàng nhận tiền VietQR'
                : 'Quét mã QR hoặc nhập Mã Kích Hoạt VIP bên dưới để mở khóa ngay'}</small>
            </div>`
        }
        <div class="payment-details">
          <div>Gói đang chọn<strong>${escape(isBundle ? bundle.name : `Gói VIP ${app.name}`)}</strong></div>
          <div>Số tiền thanh toán<strong>${catalog.formatCurrency(price)} <span style="text-decoration:line-through;color:#64748b;font-weight:400;font-size:12px;">${catalog.formatCurrency(originalPrice)}</span></strong></div>
          <div>Thời hạn gói VIP<strong style="color:#15803d;">${escape(durationLabel)}</strong></div>
          <div>Nội dung chuyển khoản<code id="ntlab-order-ref" style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:5px;font-weight:800;">${escape(ref)}</code></div>
          <div>Trạng thái gói hiện tại<strong>${
            bundleDetails.unlocked
              ? `VIP Trọn Bộ (${escape(bundleDetails.remainingText)})`
              : details.unlocked
                ? `VIP ${escape(app.name)} (${escape(details.remainingText)})`
                : details.mode === 'expired'
                  ? '⚠️ Đã hết hạn — Vui lòng gia hạn'
                  : 'Đang dùng thử miễn phí'
          }</strong></div>
        </div>
      </div>

      <div id="ntlab-autopay-status" class="ntlab-autopay-banner">
        <span>🔄 <strong>Tự động kích hoạt:</strong> Giữ nguyên cửa sổ này sau khi chuyển khoản đúng nội dung <code id="ntlab-order-ref-inline">${escape(ref)}</code>, hệ thống sẽ tự mở khóa VIP trong vài giây.</span>
        <button type="button" class="button secondary" style="padding:6px 12px;font-size:12px;" data-ntlab-action="check-order">Tôi đã chuyển khoản</button>
      </div>

      <div class="ntlab-license-box">
        <label for="ntlab-license-input">🔑 Đã có Mã Kích Hoạt VIP? Nhập mã tại đây (mở lẻ ${escape(app.codePrefix)}-... hoặc trọn bộ ALL-...):</label>
        <div class="ntlab-license-row">
          <input id="ntlab-license-input" type="text" placeholder="Ví dụ: ${escape(prefix)}-234567-ABCD" autocomplete="off" spellcheck="false">
          <button type="button" class="button primary" data-ntlab-action="activate-key">Kích hoạt VIP</button>
        </div>
        <div id="ntlab-license-msg" class="ntlab-license-msg" role="status" aria-live="polite"></div>
        <small style="display:block;margin-top:6px;color:#475569;font-size:12px;">
          ${root.NTLabCloud?.getStatus().user
            ? `☁️ Đang kết nối tài khoản Google <b>${escape(root.NTLabCloud.getStatus().user.email)}</b>: Quyền VIP & thời hạn gói được bảo vệ 1-1 trên Cloud Firestore.`
            : `☁️ Khuyến nghị bấm <b>Đăng nhập Google</b> trên thanh trên cùng để gắn gói VIP vĩnh viễn vào tài khoản của bạn.`}
        </small>
      </div>

      <div class="modal-actions">
        ${isAdmin ? `<button type="button" class="button secondary" onclick="window.NTLabUI.openAdminDashboard()">🛡️ Cài đặt Giá & Quản trị</button>` : ''}
        <button type="button" class="button secondary" data-action="close" data-ntlab-action="close">Đóng</button>
      </div>
    `;
  }

  async function bindLiveOrderToModal(scope) {
    if (!root.NTLabCloud || typeof document === 'undefined') return;
    if (activeOrderSession && typeof activeOrderSession.unsubscribe === 'function') {
      activeOrderSession.unsubscribe();
      activeOrderSession = null;
    }

    const session = await root.NTLabCloud.createAndWatchPaymentOrder(scope, ({ order, activation }) => {
      const banner = document.getElementById('ntlab-autopay-status');
      const msgEl = document.getElementById('ntlab-license-msg');
      if (banner) {
        banner.className = 'ntlab-autopay-banner paid';
        banner.innerHTML = `<span>🎉 <strong>Thanh toán thành công!</strong> Đã tự động kích hoạt mã VIP <code>${escape(order.licenseCode)}</code> (${escape(activation.remainingText || 'Đang hoạt động')}).</span>`;
      }
      if (msgEl) {
        msgEl.textContent = `🎉 Đã mở khóa tự động gói VIP với mã ${order.licenseCode}!`;
        msgEl.className = 'ntlab-license-msg ok';
      }
    });

    if (!session) return;
    activeOrderSession = session;

    const refEl = document.getElementById('ntlab-order-ref');
    const refInlineEl = document.getElementById('ntlab-order-ref-inline');
    const qrImg = document.getElementById('ntlab-checkout-qr');
    if (refEl) refEl.textContent = session.orderCode;
    if (refInlineEl) refInlineEl.textContent = session.orderCode;
    if (qrImg && root.NTLabCatalog) {
      const freshQr = root.NTLabCatalog.buildVietQrUrl(session.amount, session.orderCode);
      if (freshQr) qrImg.src = freshQr;
    }

    const checkBtn = document.querySelector('[data-ntlab-action="check-order"]');
    if (checkBtn) {
      checkBtn.onclick = async () => {
        checkBtn.textContent = '⏳ Đang kiểm tra...';
        checkBtn.disabled = true;
        const res = await session.checkStatusNow();
        checkBtn.disabled = false;
        checkBtn.textContent = 'Tôi đã chuyển khoản';
        const msgEl = document.getElementById('ntlab-license-msg');
        if (msgEl) {
          msgEl.textContent = res.paid
            ? `🎉 Xác nhận thanh toán thành công! Mã VIP của bạn: ${res.licenseCode}`
            : res.reason;
          msgEl.className = `ntlab-license-msg ${res.paid ? 'ok' : 'err'}`;
        }
      };
    }
  }

  /**
   * BẢNG ĐIỀU KHIỂN QUẢN TRỊ (ADMIN DASHBOARD)
   * Chỉ hiển thị & hoạt động duy nhất cho tài khoản: tuanngocpt@gmail.com
   */
  async function openAdminDashboard(initialTab = 'stats') {
    if (typeof document === 'undefined' || !root.NTLabCloud) return;
    const st = root.NTLabCloud.getStatus();
    if (!st.isAdmin) {
      alert('Từ chối truy cập: Chức năng Quản trị chỉ dành riêng cho tài khoản tuanngocpt@gmail.com.');
      return;
    }

    let overlay = document.getElementById('ntlab-admin-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ntlab-admin-overlay';
      overlay.className = 'ntlab-admin-overlay';
      document.body.appendChild(overlay);
    }

    let currentTab = initialTab;
    let dashData = null;

    async function refreshAndRender() {
      overlay.classList.add('open');
      overlay.innerHTML = `
        <div class="ntlab-admin-modal">
          <div class="ntlab-admin-header">
            <div>
              <h2>🛡️ Quản Trị Hệ Thống NTLab (Admin: ${escape(st.user?.email)})</h2>
              <small style="color:#cbd5e1;font-size:12px;">Bảo mật phân quyền Backend qua Firestore Security Rules · Chỉ tuanngocpt@gmail.com có quyền đọc/ghi</small>
            </div>
            <button type="button" class="button secondary" id="ntlab-admin-close" style="padding:6px 12px;">✕ Đóng</button>
          </div>
          <div class="ntlab-admin-tabs">
            <button type="button" class="ntlab-admin-tab ${currentTab === 'stats' ? 'active' : ''}" data-admin-tab="stats">📊 Thống Kê & Người Dùng VIP</button>
            <button type="button" class="ntlab-admin-tab ${currentTab === 'pricing' ? 'active' : ''}" data-admin-tab="pricing">💰 Quản Lý Giá & Thời Gian Gói VIP</button>
            <button type="button" class="ntlab-admin-tab ${currentTab === 'orders' ? 'active' : ''}" data-admin-tab="orders">🔑 Đơn Hàng Tự Động & Kho Mã</button>
            <button type="button" class="ntlab-admin-tab ${currentTab === 'automation' ? 'active' : ''}" data-admin-tab="automation">🤖 Cài Đặt Авто-Thanh Toán (Gmail Script)</button>
          </div>
          <div class="ntlab-admin-body" id="ntlab-admin-body">
            <p style="padding:20px;color:#475569;">⏳ Đang tải dữ liệu thực tế từ Google Cloud Firestore...</p>
          </div>
        </div>
      `;

      overlay.querySelector('#ntlab-admin-close').onclick = () => overlay.classList.remove('open');
      overlay.querySelectorAll('[data-admin-tab]').forEach(btn => {
        btn.onclick = () => {
          currentTab = btn.dataset.adminTab;
          renderTabContent();
          overlay.querySelectorAll('[data-admin-tab]').forEach(b => b.classList.toggle('active', b.dataset.adminTab === currentTab));
        };
      });

      dashData = await root.NTLabCloud.fetchAdminDashboardData();
      renderTabContent();
    }

    function renderTabContent() {
      const body = overlay.querySelector('#ntlab-admin-body');
      if (!body) return;

      if (!dashData || !dashData.ok) {
        body.innerHTML = `<div style="padding:16px;background:#fef2f2;color:#991b1b;border-radius:12px;">⚠️ ${escape(dashData?.reason || 'Không thể tải dữ liệu.')}</div>`;
        return;
      }

      const { stats, usersList, licensesList, ordersList } = dashData;
      const catalog = root.NTLabCatalog;

      if (currentTab === 'stats') {
        body.innerHTML = `
          <div class="ntlab-kpi-grid">
            <div class="ntlab-kpi-card">
              <span>👥 Tổng số người dùng</span>
              <strong>${stats.totalUsers}</strong>
              <small>Tài khoản Google & thiết bị truy cập</small>
            </div>
            <div class="ntlab-kpi-card">
              <span>⬇️ Người tải phần mềm</span>
              <strong style="color:#2563eb;">${stats.downloadUsersCount} <span style="font-size:15px;font-weight:700;color:#64748b;">(${stats.totalDownloads} lượt tải)</span></strong>
              <small>Đã tải bộ cài Offline / Tài liệu</small>
            </div>
            <div class="ntlab-kpi-card">
              <span>🧪 Người dùng thử (Trial)</span>
              <strong style="color:#d97706;">${stats.trialUsers}</strong>
              <small>Đang học thử / dùng thử miễn phí</small>
            </div>
            <div class="ntlab-kpi-card">
              <span>👑 Người đã mua gói VIP</span>
              <strong style="color:#16a34a;">${stats.activeVipUsers} <span style="font-size:14px;color:#dc2626;">(${stats.expiredVipUsers} hết hạn)</span></strong>
              <small>Doanh thu đơn tự động: <b>${catalog.formatCurrency(stats.paidRevenue)}</b></small>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
            <h3 style="font-size:15px;font-weight:800;">Danh sách Người dùng, Trạng thái Dùng thử / VIP & Thời hạn Gói VIP (${usersList.length})</h3>
            <button type="button" class="button secondary" id="admin-refresh-btn" style="padding:6px 12px;font-size:12px;">🔄 Làm mới số liệu</button>
          </div>

          <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:12px;">
            <table class="ntlab-admin-table">
              <thead>
                <tr>
                  <th>Người dùng / Email</th>
                  <th>Phân loại</th>
                  <th>Gói VIP</th>
                  <th>Thời gian gói VIP / Hạn dùng</th>
                  <th>Lượt tải</th>
                  <th>Hoạt động cuối</th>
                  <th>Cấp / Chỉnh sửa Thời gian VIP</th>
                </tr>
              </thead>
              <tbody>
                ${usersList.length === 0 ? `
                  <tr><td colspan="7" style="text-align:center;padding:20px;color:#64748b;">Chưa có dữ liệu người dùng.</td></tr>
                ` : usersList.map(u => {
                  const badgeCls = u.computedStatus === 'vip-active' ? 'vip' : u.computedStatus === 'vip-expired' || u.computedStatus === 'revoked' ? 'expired' : 'trial';
                  const badgeText = u.computedStatus === 'vip-active' ? '👑 Đã mua VIP' : u.computedStatus === 'vip-expired' ? '⌛ VIP Hết hạn' : u.computedStatus === 'revoked' ? '🚫 Đã thu hồi' : '🧪 Dùng thử';
                  const lastTime = u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
                  return `
                    <tr>
                      <td>
                        <strong>${escape(u.email)}</strong>
                        <div style="font-size:11.5px;color:#64748b;">${escape(u.displayName)} ${u.activatedCodes.length ? `· Mã: <code>${escape(u.activatedCodes.join(', '))}</code>` : ''}</div>
                      </td>
                      <td><span class="ntlab-badge ${badgeCls}">${badgeText}</span></td>
                      <td><strong>${escape(u.vipScope || 'Miễn phí')}</strong></td>
                      <td>
                        <strong>${escape(u.remainingText)}</strong>
                        ${u.vipDurationDays !== null ? `<div style="font-size:11px;color:#64748b;">Gói: ${u.vipDurationDays > 0 ? u.vipDurationDays + ' ngày' : 'Vĩnh viễn'}</div>` : ''}
                      </td>
                      <td><strong>${u.downloadCount}</strong> lần</td>
                      <td style="font-size:12px;color:#64748b;">${escape(lastTime)}</td>
                      <td>
                        <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
                          <select data-vip-scope="${escape(u.id)}" style="padding:4px 6px;border-radius:6px;border:1px solid #cbd5e1;font-size:12px;">
                            <option value="all-access" ${u.vipScope === 'all-access' ? 'selected' : ''}>Trọn bộ (ALL)</option>
                            <option value="go-may" ${u.vipScope === 'go-may' ? 'selected' : ''}>Tập Gõ (GM)</option>
                            <option value="man-hinh-desktop" ${u.vipScope === 'man-hinh-desktop' ? 'selected' : ''}>Màn Hình (MD)</option>
                          </select>
                          <select data-vip-days="${escape(u.id)}" style="padding:4px 6px;border-radius:6px;border:1px solid #cbd5e1;font-size:12px;">
                            <option value="30">30 ngày</option>
                            <option value="90">90 ngày</option>
                            <option value="365" selected>365 ngày (1 năm)</option>
                            <option value="0">Vĩnh viễn</option>
                          </select>
                          <button type="button" class="button primary" style="padding:4px 8px;font-size:11.5px;" data-admin-grant="${escape(u.id)}" data-uid="${escape(u.uid)}" data-vid="${escape(u.visitorId)}">Lưu VIP</button>
                          ${u.computedStatus === 'vip-active' ? `
                            <button type="button" class="button secondary" style="padding:4px 8px;font-size:11.5px;background:#fee2e2;color:#991b1b;" data-admin-revoke="${escape(u.id)}" data-uid="${escape(u.uid)}" data-vid="${escape(u.visitorId)}">Thu hồi</button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;

        body.querySelector('#admin-refresh-btn').onclick = () => refreshAndRender();
        body.querySelectorAll('[data-admin-grant]').forEach(btn => {
          btn.onclick = async () => {
            const rowId = btn.dataset.adminGrant;
            const uid = btn.dataset.uid;
            const visitorId = btn.dataset.vid;
            const scope = body.querySelector(`[data-vip-scope="${CSS.escape(rowId)}"]`)?.value || 'all-access';
            const durationDays = Number(body.querySelector(`[data-vip-days="${CSS.escape(rowId)}"]`)?.value ?? 365);
            btn.textContent = '⏳...';
            btn.disabled = true;
            const res = await root.NTLabCloud.adminSetUserVip({ uid, visitorId, scope, durationDays, action: 'grant' });
            alert(res.ok ? res.message : res.reason);
            await refreshAndRender();
          };
        });
        body.querySelectorAll('[data-admin-revoke]').forEach(btn => {
          btn.onclick = async () => {
            if (!confirm('Bạn có chắc muốn thu hồi quyền VIP của người dùng này?')) return;
            const uid = btn.dataset.uid;
            const visitorId = btn.dataset.vid;
            const res = await root.NTLabCloud.adminSetUserVip({ uid, visitorId, action: 'revoke' });
            alert(res.ok ? res.message : res.reason);
            await refreshAndRender();
          };
        });
        return;
      }

      if (currentTab === 'pricing') {
        const b = catalog.bundle;
        const pay = catalog.paymentConfig;
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:18px;">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:12px 16px;border-radius:12px;font-size:13px;color:#1e3a8a;">
              💡 Mọi thay đổi về <strong>Giá bán, Giá gốc, Thời gian Gói VIP (số ngày) và Tài khoản VietQR</strong> tại đây được lưu thẳng lên Firestore (<code>settings/catalog</code>) và áp dụng ngay lập tức cho tất cả khách truy cập.
            </div>

            <div style="border:1px solid #cbd5e1;border-radius:14px;padding:16px;">
              <h3 style="font-size:15px;font-weight:800;margin-bottom:12px;color:#0f172a;">1. Gói Trọn Bộ All-Access VIP (Mở khóa toàn bộ kho phần mềm)</h3>
              <div class="ntlab-form-grid">
                <div class="ntlab-field">
                  <label>Tên gói hiển thị</label>
                  <input type="text" id="cfg-bundle-name" value="${escape(b.name)}">
                </div>
                <div class="ntlab-field">
                  <label>Giá bán thực tế (VNĐ)</label>
                  <input type="number" id="cfg-bundle-price" value="${Number(b.price) || 99000}" min="0" step="1000">
                </div>
                <div class="ntlab-field">
                  <label>Giá gốc gạch ngang (VNĐ)</label>
                  <input type="number" id="cfg-bundle-orig" value="${Number(b.originalPrice) || 299000}" min="0" step="1000">
                </div>
                <div class="ntlab-field">
                  <label>Thời gian gói VIP (Ngày · Nhập 0 = Vĩnh viễn)</label>
                  <input type="number" id="cfg-bundle-days" value="${Number(b.durationDays ?? 365)}" min="0" step="1">
                </div>
              </div>
            </div>

            <div style="border:1px solid #cbd5e1;border-radius:14px;padding:16px;">
              <h3 style="font-size:15px;font-weight:800;margin-bottom:12px;color:#0f172a;">2. Khai báo Giá & Thời hạn VIP từng phần mềm lẻ</h3>
              <div style="display:flex;flex-direction:column;gap:14px;">
                ${catalog.apps.map(app => `
                  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;">
                    <div style="font-weight:800;font-size:13.5px;margin-bottom:8px;color:#1d4ed8;">${escape(app.name)} (<code>${escape(app.id)}</code> · Mã: ${escape(app.codePrefix)})</div>
                    <div class="ntlab-form-grid">
                      <div class="ntlab-field">
                        <label>Tên phần mềm</label>
                        <input type="text" data-app-name="${escape(app.id)}" value="${escape(app.name)}">
                      </div>
                      <div class="ntlab-field">
                        <label>Giá mua lẻ (VNĐ)</label>
                        <input type="number" data-app-price="${escape(app.id)}" value="${Number(app.price) || 39000}" min="0" step="1000">
                      </div>
                      <div class="ntlab-field">
                        <label>Giá gốc (VNĐ)</label>
                        <input type="number" data-app-orig="${escape(app.id)}" value="${Number(app.originalPrice) || 199000}" min="0" step="1000">
                      </div>
                      <div class="ntlab-field">
                        <label>Thời gian gói VIP (Ngày · 0 = Vĩnh viễn)</label>
                        <input type="number" data-app-days="${escape(app.id)}" value="${Number(app.durationDays ?? 365)}" min="0" step="1">
                      </div>
                      <div class="ntlab-field">
                        <label>Số ngày/bài dùng thử</label>
                        <input type="number" data-app-trial="${escape(app.id)}" value="${Number(app.trialDays ?? 3)}" min="0" step="1">
                      </div>
                      <div class="ntlab-field">
                        <label>Trạng thái phát hành</label>
                        <select data-app-status="${escape(app.id)}">
                          <option value="ready" ${app.status === 'ready' ? 'selected' : ''}>Đang mở bán (Ready)</option>
                          <option value="coming-soon" ${app.status === 'coming-soon' ? 'selected' : ''}>Sắp ra mắt (Coming Soon)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <div style="border:1px solid #cbd5e1;border-radius:14px;padding:16px;">
              <h3 style="font-size:15px;font-weight:800;margin-bottom:12px;color:#0f172a;">3. Tài khoản Ngân hàng nhận tiền VietQR Tự động</h3>
              <div class="ntlab-form-grid">
                <div class="ntlab-field">
                  <label>Mã Ngân hàng (VD: MB, VCB, TCB, ACB, BIDV, VPB, TPB)</label>
                  <input type="text" id="cfg-bank-id" value="${escape(pay.bankId)}" placeholder="VD: VCB hoặc MB">
                </div>
                <div class="ntlab-field">
                  <label>Số tài khoản nhận tiền</label>
                  <input type="text" id="cfg-account-no" value="${escape(pay.accountNo)}" placeholder="Nhập số tài khoản ngân hàng">
                </div>
                <div class="ntlab-field">
                  <label>Tên chủ tài khoản (Không dấu)</label>
                  <input type="text" id="cfg-account-name" value="${escape(pay.accountName)}" placeholder="VD: NGUYEN TUAN NGOC">
                </div>
                <div class="ntlab-field">
                  <label>Tiền tố nội dung chuyển khoản</label>
                  <input type="text" id="cfg-transfer-prefix" value="${escape(pay.transferPrefix || 'NTLAB')}">
                </div>
              </div>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:10px;align-items:center;">
              <span id="cfg-save-status" style="font-size:13px;font-weight:700;"></span>
              <button type="button" class="button primary" id="cfg-save-btn" style="padding:11px 22px;font-size:14px;">
                💾 Lưu Bảng Giá & Cấu Hình Lên Cloud Firestore
              </button>
            </div>
          </div>
        `;

        body.querySelector('#cfg-save-btn').onclick = async () => {
          const btn = body.querySelector('#cfg-save-btn');
          const statusEl = body.querySelector('#cfg-save-status');
          btn.disabled = true;
          btn.textContent = '⏳ Đang lưu lên Cloud...';

          const appsUpdate = {};
          for (const app of catalog.apps) {
            appsUpdate[app.id] = {
              id: app.id,
              name: body.querySelector(`[data-app-name="${app.id}"]`)?.value || app.name,
              price: Number(body.querySelector(`[data-app-price="${app.id}"]`)?.value ?? app.price),
              originalPrice: Number(body.querySelector(`[data-app-orig="${app.id}"]`)?.value ?? app.originalPrice),
              durationDays: Number(body.querySelector(`[data-app-days="${app.id}"]`)?.value ?? app.durationDays),
              trialDays: Number(body.querySelector(`[data-app-trial="${app.id}"]`)?.value ?? app.trialDays),
              status: body.querySelector(`[data-app-status="${app.id}"]`)?.value || app.status
            };
          }

          const newConfig = {
            paymentConfig: {
              bankId: body.querySelector('#cfg-bank-id')?.value || '',
              accountNo: body.querySelector('#cfg-account-no')?.value || '',
              accountName: body.querySelector('#cfg-account-name')?.value || '',
              transferPrefix: body.querySelector('#cfg-transfer-prefix')?.value || 'NTLAB',
              template: 'compact2'
            },
            bundle: {
              id: 'all-access',
              name: body.querySelector('#cfg-bundle-name')?.value || b.name,
              shortName: b.shortName,
              price: Number(body.querySelector('#cfg-bundle-price')?.value ?? b.price),
              originalPrice: Number(body.querySelector('#cfg-bundle-orig')?.value ?? b.originalPrice),
              durationDays: Number(body.querySelector('#cfg-bundle-days')?.value ?? b.durationDays)
            },
            apps: appsUpdate
          };

          const res = await root.NTLabCloud.saveCatalogToCloud(newConfig);
          btn.disabled = false;
          btn.textContent = '💾 Lưu Bảng Giá & Cấu Hình Lên Cloud Firestore';
          if (statusEl) {
            statusEl.textContent = res.ok ? '✅ Đã lưu thành công lên Firestore!' : `❌ ${res.reason}`;
            statusEl.style.color = res.ok ? '#15803d' : '#dc2626';
          }
        };
        return;
      }

      if (currentTab === 'orders') {
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:18px;">
            <div style="border:1px solid #cbd5e1;border-radius:14px;padding:16px;background:#f8fafc;">
              <h3 style="font-size:15px;font-weight:800;margin-bottom:10px;">🔑 Tạo Mã Kích Hoạt VIP mới trên Cloud (Có gắn Thời gian Gói VIP)</h3>
              <div class="ntlab-form-grid">
                <div class="ntlab-field">
                  <label>Loại gói phần mềm</label>
                  <select id="gen-lic-scope">
                    <option value="all-access">ALL — Gói Trọn Bộ (${catalog.formatCurrency(catalog.bundle.price)})</option>
                    <option value="go-may">GM — Tập Gõ Máy Tính (${catalog.formatCurrency(catalog.getApp('go-may')?.price || 39000)})</option>
                    <option value="man-hinh-desktop">MD — Màn Hình Desktop (${catalog.formatCurrency(catalog.getApp('man-hinh-desktop')?.price || 39000)})</option>
                  </select>
                </div>
                <div class="ntlab-field">
                  <label>Thời gian của gói VIP</label>
                  <select id="gen-lic-days">
                    <option value="30">30 ngày (1 tháng)</option>
                    <option value="90">90 ngày (3 tháng)</option>
                    <option value="365" selected>365 ngày (1 năm)</option>
                    <option value="0">Vĩnh viễn (Trọn đời)</option>
                  </select>
                </div>
                <div class="ntlab-field">
                  <label>Số lượng mã cần tạo</label>
                  <input type="number" id="gen-lic-count" value="5" min="1" max="50">
                </div>
                <div class="ntlab-field">
                  <label>Ghi chú khách hàng / chiến dịch</label>
                  <input type="text" id="gen-lic-note" placeholder="VD: Khách chuyển khoản Zalo">
                </div>
              </div>
              <div style="margin-top:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                <button type="button" class="button primary" id="btn-create-cloud-lic">⚡ Sinh Mã & Lưu Lên Cloud</button>
                <div id="gen-lic-output" style="font-family:monospace;font-weight:800;color:#15803d;"></div>
              </div>
            </div>

            <div>
              <h3 style="font-size:15px;font-weight:800;margin-bottom:8px;">💳 Danh sách Đơn Hàng VietQR Tự Động (${ordersList.length})</h3>
              <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:12px;max-height:260px;">
                <table class="ntlab-admin-table">
                  <thead>
                    <tr>
                      <th>Mã đơn (Nội dung CK)</th>
                      <th>Gói & Số tiền</th>
                      <th>Thời hạn VIP</th>
                      <th>Khách hàng</th>
                      <th>Trạng thái</th>
                      <th>Mã VIP đã cấp</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${ordersList.length === 0 ? `
                      <tr><td colspan="7" style="text-align:center;padding:16px;color:#64748b;">Chưa có đơn hàng nào.</td></tr>
                    ` : ordersList.map(o => `
                      <tr>
                        <td><code><strong>${escape(o.orderCode)}</strong></code></td>
                        <td>${escape(o.scope)} · <strong>${catalog.formatCurrency(o.amount)}</strong></td>
                        <td>${escape(catalog.formatDuration(o.durationDays))}</td>
                        <td>${escape(o.email || o.visitorId || 'Khách')}</td>
                        <td>
                          <span class="ntlab-badge ${o.status === 'paid' ? 'vip' : 'trial'}">
                            ${o.status === 'paid' ? '✅ Đã thanh toán' : '⏳ Chờ chuyển khoản'}
                          </span>
                        </td>
                        <td><code>${escape(o.licenseCode || '—')}</code></td>
                        <td>
                          ${o.status !== 'paid' ? `
                            <button type="button" class="button primary" style="padding:4px 10px;font-size:11.5px;" data-approve-order="${escape(o.orderCode)}">
                              ✅ Duyệt & Mở khóa ngay
                            </button>
                          ` : `<small style="color:#15803d;font-weight:700;">Đã tự động mở khóa</small>`}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 style="font-size:15px;font-weight:800;margin-bottom:8px;">🔐 Kho Mã Kích Hoạt VIP trên Cloud (${licensesList.length})</h3>
              <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:12px;max-height:240px;">
                <table class="ntlab-admin-table">
                  <thead>
                    <tr>
                      <th>Mã Kích Hoạt</th>
                      <th>Phạm vi</th>
                      <th>Thời hạn gói</th>
                      <th>Người kích hoạt</th>
                      <th>Hạn sử dụng</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${licensesList.length === 0 ? `
                      <tr><td colspan="5" style="text-align:center;padding:16px;color:#64748b;">Chưa có mã nào trên Cloud.</td></tr>
                    ` : licensesList.map(l => `
                      <tr>
                        <td><code><strong>${escape(l.code)}</strong></code></td>
                        <td>${escape(l.scope)}</td>
                        <td>${escape(catalog.formatDuration(l.durationDays))}</td>
                        <td>${escape(l.claimedEmail || l.claimedBy || 'Chưa sử dụng')}</td>
                        <td>${escape(l.claimedAt ? l.remainingText : 'Chưa kích hoạt')}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;

        body.querySelector('#btn-create-cloud-lic').onclick = async () => {
          const scope = body.querySelector('#gen-lic-scope')?.value || 'all-access';
          const durationDays = Number(body.querySelector('#gen-lic-days')?.value ?? 365);
          const count = Number(body.querySelector('#gen-lic-count')?.value || 5);
          const note = body.querySelector('#gen-lic-note')?.value || '';
          const out = body.querySelector('#gen-lic-output');
          out.textContent = '⏳ Đang tạo mã...';
          const res = await root.NTLabCloud.adminCreateCloudLicenses({ scope, durationDays, count, note });
          if (res.ok) {
            out.textContent = `Đã tạo: ${res.codes.join(', ')}`;
            await refreshAndRender();
          } else {
            out.textContent = `Lỗi: ${res.reason}`;
          }
        };

        body.querySelectorAll('[data-approve-order]').forEach(btn => {
          btn.onclick = async () => {
            const orderCode = btn.dataset.approveOrder;
            btn.textContent = '⏳ Đang duyệt...';
            btn.disabled = true;
            const res = await root.NTLabCloud.adminApproveOrder(orderCode);
            if (res.ok) {
              alert(`Đã duyệt đơn ${orderCode} và tự động mở khóa mã ${res.licenseCode} cho khách hàng!`);
              await refreshAndRender();
            } else {
              alert(res.reason);
              btn.disabled = false;
              btn.textContent = '✅ Duyệt & Mở khóa ngay';
            }
          };
        });
        return;
      }

      if (currentTab === 'automation') {
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:14px;">
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:14px 16px;border-radius:12px;color:#14532d;font-size:13.5px;">
              <strong>🔒 Cơ chế Авто-Thanh Toán Bảo Mật 100% (Cách 4 — Không qua trung gian, 0đ phí):</strong>
              <ol style="margin:8px 0 0 18px;line-height:1.6;">
                <li>Truy cập <a href="https://script.google.com" target="_blank" rel="noopener" style="color:#15803d;font-weight:800;">https://script.google.com</a> bằng đúng tài khoản <b>tuanngocpt@gmail.com</b> và tạo 1 dự án mới.</li>
                <li>Mở file <code>scripts/google-apps-script-auto-pay.gs</code> trong mã nguồn dự án và dán vào Google Apps Script.</li>
                <li>Bấm <b>Triggers (Kích hoạt)</b> → Chọn hàm <code>autoApproveBankEmails</code> chạy định kỳ mỗi <b>1 phút</b> (hoặc Deploy làm Web App nếu kết nối Webhook SePay/PayOS).</li>
                <li>Vì chạy trực tiếp bằng OAuth Token chính chủ <code>tuanngocpt@gmail.com</code>, Firestore Rules cho phép script tự động chuyển trạng thái đơn <code>orders/{orderCode}</code> sang <code>paid</code> và mở khóa trên màn hình khách ngay lập tức!</li>
              </ol>
            </div>
          </div>
        `;
      }
    }

    await refreshAndRender();
  }

  function downloadShareCard(opts = {}) {
    if (typeof document === 'undefined') return false;
    if (root.NTLabCloud) {
      root.NTLabCloud.trackSoftwareDownload(opts.appId || 'go-may', 'speed-card').catch(() => {});
    }
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

  const api = {
    statusLabel,
    mountBar,
    buildCheckoutHtml,
    bindLiveOrderToModal,
    openAdminDashboard,
    downloadSoftwarePackage,
    downloadShareCard
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NTLabUI = api;
})(globalThis);
