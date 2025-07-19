// options.js
document.addEventListener('DOMContentLoaded', function() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const scheduleContainer = document.getElementById('scheduleContainer');
    
    // Initialize the schedule UI
    function initializeSchedule() {
        scheduleContainer.innerHTML = '';
        
        days.forEach((day, index) => {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'day-schedule';
            
            dayDiv.innerHTML = `
                <input type="checkbox" class="enable-checkbox" id="enable-${index}" checked>
                <div class="day-label">${day}:</div>
                <div class="time-inputs">
                    <label>From:</label>
                    <input type="time" class="time-input" id="start-${index}" value="09:00">
                    <label>To:</label>
                    <input type="time" class="time-input" id="end-${index}" value="17:00">
                </div>
            `;
            
            scheduleContainer.appendChild(dayDiv);
            
            // Add event listener for checkbox
            const checkbox = dayDiv.querySelector(`#enable-${index}`);
            const timeInputs = dayDiv.querySelectorAll('.time-input');
            
            checkbox.addEventListener('change', function() {
                timeInputs.forEach(input => {
                    input.disabled = !this.checked;
                    input.style.opacity = this.checked ? '1' : '0.5';
                });
            });
        });
    }
    
    // Load saved settings
    function loadSettings() {
        chrome.storage.sync.get([
            'blockedSites', 
            'extensionEnabled', 
            'dailySchedule'
        ], function(result) {
            // Load blocked sites
            if (result.blockedSites) {
                document.getElementById('blockedSites').value = result.blockedSites.join('\n');
            }
            
            // Load extension enabled state
            document.getElementById('extensionEnabled').checked = result.extensionEnabled !== false;
            
            // Load daily schedule
            if (result.dailySchedule) {
                days.forEach((day, index) => {
                    const daySchedule = result.dailySchedule[index];
                    if (daySchedule) {
                        document.getElementById(`enable-${index}`).checked = daySchedule.enabled;
                        document.getElementById(`start-${index}`).value = daySchedule.startTime || '09:00';
                        document.getElementById(`end-${index}`).value = daySchedule.endTime || '17:00';
                        
                        // Update UI state
                        const timeInputs = document.querySelectorAll(`#start-${index}, #end-${index}`);
                        timeInputs.forEach(input => {
                            input.disabled = !daySchedule.enabled;
                            input.style.opacity = daySchedule.enabled ? '1' : '0.5';
                        });
                    }
                });
            }
        });
    }
    
    // Save blocked sites
    function saveBlockedSites() {
        const sitesText = document.getElementById('blockedSites').value;
        const sites = sitesText.split('\n')
            .map(site => site.trim())
            .filter(site => site.length > 0);
        
        chrome.storage.sync.set({
            blockedSites: sites
        }, function() {
            showStatus('Blocked sites saved successfully!', 'success');
        });
    }
    
    // Save daily schedule
    function saveSchedule() {
        const schedule = [];
        
        days.forEach((day, index) => {
            const enabled = document.getElementById(`enable-${index}`).checked;
            const startTime = document.getElementById(`start-${index}`).value;
            const endTime = document.getElementById(`end-${index}`).value;
            
            schedule.push({
                day: day,
                enabled: enabled,
                startTime: startTime,
                endTime: endTime
            });
        });
        
        chrome.storage.sync.set({
            dailySchedule: schedule
        }, function() {
            showStatus('Daily schedule saved successfully!', 'success');
        });
    }
    
    // Save extension enabled state
    function saveExtensionState() {
        const enabled = document.getElementById('extensionEnabled').checked;
        chrome.storage.sync.set({
            extensionEnabled: enabled
        }, function() {
            showStatus(`Extension ${enabled ? 'enabled' : 'disabled'}!`, 'success');
        });
    }
    
    // Clear all blocked sites
    function clearBlockedSites() {
        if (confirm('Are you sure you want to clear all blocked sites?')) {
            document.getElementById('blockedSites').value = '';
            chrome.storage.sync.set({
                blockedSites: []
            }, function() {
                showStatus('All blocked sites cleared!', 'success');
            });
        }
    }
    
    // Reset schedule to default
    function resetSchedule() {
        if (confirm('Reset schedule to default (9 AM - 5 PM for all days)?')) {
            days.forEach((day, index) => {
                document.getElementById(`enable-${index}`).checked = true;
                document.getElementById(`start-${index}`).value = '09:00';
                document.getElementById(`end-${index}`).value = '17:00';
                
                const timeInputs = document.querySelectorAll(`#start-${index}, #end-${index}`);
                timeInputs.forEach(input => {
                    input.disabled = false;
                    input.style.opacity = '1';
                });
            });
            
            saveSchedule();
        }
    }
    
    // Show status message
    function showStatus(message, type = 'success') {
        const statusDiv = document.getElementById('status');
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
        
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
    
    // Validate time inputs
    function validateTimes() {
        let isValid = true;
        
        days.forEach((day, index) => {
            const enabled = document.getElementById(`enable-${index}`).checked;
            if (enabled) {
                const startTime = document.getElementById(`start-${index}`).value;
                const endTime = document.getElementById(`end-${index}`).value;
                
                if (startTime >= endTime) {
                    showStatus(`Invalid time range for ${day}. Start time must be before end time.`, 'error');
                    isValid = false;
                }
            }
        });
        
        return isValid;
    }
    
    // Event listeners
    document.getElementById('saveBlocked').addEventListener('click', saveBlockedSites);
    document.getElementById('clearBlocked').addEventListener('click', clearBlockedSites);
    document.getElementById('saveSchedule').addEventListener('click', () => {
        if (validateTimes()) {
            saveSchedule();
        }
    });
    document.getElementById('resetSchedule').addEventListener('click', resetSchedule);
    document.getElementById('extensionEnabled').addEventListener('change', saveExtensionState);
    
    // Auto-save blocked sites on blur
    document.getElementById('blockedSites').addEventListener('blur', saveBlockedSites);
    
    // Initialize
    initializeSchedule();
    loadSettings();
});

// Export function for use in background script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getCurrentDaySchedule: function(callback) {
            chrome.storage.sync.get(['dailySchedule'], function(result) {
                const now = new Date();
                const dayIndex = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
                const currentTime = now.getHours() * 60 + now.getMinutes(); // minutes since midnight
                
                if (result.dailySchedule && result.dailySchedule[dayIndex]) {
                    const daySchedule = result.dailySchedule[dayIndex];
                    
                    if (!daySchedule.enabled) {
                        // If day is disabled, blocking is not active
                        callback(false);
                        return;
                    }
                    
                    const [startHour, startMinute] = daySchedule.startTime.split(':').map(Number);
                    const [endHour, endMinute] = daySchedule.endTime.split(':').map(Number);
                    
                    const startTime = startHour * 60 + startMinute;
                    const endTime = endHour * 60 + endMinute;
                    
                    // Check if current time is within blocking hours
                    const isWithinBlockingHours = currentTime >= startTime && currentTime <= endTime;
                    callback(isWithinBlockingHours);
                } else {
                    // Default: block all day
                    callback(true);
                }
            });
        }
    };
}
