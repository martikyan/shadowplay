import logo from '@/assets/logo.png';
import './App.css';
import VideoSelector from '@/components/VideoSelector/VideoSelector';
import Fork from '@/components/Fork/Fork';

export default function Home() {
    return (
        <div className='App'>
            <header className='App-header'>
                <div className='App-logo flex content-center items-center '>
                    <div className='App-icon'>
                        <img src={logo.src} width='15px' alt='logo' />
                    </div>
                    <span className='App-name'>ShadowPlay</span>
                </div>
                <Fork />
            </header>
            <div className='App-body'>
                <div className='App-information' style={{maxWidth: 920, margin: '0 auto', textAlign: 'left'}}> 
                    <h1 style={{fontSize: '2.2rem', lineHeight: 1.15, marginBottom: 12}}>ShadowPlay – Practice Intonation & Pronunciation by Shadowing Any Video</h1>
                    <h5 style={{fontSize: '1rem', fontWeight: 400, lineHeight: 1.45, opacity: .9, marginTop: 0}}>
                        Load a local video + subtitles (SRT / WebVTT) and drill sentences: set start / end marks, auto‑loop tricky lines, jump cue‑by‑cue (J / L), slow playback, amplify volume, and keep everything 100% on‑device for privacy.
                    </h5>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 22}}>
                        <div style={{flex: '1 1 300px', minWidth: 280}}>
                            <h3 style={{margin: '4px 0 8px'}}>Core Features</h3>
                            <ul style={{margin: 0, paddingLeft: 18, lineHeight: 1.5}}>
                                <li>Open local video instantly (no upload)</li>
                                <li>Add subtitles: SRT or WebVTT</li>
                                <li>Mark start (W) / end (E) and auto‑repeat segments</li>
                                <li>Cue navigation: previous / next subtitle (J / L)</li>
                                <li>Precise skips: U / O (configurable)</li>
                                <li>Configurable long skips: ← / →</li>
                                <li>Pass mode to temporarily ignore auto‑rewinds (P)</li>
                                <li>Playback speed control (0.25× – 2×)</li>
                                <li>Volume boost up to 400% (VLC‑style)</li>
                                <li>All data stays local (privacy‑first)</li>
                            </ul>
                        </div>
                        <div style={{flex: '1 1 300px', minWidth: 280}}>
                            <h3 style={{margin: '4px 0 8px'}}>Why Shadowing?</h3>
                            <p style={{margin: '0 0 8px', lineHeight: 1.5}}>
                                Shadowing helps you internalize rhythm, melody, and pronunciation by instantly imitating native speech. ShadowPlay removes friction: loop a sentence, adjust pace, and stay focused.
                            </p>
                            <h3 style={{margin: '16px 0 8px'}}>Keyboard Essentials</h3>
                            <ul style={{margin: 0, paddingLeft: 18, lineHeight: 1.5, fontSize: '.95rem'}}>
                                <li><b>Space / K</b>: Play / Pause</li>
                                <li><b>J / L</b>: Prev / Next subtitle cue</li>
                                <li><b>W / E</b>: Toggle start / end mark</li>
                                <li><b>U / O</b>: Fine skip back / forward</li>
                                <li><b>← / →</b>: Long skip (configurable)</li>
                                <li><b>P</b>: Toggle Pass mode</li>
                                <li><b>↑ / ↓</b>: Volume / Amplify</li>
                            </ul>
                        </div>
                        <div style={{flex: '1 1 260px', minWidth: 260}}>
                            <h3 style={{margin: '4px 0 8px'}}>Quick Start</h3>
                            <ol style={{margin: 0, paddingLeft: 20, lineHeight: 1.5}}>
                                <li>Select a video below.</li>
                                <li>Load matching subtitles (SRT / VTT).</li>
                                <li>Press W at a sentence start, E at its end.</li>
                                <li>Let auto‑repeat train your intonation.</li>
                                <li>Adjust speed / volume boost as needed.</li>
                            </ol>
                            <p style={{margin: '12px 0 0', fontSize: '.85rem', opacity: .75}}>Tip: Use Pass mode (P) briefly after manual navigation to prevent unwanted jumps.</p>
                        </div>
                    </div>
                </div>
                <div style={{marginTop: 32, width: '100%'}}>
                    <VideoSelector />
                </div>
                <div className='App-Feature-Notes' style={{marginTop: 40}}>
                    <div>
                        <p>
                            Based on:&nbsp;
                            <a
                                href='https://github.com/ifedapoolarewaju/simplevideoplayer'
                                target='_blank'
                                rel='noopener noreferrer'
                            >simplevideoplayer</a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
