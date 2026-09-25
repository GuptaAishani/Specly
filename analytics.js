// Optional analytics adapter.
// This file does not send data anywhere by itself.
// Before launch, connect `trackSpeclyEvent` to the analytics provider you choose
// and update privacy.html to name that provider and its data practices.

globalThis.trackSpeclyEvent = function trackSpeclyEvent(name, properties = {}) {
  // Example future integration:
  // analytics.track(name, properties);
  if (location.hostname === "localhost") {
    console.debug("[Specly analytics]", name, properties);
  }
};
