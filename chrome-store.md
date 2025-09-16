# Chrome Web Store Listing for FocusGate

## Basic Information

**Extension Name:** FocusGate

**Short Description (132 characters max):**
Stay focused by blocking distracting sites with per-site permissions and one-tap snooze. Privacy-first: no tracking or data collection.

## Detailed Description

**FocusGate** helps you take control of your time online without sacrificing your privacy. Add distracting domains to your blocklist and FocusGate will quietly redirect visits to a friendly page explaining why the site is blocked. When you need a break, snooze all blocks or just one domain with a single click—the extension automatically resumes when the timer expires. Everything runs locally in your browser with no analytics, no remote servers, and no blanket host access.

### ✨ Key Features

- **🎯 Targeted Blocking** - Add domains like `twitter.com` or `reddit.com`. FocusGate requests permission only for that specific site, never for all your browsing.
- **🔒 Privacy by Design** - Zero data collection. No analytics. No remote servers. Your blocklist stays on your device and syncs via Chrome if you're signed in.
- **⏸️ Smart Snooze** - Need a quick break? Pause all blocking for 15 minutes, 1 hour, or 12 hours. Or snooze just one site for 15 minutes. Timers persist across browser restarts.
- **📤 Import/Export** - Backup your blocklist or share it between devices. Imports prompt for permission per site—you stay in control.
- **🌓 Dark Mode** - Automatically adapts to your system's dark/light preference for comfortable use any time.
- **♿ Accessible** - Full keyboard navigation, ARIA labels, and high contrast design ensure everyone can stay focused.
- **🌍 International** - Interface text is fully translatable. English included, with support for additional languages.

### 🛡️ How It Works

Unlike other blockers that request access to all your browsing data, FocusGate uses Chrome's Declarative Net Request API to redirect only the specific domains you block. When you visit a blocked site, you're redirected to a local page (not a server) that explains the block and offers snooze options.

### 🔐 Your Privacy Matters

FocusGate is built on a foundation of privacy:
- **No Data Collection** - We don't collect any user data, period.
- **No Network Requests** - The extension never contacts external servers.
- **No Content Scripts** - We don't inject code into the pages you visit.
- **Local Storage Only** - Your settings stay on your device (or sync via Chrome).
- **Open Source** - Review our code to verify our privacy claims.

### ⚙️ Permissions Explained

We only request the minimum permissions needed:
- **declarativeNetRequest** - Redirects blocked sites to our local blocked page
- **storage** - Saves your blocklist and preferences locally
- **alarms** - Schedules automatic resume when snooze timers expire
- **Per-site host permissions** - Requested individually when you add each domain

Install FocusGate today to reclaim your attention and stop mindless scrolling—without giving up your privacy.

## Privacy Policy

**Effective Date:** September 2025

### Information We Collect
**None.** FocusGate does not collect any personal information, browsing data, or usage statistics.

### Information Storage
All data is stored locally on your device using Chrome's storage API:
- **Blocked domains list** (chrome.storage.sync - syncs across your devices if signed into Chrome)
- **Temporary snooze timers** (chrome.storage.local - device-specific)
- **UI preferences** (chrome.storage.local - theme and language settings)

### Information Sharing
We do not share any information because we do not collect any information.

### Third-Party Services
FocusGate does not use any third-party services, analytics, or external servers.

### Data Security
- All data remains on your device
- No network connections are made
- Chrome's built-in sync encryption protects synced data
- Strict Content Security Policy prevents code injection

### Data Deletion
Uninstalling the extension removes all stored data. You can also clear data by removing all domains from your blocklist.

### Children's Privacy
FocusGate does not knowingly collect information from anyone, including children.

### Changes to Privacy Policy
Updates will be posted to our GitHub repository. We cannot notify users directly as we don't collect contact information.

### Contact
For privacy questions: [GitHub Issues URL]

## Support Information

**Support Email:** [your-email@domain.com]
**Support URL:** [https://github.com/yourusername/focusgate]

## Category

Productivity

## Additional Information for Reviewers

### Single Purpose Description
FocusGate blocks distracting websites to help users stay focused, with temporary snooze options when access is needed.

### Permission Justifications

1. **declarativeNetRequest** - Required to redirect navigation from blocked domains to our local blocked.html page. We use this API specifically because it's more privacy-preserving than webRequest.

2. **storage** - Required to persist the user's blocklist and UI preferences. We use sync storage for the blocklist (so it follows users across devices) and local storage for temporary states like snooze timers.

3. **alarms** - Required to automatically resume blocking when snooze timers expire. Without this, users would have to manually resume blocking.

4. **optional_host_permissions (*://*/*)** - Declared as optional and NEVER requested in bulk. When a user adds a domain, we request permission for only that specific domain and its subdomains. Users can deny any individual permission request.

### Security & Privacy Notes for Reviewers

- **No Remote Code** - All JavaScript is bundled with the extension
- **No External Resources** - No CDNs, external scripts, or remote assets
- **Input Validation** - All user input is validated and sanitized
- **CSP Header** - Strict Content Security Policy in manifest.json
- **No eval()** - No dynamic code execution
- **No innerHTML** - Only safe DOM methods like textContent

### Testing Instructions

1. Install the extension - Note that no permissions are requested on install
2. Click the extension icon to open the popup
3. Add a test domain like "example.com" - You'll be prompted for permission only for that domain
4. Visit example.com - You'll be redirected to the blocked page
5. Click "Snooze 5m" on the blocked page - You'll return to example.com
6. After 5 minutes, example.com will be blocked again automatically

## Screenshots

1. **Main Popup** - Shows the domain management interface
2. **Blocked Page** - Shows what users see when visiting a blocked site
3. **Permission Request** - Shows the per-site permission prompt
4. **Dark Mode** - Shows the extension in dark mode
5. **Import/Export** - Shows the data portability features

## Version History

### Version 1.0.0
- Initial release
- Core blocking functionality
- Per-site permissions
- Snooze timers
- Import/Export
- Dark mode support
- Internationalization framework

## Small Promotional Tile (440x280)
[Include image showing FocusGate logo and tagline]

## Large Promotional Tile (920x680)
[Include image showing the extension in action with key features highlighted]

## Marquee Promotional Tile (1400x560)
[Include hero image with privacy-focused messaging]