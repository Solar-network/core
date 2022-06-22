export const formatSeconds = (seconds: number): string => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const secondsInDays = days > 0 ? days + (days == 1 ? " day, " : " days, ") : "";
    const secondsInHours = hours > 0 ? hours + (hours == 1 ? " hour, " : " hours, ") : "";
    const secondsInMinutes = mins > 0 ? mins + (mins == 1 ? " minute, " : " minutes, ") : "";
    const secondsRemaining = secs > 0 ? secs + (secs == 1 ? " second" : " seconds") : "";

    return (secondsInDays + secondsInHours + secondsInMinutes + secondsRemaining)
        .replace(/,\s*$/, "")
        .replace(/,([^,]*)$/, " and$1");
};
