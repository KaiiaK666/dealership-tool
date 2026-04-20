(function () {
  const ROOT_ID = "dealer-marketplace-helper";
  const STATUS_ID = "dealer-marketplace-helper-status";
  let autoApplyRunning = false;
  let lastUrl = location.href;

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function isVisible(node) {
    if (!node || !node.isConnected) return false;
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return node.getClientRects().length > 0;
  }

  function dispatchMouseSequence(node) {
    if (!node) return false;
    const events = ["pointerdown", "mousedown", "mouseup", "click"];
    node.focus?.();
    for (const type of events) {
      node.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
        })
      );
    }
    node.click?.();
    return true;
  }

  function getAriaLabelText(node) {
    const ids = String(node?.getAttribute("aria-labelledby") || "")
      .split(/\s+/)
      .filter(Boolean);
    return normalizeText(
      ids
        .map((id) => document.getElementById(id)?.textContent || "")
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
    );
  }

  function getComboboxValue(node) {
    if (!node) return "";
    const candidates = Array.from(
      node.querySelectorAll('[tabindex="-1"] span, [tabindex="-1"] div, input, textarea, [role="textbox"]')
    )
      .map((candidate) => normalizeText(candidate.textContent || candidate.value || ""))
      .filter(Boolean);
    return candidates[0] || "";
  }

  function collectFieldText(node) {
    return normalizeText(
      [
        getAriaLabelText(node),
        node.getAttribute("aria-label"),
        node.getAttribute("placeholder"),
        node.getAttribute("name"),
        node.id,
        node.closest("label")?.textContent,
        node.closest('[aria-label]')?.getAttribute("aria-label"),
        node.closest('[role="group"]')?.textContent,
        node.previousElementSibling?.textContent,
        node.parentElement?.previousElementSibling?.textContent,
        node.parentElement?.textContent,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
    );
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function matchesHint(text, hints, exact = false) {
    const source = normalizeText(text).toLowerCase();
    if (!source) return false;
    return hints.some((hint) => {
      const normalizedHint = normalizeText(hint).toLowerCase();
      return exact ? source === normalizedHint || source.startsWith(`${normalizedHint} `) : source.includes(normalizedHint);
    });
  }

  function findLabeledInput(hints, { tagName = "", exact = false } = {}) {
    const labels = Array.from(document.querySelectorAll("label")).filter(isVisible);
    for (const label of labels) {
      const labelText = normalizeText(
        [
          getAriaLabelText(label),
          ...Array.from(label.querySelectorAll("span[id]")).map((node) => node.textContent || ""),
        ].join(" ")
      ).toLowerCase();
      if (!matchesHint(labelText, hints, exact)) continue;
      const target = label.querySelector(tagName ? tagName.toLowerCase() : 'input, textarea, [contenteditable="true"], [role="textbox"]');
      if (target) return target;
    }
    return null;
  }

  function findEditable(hints, { tagName = "", exact = false } = {}) {
    const labeled = findLabeledInput(hints, { tagName, exact });
    if (labeled) return labeled;
    const candidates = Array.from(
      document.querySelectorAll('input, textarea, [contenteditable="true"], [role="textbox"]')
    ).filter((node) => {
      const type = (node.getAttribute("type") || "").toLowerCase();
      if (["hidden", "file", "checkbox", "radio"].includes(type)) return false;
      if (tagName && node.tagName !== tagName.toUpperCase()) return false;
      if (!isVisible(node)) return false;
      return true;
    });
    return candidates.find((node) => {
      const text = collectFieldText(node);
      return matchesHint(text, hints, exact);
    });
  }

  function findDescriptionField() {
    return (
      findEditable(["description"], { tagName: "TEXTAREA", exact: true }) ||
      findEditable(["description"], { tagName: "TEXTAREA" }) ||
      findEditable(["description"], { exact: true }) ||
      findEditable(["description"])
    );
  }

  function findTextField(hints) {
    return findEditable(hints, { exact: true }) || findEditable(hints);
  }

  function findCheckboxByHints(hints) {
    return Array.from(document.querySelectorAll('input[type="checkbox"]')).find((node) => {
      if (!isVisible(node) && node.closest("label") && !isVisible(node.closest("label"))) return false;
      return matchesHint(collectFieldText(node), hints, false);
    });
  }

  function findFieldGroupTitle(title) {
    return Array.from(document.querySelectorAll("span, div, h1, h2, h3")).find((node) =>
      isVisible(node) && normalizeText(node.textContent).toLowerCase() === normalizeText(title).toLowerCase()
    );
  }

  function setNativeInputValue(node, value) {
    if (!node) return false;
    const prototype = node.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (!descriptor?.set) return false;
    descriptor.set.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function setNativeChecked(node, checked) {
    if (!node) return false;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked");
    if (!descriptor?.set) return false;
    descriptor.set.call(node, checked);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    return node.checked === checked;
  }

  function setNodeValue(node, value) {
    if (!node || value == null || value === "") return false;
    node.focus();
    if (node.tagName === "TEXTAREA" || node.tagName === "INPUT") {
      const ok = setNativeInputValue(node, value);
      node.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));
      return ok;
    }
    if (node.getAttribute("contenteditable") === "true" || node.getAttribute("role") === "textbox") {
      node.textContent = value;
      node.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
      return true;
    }
    return false;
  }

  function findSelectTrigger(hints) {
    const exactCandidates = Array.from(
      document.querySelectorAll('label[role="combobox"], [role="combobox"], [aria-haspopup="listbox"]')
    ).filter(isVisible);
    const exactMatch = exactCandidates.find((node) => matchesHint(getAriaLabelText(node), hints, true));
    if (exactMatch) return exactMatch;
    return exactCandidates.find((node) => matchesHint(collectFieldText(node), hints, false));
  }

  function findOptionByText(values) {
    const targets = (Array.isArray(values) ? values : [values])
      .map((value) => normalizeText(value).toLowerCase())
      .filter(Boolean);
    if (!targets.length) return null;

    const exactCandidates = Array.from(
      document.querySelectorAll('[role="option"], [role="menuitemradio"], [role="menuitem"], [aria-selected="true"], [aria-selected="false"]')
    ).filter(isVisible);
    const broadCandidates = Array.from(document.querySelectorAll("li, span, div"))
      .filter((node) => isVisible(node) && !node.querySelector("input, textarea") && normalizeText(node.textContent).length <= 64);
    const candidates = [...exactCandidates, ...broadCandidates];

    const scored = candidates
      .map((node) => {
        const text = normalizeText(node.textContent).toLowerCase();
        if (!text) return null;
        const score = targets.reduce((best, target) => {
          if (text === target) return Math.max(best, 100);
          if (text.startsWith(target)) return Math.max(best, 80);
          if (text.includes(target)) return Math.max(best, 60);
          return best;
        }, 0);
        return score ? { node, score, textLength: text.length } : null;
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score || left.textLength - right.textLength);

    return scored[0]?.node || null;
  }

  function bodyStyleCandidates(value) {
    const source = normalizeText(value || "Sedan").toLowerCase();
    if (source.includes("suv")) return ["SUV", "Sedan"];
    if (source.includes("truck")) return ["Truck", "Pickup Truck", "Sedan"];
    if (source.includes("hatch")) return ["Hatchback", "Sedan"];
    if (source.includes("coupe")) return ["Coupe", "Sedan"];
    if (source.includes("wagon")) return ["Wagon", "Sedan"];
    if (source.includes("convert")) return ["Convertible", "Sedan"];
    if (source.includes("van")) return ["Van", "Minivan", "Sedan"];
    return [normalizeText(value || "Sedan"), "Sedan"];
  }

  function conditionCandidates(value) {
    const source = normalizeText(value).toLowerCase();
    if (!source || source === "used") return ["Very Good", "Good", "Excellent", "Fair"];
    if (source === "new") return ["New", "Excellent", "Very Good"];
    if (source.includes("excellent")) return ["Excellent", "Very Good", "Good"];
    if (source.includes("very good")) return ["Very Good", "Good", "Excellent"];
    if (source.includes("good")) return ["Very Good", "Good", "Excellent"];
    if (source.includes("fair")) return ["Fair", "Good", "Very Good"];
    if (source.includes("salvage")) return ["Fair", "Poor"];
    return [normalizeText(value), "Very Good", "Good"];
  }

  function fuelTypeCandidates(value) {
    const source = normalizeText(value).toLowerCase();
    if (!source) return [];
    if (source.includes("plug") && source.includes("hybrid")) return ["Plug-in Hybrid", "Hybrid"];
    if (source.includes("hybrid")) return ["Hybrid", "Plug-in Hybrid"];
    if (source.includes("electric") || source === "ev") return ["Electric"];
    if (source.includes("diesel")) return ["Diesel"];
    if (source.includes("flex")) return ["Flex Fuel", "Gasoline"];
    if (/(gas|gasoline|unleaded|petrol)/i.test(source)) return ["Gasoline", "Gas"];
    return [normalizeText(value)];
  }

  function vehicleTypeCandidates() {
    return ["Car/Truck", "Car / Truck", "Cars & Trucks", "Car", "Truck"];
  }

  function isVehicleTypeReady(value) {
    const text = normalizeText(value).toLowerCase();
    return text === "car/truck" || text === "car / truck" || text === "cars & trucks" || text === "car" || text === "truck";
  }

  async function selectOption(hints, value, fallbacks = []) {
    const candidateValues = [value, ...fallbacks].map((item) => normalizeText(item)).filter(Boolean);
    if (!candidateValues.length) return false;
    const trigger = findSelectTrigger(hints);
    if (!trigger) return false;

    const currentValue = normalizeText(getComboboxValue(trigger)).toLowerCase();
    if (candidateValues.some((candidate) => currentValue === candidate.toLowerCase())) {
      return true;
    }

    for (const candidate of candidateValues) {
      dispatchMouseSequence(trigger);
      await wait(450);
      let option = findOptionByText(candidate);
      if (!option) {
        await wait(450);
        option = findOptionByText(candidate);
      }
      if (!option) continue;
      dispatchMouseSequence(option);
      await wait(500);
      const nextValue = normalizeText(getComboboxValue(trigger)).toLowerCase();
      if (!nextValue || nextValue.includes(candidate.toLowerCase()) || candidate.toLowerCase().includes(nextValue)) {
        return true;
      }
    }

    return false;
  }

  async function pickVehicleType(value) {
    const trigger = findSelectTrigger(["vehicle type"]);
    if (!trigger) return false;
    const currentValue = normalizeText(getComboboxValue(trigger));
    if (isVehicleTypeReady(currentValue)) {
      return true;
    }
    const candidates = vehicleTypeCandidates();
    const changed = await selectOption(["vehicle type"], candidates[0], candidates.slice(1));
    if (!changed) {
      return false;
    }
    await wait(1100);
    const nextValue = normalizeText(getComboboxValue(findSelectTrigger(["vehicle type"]) || trigger));
    return isVehicleTypeReady(nextValue);
  }

  async function pickBodyStyle(value) {
    const candidates = bodyStyleCandidates(value);
    return await selectOption(["body style"], candidates[0], candidates.slice(1));
  }

  function actionButtonText(node) {
    return normalizeText(node?.textContent || node?.getAttribute("aria-label") || "").toLowerCase();
  }

  function isDisabledButton(node) {
    if (!node) return true;
    return node.disabled || node.getAttribute("aria-disabled") === "true";
  }

  function findActionButton(labels) {
    const candidates = Array.from(document.querySelectorAll('button, [role="button"]')).filter(isVisible);
    return candidates.find((node) => labels.some((label) => actionButtonText(node) === label || actionButtonText(node).includes(label)));
  }

  function findNextButton() {
    return findActionButton(["next"]);
  }

  function findPublishButton() {
    return findActionButton(["publish", "publish now", "publish listing", "list item"]);
  }

  function findProgressLabel() {
    return Array.from(document.querySelectorAll('[aria-label]'))
      .map((node) => normalizeText(node.getAttribute("aria-label")))
      .find((text) => /currently on step/i.test(text));
  }

  async function fillTextField(hints, value, results, successLabel, failureLabel) {
    if (value == null || value === "") return false;
    const ok = setNodeValue(findTextField(hints), value);
    results.push(ok ? successLabel : failureLabel);
    if (ok) await wait(250);
    return ok;
  }

  async function fillSelectField(hints, value, results, successLabel, failureLabel, fallbacks = []) {
    if (value == null || value === "") return false;
    const ok = await selectOption(hints, value, fallbacks);
    results.push(ok ? successLabel : failureLabel);
    if (ok) await wait(450);
    return ok;
  }

  async function fillSelectOrTextField(hints, value, results, successLabel, failureLabel, fallbacks = []) {
    if (value == null || value === "") return false;
    const selectOk = await selectOption(hints, value, fallbacks);
    if (selectOk) {
      results.push(successLabel);
      await wait(450);
      return true;
    }
    const textOk = setNodeValue(findTextField(hints), value);
    results.push(textOk ? successLabel : failureLabel);
    if (textOk) await wait(250);
    return textOk;
  }

  async function ensureCheckboxChecked(hints, checked, results, successLabel, failureLabel) {
    const checkbox = findCheckboxByHints(hints);
    if (!checkbox) {
      results.push(failureLabel);
      return false;
    }
    if (checkbox.checked === checked) {
      results.push(successLabel);
      return true;
    }
    const target = checkbox.closest('label, [role="checkbox"], [role="button"]') || checkbox.parentElement || checkbox;
    dispatchMouseSequence(target);
    await wait(250);
    if (checkbox.checked === checked) {
      results.push(successLabel);
      return true;
    }
    const ok = setNativeChecked(checkbox, checked);
    results.push(ok ? successLabel : failureLabel);
    if (ok) await wait(250);
    return ok;
  }

  async function clickNextStep(results) {
    let nextButton = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      nextButton = findNextButton();
      if (nextButton && !isDisabledButton(nextButton)) break;
      await wait(700);
    }
    if (!nextButton) {
      results.push("Could not find next button");
      return false;
    }
    if (isDisabledButton(nextButton)) {
      results.push("Next button stayed disabled");
      return false;
    }
    dispatchMouseSequence(nextButton);
    results.push("Opened final review step");
    await wait(1600);
    return true;
  }

  async function waitForFinalReview() {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const progress = findProgressLabel() || "";
      if (/step 2 of 2/i.test(progress) || findPublishButton()) {
        return true;
      }
      await wait(700);
    }
    return false;
  }

  async function fillAdditionalVehicleDetails(vehicle, results) {
    const fuelCandidates = fuelTypeCandidates(vehicle.fuel_type || "");
    await fillSelectField(
      ["body style"],
      vehicle.body_style || "Sedan",
      results,
      "Filled body style",
      "Could not find body style field",
      bodyStyleCandidates(vehicle.body_style || "Sedan").slice(1)
    );
    await fillSelectField(
      ["exterior color"],
      vehicle.exterior_color || "",
      results,
      "Filled exterior color",
      "Could not find exterior color field"
    );
    await fillSelectField(
      ["interior color"],
      vehicle.interior_color || "",
      results,
      "Filled interior color",
      "Could not find interior color field"
    );
    await fillSelectField(
      ["fuel type"],
      fuelCandidates[0] || "",
      results,
      "Filled fuel type",
      "Could not find fuel type field",
      fuelCandidates.slice(1)
    );
    await fillSelectField(
      ["transmission"],
      vehicle.transmission || "",
      results,
      "Filled transmission",
      "Could not find transmission field"
    );
  }

  function findAddPhotosButton() {
    return Array.from(document.querySelectorAll('button, [role="button"]')).find((node) =>
      /add photos/i.test(normalizeText(node.textContent || node.getAttribute("aria-label") || ""))
    );
  }

  function findImageInput() {
    const candidates = Array.from(document.querySelectorAll('input[type="file"][multiple], input[type="file"]')).filter((node) => {
      if (!isVisible(node) && node.closest("label") && !isVisible(node.closest("label"))) return false;
      const accept = String(node.getAttribute("accept") || "").toLowerCase();
      return !accept || accept.includes("image");
    });
    return candidates.find((node) => node.hasAttribute("multiple")) || candidates[0] || null;
  }

  function findPhotoDropTarget(input) {
    return input?.closest("label") || input?.parentElement || findAddPhotosButton() || null;
  }

  function getPhotoCount() {
    const texts = Array.from(document.querySelectorAll("span, div"))
      .filter(isVisible)
      .map((node) => normalizeText(node.textContent))
      .filter(Boolean);
    let best = 0;
    for (const text of texts) {
      const match = text.match(/photos?\s*[·•]?\s*(\d+)\s*\/\s*(\d+)/i);
      if (match) {
        best = Math.max(best, Number(match[1] || 0));
      }
    }
    return best;
  }

  async function waitForPhotoUpload(previousCount, minimumAdded) {
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const count = getPhotoCount();
      if (count >= previousCount + minimumAdded || count > previousCount) {
        return count;
      }
      await wait(650);
    }
    return getPhotoCount();
  }

  async function uploadImages(imageUrls) {
    let input = findImageInput();
    if (!input) {
      findAddPhotosButton()?.click();
      await wait(500);
      input = findImageInput();
    }
    if (!input || !Array.isArray(imageUrls) || !imageUrls.length) return { ok: false, uploaded: 0 };
    const startingCount = getPhotoCount();
    const dataTransfer = new DataTransfer();
    let uploaded = 0;
    for (let index = 0; index < Math.min(imageUrls.length, 10); index += 1) {
      const url = imageUrls[index];
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const blob = await response.blob();
        const extensionMatch = String(url).match(/\.([a-zA-Z0-9]{3,4})(?:[?#]|$)/);
        const extension = extensionMatch?.[1] || "jpg";
        dataTransfer.items.add(new File([blob], `vehicle-${index + 1}.${extension}`, { type: blob.type || `image/${extension}` }));
        uploaded += 1;
      } catch {
        // Ignore individual image failures.
      }
    }
    if (!uploaded) return { ok: false, uploaded: 0 };
    const filesDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");
    if (filesDescriptor?.set) {
      filesDescriptor.set.call(input, dataTransfer.files);
    } else {
      input.files = dataTransfer.files;
    }
    input.dispatchEvent(new Event("click", { bubbles: true }));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    const dropTarget = findPhotoDropTarget(input);
    try {
      dropTarget?.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer }));
      dropTarget?.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer }));
      dropTarget?.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
      input.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
    } catch {
      // DragEvent is not always constructible in Chrome extension contexts.
    }
    const endingCount = await waitForPhotoUpload(startingCount, Math.min(uploaded, 1));
    return { ok: endingCount > startingCount, uploaded, photoCount: endingCount };
  }

  function getStatusNode() {
    return document.getElementById(STATUS_ID);
  }

  function setStatus(lines, tone = "neutral") {
    const node = getStatusNode();
    if (!node) return;
    const colors = {
      neutral: "rgba(255,255,255,0.76)",
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

  async function readDraft() {
    const saved = await chrome.storage.local.get(["dealerDraft"]);
    return saved.dealerDraft || null;
  }

  async function clearAutoApplyFlag() {
    await chrome.storage.local.set({
      dealerAutoApply: {
        pending: false,
        updatedAt: Date.now(),
      },
    });
  }

  async function applyDraft({ auto = false } = {}) {
    const dealerDraft = await readDraft();
    if (!dealerDraft) {
      setStatus(["No draft found.", "Open a Bert Ogden vehicle page and use Quick Post first."], "danger");
      return { ok: false, appliedCount: 0, failedCount: 1 };
    }

    const results = [];
    const vehicle = dealerDraft.vehicle || {};
    const modelValue = normalizeText(vehicle.model || dealerDraft.raw?.model || "");
    const mileageValue = String(vehicle.mileage || "").replace(/[^0-9]/g, "");

    const vehicleTypeOk = await pickVehicleType(vehicle.body_style || "Sedan");
    results.push(vehicleTypeOk ? "Filled vehicle type" : "Could not find vehicle type field");
    if (!vehicleTypeOk) {
      const trigger = findSelectTrigger(["vehicle type"]);
      const currentValue = normalizeText(getComboboxValue(trigger));
      if (!isVehicleTypeReady(currentValue)) {
        setStatus(
          [
            "Facebook vehicle type was not set to Car/Truck.",
            "The rest of the fields were skipped so Facebook does not wipe them afterward.",
            "Open the Vehicle type dropdown first, then click Apply Saved Draft again.",
          ],
          "warning"
        );
        return { ok: false, appliedCount: 0, failedCount: 1 };
      }
    }
    await wait(1200);

    await fillTextField(["price", "asking price"], dealerDraft.price || "", results, "Filled price", "Could not find price field");

    await fillSelectOrTextField(["year"], vehicle.year || "", results, "Filled year", "Could not find year field");
    await wait(800);

    await fillSelectOrTextField(["make"], vehicle.make || "", results, "Filled make", "Could not find make field");
    await wait(800);

    await fillSelectOrTextField(["model"], modelValue, results, "Filled model", "Could not find model field");

    await fillSelectOrTextField(
      ["mileage", "odometer"],
      mileageValue,
      results,
      "Filled mileage",
      "Could not find mileage field"
    );

    await fillTextField(["description"], dealerDraft.description || "", results, "Filled description", "Could not find description field");

    await ensureCheckboxChecked(
      ["clean title"],
      vehicle.clean_title !== false,
      results,
      "Checked clean title",
      "Could not find clean title checkbox"
    );

    const conditionOptions = conditionCandidates(vehicle.marketplace_condition || vehicle.condition || "Very Good");

    await fillSelectOrTextField(
      ["condition"],
      conditionOptions[0] || "Very Good",
      results,
      "Filled condition",
      "Could not find condition field",
      conditionOptions.slice(1)
    );

    await fillAdditionalVehicleDetails(vehicle, results);

    const warningLines = [];
    if (Array.isArray(dealerDraft.images) && dealerDraft.images.length) {
      const uploadResult = await uploadImages(dealerDraft.images);
      if (uploadResult.ok) {
        const finalPhotoCount = Math.max(uploadResult.photoCount || 0, uploadResult.uploaded);
        results.push(`Uploaded ${finalPhotoCount} photo${finalPhotoCount === 1 ? "" : "s"}`);
      } else {
        warningLines.push(`Images found on vehicle page: ${dealerDraft.images.length}`);
        warningLines.push("Photo upload did not stick on this Facebook layout yet.");
      }
    }

    const nextClicked = await clickNextStep(results);
    if (nextClicked) {
      const finalReady = await waitForFinalReview();
      if (finalReady) {
        await fillTextField(["title", "listing title", "vehicle title"], dealerDraft.title || "", results, "Filled final title", "Could not find final title field");
        await fillTextField(["description"], dealerDraft.description || "", results, "Filled final description", "Could not find final description field");
        if (findPublishButton()) {
          results.push("Reached final publish screen");
        } else {
          warningLines.push("Moved past step one, but the final publish button was not found yet.");
        }
      } else {
        warningLines.push("Clicked Next, but Facebook did not fully load the final review step in time.");
      }
    } else {
      warningLines.push("Step one stayed incomplete, so the helper did not move to the final publish screen.");
    }

    const failedCount = results.filter((line) => line.startsWith("Could not")).length;
    const appliedCount = results.length - failedCount;
    const statusLines = auto
      ? ["Auto-fill attempted on Facebook Marketplace.", ...results, ...warningLines]
      : [...results, ...warningLines];

    setStatus(statusLines, failedCount ? "warning" : "success");
    return { ok: appliedCount > 0, appliedCount, failedCount };
  }

  async function maybeAutoApply() {
    if (autoApplyRunning) return;
    const { dealerAutoApply } = await chrome.storage.local.get(["dealerAutoApply"]);
    if (!dealerAutoApply?.pending) return;

    autoApplyRunning = true;
    setStatus(["Saved draft detected.", "Waiting for Facebook's vehicle form..."]);

    try {
      for (let attempt = 0; attempt < 15; attempt += 1) {
        const formReady = Boolean(
          findTextField(["price", "model", "mileage"]) ||
            findDescriptionField() ||
            findSelectTrigger(["vehicle type", "year", "make", "condition"])
        );
        if (formReady) {
          await applyDraft({ auto: true });
          await clearAutoApplyFlag();
          autoApplyRunning = false;
          return;
        }
        await wait(900);
      }

      setStatus(
        [
          "Draft was ready, but Facebook's form did not finish loading in time.",
          "Click Apply Saved Draft below once the page is fully visible.",
        ],
        "warning"
      );
      await clearAutoApplyFlag();
    } finally {
      autoApplyRunning = false;
    }
  }

  function mountPanel() {
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
    root.style.width = "280px";

    const label = document.createElement("div");
    label.textContent = "Dealer Marketplace Helper";
    label.style.fontSize = "11px";
    label.style.letterSpacing = "0.12em";
    label.style.textTransform = "uppercase";
    label.style.opacity = "0.75";
    label.style.marginBottom = "8px";

    const button = document.createElement("button");
    button.textContent = "Apply Saved Draft";
    button.style.width = "100%";
    button.style.border = "0";
    button.style.borderRadius = "10px";
    button.style.padding = "10px 12px";
    button.style.fontWeight = "700";
    button.style.cursor = "pointer";
    button.style.background = "#d8783a";
    button.style.color = "white";
    button.style.marginBottom = "8px";
    button.addEventListener("click", () => applyDraft({ auto: false }));

    const status = document.createElement("div");
    status.id = STATUS_ID;
    status.style.fontSize = "12px";
    status.style.lineHeight = "1.35";
    status.style.color = "rgba(255,255,255,0.76)";
    status.textContent = "Ready. Quick Post from the vehicle page will try to fill this form automatically.";

    root.appendChild(label);
    root.appendChild(button);
    root.appendChild(status);
    document.body.appendChild(root);
  }

  function handlePageChange() {
    if (!/facebook\.com\/marketplace\//i.test(location.href)) return;
    mountPanel();
    maybeAutoApply();
  }

  if (/facebook\.com\/marketplace\//i.test(location.href)) {
    handlePageChange();

    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
      }
      handlePageChange();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
