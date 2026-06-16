import { InventoryPanel } from "./panels/InventoryPanel.js";
import { ChatPanel } from "./panels/ChatPanel.js";
import { SpellsPanel } from "./panels/SpellsPanel.js";
import { TacMapPanel } from "./panels/TacMapPanel.js";
import { TradePanel } from "./panels/TradePanel.js";
import { Panel6 } from "./panels/Panel6.js";
import { getActorId, isDebug } from "./settings.js";

const { ApplicationV2 } = foundry.applications.api;
const MODULE_ID = "simple-display";

function debug(...args) {
  if (isDebug()) console.log(`[${MODULE_ID}]`, ...args);
}

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

export class DisplayApp extends ApplicationV2 {
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
    debug(`DisplayApp #${displayIndex} constructed, id=simple-display-${displayIndex}`);
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
    const context = {
      displayIndex: this.displayIndex,
      activePanel: this.activePanel,
      navButtons: NAV_BUTTONS.map((btn) => ({
        ...btn,
        isActive: btn.id === this.activePanel
      })),
      portrait: this.getActor()?.img ?? "icons/svg/mystery-man.svg",
      actorName: this.getActor()?.name ?? "No Actor Assigned",
      hasActor: !!this.getActor()
    };
    debug("_prepareContext ->", context);
    return context;
  }

  _renderHTML(context) {
    const { displayIndex, navButtons, portrait, actorName, hasActor } = context;

    const navHtml = navButtons.map((btn) => `
      <button class="sd-nav-btn${btn.isActive ? " active" : ""}" data-panel="${btn.id}">
        <i class="${btn.icon}"></i>
        <span>${btn.label}</span>
      </button>
    `).join("");

    const html = `
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
    debug("_renderHTML -> html length", html.length);
    return html;
  }

  _replaceHTML(result, content, options) {
    debug("_replaceHTML called, content element:", content, "tagName:", content?.tagName, "className:", content?.className);
    debug("_replaceHTML result length:", result?.length);

    content.innerHTML = result;
    this.element = content;

    debug("_replaceHTML: this.element set to:", this.element?.tagName, "className:", this.element?.className);
    debug("_replaceHTML: content has .sd-shell?", !!content.querySelector(".sd-shell"));
    debug("_replaceHTML: content has .sd-nav?", !!content.querySelector(".sd-nav"));

    const nav = content.querySelector(".sd-nav");
    debug("_replaceHTML: .sd-nav element:", nav);

    if (nav) {
      debug("_replaceHTML: .sd-nav children count:", nav.children.length);
      for (let i = 0; i < nav.children.length; i++) {
        debug(`_replaceHTML: .sd-nav child #${i}:`, nav.children[i].tagName, "data-panel:", nav.children[i].dataset?.panel);
      }
    }

    this._activateListeners(this.element);
  }

  _activateListeners(htmlElement) {
    debug("_activateListeners called, htmlElement:", htmlElement?.tagName, htmlElement?.className);
    debug("_activateListeners: element is connected?", htmlElement?.isConnected);
    debug("_activateListeners: element parentNode:", htmlElement?.parentNode?.tagName);

    const nav = htmlElement.querySelector(".sd-nav");
    debug("_activateListeners: .sd-nav found:", !!nav);

    // Approach 1: Delegation on .sd-nav (click)
    if (nav) {
      nav.addEventListener("click", (event) => {
        debug("CLICK EVENT on .sd-nav — event.target:", event.target?.tagName, "className:", event.target?.className);
        debug("CLICK EVENT — event.target.dataset:", event.target?.dataset);
        const btn = event.target.closest(".sd-nav-btn");
        debug("CLICK EVENT — closest .sd-nav-btn:", btn);
        if (!btn) {
          debug("CLICK EVENT — no .sd-nav-btn ancestor, returning");
          return;
        }
        const panelId = btn.dataset.panel;
        debug("CLICK EVENT — btn.dataset.panel:", panelId, "current activePanel:", this.activePanel);
        if (panelId && panelId !== this.activePanel) {
          this.setPanel(panelId);
        } else if (panelId === this.activePanel) {
          debug("CLICK EVENT — already active, doing nothing");
        } else {
          debug("CLICK EVENT — no panelId, returning");
        }
      });
      debug("_activateListeners: click listener attached to .sd-nav");
    } else {
      debug("_activateListeners: WARNING — .sd-nav NOT FOUND in htmlElement!");
    }

    // Approach 2: Direct binding to each .sd-nav-btn (click)
    const allButtons = htmlElement.querySelectorAll(".sd-nav-btn");
    debug(`_activateListeners: found ${allButtons.length} .sd-nav-btn elements via querySelectorAll`);
    for (const btn of allButtons) {
      btn.addEventListener("click", (event) => {
        debug("DIRECT CLICK on button —", btn.dataset.panel, "event:", event.type);
        const panelId = btn.dataset.panel;
        if (panelId && panelId !== this.activePanel) {
          this.setPanel(panelId);
        }
      });
    }

    // Approach 3: Delegation on htmlElement itself (click)
    htmlElement.addEventListener("click", (event) => {
      const btn = event.target.closest(".sd-nav-btn");
      if (btn) {
        debug("DELEGATED CLICK on htmlElement — btn:", btn.dataset.panel);
        const panelId = btn.dataset.panel;
        if (panelId && panelId !== this.activePanel) {
          this.setPanel(panelId);
        }
      }
    });

    // Approach 4: mousedown delegation on htmlElement
    htmlElement.addEventListener("mousedown", (event) => {
      const btn = event.target.closest(".sd-nav-btn");
      if (btn) {
        debug("MOUSEDOWN on button —", btn.dataset.panel);
        const panelId = btn.dataset.panel;
        if (panelId && panelId !== this.activePanel) {
          this.setPanel(panelId);
        }
      }
    });

    debug("_activateListeners: all listeners attached");
  }

  _onRender(context, options) {
    debug("_onRender called, activePanel:", this.activePanel, "hasActor:", context?.hasActor);

    const contentEl = this.element?.querySelector?.(`#sd-panel-content-${this.displayIndex}`);
    debug("_onRender: contentEl found:", !!contentEl);

    if (contentEl && context?.hasActor) {
      debug("_onRender: rendering active panel");
      this._renderActivePanel(contentEl);
    } else {
      debug("_onRender: skipping panel render (no contentEl or no actor)");
    }
  }

  setPanel(panelId) {
    debug("setPanel called with panelId:", panelId);
    if (!PANEL_REGISTRY[panelId]) {
      debug("setPanel: no registry entry for", panelId);
      return;
    }
    debug("setPanel: switching from", this.activePanel, "to", panelId);
    this.activePanel = panelId;
    this.render(true);
    debug("setPanel: render(true) called");
  }

  async _renderActivePanel(containerEl) {
    debug("_renderActivePanel called, containerEl:", containerEl?.id);

    if (this._activePanelInstance) {
      debug("_renderActivePanel: destroying previous instance");
      this._activePanelInstance.destroy();
      this._activePanelInstance = null;
    }

    const actor = this.getActor();
    if (!actor) {
      debug("_renderActivePanel: no actor, returning");
      return;
    }

    const PanelClass = PANEL_REGISTRY[this.activePanel];
    if (!PanelClass) {
      debug("_renderActivePanel: no PanelClass for", this.activePanel);
      return;
    }

    debug("_renderActivePanel: creating new", this.activePanel, "panel instance");
    this._activePanelInstance = new PanelClass(this);
    await this._activePanelInstance.render(actor, containerEl);
    debug("_renderActivePanel: panel rendered");
  }

  async close(options) {
    debug("close called for display", this.displayIndex);
    if (this._activePanelInstance) {
      this._activePanelInstance.destroy();
      this._activePanelInstance = null;
    }
    delete activeDisplays[this.displayIndex];
    return super.close(options);
  }
}
