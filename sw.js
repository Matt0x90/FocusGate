// FocusGate service worker
// Purpose: Manages blocking rules, snooze timers, and permission reconciliation
// No external connections, no tracking, all data stored locally

const RULE_BASE = 100000; // Starting ID for our dynamic rules
let _syncing = false;      // Mutex flag to prevent concurrent rule updates
let _needsResync = false;  // Flag for pending resync after current sync completes
let _debounceTimer = null; // Timer for debouncing storage changes

/* ========== STORAGE HELPERS ========== */
// All data is stored in chrome.storage (sync for blocklist, local for temporary state)

/**
 * Get current state from storage
 * @returns {Object} Current blocklist, global pause, per-domain pauses, and pending grants
 */
async function getState() {
  const [{ blockedDomains = [] }, { pausedUntilTs = 0, pausedDomains = {}, pendingGrants = {} }] = await Promise.all([
    chrome.storage.sync.get("blockedDomains"),
    chrome.storage.local.get(["pausedUntilTs", "pausedDomains", "pendingGrants"])
  ]);
  return { blockedDomains, pausedUntilTs, pausedDomains, pendingGrants };
}

/**
 * Set global pause timestamp (0 to clear)
 * @param {number} untilTs - Timestamp when pause expires
 */
async function setGlobalPause(untilTs) { 
  await chrome.storage.local.set({ pausedUntilTs: untilTs || 0 }); 
}

/**
 * Set or clear pause for a specific domain
 * @param {string} domain - Domain to pause
 * @param {number} untilTs - Timestamp when pause expires (0 to clear)
 */
async function setDomainPause(domain, untilTs) {
  const { pausedDomains = {} } = await chrome.storage.local.get("pausedDomains");
  if (untilTs && untilTs > Date.now()) {
    pausedDomains[domain] = untilTs;
  } else {
    delete pausedDomains[domain];
  }
  await chrome.storage.local.set({ pausedDomains });
}

/**
 * Clear all domain-specific pauses
 */
async function clearAllDomainPauses() { 
  await chrome.storage.local.set({ pausedDomains: {} }); 
}

/* ========== PENDING GRANT HELPERS ========== */
// Handles the grace period when user adds a domain but hasn't granted permission yet

/**
 * Get domains pending permission grant
 * @returns {Object} Map of domain to expiry timestamp
 */
async function getPendingGrants() {
  const { pendingGrants = {} } = await chrome.storage.local.get("pendingGrants");
  return pendingGrants;
}

/**
 * Mark domain as pending permission (15 second grace period)
 * @param {string} domain - Domain pending permission
 * @param {number} untilTs - Timestamp when grace period expires
 */
async function setPendingGrant(domain, untilTs) {
  const pending = await getPendingGrants();
  if (untilTs && untilTs > Date.now()) {
    pending[domain] = untilTs;
  } else {
    delete pending[domain];
  }
  await chrome.storage.local.set({ pendingGrants: pending });
}

/* ========== PERMISSION RECONCILIATION ========== */
// Ensures we only block domains we have permission to redirect

/**
 * Check if we have host permission for a domain
 * @param {string} domain - Domain to check
 * @returns {boolean} True if we have permission
 */
async function hasHostAccess(domain) {
  // Validate domain format
  if (!domain || typeof domain !== 'string' || domain.length > 253) {
    return false;
  }
  
  // Check various permission patterns
  const checks = [
    { origins: ["*://*/*"] }, // User granted "on all sites"
    { origins: [`https://*.${domain}/*`] },
    { origins: [`http://*.${domain}/*`] },
    { origins: [`https://${domain}/*`] },
    { origins: [`http://${domain}/*`] }
  ];
  
  for (const q of checks) {
    try { 
      if (await chrome.permissions.contains(q)) return true; 
    } catch {
      // Permission check failed, continue to next pattern
    }
  }
  return false;
}

/**
 * Filter domains to only those we have permission to block
 * Removes domains without permission from the blocklist
 * @param {string[]} domains - List of domains to check
 * @returns {string[]} Domains we have permission to block
 */
async function reconcileDomains(domains) {
  const now = Date.now();
  const pending = await getPendingGrants();
  let pendingChanged = false;

  const allowed = [];
  const denied = [];

  // Check each domain for permission or pending status
  for (const d of domains) {
    const inPending = pending[d] && pending[d] > now;
    if (inPending || await hasHostAccess(d)) {
      allowed.push(d);
    } else {
      denied.push(d);
    }
    
    // Clean up expired pending grants
    if (pending[d] && pending[d] <= now) { 
      delete pending[d]; 
      pendingChanged = true; 
    }
  }
  
  if (pendingChanged) {
    await chrome.storage.local.set({ pendingGrants: pending });
  }

  // Remove denied domains from blocklist
  if (denied.length) {
    const uniqSorted = Array.from(new Set(allowed)).sort();
    await chrome.storage.sync.set({ blockedDomains: uniqSorted });
  }
  
  return allowed;
}

/* ========== DECLARATIVE NET REQUEST RULES ========== */

/**
 * Create a blocking rule for a domain
 * @param {number} id - Rule ID
 * @param {string} domain - Domain to block
 * @returns {Object} DNR rule object
 */
function domainRule(id, domain) {
  // Validate domain to prevent XSS in redirect URL
  const safeDomain = encodeURIComponent(domain);
  
  return {
    id,
    priority: 1,
    action: { 
      type: "redirect", 
      redirect: { 
        extensionPath: `/blocked.html#d=${safeDomain}` 
      } 
    },
    condition: { 
      urlFilter: `||${domain}^`,  // Matches domain and all subdomains
      resourceTypes: ["main_frame"] // Only block navigation, not resources
    }
  };
}

/* ========== RULE SYNCHRONIZATION ========== */

/**
 * Sync blocking rules with current state
 * Uses mutex to prevent concurrent updates
 * Clears all rules then adds fresh ones with sequential IDs
 */
async function syncRules() {
  // Prevent concurrent syncs
  if (_syncing) { 
    _needsResync = true; 
    return; 
  }
  _syncing = true;
  
  try {
    // Get current state
    let { blockedDomains, pausedUntilTs, pausedDomains } = await getState();
    const now = Date.now();

    // Only block domains we have permission for
    const permitted = await reconcileDomains(blockedDomains);

    // Filter out globally paused or individually paused domains
    const activeDomains = (pausedUntilTs && now < pausedUntilTs)
      ? [] // All domains paused
      : permitted.filter(d => !(pausedDomains[d] && now < pausedDomains[d]));

    // Create rules with sequential IDs
    const desiredRules = activeDomains.map((d, i) => domainRule(RULE_BASE + i, d));

    // Clear our existing rules (IDs in our range)
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const ourIds = existing
      .filter(r => r.id >= RULE_BASE && r.id < RULE_BASE + 90000)
      .map(r => r.id);

    // Update rules atomically
    await chrome.declarativeNetRequest.updateDynamicRules({ 
      removeRuleIds: ourIds, 
      addRules: desiredRules 
    });
    
  } finally {
    _syncing = false;
    // If another sync was requested while we were syncing, do it now
    if (_needsResync) { 
      _needsResync = false; 
      await syncRules(); 
    }
  }
}

/* ========== SNOOZE FUNCTIONALITY ========== */

/**
 * Pause all blocking for specified minutes
 * @param {number} m - Minutes to pause
 */
async function pauseAllForMinutes(m) {
  const until = Date.now() + m * 60000;
  await setGlobalPause(until);
  await syncRules();
  // Set alarm to auto-resume when timer expires
  chrome.alarms.create("fg:resumeAll", { when: until });
}

/**
 * Resume all blocking immediately
 */
async function resumeAllNow() {
  await setGlobalPause(0);
  await clearAllDomainPauses();
  await syncRules();
  
  // Clear all snooze alarms
  chrome.alarms.clear("fg:resumeAll");
  const alarms = await chrome.alarms.getAll();
  for (const alarm of alarms) {
    if (alarm.name.startsWith("fg:resume:")) {
      chrome.alarms.clear(alarm.name);
    }
  }
}

/**
 * Pause a specific domain for specified minutes
 * @param {string} d - Domain to pause
 * @param {number} m - Minutes to pause
 */
async function pauseDomainForMinutes(d, m) {
  // Validate domain
  if (!d || typeof d !== 'string') return;
  
  const until = Date.now() + m * 60000;
  await setDomainPause(d, until);
  await syncRules();
  // Set alarm to auto-resume this domain
  chrome.alarms.create(`fg:resume:${d}`, { when: until });
}

/**
 * Resume blocking for a specific domain immediately
 * @param {string} d - Domain to resume
 */
async function resumeDomainNow(d) {
  // Validate domain
  if (!d || typeof d !== 'string') return;
  
  await setDomainPause(d, 0);
  await syncRules();
  chrome.alarms.clear(`fg:resume:${d}`);
}

/* ========== EVENT LISTENERS ========== */

// Re-sync when permissions change
chrome.permissions.onAdded.addListener(() => { syncRules(); });
chrome.permissions.onRemoved.addListener(() => { syncRules(); });

// Initialize on install/startup
chrome.runtime.onInstalled.addListener(async () => { 
  await syncRules(); 
});

chrome.runtime.onStartup.addListener(async () => {
  // Restore snooze alarms after browser restart
  const { pausedUntilTs, pausedDomains } = await getState();
  const now = Date.now();
  
  // Re-create global snooze alarm if still active
  if (pausedUntilTs && now < pausedUntilTs) {
    chrome.alarms.create("fg:resumeAll", { when: pausedUntilTs });
  }
  
  // Re-create per-domain snooze alarms
  for (const [d, ts] of Object.entries(pausedDomains || {})) {
    if (ts && now < ts) {
      chrome.alarms.create(`fg:resume:${d}`, { when: ts });
    }
  }
  
  await syncRules();
});

/* ========== MESSAGE HANDLER ========== */
// Handle messages from popup and blocked page

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch(msg?.cmd) {
        case "syncRules": 
          await syncRules(); 
          return sendResponse({ ok: true });
          
        case "pauseForMinutes": 
          if (typeof msg.minutes === 'number' && msg.minutes > 0) {
            await pauseAllForMinutes(msg.minutes); 
            return sendResponse({ ok: true });
          }
          return sendResponse({ ok: false, error: "Invalid minutes" });
          
        case "resumeNow": 
          await resumeAllNow(); 
          return sendResponse({ ok: true });
          
        case "pauseDomain": 
          if (msg.domain && typeof msg.minutes === 'number' && msg.minutes > 0) {
            await pauseDomainForMinutes(msg.domain, msg.minutes); 
            return sendResponse({ ok: true });
          }
          return sendResponse({ ok: false, error: "Invalid domain or minutes" });
          
        case "resumeDomain": 
          if (msg.domain) {
            await resumeDomainNow(msg.domain); 
            return sendResponse({ ok: true });
          }
          return sendResponse({ ok: false, error: "Invalid domain" });
          
        case "markPending": 
          if (msg.domain) {
            await setPendingGrant(msg.domain, Date.now() + 15000); // 15s grace period
            return sendResponse({ ok: true });
          }
          return sendResponse({ ok: false, error: "Invalid domain" });
          
        case "markGranted": 
          if (msg.domain) {
            await setPendingGrant(msg.domain, 0); 
            await syncRules(); 
            return sendResponse({ ok: true });
          }
          return sendResponse({ ok: false, error: "Invalid domain" });
          
        default: 
          return sendResponse({ ok: false, error: "Unknown command" });
      }
    } catch (error) {
      console.error('Message handler error:', error);
      return sendResponse({ ok: false, error: error.message });
    }
  })();
  return true; // Keep message channel open for async response
});

/* ========== DEBOUNCE HELPER ========== */

/**
 * Schedule a rule sync with debouncing to avoid rapid updates
 * @param {number} ms - Milliseconds to wait before syncing
 */
function scheduleSync(ms = 120) {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => { 
    _debounceTimer = null; 
    syncRules(); 
  }, ms);
}

/* ========== STORAGE CHANGE LISTENER ========== */

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === "sync" && changes.blockedDomains) {
    // Mark newly added domains as pending to avoid race conditions
    const oldArr = Array.isArray(changes.blockedDomains.oldValue) ? changes.blockedDomains.oldValue : [];
    const newArr = Array.isArray(changes.blockedDomains.newValue) ? changes.blockedDomains.newValue : [];
    const added = newArr.filter(d => !oldArr.includes(d));
    
    // Give 15 second grace period for permission grant
    const until = Date.now() + 15000;
    for (const d of added) { 
      try { 
        await setPendingGrant(d, until); 
      } catch {
        // Continue even if one domain fails
      }
    }
    scheduleSync();
  }
  
  if (area === "local" && (changes.pausedUntilTs || changes.pausedDomains || changes.pendingGrants)) {
    scheduleSync();
  }
});

/* ========== ALARM HANDLER ========== */
// Auto-resume when snooze timers expire

chrome.alarms.onAlarm.addListener(async alarm => {
  const name = alarm?.name || "";
  
  if (name === "fg:resumeAll") {
    // Global snooze expired
    await resumeAllNow();
    
  } else if (name.startsWith("fg:resume:")) {
    // Per-domain snooze expired
    const domain = name.substring("fg:resume:".length);
    if (domain) {
      await resumeDomainNow(domain);
    }
  }
});