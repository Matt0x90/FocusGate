// FocusGate Popup Script
// Purpose: Manages the extension popup UI, handles user interactions,
// and communicates with the service worker for blocking operations

// DOM element references
const domainInput = document.getElementById("domain-input");
const addForm = document.getElementById("add-form");
const listEl = document.getElementById("list");
const statusEl = document.getElementById("status");
const resumeBtn = document.getElementById("resume-btn");
const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const importFile = document.getElementById("import-file");
const themeToggleBtn = document.getElementById("theme-toggle");
const languageSelect = document.getElementById("language-select");

// Internationalization support
let i18nMessages = null; // Holds loaded locale messages

/* ========== INTERNATIONALIZATION (i18n) ========== */

/**
 * Load locale messages from _locales directory
 * @param {string} lang - Locale code (e.g. 'en', 'es', 'fr')
 */
async function loadLocale(lang) {
  try {
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    const res = await fetch(url);
    if (res.ok) {
      i18nMessages = await res.json();
    } else {
      console.warn('Locale file not found for', lang);
      i18nMessages = null;
    }
  } catch (err) {
    console.error('Failed to load locale', err);
    i18nMessages = null;
  }
}

/**
 * Get translated message for a key
 * Falls back to chrome.i18n.getMessage if custom locale not loaded
 * @param {string} key - Message identifier
 * @returns {string} Translated message or empty string
 */
function getMessage(key) {
  // Try custom loaded locale first
  if (i18nMessages && i18nMessages[key] && i18nMessages[key].message) {
    return i18nMessages[key].message;
  }
  // Fall back to Chrome's built-in i18n
  if (chrome?.i18n) {
    const msg = chrome.i18n.getMessage(key);
    return msg || '';
  }
  return '';
}

/**
 * Apply translations to all static text in the popup
 */
function applyI18n() {
  // Helper to update element text by ID
  const set = (id, key) => {
    const el = document.getElementById(id);
    if (el) {
      const msg = getMessage(key);
      if (msg) el.textContent = msg;
    }
  };
  
  // Update all translatable elements
  set("app-title", "appTitle");
  set("tagline", "tagline");
  set("add-label", "addLabel");
  set("snooze-title", "globalSnoozeTitle");
  set("list-title", "blockedListTitle");
  set("list-help", "blockedListHelp");
  set("ie-title", "importExportTitle");
  set("per-site-info", "perSiteInfo");
  
  // Update button labels
  const exportMsg = getMessage("export");
  if (exportMsg) exportBtn.textContent = exportMsg;
  
  const importMsg = getMessage("import");
  if (importMsg) importBtn.textContent = importMsg;
  
  const resumeMsg = getMessage("resume");
  if (resumeMsg) resumeBtn.textContent = resumeMsg;
  
  // Update snooze preset buttons
  document.querySelectorAll(".preset[data-min]").forEach(btn => {
    const minutes = btn.getAttribute("data-min");
    if (minutes === "15") {
      const m = getMessage("preset15m");
      if (m) btn.textContent = m;
    } else if (minutes === "60") {
      const m = getMessage("preset1h");
      if (m) btn.textContent = m;
    } else if (minutes === "720") {
      const m = getMessage("preset12h");
      if (m) btn.textContent = m;
    }
  });
}

/* ========== THEME MANAGEMENT ========== */

/**
 * Apply theme based on user preference
 * @param {string|boolean|undefined} mode - 'dark', 'light', true/false, or undefined (auto)
 */
function applyTheme(mode) {
  const html = document.documentElement;
  html.classList.remove('dark');
  html.classList.remove('light');
  
  if (mode === 'dark' || mode === true) {
    html.classList.add('dark');
    updateThemeIcon(true);
  } else if (mode === 'light' || mode === false) {
    html.classList.add('light');
    updateThemeIcon(false);
  } else {
    // Auto mode: rely on CSS media queries
    updateThemeIcon(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
}

/**
 * Update theme toggle button icon
 * @param {boolean} isDark - Whether dark mode is active
 */
function updateThemeIcon(isDark) {
  if (!themeToggleBtn) return;
  // Show sun when dark (to switch to light), moon when light (to switch to dark)
  themeToggleBtn.textContent = isDark ? '☀️' : '🌙';
}

/* ========== DOMAIN VALIDATION ========== */

/**
 * Validate domain format for security
 * @param {string} domain - Domain to validate
 * @returns {boolean} True if valid
 */
function isValidDomain(domain) {
  // Basic validation: no spaces, valid characters, reasonable length
  if (!domain || domain.length > 253) return false;
  
  // Check for valid domain characters (alphanumeric, dots, hyphens)
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  // Remove common protocols if present for validation
  const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/i, '');
  
  return domainRegex.test(cleanDomain);
}

/**
 * Normalize user input to a clean domain name
 * Handles URLs, protocols, www prefix, and trailing paths
 * @param {string} text - User input (domain or URL)
 * @returns {string} Normalized domain or empty string if invalid
 */
function normalizeDomain(text) {
  const t = (text || "").trim();
  if (!t) return "";
  
  try {
    // Try to parse as URL (handles full URLs)
    const url = t.includes("://") ? new URL(t) : new URL("https://" + t);
    const domain = url.hostname.replace(/^www\./i, "").toLowerCase();
    
    // Validate the extracted domain
    if (!isValidDomain(domain)) {
      console.warn('Invalid domain format:', domain);
      return "";
    }
    
    return domain;
  } catch {
    // Fallback: basic cleanup if URL parsing fails
    const cleaned = t
      .replace(/^[a-z]+:\/\//i, "") // Remove protocol
      .replace(/^www\./i, "")       // Remove www
      .split("/")[0]                // Remove path
      .toLowerCase();
    
    // Validate the cleaned domain
    if (!isValidDomain(cleaned)) {
      console.warn('Invalid domain format:', cleaned);
      return "";
    }
    
    return cleaned;
  }
}

/* ========== STORAGE OPERATIONS ========== */

/**
 * Get blocked domains from Chrome sync storage
 * @returns {Promise<string[]>} Array of blocked domains
 */
async function getBlocked() {
  const { blockedDomains = [] } = await chrome.storage.sync.get("blockedDomains");
  return blockedDomains;
}

/**
 * Update blocked domains in storage and sync rules
 * @param {string[]} domains - New list of domains to block
 */
async function setBlocked(domains) {
  // Deduplicate, normalize, and sort domains
  const uniq = [...new Set(domains.map(normalizeDomain).filter(Boolean))].sort();
  
  // Save to Chrome sync storage (syncs across devices)
  await chrome.storage.sync.set({ blockedDomains: uniq });
  
  // Tell service worker to update blocking rules
  await chrome.runtime.sendMessage({ cmd: "syncRules" });
  
  // Re-render the UI
  await render();
}

/**
 * Request host permission for a domain
 * @param {string} domain - Domain to request permission for
 * @returns {Promise<boolean>} True if permission granted
 */
async function requestOriginPermission(domain) {
  // Build origin patterns for the domain and its subdomains
  const origins = [
    `https://${domain}/*`,
    `http://${domain}/*`,
    `https://*.${domain}/*`,
    `http://*.${domain}/*`
  ];
  
  // Check if we already have permission
  const hasPermission = await chrome.permissions.contains({ origins });
  if (hasPermission) return true;
  
  // Request permission from user
  return await chrome.permissions.request({ origins });
}

/* ========== UI RENDERING ========== */

/**
 * Create a list item for a blocked domain
 * @param {string} domain - The blocked domain
 * @param {number} pausedUntilTs - Timestamp when domain pause expires (if any)
 * @returns {HTMLElement} List item element
 */
function domainRow(domain, pausedUntilTs) {
  const li = document.createElement("li");
  li.className = "domain";
  li.setAttribute("role", "option");
  li.setAttribute("tabindex", "0");
  
  // Domain name
  const host = document.createElement("span");
  host.className = "host";
  host.textContent = domain;
  
  // Pause status indicator
  const meta = document.createElement("span");
  meta.className = "paused";
  if (pausedUntilTs && Date.now() < pausedUntilTs) {
    const mins = Math.ceil((pausedUntilTs - Date.now()) / 60000);
    meta.textContent = `Snoozed ~${mins}m`;
  } else {
    meta.textContent = "";
  }
  
  // Snooze button
  const snooze = document.createElement("button");
  snooze.className = "ghost btn-mini";
  const snoozeLabel = getMessage('snoozeSite') || '⏱ 15m';
  snooze.textContent = snoozeLabel;
  snooze.title = `Snooze ${domain} for 15 minutes`;
  snooze.onclick = async () => {
    await chrome.runtime.sendMessage({ cmd: 'pauseDomain', domain, minutes: 15 });
    await render();
  };
  
  // Resume button
  const resume = document.createElement('button');
  resume.className = 'ghost btn-mini';
  const resumeLabel = getMessage('resumeSite') || '▶ Resume';
  resume.textContent = resumeLabel;
  resume.title = `Resume ${domain} now`;
  resume.onclick = async () => {
    await chrome.runtime.sendMessage({ cmd: 'resumeDomain', domain });
    await render();
  };
  
  // Remove button
  const remove = document.createElement('button');
  remove.className = 'danger btn-mini';
  const removeLabel = getMessage('remove') || 'Remove';
  remove.textContent = removeLabel;
  remove.title = `Remove ${domain}`;
  remove.onclick = async () => {
    const cur = await getBlocked();
    await setBlocked(cur.filter(d => d !== domain));
  };
  
  // Keyboard support: Delete key removes domain
  li.onkeydown = async (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const cur = await getBlocked();
      await setBlocked(cur.filter(d => d !== domain));
    }
  };
  
  li.append(host, meta, snooze, resume, remove);
  return li;
}

/**
 * Render the current state of blocked domains and pauses
 */
async function render() {
  // Get current state from storage
  const [{ blockedDomains = [] }, { pausedUntilTs = 0, pausedDomains = {} }] = await Promise.all([
    chrome.storage.sync.get("blockedDomains"),
    chrome.storage.local.get(["pausedUntilTs", "pausedDomains"])
  ]);
  
  // Update status text
  if (pausedUntilTs && Date.now() < pausedUntilTs) {
    // Global pause is active
    const mins = Math.ceil((pausedUntilTs - Date.now()) / 60000);
    const base = getMessage('allPaused') || 'All sites paused';
    statusEl.textContent = `${base} ~${mins}m`;
  } else {
    // Show domain count
    if (blockedDomains.length) {
      const suffix = getMessage('domainCount') || 'domain(s) blocked';
      statusEl.textContent = `${blockedDomains.length} ${suffix}`;
    } else {
      statusEl.textContent = getMessage('noDomains') || 'No domains yet';
    }
  }
  
  // Update domain list
  listEl.innerHTML = "";
  blockedDomains.forEach(d => {
    listEl.appendChild(domainRow(d, pausedDomains?.[d]));
  });
}

/* ========== EVENT HANDLERS ========== */

// Handle form submission to add a domain
addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  // Normalize and validate the domain
  const d = normalizeDomain(domainInput.value);
  if (!d) {
    // Show error feedback with shake animation
    domainInput.style.border = '1px solid var(--danger)';
    domainInput.classList.add('shake');
    setTimeout(() => {
      domainInput.style.border = '';
      domainInput.classList.remove('shake');
    }, 500);
    return;
  }
  
  // Get current blocklist
  const original = await getBlocked();
  
  // Mark as pending while we request permission
  await chrome.runtime.sendMessage({ cmd: "markPending", domain: d });
  
  // Add to list immediately for instant feedback
  if (!original.includes(d)) {
    await setBlocked([...original, d]);
  }
  
  // Request permission for this domain
  let granted = false;
  try {
    granted = await requestOriginPermission(d);
  } catch (err) {
    console.error('Permission request failed:', err);
  }
  
  if (!granted) {
    // User denied permission - restore original list
    await setBlocked(original);
  }
  
  // Clear pending status
  await chrome.runtime.sendMessage({ cmd: "markGranted", domain: d });
  
  // Clear input and refocus
  domainInput.value = "";
  domainInput.focus();
});

// Global snooze preset buttons
document.querySelectorAll(".preset[data-min]").forEach(btn => {
  btn.addEventListener("click", async () => {
    const minutes = parseInt(btn.getAttribute("data-min"), 10);
    await chrome.runtime.sendMessage({ cmd: "pauseForMinutes", minutes });
    await render();
  });
});

// Resume all button
resumeBtn.onclick = async () => {
  await chrome.runtime.sendMessage({ cmd: "resumeNow" });
  await render();
};

// Export blocklist
exportBtn.onclick = async () => {
  const { blockedDomains = [] } = await chrome.storage.sync.get("blockedDomains");
  const data = JSON.stringify({ blockedDomains }, null, 2);
  
  // Create and download JSON file
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "focusgate-blocklist.json";
  a.click();
  URL.revokeObjectURL(url);
};

// Import blocklist
importBtn.onclick = () => importFile.click();

importFile.onchange = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    
    // Support both array format and object format
    const domains = Array.isArray(json) ? json : json.blockedDomains;
    if (!Array.isArray(domains)) {
      throw new Error("Invalid format: expected array or {blockedDomains: [...]}");
    }
    
    // Validate and request permissions for each domain
    const validDomains = [];
    for (const raw of domains) {
      const d = normalizeDomain(raw);
      if (!d) continue;
      
      // Mark as pending during permission request
      await chrome.runtime.sendMessage({ cmd: "markPending", domain: d });
      
      // Request permission (user can deny individual domains)
      try {
        const granted = await requestOriginPermission(d);
        if (granted) validDomains.push(d);
      } catch {
        // Skip domains that fail permission request
      }
      
      // Clear pending status
      await chrome.runtime.sendMessage({ cmd: "markGranted", domain: d });
    }
    
    // Add valid domains to blocklist
    const current = await getBlocked();
    await setBlocked(current.concat(validDomains));
    
    alert(`Import complete: ${validDomains.length} domain(s) added`);
    
  } catch (err) {
    alert("Import failed: " + err.message);
  } finally {
    importFile.value = ""; // Clear file input
  }
};

// Theme toggle button
if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', async () => {
    const { darkMode } = await chrome.storage.local.get('darkMode');
    const newMode = darkMode ? false : true;
    await chrome.storage.local.set({ darkMode: newMode });
    applyTheme(newMode);
  });
}

// Language selector
if (languageSelect) {
  languageSelect.addEventListener('change', async (e) => {
    const selected = e.target.value;
    await chrome.storage.local.set({ lang: selected });
    await loadLocale(selected);
    applyI18n();
    await render();
  });
}

// Listen for storage changes to sync UI across multiple popups
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.blockedDomains) {
    render();
  }
  
  if (area === "local") {
    // Update UI when pauses change
    if (changes.pausedUntilTs || changes.pausedDomains || changes.pendingGrants) {
      render();
    }
    
    // Apply theme changes
    if (changes.darkMode) {
      applyTheme(changes.darkMode.newValue);
    }
    
    // Apply language changes
    if (changes.lang) {
      const newLang = changes.lang.newValue;
      loadLocale(newLang).then(() => {
        applyI18n();
        render();
      });
    }
  }
});

/**
 * Initialize popup on load
 */
async function initializePrefs() {
  // Load user preferences
  const prefs = await chrome.storage.local.get(["darkMode", "lang"]);
  
  // Apply theme
  applyTheme(prefs.darkMode);
  
  // Load and apply language
  let lang = prefs.lang || 'en';
  if (languageSelect) languageSelect.value = lang;
  await loadLocale(lang);
  applyI18n();
  
  // Render initial state
  await render();
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", initializePrefs);