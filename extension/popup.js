document.addEventListener('DOMContentLoaded', function() {
    const urlInput = document.getElementById('urlInput');
    const googleBtn = document.getElementById('googleBtn');
    const githubBtn = document.getElementById('githubBtn');
    const youtubeBtn = document.getElementById('youtubeBtn');
    const stackoverflowBtn = document.getElementById('stackoverflowBtn');
    const output = document.getElementById('output');

    // Function to open URL in new tab
    async function openTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, {
            action: 'click'
        })
    }

    openTab()

    // Function to show status messages
    function showMessage(message, type = '') {
        output.textContent = message;
        output.className = 'output ' + type;

        // Clear message after 3 seconds
        setTimeout(() => {
            output.textContent = '';
            output.className = 'output';
        }, 3000);
    }

    // Focus on input field when popup opens
    urlInput.focus();
    console.log("hello")
});
