// Simple in-memory TTL cache keyed by route
const DEFAULT_TTLS = {
    dashboard: 30000,
    players: 60000,
    sessions: 60000,
    stats: 120000,
    calendar: 120000
};

export default class DataCache {
    constructor() {
        this._timestamps = {};
    }

    isFreshForRoute(routeKey) {
        const ts = this._timestamps[routeKey];
        if (!ts) return false;
        const ttl = DEFAULT_TTLS[routeKey] || 60000;
        return (Date.now() - ts) < ttl;
    }

    markFresh(routeKey) {
        this._timestamps[routeKey] = Date.now();
    }

    invalidate(routeKey) {
        delete this._timestamps[routeKey];
    }

    invalidateAll() {
        this._timestamps = {};
    }
}
