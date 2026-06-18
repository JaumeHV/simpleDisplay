import { InventoryPanel } from "./panels/InventoryPanel.js";
import { ChatPanel } from "./panels/ChatPanel.js";
import { SpellsPanel } from "./panels/SpellsPanel.js";
import { TacMapPanel } from "./panels/TacMapPanel.js";
import { EffectsPanel } from "./panels/EffectsPanel.js";
import { FeaturesPanel } from "./panels/FeaturesPanel.js";
import { getActorId, isDebug } from "./settings.js";

const { ApplicationV2 } = foundry.applications.api;
const MODULE_ID = "simple-display";

function debug(...args) {
  if (isDebug()) console.log(`[${MODULE_ID}]`, ...args);
}

const PANEL_REGISTRY = {
  chat: ChatPanel,
  tacmap: TacMapPanel,
  inventory: InventoryPanel,
  spells: SpellsPanel,
  effects: EffectsPanel,
  features: FeaturesPanel
};

const NAV_BUTTONS = [
  { id: "chat", label: "Chat", icon: "fas fa-comment-dots" },
  { id: "tacmap", label: "TacMap", icon: "fas fa-map-marked-alt" },
  { id: "inventory", label: "Items", icon: "fas fa-box" },
  { id: "spells", label: "Spells", icon: "fas fa-hat-wizard" },
  { id: "effects", label: "Effects", icon: "fas fa-magic" },
  { id: "features", label: "Features", icon: "fas fa-star" }
];

export const activeDisplays = {};

export class DisplayApp extends ApplicationV2 {
  constructor(displayIndex, options = {}) {
    const actorName = (() => {
      try { return game?.actors?.get(getActorId(displayIndex))?.name; } catch(e) { return null; }
    })();
    super({
      id: `simple-display-${displayIndex}`,
      window: { title: actorName ?? `Simple Display ${displayIndex}` },
      ...options
    });
    this.displayIndex = displayIndex;
    this.activePanel = "inventory";
    this._activePanelInstance = null;
    activeDisplays[displayIndex] = this;
    debug(`DisplayApp #${displayIndex} constructed`);
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

  _onClickAction(event, target) {
    const action = target.dataset.action;
    if ( action === "setPanel" ) {
      const panelId = target.dataset.panel;
      debug("_onClickAction: setPanel ->", panelId);
      if ( panelId ) this.setPanel(panelId);
    }
  }

  getActor() {
    const actorId = getActorId(this.displayIndex);
    if (!actorId) return null;
    return game.actors.get(actorId) ?? null;
  }

  _prepareContext() {
    const actor = this.getActor();
    const context = {
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
    debug("_prepareContext ->", context);
    return context;
  }

  _renderHTML(context) {
    const { displayIndex, navButtons, portrait, actorName, hasActor } = context;

    const navHtml = navButtons.map((btn) => `
      <button type="button" class="sd-nav-btn${btn.isActive ? " active" : ""}" data-action="setPanel" data-panel="${btn.id}">
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
          <div class="sd-header-bar" id="sd-header-bar-${displayIndex}"></div>
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

  _replaceHTML(result, content, options) {
    content.innerHTML = result;
  }

  _onRender(context, options) {
    debug("_onRender, activePanel:", this.activePanel, "hasActor:", context?.hasActor);
    const actor = this.getActor();
    if (actor && this.options.window?.title !== actor.name) {
      this.options.window.title = actor.name;
      const header = this.element?.querySelector?.(".window-header .window-title");
      if (header) header.textContent = actor.name;
    }
    const contentEl = this.element?.querySelector?.(`#sd-panel-content-${this.displayIndex}`);
    if (contentEl && context?.hasActor) {
      this._renderActivePanel(contentEl);
    }
  }

  setPanel(panelId) {
    if (!PANEL_REGISTRY[panelId]) {
      debug("setPanel: unknown panel", panelId);
      return;
    }
    if (panelId === this.activePanel) return;
    debug("setPanel:", this.activePanel, "->", panelId);
    this.activePanel = panelId;
    this.render(true);
  }

  async _renderActivePanel(containerEl) {
    if (this._activePanelInstance) {
      this._activePanelInstance.destroy();
      this._activePanelInstance = null;
    }

    const actor = this.getActor();
    if (!actor) return;

    const headerBar = this.element?.querySelector(`#sd-header-bar-${this.displayIndex}`);
    if (headerBar) headerBar.innerHTML = "";

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
