(function () {
  const ROOT_ID = "dealer-marketplace-helper";

  function findInputByHints(hints) {
    const candidates = Array.from(document.querySelectorAll('input[type="text"], input:not([type]), textarea, [contenteditable="true"]'));
    return candidates.find((node) => {
      const label = [
        node.getAttribute("aria-label"),
        node.getAttribute("placeholder"),
        node.getAttribute("name"),
        node.closest("label")?.textContent,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hints.some((hint) => label.includes(hint));
    });
  }

  function setNodeValue(node, value) {
    if (!node) return false;
    if (node.tagName === "TEXTAREA" || node.tagName === "INPUT") {
      node.focus();
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    if (node.getAttribute("contenteditable") === "true") {
      node.focus();
      node.textContent = value;
      node.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
      return true;
    }
    return false;
  }

  async function applyDraft() {
    const { dealerDraft } = await chrome.storage.local.get(["dealerDraft"]);
    if (!dealerDraft) {
      alert("No dealer draft found. Build one from the extension popup first.");
      return;
    }
    const titleNode = findInputByHints(["title"]);
    const priceNode = findInputByHints(["price"]);
    const descriptionNode = findInputByHints(["description"]);

    setNodeValue(titleNode, dealerDraft.title || "");
    setNodeValue(priceNode, dealerDraft.price || "");
    setNodeValue(descriptionNode, dealerDraft.description || "");
  }

  function mountButton() {
    if (document.getElementById(ROOT_ID)) return;
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.style.position = "fixed";
    root.style.right = "16px";
    root.style.bottom = "16px";
    root.style.zIndex = "999999";
    root.style.background = "rgba(20, 28, 37, 0.95)";
    root.style.color = "white";
    root.style.padding = "12px";
    root.style.borderRadius = "14px";
    root.style.boxShadow = "0 14px 28px rgba(0,0,0,0.28)";
    root.style.fontFamily = "Arial, sans-serif";
    root.style.width = "220px";

    const label = document.createElement("div");
    label.textContent = "Dealer Marketplace Helper";
    label.style.fontSize = "11px";
    label.style.letterSpacing = "0.12em";
    label.style.textTransform = "uppercase";
    label.style.opacity = "0.75";
    label.style.marginBottom = "8px";

    const button = document.createElement("button");
    button.textContent = "Apply Draft";
    button.style.width = "100%";
    button.style.border = "0";
    button.style.borderRadius = "10px";
    button.style.padding = "10px 12px";
    button.style.fontWeight = "700";
    button.style.cursor = "pointer";
    button.style.background = "#d8783a";
    button.style.color = "white";
    button.addEventListener("click", applyDraft);

    root.appendChild(label);
    root.appendChild(button);
    document.body.appendChild(root);
  }

  if (/facebook\.com\/marketplace\//i.test(location.href)) {
    mountButton();
    const observer = new MutationObserver(() => mountButton());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
