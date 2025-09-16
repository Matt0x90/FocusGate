// FocusGate Blocked Page Script
// Purpose: Handles the blocked page UI when users visit a blocked domain
// Shows which domain is blocked and provides snooze options

/**
 * Extract the blocked domain from URL hash parameter
 * Format: blocked.html#d=example.com
 * @returns {string} The blocked domain or empty string
 */
function getDomainFromHash() {
  const match = (location.hash || "").match(/[#&]d=([^&]+)/);
  if (match) {
    // Decode and normalize the domain
    return decodeURIComponent(match[1])
      .replace(/^www\./i, "")
      .toLowerCase();
  }
  return "";
}

/**
 * Try to extract domain from document.referrer as fallback
 * This helps if the hash parameter is missing
 * @returns {string} The referring domain or empty string
 */
function getDomainFromReferrer() {
  try {
    if (document.referrer) {
      const url = new URL(document.referrer);
      return url.hostname
        .replace(/^www\./i, "")
        .toLowerCase();
    }
  } catch {
    // Invalid referrer URL, ignore
  }
  return "";
}

/* ========== INTERNATIONALIZATION ========== */

// Locale data loaded from _locales directory
let blockedLocale = null;

/**
 * Load locale messages for the blocked page
 * @param {string} lang - Locale code (e.g. 'en', 'es', 'fr')
 */
async function loadLocaleBlocked(lang) {
  try {
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    const res = await fetch(url);
    if (res.ok) {
      blockedLocale = await res.json();
    } else {
      blockedLocale = null;
    }
  } catch {
    // Failed to load locale, will fall back to chrome.i18n
    blockedLocale = null;
  }
}

/**
 * Get translated message for a key
 * @param {string} key - Message identifier
 * @returns {string} Translated message or empty string
 */
function getMessageBlocked(key) {
  // Try custom loaded locale first
  if (blockedLocale && blockedLocale[key] && blockedLocale[key].message) {
    return blockedLocale[key].message;
  }
  // Fall back to Chrome's built-in i18n
  if (chrome?.i18n) {
    const msg = chrome.i18n.getMessage(key);
    return msg || '';
  }
  return '';
}

/**
 * Apply translations to all static text on the blocked page
 */
function applyI18nBlocked() {
  // Update page title
  const titleEl = document.getElementById('t');
  if (titleEl) {
    const msg = getMessageBlocked('blockedPageTitle');
    if (msg) titleEl.textContent = msg;
  }
  
  // Update description
  const descEl = document.getElementById('d');
  if (descEl) {
    const msg = getMessageBlocked('blockedPageMessage');
    if (msg) descEl.textContent = msg;
  }
  
  // Update snooze buttons
  const btn5 = document.querySelector("button[data-min='5']");
  if (btn5) {
    const msg = getMessageBlocked('snooze5m');
    if (msg) btn5.textContent = msg;
  }
  
  const btn15 = document.querySelector("button[data-min='15']");
  if (btn15) {
    const msg = getMessageBlocked('snooze15m');
    if (msg) btn15.textContent = msg;
  }
  
  // Update popup button
  const popupBtn = document.getElementById('open-popup');
  if (popupBtn) {
    const msg = getMessageBlocked('openPopup');
    if (msg) popupBtn.textContent = msg;
  }
  
  // Update privacy notice
  const privacyNotice = document.querySelector('small.muted');
  if (privacyNotice) {
    const msg = getMessageBlocked('privacyNotice');
    if (msg) privacyNotice.textContent = msg;
  }
}

/* ========== THEME MANAGEMENT ========== */

/**
 * Apply theme based on user preference
 * @param {string|boolean|undefined} mode - Theme mode
 */
function applyThemeBlocked(mode) {
  const html = document.documentElement;
  html.classList.remove('dark');
  html.classList.remove('light');
  
  if (mode === 'dark' || mode === true) {
    html.classList.add('dark');
  } else if (mode === 'light' || mode === false) {
    html.classList.add('light');
  }
  // else: auto mode, rely on CSS media queries
}

/* ========== INITIALIZATION ========== */

/**
 * Initialize the blocked page
 * Loads theme, language preferences and applies them
 */
async function initBlocked() {
  try {
    // Load user preferences from storage
    const prefs = await chrome.storage.local.get(['darkMode', 'lang']);
    
    // Apply theme
    applyThemeBlocked(prefs.darkMode);
    
    // Load and apply language
    const lang = prefs.lang || 'en';
    await loadLocaleBlocked(lang);
  } catch (err) {
    // Continue with defaults if preferences fail to load
  }
  
  // Apply translations
  applyI18nBlocked();
}

// Initialize as soon as possible
initBlocked();

/* ========== MAIN FUNCTIONALITY ========== */

// Get the blocked domain and display it
const hostlineEl = document.getElementById("hostline");
const domain = getDomainFromHash() || getDomainFromReferrer();

if (domain) {
  // Show which domain is blocked
  hostlineEl.textContent = `Blocked: ${domain}`;
} else {
  // Couldn't determine the domain
  hostlineEl.textContent = "Site blocked";
}

// Handle snooze buttons
document.querySelectorAll("button[data-min]").forEach(btn => {
  btn.addEventListener("click", async () => {
    if (!domain) {
      // Can't snooze without knowing the domain
      alert("Could not detect site—use the popup to snooze.");
      return;
    }
    
    // Disable button to prevent double-clicks
    btn.disabled = true;
    
    // Get snooze duration from button
    const minutes = parseInt(btn.getAttribute("data-min"), 10);
    
    try {
      // Tell service worker to pause this domain
      await chrome.runtime.sendMessage({
        cmd: "pauseDomain",
        domain: domain,
        minutes: minutes
      });
    } catch (err) {
      // Failed to snooze, re-enable button
      btn.disabled = false;
      return;
    }
    
    // Wait a moment for the rule to update
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Redirect back to the original site
    // Use referrer if available, otherwise construct URL
    const target = document.referrer && /^https?:\/\//i.test(document.referrer) 
      ? document.referrer 
      : `https://${domain}/`;
    
    location.replace(target);
  });
});

// Handle "Open FocusGate" button
document.getElementById("open-popup").addEventListener("click", () => {
  // Try to open the popup (may not work in all contexts)
  if (chrome.action?.openPopup) {
    chrome.action.openPopup();
  } else {
    // Fallback: open in a new tab
    chrome.runtime.sendMessage({ cmd: "openPopup" });
  }
});