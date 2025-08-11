import React, { useState, useEffect, useRef } from 'react';
import { Amplifier, getAmplifier } from './volume';
import { secondsToTime } from './time';
import './CustomVideoControls.css';

type CustomVideoControlsProps = {
    setVideo: React.Dispatch<React.SetStateAction<HTMLVideoElement | null>>;
    video: HTMLVideoElement | null;
};

function CustomVideoControls(props: CustomVideoControlsProps) {
        // Remove a mark by time and type
        const removeMark = (time: number, type: 'start' | 'end') => {
            if (type === 'start') {
                setMarkedCues(prev => prev.filter(t => t !== time));
            } else {
                setEndMarks(prev => prev.filter(t => t !== time));
            }
        };
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
    // Show clock animation during repeat wait
    const [showClock, setShowClock] = useState(false);
    const clockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
        const EPSILON = 0.5; // 500ms
        const REPEAT_OFFSET = 0.05; // 50ms after mark
        const onTimeUpdate = () => {
            const currentTime = video.currentTime;
            // Only jump if currentTime is >= end and < end + EPSILON (never before end)
            const hitEnd = endMarks.find((end: number) => currentTime >= end && currentTime < end + EPSILON);
            if (hitEnd !== undefined && hitEnd !== lastJumpedEnd) {
                // Find previous start mark
                const prevMark = [...markedCues].reverse().find((t: number) => t < hitEnd);
                if (prevMark !== undefined && currentTime >= hitEnd) {
                    lastJumpedEnd = hitEnd;
                    // Pause, jump, then wait 1s before resuming
                    video.pause();
                    video.currentTime = prevMark + REPEAT_OFFSET;
                    setShowClock(true);
                    if (clockTimeoutRef.current) clearTimeout(clockTimeoutRef.current);
                    clockTimeoutRef.current = setTimeout(() => {
                        setShowClock(false);
                        video.play();
                    }, 1000);
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
            if (clockTimeoutRef.current) clearTimeout(clockTimeoutRef.current);
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
            // Mark at the current video time (ms precision)
            const currentTime = Number(video.currentTime.toFixed(3));
            setMarkedCues((prev: number[]) => {
                // Use a small epsilon to check for near-duplicates
                const EPS = 0.0005;
                if (prev.some(t => Math.abs(t - currentTime) < EPS)) {
                    // Unmark if already marked (within EPS)
                    return prev.filter((t: number) => Math.abs(t - currentTime) >= EPS);
                } else {
                    return [...prev, currentTime].sort((a, b) => a - b);
                }
            });
        };

        // Mark/unmark end of current subtitle with 'KeyE'
        const markEndCue = (e: KeyboardEvent) => {
            if (e.code !== 'KeyE') return;
            e.preventDefault();
        // Mark at the current video time (not subtitle end), with ms precision
        const currentTime = Number(video.currentTime.toFixed(3));
        setEndMarks((prev: number[]) => {
            // Use a small epsilon to check for near-duplicates
            const EPS = 0.0005;
            if (prev.some(t => Math.abs(t - currentTime) < EPS)) {
                // Unmark if already marked (within EPS)
                return prev.filter((t: number) => Math.abs(t - currentTime) >= EPS);
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
        const EPSILON = 0.09; // 90ms
            } else {
                setEndMarks(prev => prev.filter(t => t !== closest!.time));
            }
        };

        // ArrowRight/ArrowLeft: always jump 10 seconds forward/backward
        const adjustVideoTime = (e: KeyboardEvent) => {
            const FORWARD_KEY = 'ArrowRight';
            const BACKWARD_KEY = 'ArrowLeft';
            if (e.code !== FORWARD_KEY && e.code !== BACKWARD_KEY) {
                return;
            }
            e.preventDefault();
            if (!video) return;
            const currentTime = video.currentTime;
            if (e.code === FORWARD_KEY) {
                video.currentTime = Math.min(video.duration, currentTime + 10);
            } else if (e.code === BACKWARD_KEY) {
                video.currentTime = Math.max(0, currentTime - 10);
            }
            displayVideoTime();
        };

        // U/O: jump 0.5 seconds backward/forward
        const preciseJump = (e: KeyboardEvent) => {
            const PRECISE_BACKWARD = 'KeyU';
            const PRECISE_FORWARD = 'KeyO';
            if (e.code !== PRECISE_BACKWARD && e.code !== PRECISE_FORWARD) {
                return;
            }
            if (isTextInputFocused()) return;
            e.preventDefault();
            if (!video) return;
            const currentTime = video.currentTime;
            if (e.code === PRECISE_FORWARD) {
                video.currentTime = Math.min(video.duration, currentTime + 0.5);
            } else if (e.code === PRECISE_BACKWARD) {
                video.currentTime = Math.max(0, currentTime - 0.5);
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
        document.addEventListener('keydown', preciseJump);
        document.addEventListener('keydown', jumpBySubtitle);
        return () => {
            document.removeEventListener('keydown', markCueWrapped);
            document.removeEventListener('keydown', markEndCueWrapped);
            document.removeEventListener('keydown', removeClosestFutureMarkWrapped);
            document.removeEventListener('keydown', adjustVideoTimeWrapped);
            document.removeEventListener('keydown', preciseJump);
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

    const [playbackRate, setPlaybackRate] = useState(1);
    useEffect(() => {
        if (video) {
            video.playbackRate = playbackRate;
        }
    }, [video, playbackRate]);

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

        // Combine and sort all marks
        const allMarks = [
            ...markedCues.map(t => ({ time: t, type: 'start' as const })),
            ...endMarks.map(t => ({ time: t, type: 'end' as const })),
        ].sort((a, b) => a.time - b.time);

        // Handler for clicking a mark (only start marks are clickable)
        const goToMark = (time: number) => {
            if (video) {
                video.currentTime = time;
            }
        };

        const playbackRates = [0.25, 0.5, 0.75, 1, 1.5, 2];

        return (
            <div className="CustomVideoControls" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10, pointerEvents: 'none', userSelect: 'none' }}>
                {/* Clock animation overlay */}
                {showClock && (
                    <div style={{
                        position: 'absolute',
                        top: -8,
                        left: 24,
                        zIndex: 100,
                        pointerEvents: 'auto',
                        transition: 'opacity 0.3s',
                        background: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            border: '4px solid #fff',
                            borderTop: '4px solid #4d6dff',
                            animation: 'clockspin 1s linear infinite',
                            boxShadow: '0 0 8px 1px #0004',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(255,255,255,0.01)',
                        }}>
                            <svg width="18" height="18" viewBox="0 0 40 40">
                                <circle cx="20" cy="20" r="18" stroke="#4d6dff" strokeWidth="2" fill="none" />
                                <line x1="20" y1="20" x2="20" y2="8" stroke="#4d6dff" strokeWidth="2" strokeLinecap="round" />
                                <line x1="20" y1="20" x2="32" y2="20" stroke="#4d6dff" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </div>
                        <style>{`
                            @keyframes clockspin {
                                0% { transform: rotate(0deg); }
                                100% { transform: rotate(360deg); }
                            }
                        `}</style>
                    </div>
                )}
                {/* Timeline */}
                <div style={{ position: 'relative', height: 32, margin: '0 32px', background: 'rgba(0,0,0,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center' }}>
                    {allMarks.map((mark, idx) => (
                        <div
                            key={mark.type + '-' + mark.time}
                            style={{
                                position: 'absolute',
                                left: `${(mark.time / duration) * 100}%`,
                                top: -6,
                                bottom: -6,
                                width: 14,
                                background: mark.type === 'start' ? 'red' : 'blue',
                                borderRadius: 7,
                                border: '2px solid #fff',
                                boxShadow: mark.type === 'start'
                                    ? '0 0 16px 6px rgba(255,0,0,0.7), 0 0 2px 2px #fff'
                                    : '0 0 16px 6px rgba(0,0,255,0.7), 0 0 2px 2px #fff',
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
                {/* Time and playback rate display */}
                <div style={{ color: '#fff', fontSize: 14, marginTop: 2, textAlign: 'center', textShadow: '0 1px 2px #000', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
                    <span>{secondsToTime(currentTime)} / {secondsToTime(duration)}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontWeight: 500 }}>Pace:</span>
                        <select
                            value={playbackRate}
                            onChange={e => setPlaybackRate(Number(e.target.value))}
                            style={{
                                fontSize: 14,
                                borderRadius: 4,
                                border: '1px solid #888',
                                padding: '2px 6px',
                                background: '#222',
                                color: '#fff',
                                marginLeft: 2,
                                outline: 'none',
                                pointerEvents: 'auto',
                            }}
                            title="Set playback speed"
                        >
                            {playbackRates.map(rate => (
                                <option key={rate} value={rate}>{rate}x</option>
                            ))}
                        </select>
                    </span>
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
                {/* Marks panel with mark buttons */}
                <div
                    style={{
                        position: 'absolute',
                        top: 16,
                        right: 0,
                        width: 210,
                        minHeight: 120,
                        maxHeight: 340,
                        overflowY: 'auto',
                        background: 'rgba(30,30,40,0.97)',
                        borderRadius: '12px 0 0 12px',
                        boxShadow: '0 2px 16px 2px rgba(0,0,0,0.25)',
                        padding: '16px 10px 16px 18px',
                        zIndex: 20,
                        pointerEvents: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        fontFamily: 'inherit',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                        <span style={{ fontWeight: 'bold', color: '#fff', fontSize: 16, letterSpacing: 1 }}>Marks</span>
                        <button
                            onClick={() => {
                                if (!video) return;
                                const currentTime = Number(video.currentTime.toFixed(3));
                                setMarkedCues((prev: number[]) => {
                                    const EPS = 0.0005;
                                    if (prev.some(t => Math.abs(t - currentTime) < EPS)) {
                                        // Unmark if already marked (within EPS)
                                        return prev.filter((t: number) => Math.abs(t - currentTime) >= EPS);
                                    } else {
                                        return [...prev, currentTime].sort((a, b) => a - b);
                                    }
                                });
                            }}
                            style={{
                                background: 'linear-gradient(90deg, #ff4d4d 0%, #ffb3b3 100%)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 5,
                                padding: '4px 10px',
                                fontWeight: 600,
                                fontSize: 14,
                                cursor: 'pointer',
                                boxShadow: '0 1px 4px 0 rgba(255,0,0,0.10)',
                                marginLeft: 4
                            }}
                            title="Set/unset regular mark at current time (W)"
                        >
                            ● Mark
                        </button>
                        <button
                            onClick={() => {
                                if (!video) return;
                                const currentTime = Number(video.currentTime.toFixed(3));
                                setEndMarks((prev: number[]) => {
                                    const EPS = 0.0005;
                                    if (prev.some(t => Math.abs(t - currentTime) < EPS)) {
                                        // Unmark if already marked (within EPS)
                                        return prev.filter((t: number) => Math.abs(t - currentTime) >= EPS);
                                    } else {
                                        return [...prev, currentTime].sort((a, b) => a - b);
                                    }
                                });
                            }}
                            style={{
                                background: 'linear-gradient(90deg, #4d6dff 0%, #b3c6ff 100%)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 5,
                                padding: '4px 10px',
                                fontWeight: 600,
                                fontSize: 14,
                                cursor: 'pointer',
                                boxShadow: '0 1px 4px 0 rgba(0,0,255,0.10)',
                                marginLeft: 2
                            }}
                            title="Set/unset end mark at current time (E)"
                        >
                            ■ End
                        </button>
                    </div>
                    {allMarks.length === 0 && (
                        <div style={{ color: '#aaa', fontSize: 13 }}>No marks yet</div>
                    )}
                    {allMarks.map((mark, idx) => (
                        <div
                            key={'panel-' + mark.type + '-' + mark.time}
                            onClick={mark.type === 'start' ? () => goToMark(mark.time) : undefined}
                            style={{
                                cursor: mark.type === 'start' ? 'pointer' : 'default',
                                background: mark.type === 'start'
                                    ? 'linear-gradient(90deg, #ff4d4d 0%, #ffb3b3 100%)'
                                    : 'linear-gradient(90deg, #4d6dff 0%, #b3c6ff 100%)',
                                color: '#fff',
                                borderRadius: 6,
                                padding: '6px 10px',
                                marginBottom: 2,
                                fontWeight: mark.type === 'start' ? 600 : 500,
                                fontSize: 15,
                                boxShadow: mark.type === 'start'
                                    ? '0 1px 6px 0 rgba(255,0,0,0.15)'
                                    : '0 1px 6px 0 rgba(0,0,255,0.10)',
                                border: mark.time === currentTime ? '2px solid #fff' : '2px solid transparent',
                                outline: mark.time === currentTime
                                    ? (mark.type === 'start' ? '2px solid #ff4d4d' : '2px solid #4d6dff')
                                    : 'none',
                                transition: 'border 0.2s, outline 0.2s',
                                pointerEvents: 'auto',
                                userSelect: mark.type === 'start' ? 'auto' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                position: 'relative',
                            }}
                            title={mark.type === 'start' ? `Go to ${secondsToTime(mark.time)}` : `End mark at ${secondsToTime(mark.time)}`}
                        >
                            <span style={{ fontWeight: 700, fontSize: 17 }}>{mark.type === 'start' ? '●' : '■'}</span>
                            <span>{secondsToTime(mark.time)}</span>
                            <button
                                onClick={e => {
                                    e.stopPropagation();
                                    removeMark(mark.time, mark.type);
                                }}
                                style={{
                                    marginLeft: 'auto',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: 18,
                                    cursor: 'pointer',
                                    padding: 0,
                                    lineHeight: 1,
                                    opacity: 0.7,
                                    transition: 'opacity 0.2s',
                                }}
                                title="Remove mark"
                                tabIndex={0}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return null;
}

export default CustomVideoControls;
