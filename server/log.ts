type Level = "info" | "warn" | "error";

function log(level: Level, component: string, message: string, data?: unknown) {
  const entry = {
    time: new Date().toISOString(),
    level,
    component,
    message,
    ...(data !== undefined ? { data } : {}),
  };
  const out = level === "error" ? console.error : console.log;
  out(JSON.stringify(entry));
}

export const logger = {
  info: (component: string, message: string, data?: unknown) =>
    log("info", component, message, data),
  warn: (component: string, message: string, data?: unknown) =>
    log("warn", component, message, data),
  error: (component: string, message: string, data?: unknown) =>
    log("error", component, message, data),
};
