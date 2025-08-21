/**
 * Simple logging utility with configurable levels
 */
export class Logger {
    static LOG_LEVELS = {
        ERROR: 0,
        WARN: 1,
        INFO: 2,
        DEBUG: 3
    };

    // Set to ERROR for production, DEBUG for development
    static currentLevel = Logger.LOG_LEVELS.ERROR;

    static error(...args) {
        if (Logger.currentLevel >= Logger.LOG_LEVELS.ERROR) {
            console.error(...args);
        }
    }

    static warn(...args) {
        if (Logger.currentLevel >= Logger.LOG_LEVELS.WARN) {
            console.warn(...args);
        }
    }

    static info(...args) {
        if (Logger.currentLevel >= Logger.LOG_LEVELS.INFO) {
            console.info(...args);
        }
    }

    static debug(...args) {
        if (Logger.currentLevel >= Logger.LOG_LEVELS.DEBUG) {
            console.log(...args);
        }
    }

    static setLevel(level) {
        Logger.currentLevel = level;
    }
}

// Auto-detect environment and set appropriate log level
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    Logger.setLevel(Logger.LOG_LEVELS.INFO);
} else {
    Logger.setLevel(Logger.LOG_LEVELS.ERROR);
}