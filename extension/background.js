// background.js
class TimeBasedBlocker {
    constructor() {
        this.timerState = {
            isRunning: false,
            isPaused: false,
            currentPhase: 'focus', // 'focus' or 'rest'
            timeRemaining: 0, // in seconds
            startTime: null,
            pausedTime: 0
        };
        
        this.initializeListeners();
        this.loadTimerState();
        this.startTimerTick();
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
            
            // Check timer state first (timer overrides daily schedule)
            const shouldBlockByTimer = await this.shouldBlockByTimer();
            const shouldBlockByTime = await this.isWithinBlockingHours();
            
            // Block if timer says to block OR if daily schedule says to block and no timer is running
            const shouldBlock = shouldBlockByTimer || (!this.timerState.isRunning && shouldBlockByTime);
            
            if (!shouldBlock) return;
            
            // Check if site is in blocked list
            const isBlocked = await this.isSiteBlocked(url);
            if (!isBlocked) return;
            
            // Block the site
            this.blockSite(tabId, url);
            
        } catch (error) {
            console.error('Error in checkAndBlockSite:', error);
        }
    }
    
    shouldBlockByTimer() {
        return Promise.resolve(
            this.timerState.isRunning && 
            !this.timerState.isPaused && 
            this.timerState.currentPhase === 'focus'
        );
    }
    
    async loadTimerState() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['timerState'], (result) => {
                if (result.timerState) {
                    this.timerState = { ...this.timerState, ...result.timerState };
                    
                    // Recalculate time remaining if timer was running
                    if (this.timerState.isRunning && !this.timerState.isPaused && this.timerState.startTime) {
                        const elapsed = Math.floor((Date.now() - this.timerState.startTime - this.timerState.pausedTime) / 1000);
                        this.timerState.timeRemaining = Math.max(0, this.timerState.timeRemaining - elapsed);
                        
                        if (this.timerState.timeRemaining <= 0) {
                            this.completeCurrentPhase();
                        }
                    }
                }
                resolve();
            });
        });
    }
    
    saveTimerState() {
        chrome.storage.local.set({ timerState: this.timerState });
    }
    
    startTimer(phase = 'focus') {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['focusDuration', 'restDuration'], (result) => {
                const focusDuration = result.focusDuration || 25;
                const restDuration = result.restDuration || 5;
                
                this.timerState = {
                    isRunning: true,
                    isPaused: false,
                    currentPhase: phase,
                    timeRemaining: (phase === 'focus' ? focusDuration : restDuration) * 60,
                    startTime: Date.now(),
                    pausedTime: 0
                };
                
                this.saveTimerState();
                this.updateBadge();
                this.showNotification(`${phase === 'focus' ? 'Focus' : 'Rest'} timer started!`);
                resolve(this.timerState);
            });
        });
    }
    
    pauseTimer() {
        if (this.timerState.isRunning && !this.timerState.isPaused) {
            this.timerState.isPaused = true;
            this.timerState.pausedTime += Date.now() - this.timerState.startTime;
            this.saveTimerState();
            this.updateBadge();
        }
        return this.timerState;
    }
    
    resumeTimer() {
        if (this.timerState.isRunning && this.timerState.isPaused) {
            this.timerState.isPaused = false;
            this.timerState.startTime = Date.now();
            this.saveTimerState();
            this.updateBadge();
        }
        return this.timerState;
    }
    
    stopTimer() {
        this.timerState = {
            isRunning: false,
            isPaused: false,
            currentPhase: 'focus',
            timeRemaining: 0,
            startTime: null,
            pausedTime: 0
        };
        
        this.saveTimerState();
        this.updateBadge();
        return this.timerState;
    }
    
    async completeCurrentPhase() {
        const currentPhase = this.timerState.currentPhase;
        const nextPhase = currentPhase === 'focus' ? 'rest' : 'focus';
        
        // Show completion notification
        this.showNotification(`${currentPhase === 'focus' ? 'Focus' : 'Rest'} time complete!`);
        this.playNotificationSound();
        
        // Check auto-start setting
        const result = await new Promise(resolve => {
            chrome.storage.sync.get(['autoStartCycles'], resolve);
        });
        
        if (result.autoStartCycles) {
            // Auto-start next phase
            setTimeout(() => {
                this.startTimer(nextPhase);
            }, 1000);
        } else {
            // Stop timer and wait for manual start
            this.stopTimer();
        }
    }
    
    startTimerTick() {
        setInterval(() => {
            if (this.timerState.isRunning && !this.timerState.isPaused) {
                const elapsed = Math.floor((Date.now() - this.timerState.startTime - this.timerState.pausedTime) / 1000);
                const newTimeRemaining = Math.max(0, this.timerState.timeRemaining - elapsed);
                
                if (newTimeRemaining <= 0 && this.timerState.timeRemaining > 0) {
                    this.completeCurrentPhase();
                } else {
                    this.timerState.timeRemaining = newTimeRemaining;
                    this.updateBadge();
                }
            }
        }, 1000);
    }
    
    showNotification(message) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Block Site Timer',
            message: message
        });
    }
    
    async playNotificationSound() {
        const result = await new Promise(resolve => {
            chrome.storage.sync.get(['soundNotifications'], resolve);
        });
        
        if (result.soundNotifications !== false) {
            // Create an audio context to play notification sound
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {action: 'playNotificationSound'}).catch(() => {
                        // Ignore errors if content script not available
                    });
                }
            });
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
        const shouldBlockByTimer = await this.shouldBlockByTimer();
        
        this.updateBadge();
    }
    
    updateBadge() {
        chrome.storage.sync.get(['extensionEnabled'], (result) => {
            const isExtensionEnabled = result.extensionEnabled !== false;
            
            if (!isExtensionEnabled) {
                chrome.action.setBadgeText({ text: 'OFF' });
                chrome.action.setBadgeBackgroundColor({ color: '#666666' });
            } else if (this.timerState.isRunning) {
                // Show timer info in badge
                if (this.timerState.isPaused) {
                    chrome.action.setBadgeText({ text: '⏸️' });
                    chrome.action.setBadgeBackgroundColor({ color: '#ff9500' });
                } else {
                    const minutes = Math.ceil(this.timerState.timeRemaining / 60);
                    const phase = this.timerState.currentPhase === 'focus' ? '🍅' : '☕';
                    chrome.action.setBadgeText({ text: minutes > 99 ? '99+' : minutes.toString() });
                    chrome.action.setBadgeBackgroundColor({ 
                        color: this.timerState.currentPhase === 'focus' ? '#ff4444' : '#4CAF50' 
                    });
                }
            } else {
                // Fall back to regular schedule-based badge
                this.isWithinBlockingHours().then(isWithinHours => {
                    if (isWithinHours) {
                        chrome.action.setBadgeText({ text: 'ON' });
                        chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });
                    } else {
                        chrome.action.setBadgeText({ text: '' });
                    }
                });
            }
        });
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
            timeBasedBlocker.getNextScheduleChange(),
            timeBasedBlocker.shouldBlockByTimer()
        ]).then(([isEnabled, isBlocking, nextChange, isTimerBlocking]) => {
            sendResponse({
                enabled: isEnabled,
                blocking: isBlocking || isTimerBlocking,
                nextChange: nextChange,
                timerState: timeBasedBlocker.timerState
            });
        });
        return true;
    }
    
    if (request.action === 'toggleExtension') {
        chrome.storage.sync.get(['extensionEnabled'], (result) => {
            const newState = !result.extensionEnabled;
            chrome.storage.sync.set({ extensionEnabled: newState }, () => {
                timeBasedBlocker.updateBadge();
                sendResponse({ enabled: newState });
            });
        });
        return true;
    }
    
    if (request.action === 'startTimer') {
        timeBasedBlocker.startTimer(request.phase).then(state => {
            sendResponse({ success: true, timerState: state });
        });
        return true;
    }
    
    if (request.action === 'pauseTimer') {
        const state = timeBasedBlocker.pauseTimer();
        sendResponse({ success: true, timerState: state });
    }
    
    if (request.action === 'resumeTimer') {
        const state = timeBasedBlocker.resumeTimer();
        sendResponse({ success: true, timerState: state });
    }
    
    if (request.action === 'stopTimer') {
        const state = timeBasedBlocker.stopTimer();
        sendResponse({ success: true, timerState: state });
    }
    
    if (request.action === 'getTimerState') {
        sendResponse({ timerState: timeBasedBlocker.timerState });
    }
});

// Initialize badge on startup
timeBasedBlocker.checkTimeBasedBlocking();
