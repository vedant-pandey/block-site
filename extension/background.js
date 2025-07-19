chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    const now = new Date();
    const hours = now.getHours();
    const day = now.getDay();

    
    const isSaturdayBlock = (day === 6 && hours >= 5 && hours <= 9);
    const isWeekdayBlock = (hours >= 6 && hours <= 17 && day !== 0);

    if (isSaturdayBlock || isWeekdayBlock) {
      return {
        redirectUrl: chrome.runtime.getURL("blocked.html")
      };
    }
  },
  { urls: ["*://*/*"] },
  ["blocking"]
);

