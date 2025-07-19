// popup.js
document.addEventListener('DOMContentLoaded', function() {
    loadPopupContent();
    
    // Update time every second
    setInterval(updateCurrentTime, 1000);
});

function loadPopupContent() {
    // Get status from background script
    chrome.runtime.sendMessage({action: 'getStatus'}, function(response) {
        if (response) {
            renderPopupContent(response);
        } else {
            showError();
        }
    });
    
    // Also load schedule info
    loadScheduleInfo();
}

function renderPopupContent(status) {
    const content = document.getElementById('content');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    
    let statusText, statusClass, statusIcon;
    
    if (!status.enabled) {
        statusText = 'Extension Disabled';
        statusClass = 'disabled';
        statusIcon = '⏸️';
    } else if (status.blocking) {
        statusText = 'Blocking Active';
        statusClass = 'active';
        statusIcon = '🚫';
    } else {
        statusText = 'Not Blocking';
        statusClass = 'inactive';
        statusIcon = '✅';
    }
    
    content.innerHTML = `
        <div class="status-card">
            <div class="status-indicator">
                <div class="status-text">
                    <span class="status-dot ${statusClass}"></span>
                    <span>${statusIcon} ${statusText}</span>
                </div>
                <div class="toggle-switch ${status.enabled ? 'active' : ''}" id="toggleSwitch">
                    <div class="toggle-slider"></div>
                </div>
            </div>
            
            <div class="current-time" id="currentTime"></div>
            
            <div class="schedule-info" id="scheduleInfo">
                <div class="schedule-row">
                    <span class="schedule-label">Today (${today}):</span>
                    <span class="schedule-value" id="todaySchedule">Loading...</span>
                </div>
                <div class="schedule-row">
                    <span class="schedule-label">Status:</span>
                    <span class="schedule-value">${statusText}</span>
                </div>
            </div>
            
            ${status.nextChange ? `<div class="next-change" id="nextChange">
                Next change: ${formatNextChange(status.nextChange)}
            </div>` : ''}
            
            <div class="actions">
                <button class="btn btn-secondary" id="optionsBtn">Settings</button>
                <button class="btn btn-primary" id="quickToggleBtn">
                    ${status.enabled ? 'Disable' : 'Enable'}
                </button>
            </div>
        </div>
    `;
    
    // Add event listeners
    document.getElementById('toggleSwitch').addEventListener('click', toggleExtension);
    document.getElementById('quickToggleBtn').addEventListener('click', toggleExtension);
    document.getElementById('optionsBtn').addEventListener('click', openOptions);
    
    // Update current time
    updateCurrentTime();
}

function loadScheduleInfo() {
    chrome.storage.sync.get(['dailySchedule'], function(result) {
        const dayIndex = new Date().getDay();
        const scheduleElement = document.getElementById('todaySchedule');
        
        if (!scheduleElement) return;
        
        if (result.dailySchedule && result.dailySchedule[dayIndex]) {
            const schedule = result.dailySchedule[dayIndex];
            if (schedule.enabled) {
                scheduleElement.textContent = `${schedule.startTime} - ${schedule.endTime}`;
            } else {
                scheduleElement.textContent = 'Disabled';
            }
        } else {
            scheduleElement.textContent = '24/7 Blocking';
        }
    });
}

function updateCurrentTime() {
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        const now = new Date();
        timeElement.textContent = now.toLocaleTimeString();
    }
}

function formatNextChange(nextChangeTime) {
    const now = new Date();
    const next = new Date(nextChangeTime);
    const diffMs = next - now;
    
    if (diffMs < 0) return 'Now';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 24) {
        return next.toLocaleDateString() + ' at ' + next.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    } else if (diffHours > 0) {
        return `${diffHours}h ${diffMinutes}m`;
    } else {
        return `${diffMinutes}m`;
    }
}

function toggleExtension() {
    chrome.runtime.sendMessage({action: 'toggleExtension'}, function(response) {
        if (response) {
            // Reload the popup content to reflect changes
            setTimeout(loadPopupContent, 100);
        }
    });
}

function openOptions() {
    chrome.runtime.openOptionsPage();
    window.close();
}

function showError() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="status-card">
            <div style="text-align: center; color: #ff4757;">
                <div style="font-size: 2em; margin-bottom: 10px;">⚠️</div>
                <div>Error loading extension status</div>
                <button class="btn btn-primary" onclick="loadPopupContent()" style="margin-top: 15px;">
                    Retry
                </button>
            </div>
        </div>
    `;
}

// Listen for storage changes to update popup in real-time
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'sync' && (changes.dailySchedule || changes.extensionEnabled)) {
        loadPopupContent();
    }
});
