import type { Metadata } from 'next';
import { GoogleTagManager } from '@next/third-parties/google';
import { Inter } from 'next/font/google';
import './globals.css';
import VideoContextProvider from '@/components/VideoContextProvider/VideoContextProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'ShadowPlay - Video Player for Language Learning & Shadowing',
    description:
        'ShadowPlay is a browser-based video player designed for language learners to practice shadowing, improve intonation, and master pronunciation. Play your own videos locally, add subtitles (SRT or WebVTT), and use custom controls crafted for language learning and shadowing practice. All processing is local—your videos and subtitles never leave your device.',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang='en'>
            <GoogleTagManager gtmId='UA-172486649-1' />
            <body className={inter.className}>
                <noscript>
                    ShadowPlay is a video player for language learners to practice shadowing, intonation, and pronunciation. Play your own videos locally, add subtitles, and use custom controls for effective language learning. All processing is local—your files never leave your device.
                </noscript>
                <VideoContextProvider>{children}</VideoContextProvider>
            </body>
        </html>
    );
}
