// SPDX-FileCopyrightText: 2025 Robin Gutzen <robin.gutzen@outlook.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * sw.js — Service Worker for Panel Compass PWA.
 *
 * Cache-first strategy: all app assets are cached on install so the app
 * works fully offline after the first visit. The optimal orientation
 * calculation runs entirely client-side (no API calls needed).
 */

const CACHE_NAME = 'panel-compass-v1';

const ASSETS = [
  './',
  './index.html',
  './app.js',
  './compass.js',
  './solar.js',
  './styles.css',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ---------------------------------------------------------------------------
// Install — cache all app assets
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(ASSETS);
    })
  );
  // Activate immediately (don't wait for existing tabs to close)
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate — clean up old caches
// ---------------------------------------------------------------------------

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ---------------------------------------------------------------------------
// Fetch — cache-first, network fallback
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  // Only handle same-origin requests (don't cache external APIs)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then((response) => {
        // Don't cache non-successful responses or non-GET requests
        if (!response || response.status !== 200 || event.request.method !== 'GET') {
          return response;
        }

        // Clone and cache the response
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });

        return response;
      });
    }).catch(() => {
      // Network failed and not in cache — return a basic offline page
      if (event.request.destination === 'document') {
        return caches.match('./index.html');
      }
    })
  );
});
