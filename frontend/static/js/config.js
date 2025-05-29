// Function to parse .env file content
async function parseEnvFile() {
    try {
        const response = await fetch('/.env');
        if (!response.ok) {
            console.error('Failed to load .env file:', response.statusText);
            return getDefaultConfig();
        }
        
        const text = await response.text();
        const config = {};
        
        // Parse each line
        text.split('\n').forEach(line => {
            // Skip comments and empty lines
            if (!line || line.trim().startsWith('#')) return;
            
            // Split by first = character
            const [key, value] = line.split('=');
            if (!key || !value) return;
            
            // Trim whitespace and store in config
            const trimmedKey = key.trim();
            let trimmedValue = value.trim();
            
            // Handle true/false string values
            if (trimmedValue.toLowerCase() === 'true') trimmedValue = true;
            if (trimmedValue.toLowerCase() === 'false') trimmedValue = false;
            
            // Handle numeric values
            if (!isNaN(trimmedValue) && trimmedValue !== '') {
                trimmedValue = Number(trimmedValue);
            }
            
            config[trimmedKey] = trimmedValue;
        });
        
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
        appConfig = await parseEnvFile();
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
