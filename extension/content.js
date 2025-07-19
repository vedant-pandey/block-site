const blocklist = [
    "reddit.com",
    "facebook.com",
    "twitter.com",
    "youtube.com",
    "x.com",
    "instagram.com",
    "chess.com",
    "lichess.org",
]

function block() {
    for (const blockSite of blocklist) {
        if (window.location.host.includes(blockSite)) {
            console.log("Block this")
            var current = window.location.href;
            window.history.back();
            if (window.location.href == current) {
                window.close();
                if (window.location.href == current) {
                    window.location.href = "about://newtab";
                }
            }
        }
    }
}


var date1 = new Date();
var hours = date1.getHours();
var day = date1.getDay();

if (day === 6) {
    if (hours >= 5 && hours <= 9) {
        block();
    }
}

else if (hours >= 6 && hours <= 17 && day !== 0) {
    block();
}
