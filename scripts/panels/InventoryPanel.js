import { PanelBase, escapeHtml } from "./PanelBase.js";
import { isMetric } from "../settings.js";

const INVENTORY_TYPES = ["weapon", "equipment", "consumable", "tool", "loot", "container", "backpack"];

const TYPE_LABELS = {
  weapon: "Weapons",
  equipment: "Equipment",
  consumable: "Consumables",
  tool: "Tools",
  loot: "Loot",
  container: "Containers",
  backpack: "Backpacks"
};

const SORT_MODES = [
  { id: "name", label: "Name" },
  { id: "value", label: "Value" }
];

const RARITY_COLORS = {
  common: "#8a8a8a",
  uncommon: "#4ade80",
  rare: "#6aa8ff",
  veryRare: "#a855f7",
  legendary: "#fb923c",
  artifact: "#fbbf24"
};

const CURRENCY_META = [
  { key: "pp", label: "PP", color: "#e8e8e8" },
  { key: "gp", label: "GP", color: "#ffd700" },
  { key: "ep", label: "EP", color: "#4ade80" },
  { key: "sp", label: "SP", color: "#c0c0c0" },
  { key: "cp", label: "CP", color: "#b87333" }
];

const LB_TO_KG = 0.453592;

function fmtWeight(lb) {
  if (isMetric()) return (lb * LB_TO_KG).toFixed(1) + " kg";
  return lb.toFixed(1) + " lb";
}

export class InventoryPanel extends PanelBase {
  static panelId = "inventory";
  static panelLabel = "Inventory";
  static panelIcon = "fas fa-box";

  constructor(display) {
    super(display);
    this._containerEl = null;
    this._actor = null;
    this._allItems = [];
    this._containers = [];
    this._searchTerm = "";
    this._sortMode = "name";
    this._collapsedTypes = new Set();
    this._activeTypes = new Set(INVENTORY_TYPES);
    this._activeContainerId = "main";
    this._favoritesOnly = false;
    this._popupItemId = null;
    this._keyboardEl = null;
  }

  async render(actor, containerEl) {
    this._containerEl = containerEl;
    this._actor = actor;
    this._allItems = actor.items.filter(i => INVENTORY_TYPES.includes(i.type));
    this._containers = this._allItems.filter(i => i.type === "container" || i.type === "backpack");

    containerEl.innerHTML = `
      <div class="sd-inv-panel">
        <div class="sd-inv-toolbar">
          <select class="sd-inv-sort">
            ${SORT_MODES.map(m => `<option value="${m.id}" ${this._sortMode === m.id ? "selected" : ""}>${escapeHtml(m.label)}</option>`).join("")}
          </select>
          <div class="sd-inv-search">
            <i class="fas fa-search"></i>
            <input type="text" class="sd-inv-search-input" placeholder="Search..." value="${escapeHtml(this._searchTerm)}" />
          </div>
          <button type="button" class="sd-inv-trade-btn" title="Open trade window">
            <i class="fas fa-handshake"></i>
          </button>
        </div>

        <div class="sd-inv-currency" id="sd-inv-currency">
          ${this._renderCurrency()}
        </div>

        <div class="sd-inv-type-filters" id="sd-inv-type-filters">
          <button class="sd-inv-type-pill ${this._favoritesOnly ? "active" : ""} pill-fav" data-filter="favorites"><i class="fas fa-star"></i> Fav</button>
          ${INVENTORY_TYPES.map(t => `<button class="sd-inv-type-pill ${this._activeTypes.has(t) ? "active" : ""}" data-type="${t}">${escapeHtml(TYPE_LABELS[t])}</button>`).join("")}
        </div>

        <div class="sd-inv-scroll" id="sd-inv-scroll"></div>

        <div class="sd-inv-footer" id="sd-inv-footer"></div>
      </div>
    `;

    const scrollEl = containerEl.querySelector("#sd-inv-scroll");
    this._renderHeaderBar();
    this._renderItems();

    containerEl.querySelector(".sd-inv-search-input")?.addEventListener("input", (e) => {
      this._searchTerm = e.target.value;
      this._popupItemId = null;
      this._renderItems();
    });

    containerEl.querySelector(".sd-inv-sort")?.addEventListener("change", (e) => {
      this._sortMode = e.target.value;
      this._renderItems();
    });

    containerEl.querySelector(".sd-inv-trade-btn")?.addEventListener("click", () => {
      ui.notifications.info("Trade window — placeholder");
    });

    containerEl.querySelector("#sd-inv-currency")?.addEventListener("click", (e) => {
      const currSpan = e.target.closest(".sd-inv-currency-item");
      if (!currSpan || currSpan.querySelector("input")) return;
      const key = currSpan.dataset.curr;
      if (!key) return;
      this._startEditCurrency(key, currSpan);
    });

    containerEl.querySelector("#sd-inv-type-filters")?.addEventListener("click", (e) => {
      const pill = e.target.closest(".sd-inv-type-pill");
      if (!pill) return;
      if (pill.dataset.filter === "favorites") {
        this._favoritesOnly = !this._favoritesOnly;
      } else {
        const type = pill.dataset.type;
        if (!this._activeTypes.delete(type)) this._activeTypes.add(type);
      }
      this._renderItems();
    });

    containerEl.querySelector(".sd-inv-panel")?.addEventListener("pointerdown", (e) => {
      if (this._popupItemId && !e.target.closest(".sd-inv-popup")) {
        this._closePopup();
      }
    });

    if (scrollEl && !scrollEl._sdListener) {
      scrollEl._sdListener = true;
      scrollEl.addEventListener("click", (e) => {
        const header = e.target.closest(".sd-inv-group-header");
        const btn = e.target.closest("button");
        const qtySpan = e.target.closest("[data-qty-edit]");
        const itemRow = e.target.closest(".sd-inv-item");

        if (header) {
          const type = header.dataset.type;
          if (!type) return;
          const group = header.closest(".sd-inv-group");
          this._collapsedTypes.has(type) ? this._collapsedTypes.delete(type) : this._collapsedTypes.add(type);
          group?.classList.toggle("collapsed");
          return;
        }

        if (qtySpan) {
          this._startEditQuantity(qtySpan.dataset.itemId);
          return;
        }

        if (btn) {
          const itemId = btn.dataset.itemId;
          if (!itemId) return;
          if (btn.classList.contains("sd-inv-item-fav-btn")) {
            this._toggleFavorite(itemId);
            return;
          }
          const item = this._actor?.items.get(itemId);
          if (!item) return;
          if (btn.classList.contains("sd-inv-item-equip")) {
            item.update({ "system.equipped": !item.system.equipped }).then(() => {
              this._allItems = this._actor.items.filter(i => INVENTORY_TYPES.includes(i.type));
              this._renderItems();
            });
          } else if (btn.classList.contains("sd-inv-item-chat")) {
            item.displayCard();
          } else if (btn.classList.contains("sd-inv-item-use")) {
            try { item.use({ legacy: false }); } catch(e) {}
          }
          return;
        }

        if (itemRow) {
          const itemId = itemRow.dataset.itemId;
          if (itemId) {
            this._popupItemId === itemId ? this._closePopup() : this._showPopup(itemId);
          }
        }
      });

      scrollEl.addEventListener("dragstart", (e) => {
        const row = e.target.closest(".sd-inv-item");
        if (row) {
          e.dataTransfer.setData("text/plain", row.dataset.itemId);
          e.dataTransfer.effectAllowed = "move";
          row.classList.add("dragging");
        }
      });

      scrollEl.addEventListener("dragend", (e) => {
        document.querySelectorAll(".sd-inv-item.dragging").forEach(el => el.classList.remove("dragging"));
        document.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
      });

      scrollEl.addEventListener("dragover", (e) => {
        const target = e.target.closest("[data-drop-container]");
        if (target) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; target.classList.add("drag-over"); }
      });

      scrollEl.addEventListener("dragleave", (e) => {
        const target = e.target.closest("[data-drop-container]");
        if (target) target.classList.remove("drag-over");
      });

      scrollEl.addEventListener("drop", (e) => {
        const target = e.target.closest("[data-drop-container]");
        if (!target) return;
        e.preventDefault();
        target.classList.remove("drag-over");
        const itemId = e.dataTransfer.getData("text/plain");
        const targetId = target.dataset.containerId || target.dataset.itemId;
        if (!itemId || !targetId || itemId === targetId) return;
        this._moveItemToContainer(itemId, targetId);
      });
    }
  }

  _moveItemToContainer(itemId, containerId) {
    const item = this._actor?.items.get(itemId);
    if (!item) return;
    const containerRef = containerId === "main" ? null : (this._actor.items.get(containerId)?.id ?? null);
    item.update({ "system.container": containerRef }).then(() => {
      this._allItems = this._actor.items.filter(i => INVENTORY_TYPES.includes(i.type));
      this._containers = this._allItems.filter(i => i.type === "container" || i.type === "backpack");
      this._renderHeaderBar();
      this._renderItems();
    });
  }

  _renderCurrency() {
    const currency = this._actor?.system?.currency ?? {};
    return CURRENCY_META.map(({ key, label, color }) =>
      `<span class="sd-inv-currency-item" data-curr="${key}">
        <i class="fas fa-coins" style="color:${color}"></i> ${currency[key] ?? 0} ${label}
      </span>`
    ).join("");
  }

  _startEditCurrency(key, spanEl) {
    this._hideKeyboard();
    const currentValue = this._actor?.system?.currency?.[key] ?? 0;
    const meta = CURRENCY_META.find(c => c.key === key);
    spanEl.innerHTML = `<i class="fas fa-coins" style="color:${meta?.color}"></i>
      <input type="number" class="sd-curr-edit" value="${currentValue}" step="1" min="0" />`;
    const input = spanEl.querySelector("input");
    if (!input) return;
    this._showNumpad(input);
    input.focus();
    input.select();
    const finish = async (save) => {
      if (save) {
        const newVal = parseInt(input.value) || 0;
        try { await this._actor?.update({ [`system.currency.${key}`]: newVal }); } catch(e) {}
      }
      this._hideKeyboard();
      const currBar = this._containerEl?.querySelector("#sd-inv-currency");
      if (currBar) currBar.innerHTML = this._renderCurrency();
    };
    input.addEventListener("blur", () => finish(true));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
  }

  _startEditQuantity(itemId) {
    const item = this._actor?.items.get(itemId);
    if (!item) return;
    const scrollEl = this._containerEl?.querySelector("#sd-inv-scroll");
    if (!scrollEl) return;
    const itemRow = scrollEl.querySelector(`.sd-inv-item[data-item-id="${itemId}"]`);
    if (!itemRow) return;
    const qtySpan = itemRow.querySelector("[data-qty-edit]");
    if (!qtySpan) return;
    const currentQty = item.system.quantity ?? 1;
    qtySpan.innerHTML = `<input type="number" class="sd-qty-edit" value="${currentQty}" min="0" step="1" />`;
    const input = qtySpan.querySelector("input");
    if (!input) return;
    this._showNumpad(input);
    input.focus();
    input.select();
    const finish = async (save) => {
      this._hideKeyboard();
      if (save) {
        const newVal = parseInt(input.value);
        if (isNaN(newVal) || newVal === currentQty) {
          this._renderItems();
          return;
        }
        if (newVal <= 0) {
          const confirmed = await this._confirmRemove(item.name);
          if (confirmed) {
            await item.delete();
          } else {
            await item.update({ "system.quantity": 0 });
          }
        } else {
          await item.update({ "system.quantity": newVal });
        }
      }
      this._allItems = this._actor.items.filter(i => INVENTORY_TYPES.includes(i.type));
      this._renderItems();
    };
    input.addEventListener("blur", () => finish(true));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
  }

  _confirmRemove(itemName) {
    return new Promise((resolve) => {
      const panel = this._containerEl?.querySelector(".sd-inv-panel");
      if (!panel) { resolve(false); return; }
      const overlay = document.createElement("div");
      overlay.className = "sd-confirm-overlay";
      overlay.innerHTML = `<div class="sd-confirm-dialog">
        <p>Remove <strong>${escapeHtml(itemName)}</strong> from inventory?</p>
        <div class="sd-confirm-actions">
          <button type="button" class="sd-confirm-yes">Remove</button>
          <button type="button" class="sd-confirm-no">Keep (0 qty)</button>
        </div>
      </div>`;
      overlay.querySelector(".sd-confirm-yes")?.addEventListener("click", () => {
        overlay.remove(); resolve(true);
      });
      overlay.querySelector(".sd-confirm-no")?.addEventListener("click", () => {
        overlay.remove(); resolve(false);
      });
      panel.appendChild(overlay);
    });
  }

  _hideKeyboard() {
    if (this._keyboardEl) {
      this._keyboardEl.remove();
      this._keyboardEl = null;
    }
  }

  _showNumpad(inputEl) {
    this._hideKeyboard();
    const panel = this._containerEl?.querySelector(".sd-inv-panel");
    if (!panel) return;
    const kbd = document.createElement("div");
    kbd.className = "sd-kbd";
    const isFloat = inputEl.getAttribute("step")?.includes(".");
    const layout = [
      ["1","2","3"],
      ["4","5","6"],
      ["7","8","9"],
      [isFloat ? "." : "⌫","0","✓"]
    ];
    for (const row of layout) {
      const r = document.createElement("div");
      r.className = "sd-kbd-row";
      for (const key of row) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = key === "⌫" ? "⌫" : key === "✓" ? "OK" : key;
        btn.className = "sd-kbd-btn" + (key === "✓" ? " sd-kbd-confirm" : "") + (key === "⌫" ? " sd-kbd-bksp" : "");
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          if (key === "✓") {
            inputEl.blur();
          } else if (key === "⌫") {
            inputEl.value = inputEl.value.slice(0, -1);
            inputEl.dispatchEvent(new Event("input", { bubbles: true }));
          } else if (key === "." && !isFloat) {
            // ignore decimal when not a float field
          } else {
            const selStart = inputEl.selectionStart ?? inputEl.value.length;
            const selEnd = inputEl.selectionEnd ?? inputEl.value.length;
            const before = inputEl.value.slice(0, selStart);
            const after = inputEl.value.slice(selEnd);
            if (key === "." && before.includes(".")) return;
            inputEl.value = before + key + after;
            const newPos = selStart + key.length;
            inputEl.setSelectionRange(newPos, newPos);
            inputEl.dispatchEvent(new Event("input", { bubbles: true }));
          }
        });
        r.appendChild(btn);
      }
      kbd.appendChild(r);
    }
    panel.appendChild(kbd);
    this._keyboardEl = kbd;
  }

  _getContainerItems(containerId) {
    if (containerId === "main") {
      return this._allItems.filter(i => !i.system.container);
    }
    const container = this._actor?.items.get(containerId);
    if (!container) return [];
    return this._allItems.filter(i => i.system.container === container.id);
  }

  _getContainerWeight(containerId) {
    if (containerId === "main") {
      const enc = this._actor?.system?.attributes?.encumbrance;
      return { current: enc?.value ?? 0, max: enc?.max ?? 0 };
    }
    const container = this._actor?.items.get(containerId);
    if (!container) return { current: 0, max: 0 };
    const items = this._allItems.filter(i => i.system.container === container.id);
    let current = 0;
    for (const item of items) {
      current += (item.system.weight?.value ?? 0) * (item.system.quantity ?? 1);
    }
    const max = container.system.capacity?.value ?? 0;
    return { current, max };
  }

  _renderHeaderBar() {
    const headerBar = document.getElementById(`sd-header-bar-${this.display.displayIndex}`);
    if (!headerBar) return;
    headerBar.innerHTML = this._renderContainerBar();
    if (!headerBar._sdEventsAdded) {
      headerBar._sdEventsAdded = true;
      headerBar.addEventListener("click", (e) => {
        const btn = e.target.closest(".sd-inv-container-btn");
        if (!btn) return;
        const cid = btn.dataset.containerId;
        if (!cid || cid === this._activeContainerId) return;
        this._activeContainerId = cid;
        this._popupItemId = null;
        this._renderHeaderBar();
        this._renderItems();
      });
      headerBar.addEventListener("dragover", (e) => {
        const target = e.target.closest(".sd-inv-container-btn");
        if (target) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; target.classList.add("drag-over"); }
      });
      headerBar.addEventListener("dragleave", (e) => {
        const target = e.target.closest(".sd-inv-container-btn");
        if (target) target.classList.remove("drag-over");
      });
      headerBar.addEventListener("drop", (e) => {
        const target = e.target.closest(".sd-inv-container-btn");
        if (!target) return;
        e.preventDefault();
        target.classList.remove("drag-over");
        const itemId = e.dataTransfer.getData("text/plain");
        const targetId = target.dataset.containerId;
        if (!itemId || !targetId || itemId === targetId) return;
        this._moveItemToContainer(itemId, targetId);
      });
    }
  }

  _renderContainerBar() {
    let html = `<button class="sd-inv-container-btn ${this._activeContainerId === "main" ? "active" : ""}" data-container-id="main" data-drop-container="true" title="Main Inventory">
      <i class="fas fa-box" style="font-size:28px;color:var(--sd-text-muted)"></i>
      <span class="sd-inv-container-label">Main</span>
      ${this._weightBarHtml("main")}
    </button>`;
    for (const container of this._containers) {
      const active = this._activeContainerId === container.id;
      const name = escapeHtml(container.name);
      const img = escapeHtml(container.img || "icons/svg/mystery-man.svg");
      html += `<button class="sd-inv-container-btn ${active ? "active" : ""}" data-container-id="${container.id}" data-drop-container="true" title="${name}">
        <img src="${img}" alt="${name}" />
        <span class="sd-inv-container-label">${name}</span>
        ${this._weightBarHtml(container.id)}
      </button>`;
    }
    return html;
  }

  _weightBarHtml(containerId) {
    const { current, max } = this._getContainerWeight(containerId);
    const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
    const color = pct >= 90 ? "#ff6b6b" : pct >= 75 ? "#fb923c" : "#4ade80";
    return `<div class="sd-inv-weight-bar">
      <div class="sd-inv-weight-fill" style="width:${pct.toFixed(0)}%;background:${color}"></div>
    </div>
    <span class="sd-inv-weight-text">${fmtWeight(current)} / ${fmtWeight(max)}</span>`;
  }

  _toggleFavorite(itemId) {
    const item = this._actor?.items.get(itemId);
    if (!item) return;
    const current = item.getFlag("simple-display", "favorite");
    item.setFlag("simple-display", "favorite", !current).then(() => this._renderItems());
  }

  _isFavorite(item) {
    return item.getFlag("simple-display", "favorite") === true;
  }

  _closePopup() {
    const panel = this._containerEl?.querySelector(".sd-inv-panel");
    if (panel) {
      const popup = panel.querySelector(".sd-inv-popup");
      if (popup) popup.remove();
    }
    this._popupItemId = null;
  }

  _showPopup(itemId) {
    this._closePopup();
    this._popupItemId = itemId;
    const item = this._actor?.items.get(itemId);
    if (!item) return;
    const panel = this._containerEl?.querySelector(".sd-inv-panel");
    if (!panel) return;

    const name = escapeHtml(item.name);
    const icon = escapeHtml(item.img || "icons/svg/mystery-man.svg");
    const desc = item.system.description?.value ?? "<p><em>No description</em></p>";
    const rarity = item.system.rarity;
    const rarityLabel = rarity ? (game.i18n ? game.i18n.localize(CONFIG?.DND5E?.itemRarity?.[rarity] ?? rarity) : rarity) : null;

    const popup = document.createElement("div");
    popup.className = "sd-inv-popup";
    popup.addEventListener("pointerdown", (e) => e.stopPropagation());

    let headerHtml = `<div class="sd-inv-popup-header">
      <img src="${icon}" alt="${name}" />
      <span class="sd-inv-popup-title">${name}</span>
      <button type="button" class="sd-inv-popup-close" title="Close">&times;</button>
    </div>`;
    if (rarityLabel) {
      headerHtml = `<div class="sd-inv-popup-header" style="border-left:3px solid ${RARITY_COLORS[rarity] || "transparent"}">
        <img src="${icon}" alt="${name}" />
        <span class="sd-inv-popup-title">${name} <span style="font-size:11px;font-weight:400;color:${RARITY_COLORS[rarity] || "var(--sd-text-dim)"}">(${rarityLabel})</span></span>
        <button type="button" class="sd-inv-popup-close" title="Close">&times;</button>
      </div>`;
    }

    popup.innerHTML = headerHtml + `<div class="sd-inv-popup-body">${desc}</div>`;
    popup.querySelector(".sd-inv-popup-close")?.addEventListener("click", () => this._closePopup());
    panel.appendChild(popup);

    const scrollEl = panel.querySelector("#sd-inv-scroll");
    if (scrollEl) {
      const scrollRect = scrollEl.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const offsetTop = scrollRect.top - panelRect.top + 10;
      popup.style.position = "absolute";
      popup.style.top = Math.min(offsetTop, panel.clientHeight - 420) + "px";
      popup.style.left = "10px";
      popup.style.maxWidth = Math.min(320, panel.clientWidth - 20) + "px";
    }
  }

  _renderItems() {
    const scrollEl = this._containerEl?.querySelector("#sd-inv-scroll");
    const footerEl = this._containerEl?.querySelector("#sd-inv-footer");
    const filterEl = this._containerEl?.querySelector("#sd-inv-type-filters");
    if (!scrollEl || !footerEl || !filterEl) return;

    filterEl.querySelectorAll(".sd-inv-type-pill").forEach(pill => {
      if (pill.dataset.filter === "favorites") {
        pill.classList.toggle("active", this._favoritesOnly);
      } else if (pill.dataset.type) {
        pill.classList.toggle("active", this._activeTypes.has(pill.dataset.type));
      }
    });

    let items;
    if (this._favoritesOnly) {
      items = this._allItems.filter(i => this._isFavorite(i));
    } else {
      items = this._getContainerItems(this._activeContainerId);
    }

    if (this._searchTerm) {
      const term = this._searchTerm.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(term));
    }

    const groups = {};
    for (const item of items) {
      (groups[item.type] ??= []).push(item);
    }

    const groupKeys = INVENTORY_TYPES.filter(t => groups[t] && this._activeTypes.has(t));
    let totalItems = 0;
    let totalWeight = 0;
    let groupsHtml = "";

    for (const type of groupKeys) {
      let typeItems = groups[type];
      const label = TYPE_LABELS[type] ?? type;

      if (this._sortMode === "name") {
        typeItems = [...typeItems].sort((a, b) => a.name.localeCompare(b.name));
      } else if (this._sortMode === "value") {
        typeItems = [...typeItems].sort((a, b) => (b.system.price?.value ?? 0) - (a.system.price?.value ?? 0));
      }

      let itemsHtml = "";
      for (const item of typeItems) {
        const qty = item.system.quantity ?? 1;
        const weight = (item.system.weight?.value ?? 0) * qty;
        totalItems += qty;
        totalWeight += weight;

        const icon = escapeHtml(item.img || "icons/svg/mystery-man.svg");
        const name = escapeHtml(item.name);
        const value = item.system.price?.value ?? 0;
        const denom = item.system.price?.denomination ?? "gp";
        const canEquip = "equipped" in (item.system ?? {});
        const rarity = item.system.rarity;
        const rarityColor = RARITY_COLORS[rarity] ?? null;

        const attunement = item.system.attunement;
        const attuned = item.system.attuned;
        let attIcon = "";
        if (attuned) {
          attIcon = `<i class="fas fa-sun" style="color:#ffd700" title="Attuned"></i>`;
        } else if (attunement === "required") {
          attIcon = `<i class="fas fa-sun" style="color:#fb923c;opacity:0.6" title="Requires Attunement"></i>`;
        } else if (attunement === "optional") {
          attIcon = `<i class="fas fa-sun" style="color:#6aa8ff;opacity:0.5" title="Optional Attunement"></i>`;
        }

        const hasActivation = item.system.activation?.type;
        const hasActivities = item.system.activities?.length > 0;
        const showUse = type === "consumable" || hasActivation || hasActivities;

        const desc = item.system.description?.value ?? "";
        const plainDesc = desc.replace(/<[^>]*>/g, "").trim();
        const tooltip = plainDesc
          ? escapeHtml(plainDesc.substring(0, 200) + (plainDesc.length > 200 ? "…" : ""))
          : null;

        const rarityCls = rarityColor ? ` rarity-${rarity}` : "";
        const isContainer = type === "container" || type === "backpack";
        const isFav = this._isFavorite(item);
        const highlighted = this._popupItemId === item.id;

        itemsHtml += `<div class="sd-inv-item${highlighted ? " sd-inv-item-highlight" : ""}" data-item-id="${item.id}"${isContainer ? ` data-drop-container="true"` : ""} draggable="true"${tooltip ? ` title="${tooltip}"` : ""}>
          <span class="sd-inv-item-fav">
            <button type="button" class="sd-inv-item-fav-btn" data-item-id="${item.id}" title="${isFav ? "Unfavorite" : "Favorite"}">
              <i class="fas fa-star${isFav ? " fav-on" : ""}"></i>
            </button>
          </span>
          <span class="sd-inv-item-icon-wrap">
            <img class="sd-inv-item-icon${rarityCls}" src="${icon}" alt="${name}" loading="lazy" />
          </span>
          <span class="sd-inv-item-name">${name}</span>
          <span class="sd-inv-item-qty" data-qty-edit="${item.id}" title="Tap to edit quantity">×${qty}</span>
          <span class="sd-inv-item-weight">${weight > 0 ? fmtWeight(weight) : "—"}</span>
          <span class="sd-inv-item-value">${value > 0 ? `${value} ${denom}` : ""}</span>
          ${attIcon ? `<span class="sd-inv-item-att">${attIcon}</span>` : `<span class="sd-inv-item-att"></span>`}
          <span class="sd-inv-item-actions">
            ${showUse ? `<button class="sd-inv-item-use" data-item-id="${item.id}" title="Use item"><i class="fas fa-bolt"></i></button>` : ""}
            ${canEquip ? `<button class="sd-inv-item-equip" data-item-id="${item.id}" title="${item.system.equipped ? "Unequip" : "Equip"}">
              <i class="fas ${item.system.equipped ? "fa-check-circle" : "fa-circle"}"></i>
            </button>` : ""}
            <button class="sd-inv-item-chat" data-item-id="${item.id}" title="Show in chat">
              <i class="fas fa-comment"></i>
            </button>
          </span>
        </div>`;
      }

      const collapsed = this._collapsedTypes.has(type);
      groupsHtml += `<div class="sd-inv-group${collapsed ? " collapsed" : ""}">
        <div class="sd-inv-group-header" data-type="${type}">${escapeHtml(label)} <span class="sd-inv-group-count">(${typeItems.length})</span></div>
        ${itemsHtml}
      </div>`;
    }

    scrollEl.innerHTML = groupsHtml || `<div class="sd-inv-empty">
      <i class="fas fa-box-open"></i>
      <p>${this._searchTerm ? "No items match your search" : "No items in inventory"}</p>
    </div>`;

    const { current, max } = this._getContainerWeight(this._activeContainerId);
    footerEl.innerHTML = `
      <span>${totalItems} items</span>
      <span>${fmtWeight(current)} / ${fmtWeight(max)}</span>
    `;
  }
}
