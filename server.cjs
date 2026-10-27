const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('PORT phải là số từ 1 đến 65535.');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf'
};

const appFolders = new Set(['go-may', 'man-hinh-desktop']);

http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405);
    return response.end();
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400);
    return response.end('Bad request');
  }

  // Redirect /go-may -> /go-may/ and /man-hinh-desktop -> /man-hinh-desktop/
  const bareSlug = pathname.slice(1);
  if (appFolders.has(bareSlug)) {
    response.writeHead(302, { Location: `/${bareSlug}/` });
    return response.end();
  }

  if (pathname === '/') pathname = '/index.html';
  for (const slug of appFolders) {
    if (pathname === `/${slug}/`) pathname = `/${slug}/index.html`;
  }

  const allowed =
    pathname === '/index.html' ||
    pathname === '/style.css' ||
    /^\/shared\/[a-zA-Z0-9_-]+\.(js|css)$/.test(pathname) ||
    /^\/(src|assets)\/[a-zA-Z0-9_-]+\.(js|svg|png|webp|ico|pdf)$/.test(pathname) ||
    /^\/(go-may|man-hinh-desktop)\/(index\.html|style\.css|(src|assets)\/[a-zA-Z0-9_-]+\.(js|svg|png|webp|ico|pdf))$/.test(pathname);

  if (!allowed) {
    response.writeHead(404);
    return response.end('Not found');
  }

  const file = path.join(root, pathname);
  fs.readFile(file, (error, data) => {
    if (error) {
      response.writeHead(404);
      return response.end('Not found');
    }
    response.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(request.method === 'HEAD' ? undefined : data);
  });
}).on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Cổng ${port} đang được sử dụng. Hãy đóng phiên cũ hoặc chọn PORT khác.` : error.message);
  process.exitCode = 1;
}).listen(port, 'localhost', () => {
  console.log(`\n  NTLab · Kho phần mềm kỹ năng & năng suất (Đã kết nối Firebase: ntlab-apps)\n`);
  console.log(`  Trang chủ:         http://localhost:${port}/`);
  console.log(`  Tập Gõ Máy Tính:   http://localhost:${port}/go-may/`);
  console.log(`  Màn Hình Desktop:  http://localhost:${port}/man-hinh-desktop/\n`);
  console.log(`  Nhấn Ctrl+C để dừng. Không cần cài thư viện.\n`);
});
