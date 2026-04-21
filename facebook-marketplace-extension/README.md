# Dealership Marketplace Helper

Load this folder as an unpacked Chrome extension.

Flow:
1. Open `chrome://extensions`
2. Turn on Developer Mode
3. Click `Load unpacked`
4. Select this `facebook-marketplace-extension` folder
5. Open a Bert Ogden vehicle page in Chrome
6. Open the extension popup and click `Quick Post Current Vehicle`
7. The helper opens Facebook Marketplace and tries to fill the draft automatically
8. If `Auto publish on final review` is enabled, it will click Facebook's Publish button once the final review step is ready

Current fill coverage:
- title
- price
- description
- year
- make
- model
- mileage
- clean title
- condition
- body style
- fuel type
- transmission
- photo upload from the vehicle page gallery

The helper shows a status panel on Facebook so the rep can see which fields were filled, which fields still need manual review, and whether the listing reached the final publish step.

The popup now shows:
- extension version
- a one-click extension reload button
- an auto-publish toggle
- local posting history for the current Chrome profile

Notes:
- No extra plugin is required. Use `Load unpacked` once, then use the popup's `Reload Extension` button or Chrome's reload button after updates.
- Version `0.5.0` adds the popup version badge, local post history, stronger sales description copy, auto-publish, and more aggressive clean-title/photo handling.
- Run `npm.cmd run test:harness --prefix facebook-marketplace-extension` to execute the local Marketplace form simulation harness.
