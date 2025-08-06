import React, { useState, useEffect } from 'react';
import { Amplifier, getAmplifier } from './volume';
import { secondsToTime } from './time';
import './CustomVideoControls.css';

type CustomVideoControlsProps = {
    setVideo: React.Dispatch<React.SetStateAction<HTMLVideoElement | null>>;
    video: HTMLVideoElement | null;
};

function CustomVideoControls(props: CustomVideoControlsProps) {
    // Helper to check if a text input is focused (move to top-level for all handlers)

    // J/L: jump backward/forward by one subtitle cue
    function jumpBySubtitle(e: KeyboardEvent) {
        if (isTextInputFocused()) return;
        if (!video) return;
        const cues = getCues();
        const currentTime = video.currentTime;
        let currentCueIdx = cues.findIndex(
            cue => cue.startTime <= currentTime && currentTime < cue.endTime
        );
        if (e.code === 'KeyJ') {
            // Jump to previous cue
            if (currentCueIdx > 0) {
                video.currentTime = cues[currentCueIdx - 1].startTime;
            }
        } else if (e.code === 'KeyL') {
            // Jump to next cue
            if (currentCueIdx !== -1 && currentCueIdx < cues.length - 1) {
                video.currentTime = cues[currentCueIdx + 1].startTime;
            }
        }
    }
    // Helper to check if a text input is focused (move to top-level for all handlers)
    function isTextInputFocused() {
        const active = document.activeElement;
        if (!active) return false;
        const tag = active.tagName;
        return (
            tag === 'INPUT' ||
            tag === 'TEXTAREA' ||
            (active as HTMLElement).isContentEditable
        );
    }
    const { video, setVideo } = props;
    const [volumeMultiplier, setVolumeMultiplier] = useState(1);
    const [showVolume, setShowVolume] = useState(false);
    const [showVideoTime, setShowVideoTime] = useState(false);
    const [amplifier, setAmplifier] = useState<Amplifier | null>(null);
    // Marked subtitle cue start times (in seconds)
    const [markedCues, setMarkedCues] = useState<number[]>([]);
    // Marked subtitle cue end times (in seconds)
    const [endMarks, setEndMarks] = useState<number[]>([]);
    // Track current time for instant UI updates
    const [currentTimeState, setCurrentTimeState] = useState(0);
    // Keep currentTimeState in sync with video.currentTime
    useEffect(() => {
        // J/L: jump backward/forward by one subtitle cue
        const jumpBySubtitle = (e: KeyboardEvent) => {
            if (isTextInputFocused()) return;
            if (!video) return;
            const cues = getCues();
            const currentTime = video.currentTime;
            let currentCueIdx = cues.findIndex(
                cue => cue.startTime <= currentTime && currentTime < cue.endTime
            );
            if (e.code === 'KeyJ') {
                // Jump to previous cue
                if (currentCueIdx > 0) {
                    video.currentTime = cues[currentCueIdx - 1].startTime;
                }
            } else if (e.code === 'KeyL') {
                // Jump to next cue
                if (currentCueIdx !== -1 && currentCueIdx < cues.length - 1) {
                    video.currentTime = cues[currentCueIdx + 1].startTime;
                }
            }
        };
        if (!video) return;
        const updateCurrentTime = () => setCurrentTimeState(video.currentTime);
        video.addEventListener('timeupdate', updateCurrentTime);
        // Set initial value
        setCurrentTimeState(video.currentTime);
        return () => {
            video.removeEventListener('timeupdate', updateCurrentTime);
        };
    }, [video]);
    
    // Auto-jump to previous mark when reaching an end mark during playback
    useEffect(() => {
        if (!video) return;
        let lastJumpedEnd: number | null = null;
        const EPSILON = 1.0;
        const onTimeUpdate = () => {
            const currentTime = video.currentTime;
            // Find if we're at or just after an end mark
            const hitEnd = endMarks.find((end: number) => currentTime > end - EPSILON && currentTime < end + EPSILON);
            if (hitEnd !== undefined && hitEnd !== lastJumpedEnd) {
                // Find previous start mark
                const prevMark = [...markedCues].reverse().find((t: number) => t < hitEnd);
                if (prevMark !== undefined) {
                    lastJumpedEnd = hitEnd;
                    video.currentTime = prevMark;
                }
            }
            // Reset lastJumpedEnd if we move away
            if (lastJumpedEnd !== null && (currentTime < lastJumpedEnd - EPSILON || currentTime > lastJumpedEnd + EPSILON)) {
                lastJumpedEnd = null;
            }
        };
        video.addEventListener('timeupdate', onTimeUpdate);
        return () => {
            video.removeEventListener('timeupdate', onTimeUpdate);
        };
    }, [video, markedCues, endMarks]);
    // Helper: get cues from the first text track (assumes subtitles are loaded)
    function getCues(): TextTrackCue[] {
        if (!video || !video.textTracks || video.textTracks.length === 0) return [];
        const track = video.textTracks[0];
        // @ts-ignore: cues may be null
        return track.cues ? Array.from(track.cues) : [];
    }

    // Helper: get the start time of the current subtitle cue
    function getCurrentCueStart(currentTime: number): number | null {
        const cues = getCues();
        for (const cue of cues) {
            if (cue.startTime <= currentTime && currentTime < cue.endTime) {
                return cue.startTime;
            }
        }
        return null;
    }

    const displayVolume = () => {
        setShowVolume(true);
        setTimeout(() => {
            setShowVolume(false);
        }, 3000);
    };

    const displayVideoTime = () => {
        setShowVideoTime(true);
        setTimeout(() => {
            setShowVideoTime(false);
        }, 3000);
    };

    const playVideo = () => {
        if (video?.paused) {
            video.play();
        } else {
            video?.pause();
        }
    };

    useEffect(() => {
        if (!video) {
            setAmplifier(getAmplifier(setVideo));
        }
    }, []);

    // volume control
    useEffect(() => {
        if (!amplifier) {
            return;
        }

        // Helper to check if a text input is focused
        function isTextInputFocused() {
            const active = document.activeElement;
            if (!active) return false;
            const tag = active.tagName;
            return (
                tag === 'INPUT' ||
                tag === 'TEXTAREA' ||
                (active as HTMLElement).isContentEditable
            );
        }

        const adjustVolume = (e: KeyboardEvent) => {
            if (isTextInputFocused()) return;
            if (!video) return;
            const UP_KEY = 'ArrowUp';
            const DOWN_KEY = 'ArrowDown';
            if (e.code !== UP_KEY && e.code !== DOWN_KEY) {
                return;
            }
            e.preventDefault();

            if (e.code === UP_KEY) {
                if (video.volume < 1) {
                    // regular volume increase
                    video.volume = Math.min(video.volume + 0.1, 1);
                } else if (volumeMultiplier < 4) {
                    // vlc type volume amplification
                    const newVolumeMultiplier = Math.min(
                        volumeMultiplier + 0.1,
                        4
                    );
                    setVolumeMultiplier(newVolumeMultiplier);
                    amplifier.amplify(newVolumeMultiplier);
                }
            } else if (e.code === DOWN_KEY) {
                if (volumeMultiplier > 1) {
                    // bring volume amplification down towards 1
                    const newVolumeMultiplier = Math.max(
                        volumeMultiplier - 0.1,
                        1
                    );
                    setVolumeMultiplier(newVolumeMultiplier);
                    amplifier.amplify(newVolumeMultiplier);
                } else if (video.volume > 0) {
                    // bring volume down towards 0
                    video.volume = Math.max(video.volume - 0.1, 0);
                }
            }

            displayVolume();
        };

        document.addEventListener('keydown', adjustVolume);
        return () => {
            document.removeEventListener('keydown', adjustVolume);
        };
    }, [video, amplifier, volumeMultiplier]);

    // subtitle marking and navigation
    // Persist marks in localStorage
    useEffect(() => {
        localStorage.setItem('markedCues', JSON.stringify(markedCues));
    }, [markedCues]);
    useEffect(() => {
        localStorage.setItem('endMarks', JSON.stringify(endMarks));
    }, [endMarks]);
    useEffect(() => {
        // Load marks from localStorage on mount
        const stored = localStorage.getItem('markedCues');
        if (stored) setMarkedCues(JSON.parse(stored));
        const storedEnd = localStorage.getItem('endMarks');
        if (storedEnd) setEndMarks(JSON.parse(storedEnd));
    }, []);

    useEffect(() => {
        if (!video) return;


        // Mark/unmark current subtitle sentence with 'KeyW'
        const markCue = (e: KeyboardEvent) => {
            if (e.code !== 'KeyW') return;
            e.preventDefault();
            // Always mark at the beginning of the current subtitle sentence
            const cueStart = getCurrentCueStart(video.currentTime);
            if (cueStart === null) return;
            setMarkedCues((prev: number[]) => {
                if (prev.includes(cueStart)) {
                    // Unmark if already marked
                    return prev.filter((t: number) => t !== cueStart);
                } else {
                    return [...prev, cueStart].sort((a, b) => a - b);
                }
            });
        };

        // Mark/unmark end of current subtitle with 'KeyE'
        const markEndCue = (e: KeyboardEvent) => {
            if (e.code !== 'KeyE') return;
            e.preventDefault();
            // Mark at the current video time (not subtitle end)
            const currentTime = video.currentTime;
            setEndMarks((prev: number[]) => {
                if (prev.includes(currentTime)) {
                    // Unmark if already marked
                    return prev.filter((t: number) => t !== currentTime);
                } else {
                    return [...prev, currentTime].sort((a, b) => a - b);
                }
            });
        };

        // Remove closest future mark (regular or end) within 1 minute with 'KeyR'
        const removeClosestFutureMark = (e: KeyboardEvent) => {
            if (e.code !== 'KeyR') return;
            if (isTextInputFocused()) return;
            e.preventDefault();
            const currentTime = video.currentTime;
            const oneMinute = 60;
            // Find all future marks within 1 minute
            const futureRegular = markedCues.filter(t => t > currentTime && t - currentTime <= oneMinute);
            const futureEnd = endMarks.filter(t => t > currentTime && t - currentTime <= oneMinute);
            // Find the closest among both
            let closest: { type: 'regular' | 'end', time: number } | null = null;
            if (futureRegular.length > 0) {
                const t = futureRegular.reduce((a, b) => (a - currentTime < b - currentTime ? a : b));
                closest = { type: 'regular', time: t };
            }
            if (futureEnd.length > 0) {
                const t = futureEnd.reduce((a, b) => (a - currentTime < b - currentTime ? a : b));
                if (!closest || t - currentTime < closest.time - currentTime) {
                    closest = { type: 'end', time: t };
                }
            }
            if (!closest) return;
            if (closest.type === 'regular') {
                setMarkedCues(prev => prev.filter(t => t !== closest!.time));
            } else {
                setEndMarks(prev => prev.filter(t => t !== closest!.time));
            }
        };

        // ArrowRight/ArrowLeft: jump to next/prev marked cue (always to the beginning of the sentence)
        const adjustVideoTime = (e: KeyboardEvent) => {
            const FORWARD_KEY = 'ArrowRight';
            const BACKWARD_KEY = 'ArrowLeft';
            if (e.code !== FORWARD_KEY && e.code !== BACKWARD_KEY) {
                return;
            }
            e.preventDefault();
            const cues = getCues();
            const currentTime = video.currentTime;
            // Helper to get the start of the sentence for a mark
            function getSentenceStart(time: number): number {
                const cue = cues.find(c => c.startTime === time);
                return cue ? cue.startTime : time;
            }
            // Helper to get the previous start mark before a given time
            function getPrevMark(time: number): number | undefined {
                return [...markedCues].reverse().find((t: number) => t < time);
            }
            // Helper to get the next start mark after a given time
            function getNextMark(time: number): number | undefined {
                return markedCues.find((t: number) => t > time);
            }
            // If at or very near an end mark, jump to previous start mark (for both directions)
            const EPSILON = 1.0;
            let atEndMark = false;
            for (const end of endMarks) {
                const diff = currentTime - end;
                if (currentTime > end - EPSILON && currentTime < end + EPSILON) {
                    atEndMark = true;
                    break;
                }
            }
            if (atEndMark && markedCues.length > 0) {
                const prevMark = getPrevMark(currentTime);
                if (prevMark !== undefined) {
                    video.currentTime = getSentenceStart(prevMark);
                    displayVideoTime();
                    return;
                }
            }
            const FIVE_MINUTES = 300;
            if (e.code === FORWARD_KEY) {
                if (markedCues.length > 0) {
                    // Find the next marked cue after currentTime
                    const nextCue = getNextMark(currentTime);
                    if (nextCue !== undefined) {
                        if (nextCue - currentTime > FIVE_MINUTES) {
                            video.currentTime = Math.min(video.duration, currentTime + 10);
                        } else {
                            video.currentTime = getSentenceStart(nextCue);
                        }
                    } else {
                        // No mark in the future, go forward by 10 seconds
                        video.currentTime = Math.min(video.duration, currentTime + 10);
                    }
                } else {
                    // No marks at all, always jump by 10 seconds
                    video.currentTime = Math.min(video.duration, currentTime + 10);
                }
            } else if (e.code === BACKWARD_KEY) {
                if (markedCues.length > 0) {
                    // If within 2 seconds after a mark, go to previous mark
                    const prevCue = [...markedCues].reverse().find((t: number) => t < currentTime - 2);
                    if (prevCue !== undefined) {
                        if (currentTime - prevCue > FIVE_MINUTES) {
                            video.currentTime = Math.max(0, currentTime - 10);
                        } else {
                            video.currentTime = getSentenceStart(prevCue);
                        }
                    } else {
                        // If within 2 seconds of a mark, go to that mark
                        const closeMark = [...markedCues].reverse().find((t: number) => t < currentTime && currentTime - t <= 2);
                        if (closeMark !== undefined) {
                            video.currentTime = getSentenceStart(closeMark);
                        } else {
                            // No mark in the past, go backward by 10 seconds
                            video.currentTime = Math.max(0, currentTime - 10);
                        }
                    }
                } else {
                    // No marks at all, always jump by 10 seconds
                    video.currentTime = Math.max(0, currentTime - 10);
                }
            }
            displayVideoTime();
        };

        // Helper to check if a text input is focused
        function isTextInputFocused() {
            const active = document.activeElement;
            if (!active) return false;
            const tag = active.tagName;
            return (
                tag === 'INPUT' ||
                tag === 'TEXTAREA' ||
                (active as HTMLElement).isContentEditable
            );
        }

        // Wrap handlers to skip if input is focused
        const markCueWrapped = (e: KeyboardEvent) => {
            if (isTextInputFocused()) return;
            markCue(e);
        };
        const markEndCueWrapped = (e: KeyboardEvent) => {
            if (isTextInputFocused()) return;
            markEndCue(e);
        };
        const removeClosestFutureMarkWrapped = (e: KeyboardEvent) => {
            if (isTextInputFocused()) return;
            removeClosestFutureMark(e);
        };
        const adjustVideoTimeWrapped = (e: KeyboardEvent) => {
            if (isTextInputFocused()) return;
            adjustVideoTime(e);
        };

        document.addEventListener('keydown', markCueWrapped);
        document.addEventListener('keydown', markEndCueWrapped);
        document.addEventListener('keydown', removeClosestFutureMarkWrapped);
        document.addEventListener('keydown', adjustVideoTimeWrapped);
        document.addEventListener('keydown', jumpBySubtitle);
        return () => {
            document.removeEventListener('keydown', markCueWrapped);
            document.removeEventListener('keydown', markEndCueWrapped);
            document.removeEventListener('keydown', removeClosestFutureMarkWrapped);
            document.removeEventListener('keydown', adjustVideoTimeWrapped);
            document.removeEventListener('keydown', jumpBySubtitle);
        };
    }, [video, markedCues, endMarks]);

    // spacebar play-pause control
    useEffect(() => {
        const playOrPause = (e: KeyboardEvent) => {
            if (isTextInputFocused()) return;
            const SPACEBAR_KEY = 'Space';
            if (e.code !== SPACEBAR_KEY) {
                return;
            }
            e.preventDefault();
            if (e.code === SPACEBAR_KEY) {
                playVideo();
            }
        };
        document.addEventListener('keydown', playOrPause);
        return () => {
            document.removeEventListener('keydown', playOrPause);
        };
    }, [video]);

    // Timeline and subtitle overlay (single timeline, with start and end marks)
    function getCueText(cue: any): string {
        // VTTCue has .text, generic cues may not
        if (typeof cue.text === 'string') return cue.text;
        if (typeof cue.payload === 'string') return cue.payload;
        if (typeof cue.id === 'string') return cue.id;
        return cue.toString();
    }

    if (video) {
        const duration = video.duration || 1;
        const cues = getCues();
        const currentTime = currentTimeState;
        // Find current cue index
        let currentCueIdx = cues.findIndex(
            cue => cue.startTime <= currentTime && currentTime < cue.endTime
        );
        // Gather up to 2 previous, current, and 2 next subtitles
        let subtitleBlocks: string[] = [];
        if (currentCueIdx !== -1) {
            for (let i = currentCueIdx - 2; i <= currentCueIdx + 2; i++) {
                if (i >= 0 && i < cues.length) {
                    subtitleBlocks.push(getCueText(cues[i]));
                }
            }
        }

        return (
            <div className="CustomVideoControls" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10, pointerEvents: 'none', userSelect: 'none' }}>
                {/* Timeline */}
                <div style={{ position: 'relative', height: 32, margin: '0 32px', background: 'rgba(0,0,0,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center' }}>
                    {/* Start marks */}
                    {markedCues.map((cue, idx) => (
                        <div key={'start-' + cue}
                            style={{
                                position: 'absolute',
                                left: `${(cue / duration) * 100}%`,
                                top: -6,
                                bottom: -6,
                                width: 14,
                                background: 'red',
                                borderRadius: 7,
                                border: '2px solid #fff',
                                boxShadow: '0 0 16px 6px rgba(255,0,0,0.7), 0 0 2px 2px #fff',
                                zIndex: 2,
                                transform: 'translateX(-7px)'
                            }}
                        />
                    ))}
                    {/* End marks */}
                    {endMarks.map((cue, idx) => (
                        <div key={'end-' + cue}
                            style={{
                                position: 'absolute',
                                left: `${(cue / duration) * 100}%`,
                                top: -6,
                                bottom: -6,
                                width: 14,
                                background: 'blue',
                                borderRadius: 7,
                                border: '2px solid #fff',
                                boxShadow: '0 0 16px 6px rgba(0,0,255,0.7), 0 0 2px 2px #fff',
                                zIndex: 2,
                                transform: 'translateX(-7px)'
                            }}
                        />
                    ))}
                    {/* Current time indicator */}
                    <div
                        style={{
                            position: 'absolute',
                            left: `${(currentTime / duration) * 100}%`,
                            top: 0,
                            bottom: 0,
                            width: 2,
                            background: 'white',
                            borderRadius: 1,
                            transform: 'translateX(-1px)'
                        }}
                    />
                    {/* Timeline background */}
                    <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 4, margin: '0 0' }} />
                </div>
                {/* Time display */}
                <div style={{ color: '#fff', fontSize: 14, marginTop: 2, textAlign: 'center', textShadow: '0 1px 2px #000' }}>
                    {secondsToTime(currentTime)} / {secondsToTime(duration)}
                </div>
                {/* Subtitle display */}
                <div style={{ color: '#fff', fontSize: 18, marginTop: 8, textAlign: 'center', textShadow: '0 2px 4px #000', fontWeight: 'bold' }}>
                    {subtitleBlocks.map((text, idx) => (
                        <div key={idx} style={{
                            fontSize: idx === 2 ? 22 : 16,
                            opacity: idx === 2 ? 1 : 0.6,
                            margin: idx === 2 ? '8px 0' : '2px 0',
                            color: idx === 2 ? '#fff' : '#ccc',
                            fontWeight: idx === 2 ? 'bold' : 'normal',
                            textShadow: idx === 2 ? '0 2px 8px #000, 0 0 8px #fff' : '0 1px 2px #000'
                        }}>
                            {idx === 2 ? '▶ ' : ''}{text}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return null;
}

export default CustomVideoControls;
