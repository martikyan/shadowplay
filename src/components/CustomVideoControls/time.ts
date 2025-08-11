
export function secondsToTime(secs: number) {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = Math.floor(secs % 60);
    const ms = Math.round((secs - Math.floor(secs)) * 1000);
    return `${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(seconds)}.${threeDigits(ms)}`;
}

export function timeToSeconds(time: string): number {
    // Accepts HH:MM:SS.mmm or MM:SS.mmm or SS.mmm
    const parts = time.split(':');
    let h = 0, m = 0, s = 0, ms = 0;
    if (parts.length === 3) {
        h = parseInt(parts[0], 10) || 0;
        m = parseInt(parts[1], 10) || 0;
        [s, ms] = parseSecMs(parts[2]);
    } else if (parts.length === 2) {
        m = parseInt(parts[0], 10) || 0;
        [s, ms] = parseSecMs(parts[1]);
    } else if (parts.length === 1) {
        [s, ms] = parseSecMs(parts[0]);
    }
    return h * 3600 + m * 60 + s + ms / 1000;
}

function parseSecMs(str: string): [number, number] {
    const [sec, ms] = str.split('.')
    return [parseInt(sec, 10) || 0, parseInt(ms?.padEnd(3, '0') || '0', 10)];
}

function twoDigits(n: number) {
    return n > 9 ? `${n}` : `0${n}`;
}
function threeDigits(n: number) {
    if (n < 10) return `00${n}`;
    if (n < 100) return `0${n}`;
    return `${n}`;
}
