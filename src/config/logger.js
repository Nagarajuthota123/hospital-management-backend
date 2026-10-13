/**
 * Minimal dependency-free logger. Swap for pino/winston later without
 * touching call sites — they only rely on info/warn/error/debug.
 */
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function timestamp() {
  return new Date().toISOString();
}

function log(level, ...args) {
  if (LEVELS[level] > currentLevel) return;
  const prefix = `[${timestamp()}] [${level.toUpperCase()}]`;
  if (level === "error") console.error(prefix, ...args);
  else if (level === "warn") console.warn(prefix, ...args);
  else console.log(prefix, ...args);
}

module.exports = {
  info: (...args) => log("info", ...args),
  warn: (...args) => log("warn", ...args),
  error: (...args) => log("error", ...args),
  debug: (...args) => log("debug", ...args),
};
