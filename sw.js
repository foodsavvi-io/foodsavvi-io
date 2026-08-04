// sw.js - Service Worker for foodsavvi

const CACHE_NAME = 'foodsavvi-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/login.html',
    '/home.html',
    '/find-stores.html',
    '/claim.html',
    '/shoplist.html',
    '/fridge.html',
    '/community-share.html',
    '/community.html',
    '/advertise.html',
    '/business-profile.html',
    '/business-claims.html',
    '/recipe.html',
    '/privacy.html',
    '/offline.html',
    '/assets/icon.png',
    '/assets/fridge.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Install event - cache assets
self.addEventListener('install', event => {
    console.log('Service Worker installing.');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache).catch(err => {
                    console.error('Failed to cache:', err);
                    // Don't fail the whole install if one file fails
                    return Promise.resolve();
                });
            })
            .then(() => {
                console.log('All assets cached successfully');
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker activating.');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker activated, claiming clients');
            return self.clients.claim();
        })
    );
});

// Helper function to determine if request is for an image
function isImageRequest(request) {
    const url = request.url;
    return url.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i) !== null;
}

// Helper function to determine if request is for an HTML page
function isHtmlRequest(request) {
    const url = request.url;
    // Check if it's a navigation request or HTML file
    return request.mode === 'navigate' || url.match(/\.html$/i) !== null;
}

// Fetch event - serve from cache or network with fallback
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Skip cross-origin requests that aren't GET
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip Back4App API calls
    if (url.hostname.includes('parseapi.back4app.com')) {
        return;
    }
    
    // Skip external resources
    if (url.origin !== self.location.origin && 
        !url.hostname.includes('cdnjs') && 
        !url.hostname.includes('fonts')) {
        return;
    }
    
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                // Return cached response if found
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                // Otherwise fetch from network
                return fetch(request)
                    .then(networkResponse => {
                        // Don't cache non-successful responses
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        
                        // Clone the response
                        const responseToCache = networkResponse.clone();
                        
                        // Cache the fetched response
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(request, responseToCache);
                            })
                            .catch(err => console.error('Cache put error:', err));
                        
                        return networkResponse;
                    })
                    .catch(fetchError => {
                        console.error('Fetch failed:', fetchError, 'for URL:', request.url);
                        
                        // Try to return a fallback response for HTML pages
                        if (isHtmlRequest(request)) {
                            return caches.match('/index.html');
                        }
                        
                        // For images, return a placeholder
                        if (isImageRequest(request)) {
                            // Return a simple SVG placeholder
                            const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f0f0f0"/><text x="50" y="55" text-anchor="middle" fill="#999" font-size="12">No Image</text></svg>`;
                            return new Response(placeholderSvg, {
                                headers: { 'Content-Type': 'image/svg+xml' }
                            });
                        }
                        
                        // For other requests, return a basic error response
                        return new Response('Network error occurred', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

// Handle messages from clients
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
