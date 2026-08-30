/**
 * Service Worker Registration Hook
 * Phase 3 Task #13: Service Worker Caching
 *
 * Registers LP PRO service worker for caching and offline support.
 * Non-blocking: errors are logged but don't crash the app.
 */

import { useEffect } from 'react';

export function useServiceWorker() {
  useEffect(() => {
    // Only register in production and if service workers are supported
    if (
      !('serviceWorker' in navigator) ||
      process.env.NODE_ENV === 'development'
    ) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          '/lp-service-worker.js',
          {
            scope: '/', // Register for all routes
          }
        );

        console.log('[LP Service Worker] Registered successfully:', registration);

        // Check for updates periodically (every 6 hours)
        const updateInterval = 6 * 60 * 60 * 1000;
        setInterval(() => {
          registration.update().catch(() => {
            // Silent fail: update check is non-critical
          });
        }, updateInterval);
      } catch (error) {
        console.error('[LP Service Worker] Registration failed:', error);
        // Non-blocking: app continues to work without service worker
      }
    };

    // Delay registration slightly to avoid blocking initial page load
    const timeoutId = setTimeout(registerServiceWorker, 1000);

    return () => clearTimeout(timeoutId);
  }, []);
}

/**
 * Hook to clear service worker cache (useful for debugging)
 */
export function useClearServiceWorkerCache() {
  return async () => {
    if (!('serviceWorker' in navigator) || !('caches' in window)) {
      console.warn('[LP Service Worker] Caches API not available');
      return;
    }

    try {
      const cacheNames = await caches.keys();
      const lpCaches = cacheNames.filter((name) => name.startsWith('lp-v'));

      await Promise.all(lpCaches.map((name) => caches.delete(name)));
      console.log('[LP Service Worker] Cache cleared:', lpCaches);
    } catch (error) {
      console.error('[LP Service Worker] Cache clear failed:', error);
    }
  };
}
