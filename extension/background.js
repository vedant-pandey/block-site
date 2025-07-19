// background.js
class TimeBasedBlocker {
    constructor() {
        this.initializeListeners();
    }
    
    initializeListeners() {
        // Handle web navigation
        chrome.webNavigation.onBeforeNavigate.addListener((details) => {
            if (details.frameId === 0) { // Main frame only
                this.checkAndBlockSite(details.url, details.tabId);
            }
        });
        
        // Handle tab updates (for address bar changes)
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.url) {
                this.checkAndBlockSite(changeInfo.url, tabId);
            }
        });
        
        // Set up periodic check for time-based unblocking
        this.startPeriodicCheck();
    }
    
    async checkAndBlockSite(url, tabId) {
        try {
            // Check if extension is enabled
            const isExtensionEnabled = await this.getExtensionState();
            if (!isExtensionEnabled) return;
            
            // Check if current time is within blocking hours
            const shouldBlockByTime = await this.isWithinBlockingHours();
            if (!shouldBlockByTime) return;
            
            // Check if site is in blocked list
            const isBlocked = await this.isSiteBlocked(url);
            if (!isBlocked) return;
            
            // Block the site
            this.blockSite(tabId, url);
            
        } catch (error) {
            console.error('Error in checkAndBlockSite:', error);
        }
    }
    
    getExtensionState() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['extensionEnabled'], (result) => {
                resolve(result.extensionEnabled !== false);
            });
        });
    }
    
    isWithinBlockingHours() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['dailySchedule'], (result) => {
                const now = new Date();
                const dayIndex = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
                const currentTime = now.getHours() * 60 + now.getMinutes(); // minutes since midnight
                
                if (result.dailySchedule && result.dailySchedule[dayIndex]) {
                    const daySchedule = result.dailySchedule[dayIndex];
                    
                    if (!daySchedule.enabled) {
                        // If day is disabled, no blocking
                        resolve(false);
                        return;
                    }
                    
                    const [startHour, startMinute] = daySchedule.startTime.split(':').map(Number);
                    const [endHour, endMinute] = daySchedule.endTime.split(':').map(Number);
                    
                    const startTime = startHour * 60 + startMinute;
                    const endTime = endHour * 60 + endMinute;
                    
                    // Handle overnight schedules (e.g., 22:00 to 06:00)
                    let isWithinHours;
                    if (startTime <= endTime) {
                        // Normal schedule (e.g., 09:00 to 17:00)
                        isWithinHours = currentTime >= startTime && currentTime <= endTime;
                    } else {
                        // Overnight schedule (e.g., 22:00 to 06:00)
                        isWithinHours = currentTime >= startTime || currentTime <= endTime;
                    }
                    
                    resolve(isWithinHours);
                } else {
                    // Default: block all day
                    resolve(true);
                }
            });
        });
    }
    
    isSiteBlocked(url) {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['blockedSites'], (result) => {
                if (!result.blockedSites || result.blockedSites.length === 0) {
                    resolve(false);
                    return;
                }
                
                const hostname = new URL(url).hostname.toLowerCase();
                
                for (const site of result.blockedSites) {
                    if (this.matchesSite(hostname, site.toLowerCase().trim())) {
                        resolve(true);
                        return;
                    }
                }
                
                resolve(false);
            });
        });
    }
    
    matchesSite(hostname, pattern) {
        // Remove protocol if present
        pattern = pattern.replace(/^https?:\/\//, '');
        
        // Exact match
        if (hostname === pattern) return true;
        
        // Wildcard support
        if (pattern.includes('*')) {
            const regexPattern = pattern
                .replace(/\./g, '\\.')
                .replace(/\*/g, '.*');
            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(hostname);
        }
        
        // Subdomain matching (e.g., "example.com" blocks "www.example.com")
        if (hostname.endsWith('.' + pattern)) return true;
        
        return false;
    }
    
    blockSite(tabId, url) {
        const blockedPageUrl = chrome.runtime.getURL('blocked.html') + 
            '?site=' + encodeURIComponent(new URL(url).hostname) + 
            '&time=' + encodeURIComponent(new Date().toLocaleTimeString());
        
        chrome.tabs.update(tabId, { url: blockedPageUrl });
        
        // Log the blocking event
        this.logBlockEvent(url);
    }
    
    logBlockEvent(url) {
        const today = new Date().toDateString();
        chrome.storage.local.get(['blockLog'], (result) => {
            const log = result.blockLog || {};
            if (!log[today]) log[today] = [];
            
            log[today].push({
                url: url,
                timestamp: new Date().toISOString()
            });
            
            // Keep only last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            Object.keys(log).forEach(date => {
                if (new Date(date) < thirtyDaysAgo) {
                    delete log[date];
                }
            });
            
            chrome.storage.local.set({ blockLog: log });
        });
    }
    
    startPeriodicCheck() {
        // Check every minute if we need to update blocking status
        setInterval(() => {
            this.checkTimeBasedBlocking();
        }, 60000); // 60 seconds
    }
    
    async checkTimeBasedBlocking() {
        const isWithinHours = await this.isWithinBlockingHours();
        const isExtensionEnabled = await this.getExtensionState();
        
        // Update badge to show current status
        if (!isExtensionEnabled) {
            chrome.action.setBadgeText({ text: 'OFF' });
            chrome.action.setBadgeBackgroundColor({ color: '#666666' });
        } else if (isWithinHours) {
            chrome.action.setBadgeText({ text: 'ON' });
            chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });
        } else {
            chrome.action.setBadgeText({ text: '' });
        }
    }
    
    // Get next schedule change time for display
    getNextScheduleChange() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['dailySchedule'], (result) => {
                const now = new Date();
                const dayIndex = now.getDay();
                const currentTime = now.getHours() * 60 + now.getMinutes();
                
                if (!result.dailySchedule || !result.dailySchedule[dayIndex]) {
                    resolve(null);
                    return;
                }
                
                const daySchedule = result.dailySchedule[dayIndex];
                if (!daySchedule.enabled) {
                    resolve(null);
                    return;
                }
                
                const [startHour, startMinute] = daySchedule.startTime.split(':').map(Number);
                const [endHour, endMinute] = daySchedule.endTime.split(':').map(Number);
                
                const startTime = startHour * 60 + startMinute;
                const endTime = endHour * 60 + endMinute;
                
                let nextChange;
                if (currentTime < startTime) {
                    // Before blocking period starts
                    nextChange = new Date();
                    nextChange.setHours(startHour, startMinute, 0, 0);
                } else if (currentTime <= endTime) {
                    // During blocking period
                    nextChange = new Date();
                    nextChange.setHours(endHour, endMinute, 0, 0);
                } else {
                    // After blocking period, next change is tomorrow
                    nextChange = new Date();
                    nextChange.setDate(nextChange.getDate() + 1);
                    nextChange.setHours(startHour, startMinute, 0, 0);
                }
                
                resolve(nextChange);
            });
        });
    }
}

// Initialize the blocker
const timeBasedBlocker = new TimeBasedBlocker();

// Handle popup requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getStatus') {
        Promise.all([
            timeBasedBlocker.getExtensionState(),
            timeBasedBlocker.isWithinBlockingHours(),
            timeBasedBlocker.getNextScheduleChange()
        ]).then(([isEnabled, isBlocking, nextChange]) => {
            sendResponse({
                enabled: isEnabled,
                blocking: isBlocking,
                nextChange: nextChange
            });
        });
        return true; // Indicates we will send response asynchronously
    }
    
    if (request.action === 'toggleExtension') {
        chrome.storage.sync.get(['extensionEnabled'], (result) => {
            const newState = !result.extensionEnabled;
            chrome.storage.sync.set({ extensionEnabled: newState }, () => {
                sendResponse({ enabled: newState });
            });
        });
        return true;
    }
});

// Initialize badge on startup
timeBasedBlocker.checkTimeBasedBlocking();
