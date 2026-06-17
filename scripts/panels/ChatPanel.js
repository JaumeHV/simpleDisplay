import { PanelBase, escapeHtml } from "./PanelBase.js";

const MAX_MESSAGES = 100;

export class ChatPanel extends PanelBase {
  static panelId = "chat";
  static panelLabel = "Chat";
  static panelIcon = "fas fa-comment-dots";

  constructor(display) {
    super(display);
    this._containerEl = null;
    this._actor = null;
    this._hookId = null;
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
        <div class="sd-chat-scroll" id="sd-chat-scroll">
          ${this._renderMessages()}
        </div>
      </div>
    `;

    const scrollEl = containerEl.querySelector("#sd-chat-scroll");
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
      const el = containerEl.querySelector("#sd-chat-scroll");
      if (el) el.innerHTML = this._renderMessages();
    });

    this._hookId = Hooks.on("createChatMessage", (msg) => {
      if (!this._containerEl) return;
      const scrollEl = this._containerEl.querySelector("#sd-chat-scroll");
      if (!scrollEl) return;
      scrollEl.innerHTML = this._renderMessages();
      if (this._autoScroll) scrollEl.scrollTop = scrollEl.scrollHeight;
    });
  }

  _renderMessages() {
    const messages = game.messages?.contents ?? [];
    let filtered = this._filter === "all" ? messages : messages.filter(m => this._matchesFilter(m));

    const recent = filtered.slice(-MAX_MESSAGES);

    let html = "";
    for (const msg of recent) {
      html += this._renderMessage(msg);
    }

    return html || `<div class="sd-chat-empty">
      <i class="fas fa-comment-dots"></i>
      <p>No messages</p>
    </div>`;
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

  _renderMessage(msg) {
    const alias = escapeHtml(msg.alias || msg.speaker?.alias || msg.author?.name || "Unknown");
    const content = msg.content ?? "";
    const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
    const T = this._getTypes();
    const isRoll = msg.type === T.ROLL;
    const isWhisper = msg.isWhisper;
    const isEmote = msg.type === T.IC;

    const speakerEl = msg.speaker?.actor
      ? this._actor?.id === msg.speaker.actor ? "sd-chat-msg-self" : ""
      : "";

    return `<div class="sd-chat-msg ${speakerEl} ${isRoll ? "is-roll" : ""} ${isWhisper ? "is-whisper" : ""}">
      <div class="sd-chat-msg-header">
        <span class="sd-chat-msg-alias"><i class="fas ${isRoll ? "fa-dice-d20" : isWhisper ? "fa-mask" : "fa-user"}"></i> ${alias}</span>
        <span class="sd-chat-msg-time">${time}</span>
      </div>
      <div class="sd-chat-msg-body">${content}</div>
    </div>`;
  }

  destroy() {
    if (this._hookId) {
      Hooks.off(this._hookId);
      this._hookId = null;
    }
    this._containerEl = null;
    this._actor = null;
    super.destroy();
  }
}
