


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

function block() // Function will block the website.
{
    for (const blockSite of blocklist) {
        if (window.location.host.includes(blockSite)) {
            console.log("Block this")
            var current = window.location.href;
            window.history.back(); // Attempt to go back (if it's opened in a tab with no tab history)
            if (window.location.href == current) // If it's still there
            {
                window.close(); // Attempt to close page
                if (window.location.href == current) // If it's still there (if it's the only tab)
                {
                    window.location.href = "about://newtab"; // Go to a new tab; always works!
                }
            }
        }
    }
}


var date1 = new Date();
var hours = date1.getHours(); // Hours
var day = date1.getDay(); // Day of the week

if (day === 6) // If it's a Saturday
{
    if (hours >= 5 && hours <= 9) //  Doesn't hurt to add a few more hours of work.
    {
        block();
    }
}

else if (hours >= 6 && hours <= 17 && day !== 0) // If hours are 7 AM to 6 PM (inclusive) and not a Sunday
{
    block();
}
