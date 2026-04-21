(function () {
  const ROOT_ID = "dealer-marketplace-helper";
  const STATUS_ID = "dealer-marketplace-helper-status";
  let autoApplyRunning = false;
  let lastUrl = location.href;

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function simplifyText(text) {
    return normalizeText(text).toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function valueMatches(currentValue, candidate) {
    const current = simplifyText(currentValue);
    const target = simplifyText(candidate);
    if (!current || !target) return false;
    return current === target || current.includes(target) || target.includes(current);
  }

  function clampMarketplaceMileage(value) {
    const digits = String(value || "").replace(/[^0-9]/g, "");
    if (!digits) return "";
    const numeric = Number(digits);
    if (!Number.isFinite(numeric) || numeric <= 0) return "";
    if (numeric < 300) return "300";
    return String(Math.min(numeric, 1000000));
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
    const directValue = normalizeText(node.value || "");
    if (directValue) return directValue;
    const ownText = normalizeText(node.textContent || "");
    if (ownText && ownText.length <= 80) return ownText;
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
    const nearbyMarker = findFieldMarkers(hints, { exact })[0];
    const nearbyEditable = findControlNearMarker(
      nearbyMarker,
      tagName ? tagName.toLowerCase() : 'input, textarea, [contenteditable="true"], [role="textbox"]'
    );
    if (nearbyEditable) return nearbyEditable;
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

  function measureNodeDistance(source, target) {
    if (!source || !target) return Number.POSITIVE_INFINITY;
    const sourceBox = source.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    const verticalGap =
      targetBox.top > sourceBox.bottom
        ? targetBox.top - sourceBox.bottom
        : sourceBox.top > targetBox.bottom
          ? sourceBox.top - targetBox.bottom
          : 0;
    const horizontalGap =
      targetBox.left > sourceBox.right
        ? targetBox.left - sourceBox.right
        : sourceBox.left > targetBox.right
          ? sourceBox.left - targetBox.right
          : 0;
    return verticalGap * 4 + horizontalGap;
  }

  function findFieldMarkers(hints, { exact = false } = {}) {
    return Array.from(document.querySelectorAll("label, span, div, p, legend, h1, h2, h3, h4"))
      .filter((node) => {
        if (!isVisible(node)) return false;
        const text = normalizeText(node.textContent || node.getAttribute("aria-label") || "");
        if (!text || text.length > 80) return false;
        return matchesHint(text, hints, exact);
      })
      .sort((left, right) => {
        const leftLength = normalizeText(left.textContent || "").length;
        const rightLength = normalizeText(right.textContent || "").length;
        return leftLength - rightLength;
      });
  }

  function findControlNearMarker(marker, selector) {
    if (!marker) return null;
    const scopes = [
      marker.closest("label"),
      marker.closest('[role="group"]'),
      marker.closest("fieldset"),
      marker.parentElement,
      marker.parentElement?.parentElement,
      marker.closest('[role="dialog"]'),
    ].filter(Boolean);

    for (const scope of scopes) {
      const localMatch = Array.from(scope.querySelectorAll(selector))
        .filter((node) => isVisible(node) && node !== marker && !node.contains(marker))
        .map((node) => ({ node, distance: measureNodeDistance(marker, node) }))
        .sort((left, right) => left.distance - right.distance)[0]?.node;
      if (localMatch) return localMatch;
    }

    return Array.from(document.querySelectorAll(selector))
      .filter((node) => isVisible(node) && node !== marker && !node.contains(marker))
      .map((node) => ({ node, distance: measureNodeDistance(marker, node) }))
      .filter(({ distance }) => distance < 900)
      .sort((left, right) => left.distance - right.distance)[0]?.node || null;
  }

  function findCleanTitleCheckbox() {
    const markers = Array.from(document.querySelectorAll("div, span, p, label"))
      .filter((node) => isVisible(node) && /clean title/i.test(normalizeText(node.textContent || "")));
    for (const marker of markers) {
      const markerBox = marker.getBoundingClientRect();
      const candidates = Array.from(document.querySelectorAll('input[type="checkbox"], [role="checkbox"], [aria-checked]'))
        .filter(isVisible)
        .map((node) => {
          const box = node.getBoundingClientRect();
          const distance =
            Math.abs(box.left - markerBox.right) +
            Math.abs(box.top - markerBox.top);
          return { node, distance };
        })
        .sort((left, right) => left.distance - right.distance);
      if (candidates[0]?.node) {
        return candidates[0].node;
      }
    }
    return null;
  }

  function findCheckboxByHints(hints) {
    if (hints.some((hint) => /clean title/i.test(hint))) {
      const cleanTitleCheckbox = findCleanTitleCheckbox();
      if (cleanTitleCheckbox) return cleanTitleCheckbox;
    }
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
    if (node.getAttribute("role") === "checkbox" || node.hasAttribute("aria-checked")) {
      dispatchMouseSequence(node);
      return String(node.getAttribute("aria-checked")) === String(checked);
    }
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
      node.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Tab" }));
      node.dispatchEvent(new Event("blur", { bubbles: true }));
      node.blur?.();
      return ok;
    }
    if (node.getAttribute("contenteditable") === "true" || node.getAttribute("role") === "textbox") {
      node.textContent = value;
      node.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
      node.dispatchEvent(new Event("blur", { bubbles: true }));
      node.blur?.();
      return true;
    }
    return false;
  }

  function findSelectTrigger(hints) {
    const triggerSelector =
      'label[role="combobox"], [role="combobox"], [aria-haspopup="listbox"], button[aria-haspopup], [role="button"][aria-haspopup], input[role="combobox"], input[aria-autocomplete="list"], input[aria-expanded="true"], input[aria-expanded="false"]';
    const exactCandidates = Array.from(
      document.querySelectorAll(triggerSelector)
    ).filter(isVisible);
    const exactMatch = exactCandidates.find((node) => matchesHint(getAriaLabelText(node), hints, true));
    if (exactMatch) return exactMatch;
    const nearbyMarker = findFieldMarkers(hints, { exact: true })[0] || findFieldMarkers(hints)[0];
    const nearbyTrigger = findControlNearMarker(nearbyMarker, triggerSelector);
    if (nearbyTrigger) return nearbyTrigger;
    return exactCandidates.find((node) => matchesHint(collectFieldText(node), hints, false));
  }

  function findOptionByText(values, root = document) {
    const targets = (Array.isArray(values) ? values : [values])
      .map((value) => normalizeText(value).toLowerCase())
      .filter(Boolean);
    if (!targets.length) return null;

    const exactCandidates = Array.from(
      root.querySelectorAll('[role="option"], [role="menuitemradio"], [role="menuitem"], [aria-selected="true"], [aria-selected="false"]')
    ).filter(isVisible);
    const broadCandidates = Array.from(root.querySelectorAll("li, span, div"))
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

  function getVisibleOptionScopes() {
    const scopes = Array.from(document.querySelectorAll('[role="listbox"], [role="menu"], [role="dialog"]')).filter(isVisible);
    return scopes.length ? scopes : [document];
  }

  function findVisibleOptionSearchInput(scopes, trigger) {
    for (const scope of scopes) {
      const match = Array.from(scope.querySelectorAll('input, textarea, [contenteditable="true"], [role="textbox"]'))
        .filter((node) => {
          if (!isVisible(node) || node === trigger) return false;
          const type = (node.getAttribute("type") || "").toLowerCase();
          if (["hidden", "file", "checkbox", "radio"].includes(type)) return false;
          return true;
        })[0];
      if (match) return match;
    }
    return null;
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
    if (source.includes("hybrid")) return ["Other", "Plug-in hybrid", "Petrol"];
    if (source.includes("electric") || source === "ev") return ["Electric"];
    if (source.includes("diesel")) return ["Diesel"];
    if (source.includes("flex")) return ["Flex Fuel", "Gasoline"];
    if (/(gas|gasoline|unleaded|petrol)/i.test(source)) return ["Petrol", "Gasoline", "Gas", "Other"];
    return [normalizeText(value)];
  }

  function scrollFieldIntoView(hints) {
    const node =
      findSelectTrigger(hints) ||
      findTextField(hints) ||
      findCheckboxByHints(hints);
    if (node) {
      node.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    }
    return node;
  }

  function findPrimaryFieldMarker(hints) {
    return findFieldMarkers(hints, { exact: true })[0] || findFieldMarkers(hints)[0] || null;
  }

  function readFieldGroupText(hints) {
    const marker = findPrimaryFieldMarker(hints);
    if (!marker) return "";
    const scopes = [
      marker.closest("label"),
      marker.closest('[role="combobox"]'),
      marker.closest('[role="button"]'),
      marker.parentElement,
      marker.parentElement?.parentElement,
      marker.parentElement?.parentElement?.parentElement,
    ].filter(Boolean);
    for (const scope of scopes) {
      const text = normalizeText(scope.textContent || scope.getAttribute?.("aria-label") || "");
      if (text) return text;
    }
    return normalizeText(marker.textContent || "");
  }

  function vehicleTypeCandidates() {
    return ["Car/Truck", "Car / Truck", "Cars & Trucks", "Car", "Truck"];
  }

  function isVehicleTypeReady(value) {
    const text = normalizeText(value).toLowerCase();
    return text === "car/truck" || text === "car / truck" || text === "cars & trucks" || text === "car" || text === "truck";
  }

  function vehicleTypeLooksReady() {
    const triggerValue = normalizeText(getComboboxValue(findSelectTrigger(["vehicle type"])));
    if (isVehicleTypeReady(triggerValue)) return true;
    const groupText = readFieldGroupText(["vehicle type"]);
    return vehicleTypeCandidates().some((candidate) => valueMatches(groupText, candidate));
  }

  async function selectOption(hints, value, fallbacks = []) {
    const candidateValues = [value, ...fallbacks].map((item) => normalizeText(item)).filter(Boolean);
    if (!candidateValues.length) return false;
    const trigger = findSelectTrigger(hints);
    if (!trigger) return false;

    const currentValue = normalizeText(getComboboxValue(trigger));
    if (candidateValues.some((candidate) => valueMatches(currentValue, candidate))) {
      return true;
    }

    for (const candidate of candidateValues) {
      trigger.scrollIntoView?.({ block: "center", inline: "nearest", behavior: "instant" });
      dispatchMouseSequence(trigger);
      await wait(500);
      let option = null;
      for (let attempt = 0; attempt < 4 && !option; attempt += 1) {
        const scopes = getVisibleOptionScopes();
        const searchInput = findVisibleOptionSearchInput(scopes, trigger);
        if (searchInput && !option && attempt > 0) {
          setNodeValue(searchInput, candidate);
          await wait(350);
        }
        option =
          scopes.map((scope) => findOptionByText(candidate, scope)).find(Boolean) ||
          findOptionByText(candidate);
        if (!option) {
          await wait(350);
        }
      }
      if (!option) continue;
      option.scrollIntoView?.({ block: "center", inline: "nearest", behavior: "instant" });
      dispatchMouseSequence(option);
      for (let settle = 0; settle < 6; settle += 1) {
        await wait(280);
        const liveTrigger = findSelectTrigger(hints) || trigger;
        const nextValue = normalizeText(getComboboxValue(liveTrigger));
        if (valueMatches(nextValue, candidate)) {
          return true;
        }
      }
    }

    return false;
  }

  async function pickVehicleType(value) {
    const trigger = findSelectTrigger(["vehicle type"]);
    if (vehicleTypeLooksReady()) {
      return true;
    }
    if (!trigger) return false;
    const candidates = vehicleTypeCandidates();
    const changed = await selectOption(["vehicle type"], candidates[0], candidates.slice(1));
    if (!changed) {
      return vehicleTypeLooksReady();
    }
    await wait(1100);
    return vehicleTypeLooksReady();
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
    return findActionButton(["next", "continue", "review"]);
  }

  function findPublishButton() {
    return findActionButton(["publish", "publish now", "publish listing", "list item"]);
  }

  function findProgressLabel() {
    return Array.from(document.querySelectorAll('[aria-label]'))
      .map((node) => normalizeText(node.getAttribute("aria-label")))
      .find((text) => /currently on step/i.test(text));
  }

  function getEditableValue(node) {
    if (!node) return "";
    if (node.tagName === "INPUT" || node.tagName === "TEXTAREA") {
      return normalizeText(node.value || "");
    }
    return normalizeText(node.textContent || "");
  }

  function getTextValue(hints) {
    return getEditableValue(findTextField(hints));
  }

  function collectVisibleValidationIssues() {
    const candidates = Array.from(document.querySelectorAll('[aria-invalid="true"], input:invalid, textarea:invalid'))
      .filter(isVisible)
      .map((node) => normalizeText(collectFieldText(node)))
      .filter(Boolean)
      .map((text) => text.split(" ").slice(0, 6).join(" "))
      .slice(0, 6);
    return Array.from(new Set(candidates));
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
    if (findPublishButton()) {
      results.push("Already on final review step");
      return true;
    }
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
      const validationIssues = collectVisibleValidationIssues();
      if (validationIssues.length) {
        results.push(`Facebook still marked invalid: ${validationIssues.join(", ")}`);
      }
      results.push("Next button stayed disabled");
      return false;
    }
    nextButton.scrollIntoView?.({ block: "center", inline: "nearest", behavior: "instant" });
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

  function findPhotoUploadLabel() {
    return Array.from(document.querySelectorAll("label, div, [role='button']")).find((node) => {
      return isVisible(node) && /add photos/i.test(normalizeText(node.textContent || node.getAttribute("aria-label") || ""));
    });
  }

  function findImageInput() {
    const photoLabel = findPhotoUploadLabel();
    const labeledInput = photoLabel?.querySelector?.('input[type="file"]');
    if (labeledInput) return labeledInput;
    const candidates = Array.from(document.querySelectorAll('input[type="file"][multiple], input[type="file"]')).filter((node) => {
      if (!isVisible(node) && node.closest("label") && !isVisible(node.closest("label"))) return false;
      const accept = String(node.getAttribute("accept") || "").toLowerCase();
      return !accept || accept.includes("image");
    });
    return candidates.find((node) => node.hasAttribute("multiple")) || candidates[0] || null;
  }

  function findPhotoDropTarget(input) {
    return findPhotoUploadLabel() || input?.closest("label") || input?.parentElement || findAddPhotosButton() || null;
  }

  function runtimeSendMessage(message) {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      return Promise.resolve({ ok: false, error: "Chrome extension runtime unavailable." });
    }
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          const runtimeError = chrome.runtime?.lastError;
          if (runtimeError) {
            resolve({ ok: false, error: runtimeError.message || "Extension background worker is unavailable." });
            return;
          }
          resolve(response || { ok: false, error: "Extension background worker did not respond." });
        });
      } catch (error) {
        resolve({ ok: false, error: error?.message || "Extension background worker is unavailable." });
      }
    });
  }

  async function fetchImagePayloads(imageUrls) {
    const urls = (Array.isArray(imageUrls) ? imageUrls : []).map((url) => String(url || "").trim()).filter(Boolean).slice(0, 10);
    if (!urls.length) return { ok: false, files: [], error: "" };
    const response = await runtimeSendMessage({
      type: "FETCH_MARKETPLACE_IMAGE_FILES",
      urls,
    });
    return {
      ok: Boolean(response?.ok),
      files: Array.isArray(response?.files) ? response.files : [],
      error: String(response?.error || ""),
    };
  }

  async function buildFilesFromPayloads(payloads) {
    const files = [];
    for (let index = 0; index < payloads.length; index += 1) {
      const item = payloads[index] || {};
      try {
        const response = await fetch(String(item.dataUrl || ""));
        if (!response.ok) continue;
        const blob = await response.blob();
        const fallbackExtensionMatch = String(item.url || item.name || "").match(/\.([a-zA-Z0-9]{3,4})(?:[?#]|$)/);
        const fallbackExtension = fallbackExtensionMatch?.[1] || "jpg";
        files.push(
          new File([blob], item.name || `vehicle-${index + 1}.${fallbackExtension}`, {
            type: item.type || blob.type || `image/${fallbackExtension}`,
          })
        );
      } catch {
        // Keep going so one bad payload does not cancel the rest.
      }
    }
    return files;
  }

  async function assignFilesInPageContext(input, files) {
    if (!input || !files.length) return false;
    const targetId = `dealer-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    input.setAttribute("data-dealer-upload-target", targetId);
    const payload = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        type: file.type,
        dataUrl: await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }),
      }))
    );
    await new Promise((resolve) => {
      const script = document.createElement("script");
      script.textContent = `
        (async () => {
          const input = document.querySelector('[data-dealer-upload-target="${targetId}"]');
          if (!input) return;
          const files = [];
          for (const item of ${JSON.stringify(payload)}) {
            const response = await fetch(item.dataUrl);
            const blob = await response.blob();
            files.push(new File([blob], item.name, { type: item.type || blob.type || "image/jpeg" }));
          }
          const dataTransfer = new DataTransfer();
          for (const file of files) dataTransfer.items.add(file);
          const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");
          if (descriptor && descriptor.set) {
            descriptor.set.call(input, dataTransfer.files);
          } else {
            input.files = dataTransfer.files;
          }
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        })().finally(() => {
          document.currentScript?.remove();
        });
      `;
      document.documentElement.appendChild(script);
      setTimeout(resolve, 700);
    });
    input.removeAttribute("data-dealer-upload-target");
    return Number(input.files?.length || 0) > 0;
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
    let fetchError = "";

    const extensionFetch = await fetchImagePayloads(imageUrls);
    let files = extensionFetch.ok ? await buildFilesFromPayloads(extensionFetch.files) : [];
    if (!files.length && extensionFetch.error) {
      fetchError = extensionFetch.error;
    }

    if (!files.length) {
      for (let index = 0; index < Math.min(imageUrls.length, 10); index += 1) {
        const url = imageUrls[index];
        try {
          const response = await fetch(url);
          if (!response.ok) continue;
          const blob = await response.blob();
          const extensionMatch = String(url).match(/\.([a-zA-Z0-9]{3,4})(?:[?#]|$)/);
          const extension = extensionMatch?.[1] || "jpg";
          files.push(new File([blob], `vehicle-${index + 1}.${extension}`, { type: blob.type || `image/${extension}` }));
        } catch {
          // Ignore individual image failures.
        }
      }
    }

    for (const file of files) {
      dataTransfer.items.add(file);
      uploaded += 1;
    }
    if (!uploaded) return { ok: false, uploaded: 0, fetchError };
    let endingCount = startingCount;
    let assignedCount = 0;
    input = findImageInput() || input;
    scrollFieldIntoView(["add photos"]);
    const pageWorldAssigned = await assignFilesInPageContext(input, Array.from(dataTransfer.files));
    assignedCount = Math.max(assignedCount, pageWorldAssigned ? uploaded : 0, Number(input.files?.length || 0));
    endingCount = await waitForPhotoUpload(startingCount, Math.min(uploaded, 1));
    if (pageWorldAssigned && endingCount > startingCount) {
      return { ok: true, uploaded, photoCount: endingCount, assignedCount, fetchError };
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      input = findImageInput() || input;
      scrollFieldIntoView(["add photos"]);
      const dropTarget = findPhotoDropTarget(input);
      const filesDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");
      if (filesDescriptor?.set) {
        filesDescriptor.set.call(input, dataTransfer.files);
      } else {
        input.files = dataTransfer.files;
      }
      assignedCount = Math.max(assignedCount, Number(input.files?.length || 0));
      input.dispatchEvent(new Event("click", { bubbles: true }));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      dropTarget?.dispatchEvent(new Event("input", { bubbles: true }));
      dropTarget?.dispatchEvent(new Event("change", { bubbles: true }));
      try {
        dropTarget?.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer }));
        dropTarget?.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer }));
        dropTarget?.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
        input.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
      } catch {
        // DragEvent is not always constructible in Chrome extension contexts.
      }
      endingCount = await waitForPhotoUpload(startingCount, Math.min(uploaded, 1));
      if (endingCount > startingCount) {
        return { ok: true, uploaded, photoCount: endingCount, assignedCount, fetchError };
      }
      dispatchMouseSequence(dropTarget || input);
      await wait(450);
    }
    const pageWorldRetryAssigned = await assignFilesInPageContext(
      input,
      Array.from(dataTransfer.files)
    );
    assignedCount = Math.max(assignedCount, Number(input.files?.length || 0));
    endingCount = await waitForPhotoUpload(startingCount, Math.min(uploaded, 1));
    if (pageWorldRetryAssigned && endingCount > startingCount) {
      return { ok: true, uploaded, photoCount: endingCount, assignedCount, fetchError };
    }
    return { ok: false, uploaded, photoCount: endingCount, assignedCount, fetchError };
  }

  function getSelectValue(hints) {
    const trigger = findSelectTrigger(hints);
    return normalizeText(getComboboxValue(trigger));
  }

  function getFormSnapshot() {
    const cleanTitleCheckbox = findCheckboxByHints(["clean title"]);
    return {
      vehicleType: getSelectValue(["vehicle type"]),
      price: getTextValue(["price", "asking price"]),
      year: getTextValue(["year"]) || getSelectValue(["year"]),
      make: getTextValue(["make"]) || getSelectValue(["make"]),
      model: getTextValue(["model"]) || getSelectValue(["model"]),
      mileage: getTextValue(["mileage", "odometer"]),
      description: getTextValue(["description"]),
      bodyStyle: getSelectValue(["body style"]),
      cleanTitle: Boolean(cleanTitleCheckbox?.checked || cleanTitleCheckbox?.getAttribute?.("aria-checked") === "true"),
      condition: getSelectValue(["condition"]),
      fuelType: getSelectValue(["fuel type"]),
      transmission: getSelectValue(["transmission"]),
      photos: getPhotoCount(),
    };
  }

  function missingSnapshotFields(snapshot) {
    const missing = [];
    if (!snapshot.vehicleType) missing.push("vehicle type");
    if (!snapshot.price) missing.push("price");
    if (!snapshot.year) missing.push("year");
    if (!snapshot.make) missing.push("make");
    if (!snapshot.model) missing.push("model");
    if (!snapshot.mileage) missing.push("mileage");
    if (!snapshot.description) missing.push("description");
    if (!snapshot.bodyStyle) missing.push("body style");
    if (!snapshot.cleanTitle) missing.push("clean title");
    if (!snapshot.condition) missing.push("condition");
    if (!snapshot.fuelType) missing.push("fuel type");
    if (!snapshot.transmission) missing.push("transmission");
    if (!snapshot.photos) missing.push("photos");
    return missing;
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
    const mileageValue = clampMarketplaceMileage(vehicle.mileage);

    let vehicleTypeOk = await pickVehicleType(vehicle.body_style || "Sedan");
    if (!vehicleTypeOk && vehicleTypeLooksReady()) {
      vehicleTypeOk = true;
    }
    results.push(vehicleTypeOk ? "Filled vehicle type" : "Could not confirm vehicle type field");
    if (!vehicleTypeOk) {
      const currentValue = normalizeText(getComboboxValue(findSelectTrigger(["vehicle type"]))) || readFieldGroupText(["vehicle type"]);
      setStatus(
        [
          "Facebook vehicle type could not be confirmed as Car/Truck.",
          currentValue ? `Detected around that field: ${currentValue}` : "Detected around that field: blank",
          "The rest of the fields were skipped so Facebook does not wipe them afterward.",
        ],
        "warning"
      );
      return { ok: false, appliedCount: 0, failedCount: 1 };
    }
    await wait(1200);

    await fillTextField(["price", "asking price"], dealerDraft.price || "", results, "Filled price", "Could not find price field");

    await fillSelectOrTextField(["year"], vehicle.year || "", results, "Filled year", "Could not find year field");
    await wait(800);

    await fillSelectOrTextField(["make"], vehicle.make || "", results, "Filled make", "Could not find make field");
    await wait(800);

    await fillSelectOrTextField(["model"], modelValue, results, "Filled model", "Could not find model field");

    if (mileageValue && mileageValue !== String(vehicle.mileage || "").replace(/[^0-9]/g, "")) {
      results.push(`Adjusted mileage to ${mileageValue} for Facebook minimums`);
    }
    await fillSelectOrTextField(
      ["mileage", "odometer"],
      mileageValue,
      results,
      "Filled mileage",
      "Could not find mileage field"
    );

    await fillTextField(["description"], dealerDraft.description || "", results, "Filled description", "Could not find description field");

    scrollFieldIntoView(["clean title"]);
    await ensureCheckboxChecked(
      ["clean title"],
      vehicle.clean_title !== false,
      results,
      "Checked clean title",
      "Could not find clean title checkbox"
    );

    const conditionOptions = conditionCandidates(vehicle.marketplace_condition || vehicle.condition || "Very Good");

    scrollFieldIntoView(["condition"]);
    await fillSelectOrTextField(
      ["condition"],
      conditionOptions[0] || "Very Good",
      results,
      "Filled condition",
      "Could not find condition field",
      conditionOptions.slice(1)
    );

    scrollFieldIntoView(["fuel type"]);
    await fillAdditionalVehicleDetails(vehicle, results);

    const warningLines = [];
    if (Array.isArray(dealerDraft.images) && dealerDraft.images.length) {
      const uploadResult = await uploadImages(dealerDraft.images);
      if (uploadResult.ok) {
        const finalPhotoCount = Math.max(uploadResult.photoCount || 0, uploadResult.uploaded);
        results.push(`Uploaded ${finalPhotoCount} photo${finalPhotoCount === 1 ? "" : "s"}`);
      } else {
        if (uploadResult.fetchError) {
          warningLines.push(`Photo download issue: ${uploadResult.fetchError}`);
        }
        warningLines.push(`Images found on vehicle page: ${dealerDraft.images.length}`);
        warningLines.push(`Photo input accepted ${uploadResult.assignedCount || 0} file${uploadResult.assignedCount === 1 ? "" : "s"}, but Facebook still shows ${uploadResult.photoCount || 0} photo${uploadResult.photoCount === 1 ? "" : "s"}.`);
      }
    }

    let snapshot = getFormSnapshot();
    if (!snapshot.vehicleType) {
      const vehicleTypeRetry = await pickVehicleType(vehicle.body_style || "Sedan");
      results.push(vehicleTypeRetry ? "Retried vehicle type" : "Vehicle type stayed blank");
      snapshot = getFormSnapshot();
    }
    if (!snapshot.price && dealerDraft.price) {
      await fillTextField(["price", "asking price"], dealerDraft.price, results, "Retried price", "Price stayed blank");
      snapshot = getFormSnapshot();
    }
    if (!snapshot.year && vehicle.year) {
      await fillSelectOrTextField(["year"], vehicle.year, results, "Retried year", "Year stayed blank");
      snapshot = getFormSnapshot();
    }
    if (!snapshot.make && vehicle.make) {
      await fillSelectOrTextField(["make"], vehicle.make, results, "Retried make", "Make stayed blank");
      snapshot = getFormSnapshot();
    }
    if (!snapshot.model && modelValue) {
      await fillSelectOrTextField(["model"], modelValue, results, "Retried model", "Model stayed blank");
      snapshot = getFormSnapshot();
    }
    if (!snapshot.mileage && mileageValue) {
      await fillSelectOrTextField(["mileage", "odometer"], mileageValue, results, "Retried mileage", "Mileage stayed blank");
      snapshot = getFormSnapshot();
    }
    if (!snapshot.description && dealerDraft.description) {
      await fillTextField(["description"], dealerDraft.description, results, "Retried description", "Description stayed blank");
      snapshot = getFormSnapshot();
    }
    if (!snapshot.bodyStyle) {
      const bodyStyleOptions = bodyStyleCandidates(vehicle.body_style || "Sedan");
      await fillSelectField(
        ["body style"],
        bodyStyleOptions[0] || "Sedan",
        results,
        "Retried body style",
        "Body style stayed blank",
        bodyStyleOptions.slice(1)
      );
      snapshot = getFormSnapshot();
    }
    if (!snapshot.cleanTitle) {
      await ensureCheckboxChecked(
        ["clean title"],
        true,
        results,
        "Retried clean title",
        "Clean title still did not check"
      );
      snapshot = getFormSnapshot();
    }
    if (!snapshot.fuelType) {
      const fuelCandidates = fuelTypeCandidates(vehicle.fuel_type || "");
      await fillSelectField(
        ["fuel type"],
        fuelCandidates[0] || "",
        results,
        "Retried fuel type",
        "Fuel type stayed blank",
        fuelCandidates.slice(1)
      );
      snapshot = getFormSnapshot();
    }
    if (!snapshot.condition) {
      await fillSelectOrTextField(
        ["condition"],
        conditionOptions[0] || "Very Good",
        results,
        "Retried condition",
        "Condition stayed blank",
        conditionOptions.slice(1)
      );
      snapshot = getFormSnapshot();
    }
    if (!snapshot.transmission && vehicle.transmission) {
      await fillSelectField(
        ["transmission"],
        vehicle.transmission,
        results,
        "Retried transmission",
        "Transmission stayed blank"
      );
      snapshot = getFormSnapshot();
    }
    const missingBeforeNext = missingSnapshotFields(snapshot);
    if (missingBeforeNext.length) {
      warningLines.push(`Still missing before Next: ${missingBeforeNext.join(", ")}`);
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
