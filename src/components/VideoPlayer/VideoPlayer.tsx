import React, { useRef, useEffect, useState } from 'react';
import KeyboardVideoControls from '../CustomVideoControls/CustomVideoControls';
import VideoControls from '../VideoControls/VideoControls';
import './VideoPlayer.css';

type VideoPlayerProps = {
    videoSrc: string;
    subtitleSrc: string;
    videoName: string;
    subtitleName?: string;
};

function VideoPlayer(props: VideoPlayerProps) {
    const { videoSrc, subtitleSrc, videoName } = props;
    const [video, setVideo] = useState<HTMLVideoElement | null>(null);
    const [keyboardControls, setKeyboardControls] =
        useState<React.JSX.Element | null>(null);
    const [videoPlayerControls, setVideoControls] =
        useState<React.JSX.Element | null>(null);

    const videoContainer = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (video?.hasChildNodes()) {
            if (video.getElementsByTagName('track')[0]) {
                video.getElementsByTagName('track')[0].src = subtitleSrc;
                return;
            }
        }
        setKeyboardControls(
            <KeyboardVideoControls video={video} setVideo={setVideo} />
        );
        if (video) {
            let track = document.createElement('track');
            track.kind = 'subtitles';
            track.src = subtitleSrc;
            track.default = true;
            video.src = videoSrc;
            video.autoplay = true;
            video.playsInline = true;
            video.volume = Math.min(Math.max(video.volume ?? 1, 0), 1);
            video.appendChild(track);
        }

        if (video && videoContainer.current) {
            videoContainer.current.appendChild(video);
            setVideoControls(
                <VideoControls
                    videoName={videoName}
                    video={video}
                    videoContainer={videoContainer.current}
                />
            );

            // Try autoplay after the element is in the DOM
            const tryAutoplay = async () => {
                try {
                    await video.play();
                } catch (e) {
                    // Autoplay with sound likely blocked; try muted autoplay
                    const wasMuted = video.muted;
                    try {
                        video.muted = true;
                        await video.play();
                        // On first user gesture, unmute
                        const unmute = () => {
                            video.muted = wasMuted;
                            window.removeEventListener('click', unmute);
                            window.removeEventListener('keydown', unmute);
                            window.removeEventListener('touchstart', unmute);
                        };
                        window.addEventListener('click', unmute);
                        window.addEventListener('keydown', unmute);
                        window.addEventListener('touchstart', unmute);
                    } catch {
                        // Give up; user interaction required
                    }
                }
            };
            void tryAutoplay();
        }
    }, [videoContainer, video, subtitleSrc]);

    return (
        <div className='VideoPlayer' ref={videoContainer}>
            {videoPlayerControls}
            {keyboardControls}
        </div>
    );
}

export default VideoPlayer;
