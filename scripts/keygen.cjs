#!/usr/bin/env node
'use strict';

const platform = require('../shared/platform.js');

const scopeArg = (process.argv[2] || 'ALL').toUpperCase();
const count = Math.max(1, Math.min(500, Number(process.argv[3] || 5)));

console.log(`\n=== NTLAB LICENSE KEY GENERATOR ===`);
console.log(`Loại mã: ${scopeArg === 'ALL' ? 'ALL (Trọn bộ N phần mềm - 99k)' : scopeArg === 'GM' ? 'GM (Gõ Mây - 39k)' : scopeArg === 'MD' ? 'MD (Màn Hình Desktop - 39k)' : scopeArg}`);
console.log(`Số lượng: ${count} mã\n`);

for (let i = 0; i < count; i++) {
  console.log(`  ${platform.generateLicenseKey(scopeArg)}`);
}

console.log(`\nHướng dẫn: Gửi 1 mã trên cho khách hàng để nhập vào ô "Kích hoạt mã" trên Trang chủ hoặc trong từng phần mềm.\n`);
