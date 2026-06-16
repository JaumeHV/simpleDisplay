import { InventoryPanel } from "./panels/InventoryPanel.js";
import { ChatPanel } from "./panels/ChatPanel.js";
import { SpellsPanel } from "./panels/SpellsPanel.js";
import { TacMapPanel } from "./panels/TacMapPanel.js";
import { TradePanel } from "./panels/TradePanel.js";
import { Panel6 } from "./panels/Panel6.js";
import { getActorId } from "./settings.js";

const PANEL_REGISTRY = {
  inventory: InventoryPanel,
  chat: ChatPanel,
  spells: SpellsPanel,
  tacmap: TacMapPanel,
  trade: TradePanel,
  panel6: Panel6
};

const NAV_BUTTONS = [
  { id: "inventory", label: "Inv", icon: "fas fa-box" },
  { id: "chat", label: "Chat", icon: "fas fa-comment-dots" },
  { id: "spells", label: "Spells", icon: "fas fa-hat-wizard" },
  { id: "tacmap", label: "TacMap", icon: "fas fa-map-marked-alt" },
  { id: "trade", label: "Trade", icon: "fas fa-handshake" },
  { id: "panel6", label: "6", icon: "fas fa-ellipsis-h" }
];

export const activeDisplays = {};

export class DisplayApp extends foundry.applications.api.ApplicationV2 {
  constructor(displayIndex, options = {}) {
    super({
      id: `simple-display-${displayIndex}`,
      window: { title: `Simple Display ${displayIndex}` },
      ...options
    });
    this.displayIndex = displayIndex;
    this.activePanel = "inventory";
    this._activePanelInstance = null;
    activeDisplays[displayIndex] = this;
  }

  static DEFAULT_OPTIONS = {
    id: "simple-display",
    window: {
      icon: "fas fa-tv",
      frame: true,
      resizable: true
    },
    position: {
      width: 1280,
      height: 800
    }
  };

  getActor() {
    const actorId = getActorId(this.displayIndex);
    if (!actorId) return null;
    return game.actors.get(actorId) ?? null;
  }

  _prepareContext() {
    const actor = this.getActor();
    return {
      displayIndex: this.displayIndex,
      activePanel: this.activePanel,
      navButtons: NAV_BUTTONS.map((btn) => ({
        ...btn,
        isActive: btn.id === this.activePanel
      })),
      portrait: actor?.img ?? "icons/svg/mystery-man.svg",
      actorName: actor?.name ?? "No Actor Assigned",
      hasActor: !!actor
    };
  }

  _renderHTML(context) {
    const { displayIndex, navButtons, portrait, actorName, hasActor } = context;

    const navHtml = navButtons.map((btn) => `
      <button class="sd-nav-btn${btn.isActive ? " active" : ""}" data-panel="${btn.id}">
        <i class="${btn.icon}"></i>
        <span>${btn.label}</span>
      </button>
    `).join("");

    return `
      <div class="sd-shell" data-display="${displayIndex}">
        <div class="sd-main">
          <div class="sd-portrait">
            <img src="${portrait}" alt="${actorName}" title="${actorName}" />
          </div>
          <div class="sd-panel-content" id="sd-panel-content-${displayIndex}">
            ${hasActor ? "" : `<div class="sd-panel-placeholder"><i class="fas fa-user-slash"></i><h2>No Actor Assigned</h2><p>Set an Actor ID in module settings.</p></div>`}
          </div>
        </div>
        <nav class="sd-nav">
          ${navHtml}
        </nav>
      </div>
    `;
  }

  _replaceHTML(result, options) {
    this.element.innerHTML = result ?? "";
  }

  _onRender(context, options) {
    const contentEl = this.element?.querySelector?.(`#sd-panel-content-${this.displayIndex}`);
    if (contentEl && context.hasActor) {
      this._renderActivePanel(contentEl);
    }
  }

  _activateListeners(htmlElement) {
    htmlElement.addEventListener("click", (event) => {
      const btn = event.target.closest(".sd-nav-btn");
      if (!btn) return;
      const panelId = btn.dataset.panel;
      if (panelId && panelId !== this.activePanel) {
        this.setPanel(panelId);
      }
    });
  }

  setPanel(panelId) {
    if (!PANEL_REGISTRY[panelId]) return;
    this.activePanel = panelId;
    this.render(false);
  }

  async _renderActivePanel(containerEl) {
    if (this._activePanelInstance) {
      this._activePanelInstance.destroy();
      this._activePanelInstance = null;
    }

    const actor = this.getActor();
    if (!actor) return;

    const PanelClass = PANEL_REGISTRY[this.activePanel];
    if (!PanelClass) return;

    this._activePanelInstance = new PanelClass(this);
    await this._activePanelInstance.render(actor, containerEl);
  }

  async close(options) {
    if (this._activePanelInstance) {
      this._activePanelInstance.destroy();
      this._activePanelInstance = null;
    }
    delete activeDisplays[this.displayIndex];
    return super.close(options);
  }
}
