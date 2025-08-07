'use client';
import React, { useRef, useState } from 'react';
import './VideoSelector.css';
import pressplay from '@/assets/playicon.png';
import { useVideoContext } from '../VideoContextProvider/VideoContextProvider';
import { useRouter } from 'next/navigation';

function VideoSelector() {
    const { setSelectedVideo } = useVideoContext();
    const [dragActive, setDragActive] = useState(false);
    const fileField = useRef<HTMLInputElement>(null);

    const router = useRouter();
    const onClick = () => {
        if (!fileField.current) {
            return;
        }
        // reset value, so 'onChange' always works
        fileField.current.value = '';
        fileField.current.click();
    };

    const onFileAdded = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) {
            return;
        }

        // Support both video and subtitle file selection
        let videoFile: File | null = null;
        let subtitleFile: File | null = null;
        for (let i = 0; i < e.target.files.length; i++) {
            const file = e.target.files[i];
            if (file.name.match(/\.(mp4|mkv|webm|mov)$/i)) {
                videoFile = file;
            } else if (file.name.match(/\.(srt|vtt)$/i)) {
                subtitleFile = file;
            }
        }

        if (!videoFile) {
            alert('Please select a video file (.mp4, .mkv, .webm, .mov)');
            return;
        }

        const videoName = videoFile.name;
        const videoObjectURL = URL.createObjectURL(videoFile);
        let subtitleSrc = '';

        if (subtitleFile) {
            if (subtitleFile.name.endsWith('.srt')) {
                // Convert SRT to VTT
                const reader = new FileReader();
                reader.onload = function (ev: ProgressEvent<FileReader>) {
                    if (typeof ev.target?.result !== 'string') return;
                    // Dynamically import srt2vtt
                    import('../SubtitleSelector/srt2vtt').then((mod) => {
                        const converted = mod.default(ev.target!.result as string);
                        const vttBlob = new Blob([converted], { type: 'text/vtt' });
                        subtitleSrc = URL.createObjectURL(vttBlob);
                        setSelectedVideo((prev) => ({
                            ...prev,
                            videoUrl: videoObjectURL,
                            videoName,
                            subtitleSrc,
                        }));
                        router.push('/screen');
                    });
                };
                reader.readAsText(subtitleFile);
                return; // Wait for async
            } else {
                // vtt file
                subtitleSrc = URL.createObjectURL(subtitleFile);
            }
        }

        setSelectedVideo((prev) => ({
            ...prev,
            videoUrl: videoObjectURL,
            videoName,
            subtitleSrc,
        }));
        router.push('/screen');
    };

    const onDrag = (e: React.DragEvent<HTMLDivElement>) => {
        console.log('dragging');
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!e.dataTransfer.files || !e.dataTransfer.files[0]) {
            return;
        }

        const file = e.dataTransfer.files[0];
        const videoName = file.name;
        const objectURL = URL.createObjectURL(file);
        setSelectedVideo((prev) => {
            return {
                ...prev,
                videoUrl: objectURL,
                videoName,
            };
        });

        router.push('/screen');
    };

    return (
        <div
            onDrop={onDrop}
            onDragEnter={onDrag}
            onDragOver={onDrag}
            onDragLeave={onDrag}
            className='VideoSelector'
        >
            <div
                className={`VideoDragSelector ${!dragActive ? 'hidden' : ''} `}
            />

            <button onClick={onClick} className='default-button'>
                <img
                    className='inline-block align-top'
                    src={pressplay.src}
                    width='30px'
                    alt='Press Play icon'
                />
                &nbsp;
                <span>Select a video file</span>
            </button>
            <input
                type='file'
                ref={fileField}
                hidden={true}
                accept='.mp4,.mkv,.webm,.mov,video/mp4,video/x-m4v,video/*,.srt,.vtt,text/vtt,application/x-subrip'
                multiple
                onChange={onFileAdded}
            />
        </div>
    );
}

export default VideoSelector;
