# Dealership Marketplace Helper

Load this folder as an unpacked Chrome extension.

Flow:
1. Open `chrome://extensions`
2. Turn on Developer Mode
3. Click `Load unpacked`
4. Select this `facebook-marketplace-extension` folder
5. Open a Bert Ogden vehicle page in Chrome
6. Open the extension popup and click `Capture This Page`
7. Click `Open Facebook Marketplace`
8. On the Facebook vehicle listing page, click `Apply Draft`

Current fill coverage:
- title
- price
- description
- year
- make
- model
- mileage
- condition

The helper shows a status panel on Facebook so the rep can see which fields were filled and which still need manual entry.

It does not auto-submit the listing, and image upload still needs to be done manually in Facebook.
