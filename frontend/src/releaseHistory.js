export const ADMIN_RELEASE_HISTORY = [
  {
    version: "2026.04.22",
    updatedAt: "April 22, 2026",
    title: "CRM cleanup release",
    summary: "Added the CRM duplicate-review workspace and tightened selected-state highlighting across the app.",
    items: [
      "New CRM Cleanup tab for List Builder and Report Scrape exports.",
      "Duplicate detection now flags shared phone numbers, addresses, and merge candidates in one review queue.",
      "Top tabs, admin subtabs, Tracker, DMS Log, and analytics toggles now keep a clear active highlight.",
      "Admin now shows the current release version and the latest software update date.",
    ],
  },
];

export const LATEST_ADMIN_RELEASE = ADMIN_RELEASE_HISTORY[0];
