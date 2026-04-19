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
8. Review the listing, upload photos if needed, and finish the post

Current fill coverage:
- title
- price
- description
- year
- make
- model
- mileage
- condition

The helper shows a status panel on Facebook so the rep can see which fields were filled and retry if Facebook changes its form.

It does not auto-submit the listing, and image upload still needs to be done manually in Facebook.
