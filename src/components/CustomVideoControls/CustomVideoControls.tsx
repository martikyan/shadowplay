import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Amplifier, getAmplifier } from './volume';
import { secondsToTime, timeToSeconds } from './time';
import './CustomVideoControls.css';
import { useVideoContext } from '../VideoContextProvider/VideoContextProvider';

type CustomVideoControlsProps = {
    setVideo: React.Dispatch<React.SetStateAction<HTMLVideoElement | null>>;
    video: HTMLVideoElement | null;
};

function CustomVideoControls(props: CustomVideoControlsProps) {
    // --- Editing mark state for double-click edit ---
    const [editingMark, setEditingMark] = useState<null | { time: number, type: 'start' | 'end', value: string }>(null);
    function finishEditMark(mark: { time: number, type: 'start' | 'end' }) {
        if (!editingMark) return;
        let newTime = timeToSeconds(editingMark.value);
        if (isNaN(newTime) || newTime < 0) {
            setEditingMark(null);
            return;
        }
        // Remove old, add new
        if (mark.type === 'start') {
            setMarkedCues(prev => [...prev.filter(t => t !== mark.time), newTime].sort((a, b) => a - b));
        } else {
            setEndMarks(prev => [...prev.filter(t => t !== mark.time), newTime].sort((a, b) => a - b));
        }
        setEditingMark(null);
    }
    // Identify video+subtitle pair for per-pair mark storage
    const { videoName, subtitleName } = useVideoContext();
    const storageKey = useMemo(() => {
        if (!videoName) return null;
        const sub = subtitleName && subtitleName.length ? subtitleName : 'none';
        return `svp:marks:${videoName}::${sub}`;
    }, [videoName, subtitleName]);
    // Flag to avoid overwriting existing storage with empty arrays on first mount
    const storageReadyRef = useRef(false);
    const lastLoadedKeyRef = useRef<string | null>(null);
    // Settings panel visibility
    const [settingsOpen, setSettingsOpen] = useState(false);
    // Configurable playback durations (defaults reflect previous constants)
    const [autoResumeDelay, setAutoResumeDelay] = useState(1000); // ms between pause at end mark and auto-resume
    const [passPulseDuration, setPassPulseDuration] = useState(1000); // ms for temporary pass mode pulse
    const passPulseDurationRef = useRef(passPulseDuration);
    useEffect(() => { passPulseDurationRef.current = passPulseDuration; }, [passPulseDuration]);
    const [longSkipSeconds, setLongSkipSeconds] = useState(10); // Arrow left/right skip
    const [shortSkipSeconds, setShortSkipSeconds] = useState(0.5); // U/O precise skip
    const [infoOpen, setInfoOpen] = useState(false); // Instructions panel visibility
    // Pass mode: ignore end-mark auto-jumps for a short window or until manually toggled off
    const [passMode, setPassMode] = useState(false);
    // If true, pass mode is manually toggled and shouldn't auto-disable
    const passModeStickyRef = useRef(false);
    const passModeAutoTimerRef = useRef<NodeJS.Timeout | null>(null);
    const pulsePassMode = () => {
        if (passModeStickyRef.current) return; // don't override manual ON
        setPassMode(true);
        if (passModeAutoTimerRef.current) clearTimeout(passModeAutoTimerRef.current);
        passModeAutoTimerRef.current = setTimeout(() => {
            if (!passModeStickyRef.current) setPassMode(false);
            passModeAutoTimerRef.current = null;
        }, passPulseDurationRef.current);
    };
    const togglePassMode = () => {
        passModeStickyRef.current = !passModeStickyRef.current;
        if (passModeStickyRef.current) {
            if (passModeAutoTimerRef.current) clearTimeout(passModeAutoTimerRef.current);
            passModeAutoTimerRef.current = null;
            setPassMode(true);
        } else {
            setPassMode(false);
        }
    };
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
                // Pulse pass mode to avoid immediate auto-jump at nearby end marks
                pulsePassMode();
            }
        } else if (e.code === 'KeyL') {
            // Jump to next cue
            if (currentCueIdx !== -1 && currentCueIdx < cues.length - 1) {
                video.currentTime = cues[currentCueIdx + 1].startTime;
                // Pulse pass mode to avoid immediate auto-jump at nearby end marks
                pulsePassMode();
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

    // Load marks from localStorage when video/subtitle pair changes
    useEffect(() => {
        if (!storageKey) return;
        try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
            if (raw) {
                const parsed = JSON.parse(raw) as { markedCues?: number[]; endMarks?: number[] };
                setMarkedCues(Array.isArray(parsed.markedCues) ? parsed.markedCues : []);
                setEndMarks(Array.isArray(parsed.endMarks) ? parsed.endMarks : []);
                lastLoadedKeyRef.current = storageKey;
            } else {
                // Fallback: if no exact pair found, try marks saved without subtitle ("none")
                let loaded = false;
                if (videoName) {
                    const fallbackKey = `svp:marks:${videoName}::none`;
                    const rawFallback = typeof window !== 'undefined' ? localStorage.getItem(fallbackKey) : null;
                    if (rawFallback) {
                        const parsed = JSON.parse(rawFallback) as { markedCues?: number[]; endMarks?: number[] };
                        setMarkedCues(Array.isArray(parsed.markedCues) ? parsed.markedCues : []);
                        setEndMarks(Array.isArray(parsed.endMarks) ? parsed.endMarks : []);
                        loaded = true;
                        lastLoadedKeyRef.current = fallbackKey;
                    }
                }
                if (!loaded) {
                    // Ensure we don't carry marks from previous pair
                    setMarkedCues([]);
                    setEndMarks([]);
                    lastLoadedKeyRef.current = storageKey;
                }
            }
        } catch (e) {
            // On parse error, reset state but don't write immediately
            setMarkedCues([]);
            setEndMarks([]);
            lastLoadedKeyRef.current = storageKey;
        } finally {
            // After attempting a load, allow future saves on next tick (ensure state applied)
            storageReadyRef.current = false;
            if (typeof window !== 'undefined') {
                if (typeof window.requestAnimationFrame === 'function') {
                    window.requestAnimationFrame(() => {
                        storageReadyRef.current = true;
                    });
                } else {
                    setTimeout(() => {
                        storageReadyRef.current = true;
                    }, 0);
                }
            } else {
                storageReadyRef.current = true;
            }
        }
    }, [storageKey, videoName]);

    // Persist marks to localStorage when they change (after initial load attempt)
    useEffect(() => {
        if (!storageKey) return;
        if (!storageReadyRef.current) return;
        try {
            if (typeof window !== 'undefined') {
                // Guard: if both arrays are empty but existing storage has non-empty marks, don't overwrite
                const existingRaw = localStorage.getItem(storageKey);
                if (
                    existingRaw &&
                    Array.isArray(markedCues) && Array.isArray(endMarks) &&
                    markedCues.length === 0 && endMarks.length === 0
                ) {
                    try {
                        const existing = JSON.parse(existingRaw) as { markedCues?: any[]; endMarks?: any[] };
                        const hasExisting = (existing.markedCues?.length || 0) > 0 || (existing.endMarks?.length || 0) > 0;
                        if (hasExisting) {
                            return; // skip overwriting with empty arrays
                        }
                    } catch {
                        // ignore parse errors and proceed to write
                    }
                }
                const payload = JSON.stringify({ markedCues, endMarks });
                localStorage.setItem(storageKey, payload);
            }
        } catch {}
    }, [markedCues, endMarks, storageKey]);
    // Track current time for instant UI updates
    const [currentTimeState, setCurrentTimeState] = useState(0);
    // Show clock animation during repeat wait
    const [showClock, setShowClock] = useState(false);
    const clockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    // Token to invalidate any pending auto-resume callbacks
    const autoResumeTokenRef = useRef<number>(0);
    // During programmatic pause/seek, ignore cancel-triggering events until this timestamp (ms since epoch)
    const ignoreCancelBeforeRef = useRef<number>(0);
    // True only during the 1s auto-pause window between jump and autoresume
    const inAutoPauseRef = useRef<boolean>(false);
    // Timestamp of the most recent user gesture (pointer/keyboard) observed during auto-pause
    const lastUserGestureTsRef = useRef<number>(0);
    // Cancel any pending auto-resume and hide clock (used on user playback interactions)
    const cancelPendingAutoResume = () => {
        if (clockTimeoutRef.current) {
            clearTimeout(clockTimeoutRef.current);
            clockTimeoutRef.current = null;
        }
        // Invalidate current token so any already-fired callback captured won't act
        autoResumeTokenRef.current += 1;
        setShowClock(false);
    };
    // Cleanup pass mode timer on unmount
    useEffect(() => () => {
        if (passModeAutoTimerRef.current) clearTimeout(passModeAutoTimerRef.current);
    }, []);
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
            // In pass mode, ignore all auto-jumps
            if (passMode) {
                if (lastJumpedEnd !== null && (currentTime < lastJumpedEnd - EPSILON || currentTime > lastJumpedEnd + EPSILON)) {
                    lastJumpedEnd = null;
                }
                return;
            }
            // Only jump if currentTime is >= end and < end + EPSILON (never before end)
            const hitEnd = endMarks.find((end: number) => currentTime >= end && currentTime < end + EPSILON);
            if (hitEnd !== undefined && hitEnd !== lastJumpedEnd) {
                // Find previous start mark
                const prevMark = [...markedCues].reverse().find((t: number) => t < hitEnd);
                if (prevMark !== undefined && currentTime >= hitEnd) {
                    lastJumpedEnd = hitEnd;
                    // Pause, jump, then wait 1s before resuming
                    // Enter auto-pause window and set a brief suppression window to ignore programmatic events below
                    inAutoPauseRef.current = true;
                    ignoreCancelBeforeRef.current = Date.now() + 300; // ~300ms covers pause/seeking/seeked dispatch
                    video.pause();
                    video.currentTime = prevMark + REPEAT_OFFSET;
                    setShowClock(true);
                    if (clockTimeoutRef.current) clearTimeout(clockTimeoutRef.current);
                    // Issue a new token for this auto-resume cycle
                    const myToken = ++autoResumeTokenRef.current;
            clockTimeoutRef.current = setTimeout(() => {
                        // Only auto-resume if this token is still current (i.e., not canceled by user interaction)
                        if (autoResumeTokenRef.current === myToken) {
                            setShowClock(false);
                            void video.play();
                        }
                        clockTimeoutRef.current = null;
                        inAutoPauseRef.current = false;
            }, autoResumeDelay);
                }
            }
            // Reset lastJumpedEnd if we move away
            if (lastJumpedEnd !== null && (currentTime < lastJumpedEnd - EPSILON || currentTime > lastJumpedEnd + EPSILON)) {
                lastJumpedEnd = null;
            }
    };
        video.addEventListener('timeupdate', onTimeUpdate);
        // If user interacts with playback during the 1s pause, cancel the pending auto-resume
        const onPlay = () => {
            // Only cancel if we're in the auto-pause window, not within the initial suppression,
            // and a recent user gesture was detected (likely user-initiated play/seek)
            const now = Date.now();
            if (!inAutoPauseRef.current) return;
            if (now < ignoreCancelBeforeRef.current) return;
            if (now - lastUserGestureTsRef.current > 1000) return;
            cancelPendingAutoResume();
        };
        // We don't cancel on pause; the video is already paused during the wait
        const onSeeking = () => {
            const now = Date.now();
            if (!inAutoPauseRef.current) return;
            if (now < ignoreCancelBeforeRef.current) return;
            if (now - lastUserGestureTsRef.current > 1000) return;
            cancelPendingAutoResume();
        };
        const onSeeked = () => {
            const now = Date.now();
            if (!inAutoPauseRef.current) return;
            if (now < ignoreCancelBeforeRef.current) return;
            if (now - lastUserGestureTsRef.current > 1000) return;
            cancelPendingAutoResume();
        };
        // Scoped gesture listeners: only track gestures while in the auto-pause window
        const onPointerDown = () => { if (inAutoPauseRef.current) lastUserGestureTsRef.current = Date.now(); };
        const onKeyDown = () => { if (inAutoPauseRef.current) lastUserGestureTsRef.current = Date.now(); };
        video.addEventListener('play', onPlay);
        video.addEventListener('seeking', onSeeking);
        video.addEventListener('seeked', onSeeked);
        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('keydown', onKeyDown);
        return () => {
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('play', onPlay);
            video.removeEventListener('seeking', onSeeking);
            video.removeEventListener('seeked', onSeeked);
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('keydown', onKeyDown);
            if (clockTimeoutRef.current) clearTimeout(clockTimeoutRef.current);
        };
    }, [video, markedCues, endMarks, passMode, autoResumeDelay]);
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

    // Ensure AudioContext is resumed on first user gesture (for Safari/Chrome policies)
    useEffect(() => {
        if (!amplifier) return;
        const resume = () => {
            if (amplifier.context.state === 'suspended') {
                amplifier.context.resume().catch(() => {});
            }
        };
        window.addEventListener('click', resume, { once: true });
        window.addEventListener('keydown', resume, { once: true });
        window.addEventListener('touchstart', resume, { once: true });
        return () => {
            window.removeEventListener('click', resume as any);
            window.removeEventListener('keydown', resume as any);
            window.removeEventListener('touchstart', resume as any);
        };
    }, [amplifier]);

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
                video.currentTime = Math.min(video.duration, currentTime + longSkipSeconds);
            } else if (e.code === BACKWARD_KEY) {
                video.currentTime = Math.max(0, currentTime - longSkipSeconds);
            }
            displayVideoTime();
            // User navigation should briefly bypass end marks
            pulsePassMode();
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
                video.currentTime = Math.min(video.duration, currentTime + shortSkipSeconds);
            } else if (e.code === PRECISE_BACKWARD) {
                video.currentTime = Math.max(0, currentTime - shortSkipSeconds);
            }
            displayVideoTime();
            // User navigation should briefly bypass end marks
            pulsePassMode();
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
        const adjustVideoTimeWrapped = (e: KeyboardEvent) => {
            if (isTextInputFocused()) return;
            adjustVideoTime(e);
        };

        document.addEventListener('keydown', markCueWrapped);
        document.addEventListener('keydown', markEndCueWrapped);
        document.addEventListener('keydown', adjustVideoTimeWrapped);
        document.addEventListener('keydown', preciseJump);
        document.addEventListener('keydown', jumpBySubtitle);
        return () => {
            document.removeEventListener('keydown', markCueWrapped);
            document.removeEventListener('keydown', markEndCueWrapped);
            document.removeEventListener('keydown', adjustVideoTimeWrapped);
            document.removeEventListener('keydown', preciseJump);
            document.removeEventListener('keydown', jumpBySubtitle);
        };
    }, [video, markedCues, endMarks]);

    // spacebar and 'K' play-pause control
    useEffect(() => {
        const playOrPause = (e: KeyboardEvent) => {
            if (isTextInputFocused()) return;
            const SPACEBAR_KEY = 'Space';
            const K_KEY = 'KeyK';
            if (e.code !== SPACEBAR_KEY && e.code !== K_KEY) {
                return;
            }
            e.preventDefault();
            playVideo();
            // Briefly bypass end marks after user playback control
            pulsePassMode();
        };
        document.addEventListener('keydown', playOrPause);
        return () => {
            document.removeEventListener('keydown', playOrPause);
        };
    }, [video]);

    // Keyboard toggle for pass mode (P)
    useEffect(() => {
        const onKeyTogglePass = (e: KeyboardEvent) => {
            if (isTextInputFocused()) return;
            if (e.code === 'KeyP') {
                e.preventDefault();
                togglePassMode();
            }
        };
        document.addEventListener('keydown', onKeyTogglePass);
        return () => document.removeEventListener('keydown', onKeyTogglePass);
    }, []);

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

        // Combine and sort all marks, and attach subtitle text for start marks
        const allMarks = [
            ...markedCues.map(t => {
                // Show the subtitle that is visible exactly at the mark time.
                // If none is visible at that instant, show the next future subtitle.
                // Use millisecond precision as provided by mark times.
                let cueText = '';
                let cue = cues.find(c => c.startTime <= t && t < c.endTime);
                if (!cue) {
                    cue = cues.find(c => c.startTime > t);
                }
                if (cue) cueText = getCueText(cue);
                return { time: t, type: 'start' as const, subtitle: cueText };
            }),
            ...endMarks.map(t => ({ time: t, type: 'end' as const })),
        ].sort((a, b) => a.time - b.time);

        // Handler for clicking a mark (only start marks are clickable)
    const goToMark = (time: number) => {
            if (video) {
        // Briefly bypass end marks when user jumps to a mark
        pulsePassMode();
                video.currentTime = time;
                // Autoplay when user clicks a start mark
                void video.play();
            }
        };

        const playbackRates = [0.25, 0.5, 0.75, 1, 1.5, 2];

        return (
            <div className="CustomVideoControls" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10, pointerEvents: 'none', userSelect: 'none' }}>
                {/* Clock animation overlay */}
                {showClock && (
                    <div style={{
                        position: 'absolute',
                        top: 72,
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
                {/* Time and playback rate display */}
                <div style={{
                    color: '#fff',
                    fontSize: 14,
                    marginTop: 2,
                    textAlign: 'center',
                    textShadow: '0 1px 2px #000',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 16,
                }}>
                    <span style={{
                        fontFamily: 'monospace',
                        minWidth: 220,
                        display: 'inline-block',
                        textAlign: 'right',
                        letterSpacing: '0.5px',
                        userSelect: 'text',
                    }}>{secondsToTime(currentTime)} / {secondsToTime(duration)}</span>
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
                    <button
                        onClick={() => togglePassMode()}
                        style={{
                            pointerEvents: 'auto',
                            fontSize: 13,
                            borderRadius: 6,
                            border: '1px solid #888',
                            padding: '3px 10px',
                            background: '#222',
                            color: '#fff',
                            boxShadow: 'none',
                            cursor: 'pointer',
                            width: 90,
                            textAlign: 'center',
                            fontVariantNumeric: 'tabular-nums',
                        }}
                        title="Toggle pass mode (P). When ON, marks are ignored for auto-jumps."
                    >
                        {passMode ? 'Pass: ON' : 'Pass: OFF'}
                    </button>
                    <button
                        onClick={() => setSettingsOpen(o => !o)}
                        style={{
                            pointerEvents: 'auto',
                            fontSize: 13,
                            borderRadius: 6,
                            border: '1px solid #888',
                            padding: '3px 10px',
                            background: settingsOpen ? 'linear-gradient(90deg, #555 0%, #777 100%)' : '#222',
                            color: '#fff',
                            cursor: 'pointer',
                            width: 50,
                            textAlign: 'center'
                        }}
                        title="Open settings (⚙️)"
                    >
                        ⚙️
                    </button>
                    <button
                        onClick={() => setInfoOpen(o => !o)}
                        style={{
                            pointerEvents: 'auto',
                            fontSize: 13,
                            borderRadius: 6,
                            border: '1px solid #888',
                            padding: '3px 10px',
                            background: infoOpen ? 'linear-gradient(90deg, #1f5ba8 0%, #3f84d6 100%)' : '#222',
                            color: '#fff',
                            cursor: 'pointer',
                            width: 50,
                            textAlign: 'center'
                        }}
                        title="Show instructions (i)"
                    >
                        i
                    </button>
                </div>
                {/* Settings Panel */}
                {settingsOpen && (
                    <div style={{
                        position: 'absolute',
                        top: 16,
                        left: 16,
                        width: 300,
                        background: 'rgba(25,25,30,0.97)',
                        borderRadius: 12,
                        padding: '14px 18px 18px',
                        boxShadow: '0 2px 16px 2px rgba(0,0,0,0.25)',
                        color: '#fff',
                        fontSize: 13,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        pointerEvents: 'auto',
                        zIndex: 30
                    }}>
                        <div style={{display:'flex', alignItems:'center'}}>
                            <span style={{fontWeight:600, fontSize:15}}>Settings</span>
                            <button onClick={() => setSettingsOpen(false)} style={{marginLeft:'auto', background:'transparent', border:'none', color:'#fff', fontSize:18, cursor:'pointer', lineHeight:1}}>×</button>
                        </div>
                        <div style={{display:'flex', flexDirection:'column', gap:6}}>
                            <label style={{display:'flex', flexDirection:'column', gap:2}}>
                                <span>Auto resume delay (ms)</span>
                                <input type="number" min={0} value={autoResumeDelay} onChange={e => setAutoResumeDelay(Math.max(0, Number(e.target.value)))} style={{background:'#222', color:'#fff', border:'1px solid #555', borderRadius:4, padding:'4px 6px'}} />
                            </label>
                            <label style={{display:'flex', flexDirection:'column', gap:2}}>
                                <span>Pass mode pulse (ms)</span>
                                <input type="number" min={0} value={passPulseDuration} onChange={e => setPassPulseDuration(Math.max(100, Number(e.target.value)))} style={{background:'#222', color:'#fff', border:'1px solid #555', borderRadius:4, padding:'4px 6px'}} />
                            </label>
                            <label style={{display:'flex', flexDirection:'column', gap:2}}>
                                <span>Long skip (s) (←/→)</span>
                                <input type="number" min={0} step={0.1} value={longSkipSeconds} onChange={e => setLongSkipSeconds(Math.max(0, Number(e.target.value)))} style={{background:'#222', color:'#fff', border:'1px solid #555', borderRadius:4, padding:'4px 6px'}} />
                            </label>
                            <label style={{display:'flex', flexDirection:'column', gap:2}}>
                                <span>Short skip (s) (U/O)</span>
                                <input type="number" min={0} step={0.05} value={shortSkipSeconds} onChange={e => setShortSkipSeconds(Math.max(0, Number(e.target.value)))} style={{background:'#222', color:'#fff', border:'1px solid #555', borderRadius:4, padding:'4px 6px'}} />
                            </label>
                            <div style={{fontSize:11, opacity:0.7, lineHeight:1.4}}>Notes: Pass pulses auto-enable pass mode briefly after manual navigation. Manual toggle (P) overrides pulses.</div>
                        </div>
                    </div>
                )}
                {/* Info / Instructions Panel */}
                {infoOpen && (
                    <div style={{
                        position: 'absolute',
                        top: settingsOpen ? 200 : 16,
                        left: 16,
                        width: 340,
                        maxHeight: 440,
                        overflowY: 'auto',
                        background: 'rgba(20,25,35,0.97)',
                        borderRadius: 12,
                        padding: '14px 18px 18px',
                        boxShadow: '0 2px 16px 2px rgba(0,0,0,0.25)',
                        color: '#fff',
                        fontSize: 13,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        pointerEvents: 'auto',
                        zIndex: 29
                    }}>
                        <div style={{display:'flex', alignItems:'center'}}>
                            <span style={{fontWeight:600, fontSize:15}}>Instructions</span>
                            <button onClick={() => setInfoOpen(false)} style={{marginLeft:'auto', background:'transparent', border:'none', color:'#fff', fontSize:18, cursor:'pointer', lineHeight:1}}>×</button>
                        </div>
                        <div style={{lineHeight:1.5, display:'flex', flexDirection:'column', gap:8}}>
                            <div><strong>Playback</strong><br/>Space / K: Play / Pause<br/>Arrow Left / Right: Skip {longSkipSeconds}s<br/>U / O: Precise skip {shortSkipSeconds}s back / forward<br/>Speed: Use Pace dropdown</div>
                            <div><strong>Subtitle Navigation</strong><br/>J / L: Previous / Next subtitle cue<br/>W: Toggle start mark at current time<br/>E: Toggle end mark at current time<br/>Click start mark: Jump & play<br/>Double‑click mark: Edit time (HH:MM:SS.mmm)</div>
                            <div><strong>Marks & Repeat</strong><br/>On reaching an end mark, playback rewinds to the previous start mark then auto-resumes after {autoResumeDelay} ms (unless Pass mode active).</div>
                            <div><strong>Pass Mode</strong><br/>P: Toggle pass mode (ignore auto-jumps)<br/>Auto pulses (~{passPulseDuration} ms) after manual navigation prevent unwanted rewinds.</div>
                            <div><strong>Volume</strong><br/>Arrow Up / Down: Volume & amplification (beyond 100% up to 4×)</div>
                            <div><strong>Editing</strong><br/>× on a mark inside the panel removes it. Double‑click to edit mark time.</div>
                            <div style={{fontSize:11, opacity:0.7}}>Tip: Adjust delays & skips in Settings (⚙️). Manual Pass (P) overrides pulses.</div>
                        </div>
                    </div>
                )}
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
                        width: 320,
                        minHeight: 120,
                        maxHeight: 440,
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
                    {allMarks.map((mark, idx) => {
                        const isEditing = editingMark && editingMark.time === mark.time && editingMark.type === mark.type;
                        return (
                            <div
                                key={'panel-' + mark.type + '-' + mark.time}
                                onClick={mark.type === 'start' && !isEditing ? () => goToMark(mark.time) : undefined}
                                onDoubleClick={() => setEditingMark({ time: mark.time, type: mark.type, value: secondsToTime(mark.time) })}
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
                                    gap: 8,
                                    position: 'relative',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                }}
                                title={mark.type === 'start' ? `Go to ${secondsToTime(mark.time)}` : `End mark at ${secondsToTime(mark.time)}`}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                    <span style={{ fontWeight: 700, fontSize: 17 }}>{mark.type === 'start' ? '●' : '■'}</span>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editingMark.value}
                                            autoFocus
                                            style={{ fontSize: 15, width: 120, marginLeft: 4, borderRadius: 4, border: '1px solid #888', padding: '2px 6px' }}
                                            onChange={e => setEditingMark(editingMark => editingMark ? { ...editingMark, value: e.target.value } : null)}
                                            onBlur={() => finishEditMark(mark)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') finishEditMark(mark);
                                                if (e.key === 'Escape') setEditingMark(null);
                                            }}
                                            title="Edit time (HH:MM:SS.mmm)"
                                        />
                                    ) : (
                                        <span>{secondsToTime(mark.time)}</span>
                                    )}
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
                                {/* Show subtitle text in panel for start marks */}
                                {mark.type === 'start' && mark.subtitle && (
                                    <div style={{
                                        marginTop: 2,
                                        fontSize: 13,
                                        color: '#fff',
                                        background: 'rgba(0,0,0,0.7)',
                                        borderRadius: 4,
                                        padding: '2px 6px',
                                        maxWidth: 260,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}>{mark.subtitle}</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return null;
}

export default CustomVideoControls;
