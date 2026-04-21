function inferExtension(url, contentType) {
  const urlMatch = String(url || "").match(/\.([a-zA-Z0-9]{3,4})(?:[?#]|$)/);
  if (urlMatch?.[1]) return urlMatch[1].toLowerCase();
  const typeMatch = String(contentType || "").match(/image\/([a-zA-Z0-9.+-]+)/i);
  if (!typeMatch?.[1]) return "jpg";
  if (typeMatch[1].toLowerCase() === "jpeg") return "jpg";
  return typeMatch[1].toLowerCase();
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

async function fetchMarketplaceImageFiles(urls) {
  const files = [];
  let lastError = "";
  for (let index = 0; index < urls.length; index += 1) {
    const url = String(urls[index] || "").trim();
    if (!/^https?:\/\//i.test(url)) continue;
    try {
      const response = await fetch(url, { credentials: "omit", cache: "no-store" });
      if (!response.ok) {
        lastError = `HTTP ${response.status} while downloading ${url}`;
        continue;
      }
      const blob = await response.blob();
      const extension = inferExtension(url, blob.type);
      files.push({
        url,
        name: `vehicle-${index + 1}.${extension}`,
        type: blob.type || `image/${extension}`,
        dataUrl: await blobToDataUrl(blob),
      });
    } catch (error) {
      lastError = error?.message || `Could not download ${url}`;
    }
  }
  return {
    ok: files.length > 0,
    files,
    error: files.length ? "" : lastError || "Could not download vehicle photos from the inventory page.",
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "FETCH_MARKETPLACE_IMAGE_FILES") return undefined;
  const urls = Array.isArray(message.urls) ? message.urls.slice(0, 10) : [];
  fetchMarketplaceImageFiles(urls)
    .then((result) => sendResponse(result))
    .catch((error) =>
      sendResponse({
        ok: false,
        files: [],
        error: error?.message || "Could not download vehicle photos from the inventory page.",
      })
    );
  return true;
});
