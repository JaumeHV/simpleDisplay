import { PanelBase, escapeHtml } from "./PanelBase.js";

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
  { id: "category", label: "Category" },
  { id: "name", label: "Name" },
  { id: "value", label: "Value" }
];

export class InventoryPanel extends PanelBase {
  static panelId = "inventory";
  static panelLabel = "Inventory";
  static panelIcon = "fas fa-box";

  constructor(display) {
    super(display);
    this._containerEl = null;
    this._actor = null;
    this._allItems = [];
    this._searchTerm = "";
    this._sortMode = "category";
  }

  async render(actor, containerEl) {
    this._containerEl = containerEl;
    this._actor = actor;
    this._allItems = actor.items.filter(i => INVENTORY_TYPES.includes(i.type));

    const currency = actor.system.currency ?? {};

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
        </div>

        <div class="sd-inv-currency">
          <span class="sd-inv-currency-item"><i class="fas fa-coins"></i> ${currency.pp ?? 0} PP</span>
          <span class="sd-inv-currency-item">${currency.gp ?? 0} GP</span>
          <span class="sd-inv-currency-item">${currency.ep ?? 0} EP</span>
          <span class="sd-inv-currency-item">${currency.sp ?? 0} SP</span>
          <span class="sd-inv-currency-item">${currency.cp ?? 0} CP</span>
        </div>

        <div class="sd-inv-scroll" id="sd-inv-scroll"></div>

        <div class="sd-inv-footer" id="sd-inv-footer"></div>
      </div>
    `;

    this._renderItems();

    containerEl.querySelector(".sd-inv-search-input")?.addEventListener("input", (e) => {
      this._searchTerm = e.target.value;
      this._renderItems();
    });

    containerEl.querySelector(".sd-inv-sort")?.addEventListener("change", (e) => {
      this._sortMode = e.target.value;
      this._renderItems();
    });
  }

  _renderItems() {
    const scrollEl = this._containerEl?.querySelector("#sd-inv-scroll");
    const footerEl = this._containerEl?.querySelector("#sd-inv-footer");
    if (!scrollEl || !footerEl) return;

    let items = this._allItems;

    if (this._searchTerm) {
      const term = this._searchTerm.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(term));
    }

    if (this._sortMode === "category") {
      items = [...items].sort((a, b) => a.name.localeCompare(b.name));
    } else if (this._sortMode === "name") {
      items = [...items].sort((a, b) => a.name.localeCompare(b.name));
    } else if (this._sortMode === "value") {
      items = [...items].sort((a, b) => (b.system.price?.value ?? 0) - (a.system.price?.value ?? 0));
    }

    const groups = {};
    for (const item of items) {
      (groups[item.type] ??= []).push(item);
    }

    const groupKeys = this._sortMode === "category"
      ? INVENTORY_TYPES.filter(t => groups[t])
      : Object.keys(groups);
    let totalItems = 0;
    let totalWeight = 0;
    let groupsHtml = "";

    for (const type of groupKeys) {
      const typeItems = groups[type];
      const label = TYPE_LABELS[type] ?? type;

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

        itemsHtml += `<div class="sd-inv-item">
          <img class="sd-inv-item-icon" src="${icon}" alt="${name}" loading="lazy" />
          <span class="sd-inv-item-name">${name}</span>
          <span class="sd-inv-item-qty">×${qty}</span>
          <span class="sd-inv-item-weight">${weight > 0 ? weight.toFixed(1) : "—"}</span>
          <span class="sd-inv-item-value">${value > 0 ? `${value} ${denom}` : ""}</span>
          ${canEquip ? `<button class="sd-inv-item-equip" data-item-id="${item.id}" title="${item.system.equipped ? "Unequip" : "Equip"}">
            <i class="fas ${item.system.equipped ? "fa-check-circle" : "fa-circle"}"></i>
          </button>` : ""}
          <button class="sd-inv-item-chat" data-item-id="${item.id}" title="Show in chat">
            <i class="fas fa-comment"></i>
          </button>
        </div>`;
      }

      groupsHtml += `<div class="sd-inv-group">
        <div class="sd-inv-group-header">${escapeHtml(label)} <span class="sd-inv-group-count">(${typeItems.length})</span></div>
        ${itemsHtml}
      </div>`;
    }

    scrollEl.innerHTML = groupsHtml || `<div class="sd-inv-empty">
      <i class="fas fa-box-open"></i>
      <p>${this._searchTerm ? "No items match your search" : "No items in inventory"}</p>
    </div>`;

    const encumbrance = this._actor?.system?.attributes?.encumbrance;
    const maxWeight = encumbrance?.max ?? 0;
    footerEl.innerHTML = `
      <span>${totalItems} items</span>
      <span>${totalWeight.toFixed(1)} / ${maxWeight} lb</span>
    `;

    scrollEl.querySelectorAll(".sd-inv-item-equip").forEach(btn => {
      btn.addEventListener("click", async () => {
        const item = this._actor?.items.get(btn.dataset.itemId);
        if (!item) return;
        await item.update({ "system.equipped": !item.system.equipped });
        this._allItems = this._actor.items.filter(i => INVENTORY_TYPES.includes(i.type));
        this._renderItems();
      });
    });

    scrollEl.querySelectorAll(".sd-inv-item-chat").forEach(btn => {
      btn.addEventListener("click", async () => {
        const item = this._actor?.items.get(btn.dataset.itemId);
        if (!item) return;
        await item.displayCard();
      });
    });
  }
}
