import { PanelBase, escapeHtml } from "./PanelBase.js";

const MAX_MESSAGES = 60;

export class ChatPanel extends PanelBase {
  static panelId = "chat";
  static panelLabel = "Chat";
  static panelIcon = "fas fa-comment-dots";

  constructor(display) {
    super(display);
    this._containerEl = null;
    this._actor = null;
    this._hookId = null;
    this._updateHookId = null;
    this._filter = "all";
    this._autoScroll = true;
  }

  async render(actor, containerEl) {
    this._containerEl = containerEl;
    this._actor = actor;

    containerEl.innerHTML = `
      <div class="sd-chat-panel">
        <div class="sd-chat-toolbar">
          <div class="sd-chat-filters">
            <button class="sd-chat-filter-pill active" data-filter="all">All</button>
            <button class="sd-chat-filter-pill" data-filter="chat">Chat</button>
            <button class="sd-chat-filter-pill" data-filter="roll">Rolls</button>
            <button class="sd-chat-filter-pill" data-filter="combat">Combat</button>
            <button class="sd-chat-filter-pill" data-filter="whisper">Whisper</button>
          </div>
          <button class="sd-chat-scroll-btn" id="sd-chat-scroll-toggle" title="Auto-scroll">
            <i class="fas fa-arrow-down"></i>
          </button>
        </div>
        <div class="sd-chat-scroll" id="sd-chat-scroll"></div>
      </div>
    `;

    const scrollEl = containerEl.querySelector("#sd-chat-scroll");
    this._rebuild();

    if (scrollEl) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
      scrollEl.addEventListener("scroll", () => {
        const atBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 50;
        this._autoScroll = atBottom;
        const toggle = containerEl.querySelector("#sd-chat-scroll-toggle");
        if (toggle) toggle.classList.toggle("active", atBottom);
      });
    }

    containerEl.querySelector("#sd-chat-scroll-toggle")?.addEventListener("click", () => {
      this._autoScroll = true;
      const el = containerEl.querySelector("#sd-chat-scroll");
      if (el) el.scrollTop = el.scrollHeight;
    });

    containerEl.querySelector(".sd-chat-filters")?.addEventListener("click", (e) => {
      const pill = e.target.closest(".sd-chat-filter-pill");
      if (!pill) return;
      this._filter = pill.dataset.filter;
      containerEl.querySelectorAll(".sd-chat-filter-pill").forEach(p => p.classList.toggle("active", p.dataset.filter === this._filter));
      this._rebuild();
    });

    this._hookId = Hooks.on("createChatMessage", () => this._rebuild(true));
    this._updateHookId = Hooks.on("updateChatMessage", () => this._rebuild(false));
  }

  _rebuild(scrollToBottom = false) {
    if (!this._containerEl) return;
    const scrollEl = this._containerEl.querySelector("#sd-chat-scroll");
    if (!scrollEl) return;

    const messages = game.messages?.contents ?? [];
    const filtered = this._filter === "all" ? messages : messages.filter(m => this._matchesFilter(m));
    const recent = filtered.slice(-MAX_MESSAGES);

    scrollEl.innerHTML = "";

    if (!recent.length) {
      scrollEl.innerHTML = `<div class="sd-chat-empty">
        <i class="fas fa-comment-dots"></i>
        <p>No messages</p>
      </div>`;
      return;
    }

    for (const msg of recent) {
      const card = this._buildCard(msg);
      if (card) scrollEl.appendChild(card);
    }

    if (this._autoScroll || scrollToBottom) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  _getTypes() {
    return CONST?.CHAT_MESSAGE_TYPES ?? { IC: 2, OOC: 1, ROLL: 3, COMBAT: 5 };
  }

  _matchesFilter(msg) {
    const T = this._getTypes();
    switch (this._filter) {
      case "chat": return msg.type === T.OOC || msg.type === T.IC;
      case "roll": return msg.type === T.ROLL;
      case "combat": return msg.type === T.COMBAT;
      case "whisper": return msg.isWhisper;
      default: return true;
    }
  }

  /**
   * Build a chat card element. Parses the rendered message content to extract
   * the dnd5e chat-card structure (icon, title, subtitle, description, pills,
   * action buttons). Falls back to a plain text card for non-item messages.
   */
  _buildCard(msg) {
    const speaker = msg.alias || msg.speaker?.alias || msg.author?.name || "Unknown";
    const time = msg.timestamp
      ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";
    const selfCls = msg.speaker?.actor && this._actor?.id === msg.speaker.actor ? " sd-chat-card-self" : "";

    // Parse the rendered HTML content into a DOM fragment.
    const parser = document.createElement("div");
    parser.innerHTML = msg.content ?? "";
    const chatCard = parser.querySelector(".chat-card");

    const card = document.createElement("div");
    card.className = `sd-chat-card${selfCls}`;

    if (chatCard) {
      this._buildItemCard(card, msg, chatCard, speaker, time);
    } else {
      this._buildTextCard(card, msg, parser, speaker, time);
    }

    return card;
  }

  _buildItemCard(card, msg, chatCard, speaker, time) {
    const img = chatCard.querySelector(".gold-icon, img")?.getAttribute("src") || "icons/svg/mystery-man.svg";
    const title = chatCard.querySelector(".title")?.textContent?.trim() || msg.flavor || speaker;
    const subtitle = chatCard.querySelector(".subtitle")?.innerHTML?.trim() || "";
    const descEl = chatCard.querySelector(".card-content .wrapper, .card-content");
    const descHtml = descEl?.innerHTML?.trim() || "";

    // Property pills (RITUAL, V/S/M, durations, ranges, etc.)
    const pills = [...chatCard.querySelectorAll(".card-footer .pill .label, .card-footer .pill")]
      .map(p => p.textContent.trim())
      .filter(Boolean);

    // Supplement lines (e.g. Materials).
    const supplements = [...chatCard.querySelectorAll(".supplement")]
      .map(s => s.innerHTML.trim())
      .filter(Boolean);

    // Real action buttons — preserve their data-* attributes so native handlers fire.
    const buttons = [...chatCard.querySelectorAll(".card-buttons button, button[data-action]")];

    card.innerHTML = `
      <div class="sd-chat-card-thumb"><img src="${img}" alt="" loading="lazy"></div>
      <div class="sd-chat-card-content">
        <div class="sd-chat-card-head">
          <span class="sd-chat-card-title">${escapeHtml(title)}</span>
          <span class="sd-chat-card-time">${speaker ? escapeHtml(speaker) + " · " : ""}${time}</span>
        </div>
        ${subtitle ? `<div class="sd-chat-card-subtitle">${subtitle}</div>` : ""}
        ${descHtml ? `<div class="sd-chat-card-desc">${descHtml}</div>` : ""}
        ${supplements.length ? `<div class="sd-chat-card-supplements">${supplements.map(s => `<div class="sd-chat-card-supplement">${s}</div>`).join("")}</div>` : ""}
        ${pills.length ? `<div class="sd-chat-card-pills">${pills.map(p => `<span class="sd-chat-pill">${escapeHtml(p)}</span>`).join("")}</div>` : ""}
      </div>
      <div class="sd-chat-card-divider"></div>
      <div class="sd-chat-card-actions"></div>
    `;

    const actionsEl = card.querySelector(".sd-chat-card-actions");
    if (buttons.length) {
      for (const btn of buttons) {
        const clone = btn.cloneNode(true);
        clone.classList.add("sd-chat-action-btn");
        actionsEl.appendChild(clone);
      }
      // Wire up native dnd5e behavior on the cloned buttons.
      this._wireNativeListeners(msg, actionsEl);
    } else {
      actionsEl.innerHTML = `<div class="sd-chat-card-noactions">—</div>`;
    }

    // Collapsible description toggle.
    if (descHtml) {
      const titleEl = card.querySelector(".sd-chat-card-title");
      titleEl?.addEventListener("click", () => card.classList.toggle("sd-chat-card-expanded"));
    }
  }

  _buildTextCard(card, msg, parser, speaker, time) {
    const T = this._getTypes();
    const isRoll = msg.type === T.ROLL || msg.rolls?.length;
    const isWhisper = msg.isWhisper;
    const isCombat = msg.type === T.COMBAT;

    let icon, typeLabel;
    if (isRoll) { icon = "fa-dice-d20"; typeLabel = "Roll"; }
    else if (isWhisper) { icon = "fa-mask"; typeLabel = "Whisper"; }
    else if (isCombat) { icon = "fa-swords"; typeLabel = "Combat"; }
    else { icon = "fa-comment"; typeLabel = "Chat"; }

    const flavor = msg.flavor ? `<div class="sd-chat-card-subtitle">${msg.flavor}</div>` : "";
    const content = parser.innerHTML || "";

    card.innerHTML = `
      <div class="sd-chat-card-thumb"><i class="fas ${icon}"></i></div>
      <div class="sd-chat-card-content">
        <div class="sd-chat-card-head">
          <span class="sd-chat-card-title">${escapeHtml(speaker)}</span>
          <span class="sd-chat-card-time">${time}</span>
        </div>
        ${flavor}
        <div class="sd-chat-card-desc sd-chat-card-text">${content}</div>
      </div>
      <div class="sd-chat-card-divider"></div>
      <div class="sd-chat-card-actions">
        <span class="sd-chat-pill sd-chat-pill-type">${typeLabel}</span>
      </div>
    `;
  }

  _wireNativeListeners(msg, actionsEl) {
    try {
      const activity = msg.getAssociatedActivity?.();
      if (activity?.activateChatListeners) {
        activity.activateChatListeners(msg, actionsEl);
        return;
      }
    } catch (err) {
      console.warn("Simple Display: could not wire native chat listeners", err);
    }
    // Fallback: dispatch a click on the original message's button in the live chat log.
    actionsEl.querySelectorAll(".sd-chat-action-btn").forEach(btn => {
      btn.addEventListener("click", () => this._fallbackButtonClick(msg, btn));
    });
  }

  _fallbackButtonClick(msg, clonedBtn) {
    const action = clonedBtn.dataset.action;
    const original = document.querySelector(`#chat-log [data-message-id="${msg.id}"] button[data-action="${action}"]`);
    if (original) original.click();
  }

  destroy() {
    if (this._hookId) { Hooks.off("createChatMessage", this._hookId); this._hookId = null; }
    if (this._updateHookId) { Hooks.off("updateChatMessage", this._updateHookId); this._updateHookId = null; }
    this._containerEl = null;
    this._actor = null;
    super.destroy();
  }
}
