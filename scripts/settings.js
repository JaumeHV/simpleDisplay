const MODULE_ID = "simple-display";

export function registerSettings() {
  for (let i = 1; i <= 4; i++) {
    game.settings.register(MODULE_ID, `player${i}ActorId`, {
      name: `Display ${i} — Actor ID`,
      hint: `Paste the Actor ID to assign to Display ${i}.`,
      scope: "world",
      config: true,
      type: String,
      default: ""
    });
  }

  game.settings.register(MODULE_ID, "debugMode", {
    name: "Debug Mode",
    hint: "Enable verbose console logging for debugging button clicks and rendering lifecycle.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "metricUnits", {
    name: "Use Metric Units",
    hint: "Display weights in kilograms instead of pounds.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
}

export function getActorId(displayIndex) {
  return game.settings.get(MODULE_ID, `player${displayIndex}ActorId`);
}

export function isDebug() {
  return game.settings.get(MODULE_ID, "debugMode") === true;
}

export function isMetric() {
  return game.settings.get(MODULE_ID, "metricUnits") === true;
}
