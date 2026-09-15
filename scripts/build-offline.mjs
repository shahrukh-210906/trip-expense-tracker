import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const dist = resolve('client/dist');
const paths = ['/index.html', ...readdirSync(resolve(dist, 'assets')).filter(name => /\.(js|css)$/.test(name)).map(name => '/assets/' + name)];
const hash = createHash('sha256');
for (const path of paths) hash.update(readFileSync(resolve(dist, '.' + path)));
const version = hash.digest('hex').slice(0, 16);
writeFileSync(resolve(dist, 'sw.js'), `
const CACHE = 'trip-shell-${version}';
const SHELL = ${JSON.stringify(paths)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('trip-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || /^\\/(api|socket\\.io)(\\/|$)/.test(url.pathname)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html'))));
  } else if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.pathname)) || fetch(event.request)));
  }
});
`);
console.log('Offline app shell built: ' + version);
