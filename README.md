# FocusGate

FocusGate is a privacy-first Chrome extension that helps you stay focused by blocking distracting websites. It stores your blocklist locally, uses Chrome's minimal **Declarative Net Request** API to redirect visits, and requests site permissions only on demand when you add a domain. You can snooze the blocklist temporarily when you really need access.

## Features

- **Add/Remove Domains** - Block distracting sites by hostname. Type a domain (e.g. `twitter.com` or full URL) and click **Add**. Remove with the "Remove" button or `Delete` key.
- **Per-Site Permissions** - FocusGate does **not** request blanket access to all websites. When you add a domain, the extension asks Chrome for host permission just for that site and its subdomains. If you deny, the domain is removed from the blocklist.
- **Smart Snooze** - Temporarily disable blocking globally (15 minutes, 1 hour, or 12 hours) or for specific domains (15 minutes). Snoozes survive browser restarts.
- **Import/Export** - Backup or restore your blocklist as JSON. Imports request permissions for each domain as needed.
- **Accessible UI** - Keyboard navigable, ARIA roles, clear contrast. Blocked pages explain why and let you snooze.
- **Dark Mode** - Automatically follows your system dark/light preference.
- **Internationalization** - All text is translatable via Chrome's i18n system. English included by default.

## Installation

1. Clone or download this repository
2. In Chrome, navigate to `chrome://extensions` and enable **Developer mode**
3. Click **Load unpacked** and choose the folder containing `manifest.json`
4. The FocusGate icon will appear in your toolbar

## Privacy Policy

**Last Updated: September 2025**

### Data Collection & Storage
FocusGate is designed with privacy as a core principle:

- **No Data Collection**: FocusGate does not collect, transmit, or share any user data
- **Local Storage Only**: All data (your blocklist and preferences) is stored locally in Chrome's storage API
- **Chrome Sync Storage**: If you're signed into Chrome, your blocklist syncs across your devices using Chrome's built-in sync (encrypted by Google)
- **No Analytics**: No tracking, analytics, or telemetry of any kind
- **No Remote Servers**: FocusGate never communicates with external servers
- **No Content Scripts**: FocusGate doesn't inject code into the websites you visit

### What We Store

FocusGate stores the following data locally on your device:

1. **Blocked Domains List** - The domains you choose to block (stored in Chrome sync storage)
2. **Snooze Timers** - Temporary pause timestamps (stored in Chrome local storage)
3. **UI Preferences** - Theme preference (dark/light mode) and language selection (stored in Chrome local storage)
4. **Temporary State** - Pending permission grants during the add-domain flow (stored in Chrome local storage, auto-expires in 15 seconds)

### Data Sharing
- **Never Shared**: Your data is never shared with third parties
- **Never Sold**: Your data is never sold
- **Never Transmitted**: Your data never leaves your device (except via Chrome's own sync if you're signed in)

### Data Deletion
To delete all FocusGate data:
1. Uninstall the extension from `chrome://extensions`, or
2. Clear the blocklist via Export (to save a backup) then remove all domains

### Permissions Explained

| Permission | Purpose |
|------------|---------|
| `declarativeNetRequest` | Redirects blocked domains to a local page. Only affects top-level navigation. |
| `storage` | Saves your blocklist and preferences locally. |
| `alarms` | Schedules snooze expirations for automatic resume. |
| `optional_host_permissions` | Declared as `*://*/*` but never granted by default. Requested per-domain when you add sites. |

### Security

- **Content Security Policy**: Strict CSP prevents code injection
- **Input Validation**: All user input is validated and sanitized
- **No External Resources**: Extension loads no external scripts or resources
- **HTTPS Only**: If any network requests were made (they aren't), they would be HTTPS-only

### Contact

For privacy concerns or questions about FocusGate:
- Open an issue on GitHub: https://github.com/Matt0x90/FocusGate/issues
- Email: admin@zaelious.com

### Changes to This Policy

Any changes to this privacy policy will be posted in the extension's GitHub repository and noted in the changelog. The extension does not have the ability to notify you of changes since it doesn't collect contact information.

## Manual QA Checklist

When testing or publishing a new version, verify these behaviors:

### Core Functionality
1. **Installation** - Extension installs without requesting any host permissions
2. **Adding Domains** - Entering `example.com` prompts for that site only. Grant = added, Deny = not added
3. **Blocking** - Visiting blocked sites redirects to `blocked.html` with domain shown
4. **Removing** - Click Remove or press Delete to unblock immediately
5. **Global Snooze** - Presets pause all blocks and auto-resume after timer
6. **Per-Site Snooze** - Individual domain snooze works independently
7. **Import/Export** - Export saves JSON, import restores with per-domain permission prompts

### Edge Cases
8. **Invalid Input** - Non-domain text is rejected with visual feedback
9. **Duplicate Domains** - Adding same domain twice is handled gracefully
10. **Permission Changes** - Revoking permissions removes domain from blocklist
11. **Browser Restart** - Snoozes persist and resume correctly
12. **Multiple Windows** - Changes in one popup reflect in others immediately
13. **Incognito Mode** - Separate blocklist per `incognito: "split"` in manifest

### Performance
14. **No Back/Forward Cache Issues** - No unload handlers or persistent connections
15. **Fast Rule Updates** - Debounced syncing prevents rapid DNR updates
16. **Memory Efficient** - No memory leaks from event listeners

## Known Limitations

- **Pattern Support** - Only exact hostnames are supported (no wildcards or paths)
- **IDN Support** - International domains work but display as punycode
- **Large Imports** - Each domain triggers a separate permission prompt
- **Permission Batching** - Chrome doesn't allow batching permission requests

## Contributing

Contributions are welcome! Please:
1. Keep code beginner-friendly with clear comments
2. Maintain the privacy-first approach (no external connections)
3. Test all changes with the QA checklist
4. Update documentation as needed

## License

Apache License 2.0

## Support

For issues or questions:
- Open an issue on GitHub: https://github.com/Matt0x90/FocusGate/issues
- Contact me by email. admin@zaelious.com
