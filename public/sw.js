/* eslint-disable no-restricted-globals */

// SignageOS Service Worker for Offline Support
const CACHE_NAME = 'signageos-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event - cache core assets safely
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('Opened cache');
      for (const url of urlsToCache) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('Service worker failed to cache URL:', url, err);
        }
      }
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache hit - return response
      if (response) {
        return response;
      }
      return fetch(event.request);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
