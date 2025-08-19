// popup.js
document.addEventListener('DOMContentLoaded', function() {
    loadPopupContent();
    
    // Update time every second
    setInterval(updateCurrentTime, 1000);
    
    // Update timer display every second
    setInterval(updateTimerDisplay, 1000);
});

function updateTimerDisplay() {
    chrome.runtime.sendMessage({action: 'getTimerState'}, function(response) {
        if (chrome.runtime.lastError) return;
        
        if (response && response.timerState && response.timerState.isRunning) {
            const timerDisplay = document.getElementById('timerDisplay');
            if (timerDisplay && response.timerState.timeRemaining >= 0) {
                const minutes = Math.floor(response.timerState.timeRemaining / 60);
                const seconds = response.timerState.timeRemaining % 60;
                const timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                timerDisplay.textContent = timeDisplay;
                
                // If timer completed, refresh the popup
                if (response.timerState.timeRemaining === 0) {
                    setTimeout(() => loadPopupContent(), 1000);
                }
            }
        }
    });
}

function loadPopupContent() {
    // Get status from background script
    chrome.runtime.sendMessage({action: 'getStatus'}, function(response) {
        if (response) {
            renderPopupContent(response);
        } else {
            showError();
        }
    });
}

function renderPopupContent(status) {
    const content = document.getElementById('content');
    
    let statusText, statusClass, statusIcon;
    
    if (!status.enabled) {
        statusText = 'Extension Disabled';
        statusClass = 'disabled';
        statusIcon = '⏸️';
    } else if (status.timerState && status.timerState.isRunning) {
        // Timer is running - show timer status
        if (status.timerState.currentPhase === 'focus') {
            statusText = 'Focus Mode - Sites Blocked';
            statusClass = 'active';
            statusIcon = '🍅';
        } else {
            statusText = 'Rest Mode - Sites Available';
            statusClass = 'inactive';
            statusIcon = '☕';
        }
    } else {
        statusText = 'No Timer - Sites Available';
        statusClass = 'inactive';
        statusIcon = '✅';
    }
    
    let timerSection = '';
    if (status.timerState) {
        timerSection = renderTimerSection(status.timerState);
    }
    
    content.innerHTML = `
        ${timerSection}
        
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
                    <span class="schedule-label">Blocking Mode:</span>
                    <span class="schedule-value">Focus Timer Only</span>
                </div>
                <div class="schedule-row">
                    <span class="schedule-label">Current Status:</span>
                    <span class="schedule-value">${statusText}</span>
                </div>
                ${status.timerState && status.timerState.isRunning ? `
                <div class="schedule-row">
                    <span class="schedule-label">Access:</span>
                    <span class="schedule-value">${status.timerState.currentPhase === 'focus' ? '🚫 Blocked' : '✅ Available'}</span>
                </div>
                ` : ''}
            </div>
            
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
    
    // Add timer control listeners
    addTimerEventListeners();
    
    // Update current time
    updateCurrentTime();
}

function renderTimerSection(timerState) {
    if (!timerState) return '';
    
    const minutes = Math.floor(timerState.timeRemaining / 60);
    const seconds = timerState.timeRemaining % 60;
    const timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const phaseIcon = timerState.currentPhase === 'focus' ? '🍅' : '☕';
    const phaseText = timerState.currentPhase === 'focus' ? 'Focus Time' : 'Rest Time';
    
    if (!timerState.isRunning) {
        // Timer not running - show start options
        return `
            <div class="timer-section">
                <div class="timer-phase">🍅 Start Focus Timer</div>
                <div class="timer-controls">
                    <button class="timer-btn primary" id="startFocusBtn">Start Focus</button>
                    <button class="timer-btn" id="startRestBtn">Start Rest</button>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="timer-section">
            <div class="timer-phase">
                <span class="phase-indicator">${phaseIcon}</span>
                ${phaseText}
                ${timerState.isPaused ? ' (Paused)' : ''}
            </div>
            <div class="timer-display" id="timerDisplay">${timeDisplay}</div>
            <div class="timer-controls">
                ${timerState.isPaused ? 
                    '<button class="timer-btn primary" id="resumeBtn">Resume</button>' :
                    '<button class="timer-btn" id="pauseBtn">Pause</button>'
                }
                <button class="timer-btn" id="stopBtn">Stop</button>
            </div>
        </div>
    `;
}

function addTimerEventListeners() {
    const startFocusBtn = document.getElementById('startFocusBtn');
    const startRestBtn = document.getElementById('startRestBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    if (startFocusBtn) {
        startFocusBtn.addEventListener('click', () => startTimer('focus'));
    }
    
    if (startRestBtn) {
        startRestBtn.addEventListener('click', () => startTimer('rest'));
    }
    
    if (pauseBtn) {
        pauseBtn.addEventListener('click', pauseTimer);
    }
    
    if (resumeBtn) {
        resumeBtn.addEventListener('click', resumeTimer);
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', stopTimer);
    }
}

function startTimer(phase) {
    chrome.runtime.sendMessage({action: 'startTimer', phase: phase}, function(response) {
        if (response && response.success) {
            loadPopupContent();
        }
    });
}

function pauseTimer() {
    chrome.runtime.sendMessage({action: 'pauseTimer'}, function(response) {
        if (response && response.success) {
            loadPopupContent();
        }
    });
}

function resumeTimer() {
    chrome.runtime.sendMessage({action: 'resumeTimer'}, function(response) {
        if (response && response.success) {
            loadPopupContent();
        }
    });
}

function stopTimer() {
    chrome.runtime.sendMessage({action: 'stopTimer'}, function(response) {
        if (response && response.success) {
            loadPopupContent();
        }
    });
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
