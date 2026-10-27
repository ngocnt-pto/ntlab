/**
 * ============================================================================
 * NTLAB AUTO-PAYMENT BOT (GOOGLE APPS SCRIPT — CHÍNH CHỦ 0Đ PHÍ, BẢO MẬT 100%)
 * Dành riêng cho Admin: tuanngocpt@gmail.com | Dự án Firebase: ntlab-apps
 * ============================================================================
 *
 * HƯỚNG DẪN CÀI ĐẶT TRONG 2 PHÚT:
 * 1. Đăng nhập tài khoản tuanngocpt@gmail.com, mở https://script.google.com -> Dự án mới.
 * 2. Dán toàn bộ nội dung file này vào Code.gs và bấm Lưu (Ctrl+S).
 * 3. Bấm biểu tượng Đồng hồ (Kích hoạt / Triggers) ở thanh bên trái:
 *    - Chọn hàm: autoApproveBankEmails
 *    - Nguồn sự kiện: Theo thời gian (Time-driven) -> Bộ hẹn giờ theo phút -> Mỗi phút 1 lần.
 * 4. (Tùy chọn) Nếu dùng thêm SePay/Casso Webhook: Bấm Triển khai (Deploy) -> Ứng dụng web (Web App)
 *    -> Thực thi dưới tên: Tôi (tuanngocpt@gmail.com) -> Ai có quyền truy cập: Bất kỳ ai -> Copy URL dán vào Webhook.
 */

const FIREBASE_PROJECT_ID = 'ntlab-apps';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// Thuật toán sinh Mã Kích Hoạt VIP chuẩn NTLab (khớp 100% với shared/platform.js)
function computeChecksum(prefix, payload) {
  const input = `NTLAB-SUITE-V1:${prefix}:${payload}`;
  let h1 = 0x811c9dc5;
  let h2 = 5381;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = ((h2 << 5) + h2 + code) >>> 0;
  }
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let out = '';
  let combined = (h1 ^ h2) >>> 0;
  for (let i = 0; i < 4; i++) {
    out += alphabet[combined % alphabet.length];
    combined = (Math.floor(combined / alphabet.length) ^ (h1 >>> (i * 4))) >>> 0;
  }
  return out;
}

function generateLicenseKey(prefix) {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let payload = '';
  for (let i = 0; i < 6; i++) {
    payload += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  const check = computeChecksum(prefix, payload);
  return `${prefix}-${payload}-${check}`;
}

/**
 * 1. Quét email báo biến động số dư ngân hàng trong Gmail (Cách 4 - Miễn phí 100%)
 */
function autoApproveBankEmails() {
  // Tìm các email chưa đọc trong 2 ngày gần nhất có chứa từ khóa mã đơn NTLAB-
  const threads = GmailApp.search('is:unread newer_than:2d "NTLAB"', 0, 20);
  for (let t = 0; t < threads.length; t++) {
    const messages = threads[t].getMessages();
    for (let m = 0; m < messages.length; m++) {
      const msg = messages[m];
      if (!msg.isUnread()) continue;
      const body = msg.getPlainBody() + ' ' + msg.getSubject();
      const match = /NTLAB[-\s]?(ALL|GM|MD|DN)[-\s]?([2-9A-HJ-NP-Z]{6})/i.exec(body);
      if (match) {
        const prefix = match[1].toUpperCase();
        const suffix = match[2].toUpperCase();
        const orderCode = `NTLAB-${prefix}-${suffix}`;
        const paidAmount = extractAmountFromText(body);
        const ok = verifyAndApproveFirestoreOrder(orderCode, paidAmount, 'gmail-auto');
        if (ok) {
          msg.markRead();
        }
      }
    }
  }
}

/**
 * 2. Webhook nhận thông báo tức thì từ SePay / Casso / PayOS (nếu kết nối thêm)
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const content = String(
      payload.content || payload.description || (payload.data && payload.data.description) || JSON.stringify(payload)
    );
    const amount = Number(
      payload.transferAmount || payload.amount || (payload.data && payload.data.amount) || 0
    );
    const match = /NTLAB[-\s]?(ALL|GM|MD|DN)[-\s]?([2-9A-HJ-NP-Z]{6})/i.exec(content);
    if (match) {
      const orderCode = `NTLAB-${match[1].toUpperCase()}-${match[2].toUpperCase()}`;
      verifyAndApproveFirestoreOrder(orderCode, amount, 'webhook-auto');
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function extractAmountFromText(text) {
  const matches = text.match(/(\+?\s?\d{1,3}(?:[.,]\d{3})+)\s*(?:VND|VNĐ|đ|d)/i);
  if (!matches) return 0;
  return Number(matches[1].replace(/[^\d]/g, '')) || 0;
}

function verifyAndApproveFirestoreOrder(orderCode, receivedAmount, source) {
  const token = ScriptApp.getOAuthToken();
  const orderUrl = `${FIRESTORE_BASE_URL}/orders/${encodeURIComponent(orderCode)}`;

  const getResp = UrlFetchApp.fetch(orderUrl, {
    method: 'get',
    headers: { Authorization: `Bearer ${token}` },
    muteHttpExceptions: true
  });

  if (getResp.getResponseCode() !== 200) return false;
  const orderDoc = JSON.parse(getResp.getContentText());
  const fields = orderDoc.fields || {};

  const currentStatus = fields.status && fields.status.stringValue;
  if (currentStatus === 'paid') return true;

  const expectedAmount = Number(fields.amount && (fields.amount.integerValue || fields.amount.doubleValue) || 39000);
  if (receivedAmount > 0 && receivedAmount < expectedAmount) {
    Logger.log(`Đơn ${orderCode}: Số tiền nhận (${receivedAmount}) nhỏ hơn giá gói (${expectedAmount}).`);
    return false;
  }

  const scope = (fields.scope && fields.scope.stringValue) || 'all-access';
  const prefix = (fields.codePrefix && fields.codePrefix.stringValue) || 'ALL';
  const durationDays = Number(fields.durationDays && (fields.durationDays.integerValue || fields.durationDays.doubleValue) ?? 365);
  const nowIso = new Date().toISOString();
  const expiresAtIso = durationDays > 0
    ? new Date(Date.now() + durationDays * 86400000).toISOString()
    : '';
  const licenseCode = generateLicenseKey(prefix);

  // 1. Tạo mã bản quyền trên Firestore (licenses/{licenseCode})
  const licUrl = `${FIRESTORE_BASE_URL}/licenses/${encodeURIComponent(licenseCode)}`;
  UrlFetchApp.fetch(licUrl, {
    method: 'patch',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${token}` },
    payload: JSON.stringify({
      fields: {
        code: { stringValue: licenseCode },
        scope: { stringValue: scope },
        durationDays: { integerValue: String(durationDays) },
        expiresAt: expiresAtIso ? { stringValue: expiresAtIso } : { nullValue: null },
        createdAt: { stringValue: nowIso },
        createdBy: { stringValue: `auto-${source}` },
        orderCode: { stringValue: orderCode },
        revoked: { booleanValue: false }
      }
    }),
    muteHttpExceptions: true
  });

  // 2. Cập nhật đơn hàng sang trạng thái 'paid' -> Trình duyệt khách tự nhận mã & mở khóa ngay!
  const patchUrl = `${orderUrl}?updateMask.fieldPaths=status&updateMask.fieldPaths=licenseCode&updateMask.fieldPaths=paidAt&updateMask.fieldPaths=expiresAt&updateMask.fieldPaths=approvedBy`;
  UrlFetchApp.fetch(patchUrl, {
    method: 'patch',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${token}` },
    payload: JSON.stringify({
      fields: {
        status: { stringValue: 'paid' },
        licenseCode: { stringValue: licenseCode },
        paidAt: { stringValue: nowIso },
        expiresAt: expiresAtIso ? { stringValue: expiresAtIso } : { nullValue: null },
        approvedBy: { stringValue: `tuanngocpt@gmail.com (${source})` }
      }
    }),
    muteHttpExceptions: true
  });

  Logger.log(`Đã duyệt tự động đơn ${orderCode} -> Cấp mã ${licenseCode}`);
  return true;
}
