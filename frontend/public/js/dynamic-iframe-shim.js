/**
 * Dynamic Iframe Shim
 * 
 * This script must load BEFORE any other scripts in the app.
 * It marks Dynamic authentication iframes as credentialless to work
 * with COEP (Cross-Origin-Embedder-Policy) headers required for WASM.
 * 
 * Without this, Dynamic's authentication iframes would be blocked by COEP,
 * breaking wallet connection functionality.
 */
(() => {
  'use strict';

  // Match Dynamic authentication hosts
  const matchesAuthHost = (url) => {
    try {
      const u = new URL(url, document.baseURI);
      return (
        u.hostname === 'relay.dynamicauth.com' ||
        /\.dynamicauth\.com$/.test(u.hostname) ||
        u.hostname === 'app.dynamicauth.com'
      );
    } catch {
      return false;
    }
  };

  // Mark iframe as credentialless
  const markCredentialless = (iframe) => {
    try {
      iframe.credentialless = true;
    } catch (e) {
      // Silently ignore if browser doesn't support credentialless
    }
  };

  // 1. Intercept iframe.src setter
  try {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLIFrameElement.prototype,
      'src'
    );
    
    if (originalDescriptor && originalDescriptor.set) {
      const originalSet = originalDescriptor.set;
      
      Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
        ...originalDescriptor,
        set(value) {
          if (matchesAuthHost(value)) {
            markCredentialless(this);
          }
          return originalSet.call(this, value);
        }
      });
    }
  } catch (e) {
    console.warn('[dynamic-iframe-shim] Failed to patch iframe.src:', e);
  }

  // 2. Intercept setAttribute for src
  try {
    const originalSetAttribute = HTMLIFrameElement.prototype.setAttribute;
    
    HTMLIFrameElement.prototype.setAttribute = function(name, value) {
      if (name.toLowerCase() === 'src' && matchesAuthHost(value)) {
        markCredentialless(this);
      }
      return originalSetAttribute.call(this, name, value);
    };
  } catch (e) {
    console.warn('[dynamic-iframe-shim] Failed to patch setAttribute:', e);
  }

  // 3. Watch for dynamically created iframes
  try {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.tagName === 'IFRAME') {
            const src = node.src || node.getAttribute('src');
            if (src && matchesAuthHost(src)) {
              markCredentialless(node);
            }
          }
        }
      }
    });

    // Start observing when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    } else {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  } catch (e) {
    console.warn('[dynamic-iframe-shim] Failed to set up MutationObserver:', e);
  }

  console.log('[dynamic-iframe-shim] Initialized - Dynamic iframes will be marked credentialless');
})();
