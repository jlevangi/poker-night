// Function to fetch config from secure backend endpoint
async function fetchConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            console.error('Failed to load config:', response.statusText);
            return getDefaultConfig();
        }
        
        const config = await response.json();
        return {...getDefaultConfig(), ...config};
    } catch (error) {
        console.error('Error loading config:', error);
        return getDefaultConfig();
    }
}

// Fallback default configuration
function getDefaultConfig() {
    return {
        APP_VERSION: '1.0.6', // Default version if .env can't be loaded
        API_BASE_URL: '/api',
        CACHE_NAME_PREFIX: 'gamble-king-cache',
        DEBUG_MODE: false,
        CACHE_BUST_VALUE: 1
    };
}

// Global config object
let appConfig = null;

// Async function to load config
async function loadConfig() {
    if (appConfig === null) {
        appConfig = await fetchConfig();
    }
    return appConfig;
}

// For use in service worker and other non-module scripts
self.getAppConfig = async function() {
    return await loadConfig();
};

// Helper to get version synchronously if already loaded
export function getLoadedAppVersion() {
    return appConfig ? appConfig.APP_VERSION : undefined;
}

// Export for ES modules
export default {
    getConfig: loadConfig,
    getAppVersion: async () => {
        const config = await loadConfig();
        return config.APP_VERSION;
    },
    getCacheName: async () => {
        const config = await loadConfig();
        return `${config.CACHE_NAME_PREFIX}-v${config.APP_VERSION}-${config.CACHE_BUST_VALUE || 1}`;
    },
    getLoadedAppVersion
};
