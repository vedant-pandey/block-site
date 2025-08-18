// content.js
(function() {
    'use strict';
    
    // Check if we should block this page
    function checkAndBlock() {
        chrome.runtime.sendMessage({action: 'getStatus'}, function(response) {
            if (chrome.runtime.lastError) return;
            
            if (response && response.enabled && response.blocking) {
                // Additional content-level blocking
                const hostname = window.location.hostname;
                
                chrome.storage.sync.get(['blockedSites'], function(result) {
                    if (result.blockedSites && Array.isArray(result.blockedSites)) {
                        for (const site of result.blockedSites) {
                            if (matchesSite(hostname, site.toLowerCase().trim())) {
                                blockPage();
                                return;
                            }
                        }
                    }
                });
            }
        });
    }
    
    function matchesSite(hostname, pattern) {
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
        
        // Subdomain matching
        if (hostname.endsWith('.' + pattern)) return true;
        
        return false;
    }
    
    function blockPage() {
        // Create overlay for immediate blocking
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            z-index: 999999 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            color: white !important;
            font-family: 'Segoe UI', system-ui, sans-serif !important;
            text-align: center !important;
        `;
        
        overlay.innerHTML = `
            <div style="max-width: 500px; padding: 40px;">
                <div style="font-size: 4em; margin-bottom: 20px;">🚫</div>
                <h1 style="font-size: 2.5em; margin: 0 0 20px 0; font-weight: 300;">Site Blocked</h1>
                <div style="font-size: 1.2em; margin: 20px 0;">
                    <strong>${window.location.hostname}</strong> is blocked during your scheduled focus time.
                </div>
                <div style="margin: 30px 0; font-size: 1.1em; opacity: 0.9;">
                    Current time: <span id="currentTime" style="font-family: monospace; color: #4ecdc4;">${new Date().toLocaleTimeString()}</span>
                </div>
                <button onclick="window.history.back()" style="
                    background: rgba(255,255,255,0.2);
                    border: 2px solid rgba(255,255,255,0.3);
                    color: white;
                    padding: 12px 25px;
                    margin: 10px;
                    border-radius: 25px;
                    cursor: pointer;
                    font-size: 16px;
                ">← Go Back</button>
            </div>
        `;
        
        // Remove any existing content
        document.documentElement.innerHTML = '';
        document.body = document.createElement('body');
        document.body.appendChild(overlay);
        
        // Update time every second
        setInterval(function() {
            const timeElement = document.getElementById('currentTime');
            if (timeElement) {
                timeElement.textContent = new Date().toLocaleTimeString();
            }
        }, 1000);
        
        // Prevent navigation
        window.addEventListener('beforeunload', function(e) {
            e.preventDefault();
            return 'This site is blocked during your focus time.';
        });
        
        // Redirect to blocked page after a short delay
        setTimeout(function() {
            const blockedPageUrl = chrome.runtime.getURL('blocked.html') + 
                '?site=' + encodeURIComponent(window.location.hostname) + 
                '&time=' + encodeURIComponent(new Date().toLocaleTimeString());
            window.location.replace(blockedPageUrl);
        }, 2000);
    }
    
    // Run check when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAndBlock);
    } else {
        checkAndBlock();
    }
    
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'playNotificationSound') {
            playNotificationSound();
            sendResponse({success: true});
        }
    });
    
    function playNotificationSound() {
        try {
            // Create a simple notification sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.log('Could not play notification sound:', error);
        }
    }

    // Also check on navigation changes
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            checkAndBlock();
        }
    }).observe(document, { subtree: true, childList: true });
    
})();
