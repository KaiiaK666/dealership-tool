(function () {
  const ROOT_ID = "dealer-marketplace-helper";
  const STATUS_ID = "dealer-marketplace-helper-status";

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function collectFieldText(node) {
    return normalizeText(
      [
        node.getAttribute("aria-label"),
        node.getAttribute("placeholder"),
        node.getAttribute("name"),
        node.id,
        node.closest("label")?.textContent,
        node.closest('[role="group"]')?.textContent,
        node.parentElement?.textContent,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
    );
  }

  function findEditable(hints) {
    const candidates = Array.from(
      document.querySelectorAll('input, textarea, [contenteditable="true"], [role="textbox"]')
    ).filter((node) => {
      const type = (node.getAttribute("type") || "").toLowerCase();
      return !["hidden", "file", "checkbox", "radio"].includes(type);
    });
    return candidates.find((node) => {
      const text = collectFieldText(node);
      return hints.some((hint) => text.includes(hint));
    });
  }

  function setNodeValue(node, value) {
    if (!node || value == null || value === "") return false;
    if (node.tagName === "TEXTAREA" || node.tagName === "INPUT") {
      node.focus();
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
      node.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));
      return true;
    }
    if (node.getAttribute("contenteditable") === "true" || node.getAttribute("role") === "textbox") {
      node.focus();
      node.textContent = value;
      node.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
      return true;
    }
    return false;
  }

  function findSelectTrigger(hints) {
    const candidates = Array.from(document.querySelectorAll('[role="button"], [role="combobox"], button, div'));
    return candidates.find((node) => {
      const text = collectFieldText(node);
      if (!text) return false;
      return hints.some((hint) => text.includes(hint));
    });
  }

  function findOptionByText(value) {
    const target = normalizeText(value).toLowerCase();
    const candidates = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], li, span, div'));
    return candidates.find((node) => normalizeText(node.textContent).toLowerCase() === target);
  }

  async function selectOption(hints, value) {
    if (!value) return false;
    const trigger = findSelectTrigger(hints);
    if (!trigger) return false;
    trigger.click();
    await wait(350);
    const option = findOptionByText(value);
    if (!option) return false;
    option.click();
    await wait(250);
    return true;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getStatusNode() {
    return document.getElementById(STATUS_ID);
  }

  function setStatus(lines, tone = "neutral") {
    const node = getStatusNode();
    if (!node) return;
    const colors = {
      neutral: "rgba(255,255,255,0.74)",
      success: "#d6ffe5",
      warning: "#ffe4c7",
      danger: "#ffd1d1",
    };
    node.innerHTML = "";
    lines.forEach((line) => {
      const row = document.createElement("div");
      row.textContent = line;
      row.style.marginTop = "4px";
      node.appendChild(row);
    });
    node.style.color = colors[tone] || colors.neutral;
  }

  async function applyDraft() {
    const { dealerDraft } = await chrome.storage.local.get(["dealerDraft"]);
    if (!dealerDraft) {
      setStatus(["No draft found.", "Open a Bert Ogden vehicle page and click Capture This Page first."], "danger");
      return;
    }

    const results = [];
    const vehicle = dealerDraft.vehicle || {};

    const titleOk = setNodeValue(findEditable(["title", "listing title"]), dealerDraft.title || "");
    results.push(titleOk ? "Filled title" : "Could not find title field");

    const priceOk = setNodeValue(findEditable(["price", "asking price"]), dealerDraft.price || "");
    results.push(priceOk ? "Filled price" : "Could not find price field");

    const descOk = setNodeValue(findEditable(["description"]), dealerDraft.description || "");
    results.push(descOk ? "Filled description" : "Could not find description field");

    const yearOk =
      (await selectOption(["year"], vehicle.year || "")) ||
      setNodeValue(findEditable(["year"]), vehicle.year || "");
    results.push(yearOk ? "Filled year" : "Could not find year field");

    const makeOk =
      (await selectOption(["make"], vehicle.make || "")) ||
      setNodeValue(findEditable(["make"]), vehicle.make || "");
    results.push(makeOk ? "Filled make" : "Could not find make field");

    const modelOk =
      (await selectOption(["model"], vehicle.model || "")) ||
      setNodeValue(findEditable(["model"]), vehicle.model || "");
    results.push(modelOk ? "Filled model" : "Could not find model field");

    const mileageValue = String(vehicle.mileage || "").replace(/[^0-9]/g, "");
    const mileageOk =
      (await selectOption(["mileage", "odometer"], mileageValue)) ||
      setNodeValue(findEditable(["mileage", "odometer"]), mileageValue);
    results.push(mileageOk ? "Filled mileage" : "Could not find mileage field");

    const conditionOk =
      (await selectOption(["condition"], vehicle.condition || "")) ||
      setNodeValue(findEditable(["condition"]), vehicle.condition || "");
    results.push(conditionOk ? "Filled condition" : "Could not find condition field");

    const warningLines = [];
    if (Array.isArray(dealerDraft.images) && dealerDraft.images.length) {
      warningLines.push(`Images found on vehicle page: ${dealerDraft.images.length}`);
      warningLines.push("Image upload still needs to be done manually inside Facebook.");
    }

    const failedCount = results.filter((line) => line.startsWith("Could not")).length;
    setStatus(
      [...results, ...warningLines],
      failedCount ? "warning" : "success"
    );
  }

  function mountButton() {
    if (document.getElementById(ROOT_ID)) return;
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.style.position = "fixed";
    root.style.right = "16px";
    root.style.bottom = "16px";
    root.style.zIndex = "999999";
    root.style.background = "rgba(20, 28, 37, 0.96)";
    root.style.color = "white";
    root.style.padding = "12px";
    root.style.borderRadius = "14px";
    root.style.boxShadow = "0 14px 28px rgba(0,0,0,0.28)";
    root.style.fontFamily = "Arial, sans-serif";
    root.style.width = "260px";

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
    button.style.marginBottom = "8px";
    button.addEventListener("click", applyDraft);

    const status = document.createElement("div");
    status.id = STATUS_ID;
    status.style.fontSize = "12px";
    status.style.lineHeight = "1.35";
    status.style.color = "rgba(255,255,255,0.74)";
    status.textContent = "Ready. Click Apply Draft on the Facebook vehicle form.";

    root.appendChild(label);
    root.appendChild(button);
    root.appendChild(status);
    document.body.appendChild(root);
  }

  if (/facebook\.com\/marketplace\//i.test(location.href)) {
    mountButton();
    const observer = new MutationObserver(() => mountButton());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
