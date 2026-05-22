'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  source: 'upload' | 'youtube';
  url: string;
  initialOffset: number; // seconds to seek to on load
  onTimeUpdate?: (seconds: number) => void;
  onStarted?: () => void;
};

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : url.length === 11 ? url : null;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export default function VideoPlayer({ source, url, initialOffset, onTimeUpdate, onStarted }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [ytReady, setYtReady] = useState(false);

  // Upload player
  useEffect(() => {
    if (source !== 'upload') return;
    const video = videoRef.current;
    if (!video) return;

    const handleTime = () => {
      onTimeUpdate?.(Math.floor(video.currentTime));
    };

    video.addEventListener('timeupdate', handleTime);
    return () => video.removeEventListener('timeupdate', handleTime);
  }, [source, onTimeUpdate]);

  function startUpload() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = initialOffset;
    video.play().catch(() => {});
    setStarted(true);
    onStarted?.();
  }

  // YouTube player
  const ytIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (source !== 'youtube') return;

    function initPlayer() {
      const videoId = extractYouTubeId(url);
      if (!videoId) return;

      ytPlayerRef.current = new window.YT.Player('yt-player', {
        videoId,
        playerVars: {
          controls: 0,
          disablekb: 1,
          rel: 0,
          modestbranding: 1,
          fs: 0,
          iv_load_policy: 3,
          autoplay: 0,
          start: initialOffset,
        },
        events: {
          onReady: () => setYtReady(true),
          onStateChange: (e: any) => {
            if (e.data === 1) onStarted?.();
          },
        },
      });

      // Store interval in ref so cleanup always works (sync or async path)
      ytIntervalRef.current = setInterval(() => {
        if (ytPlayerRef.current?.getCurrentTime) {
          onTimeUpdate?.(Math.floor(ytPlayerRef.current.getCurrentTime()));
        }
      }, 1000);
    }

    if (window.YT?.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = () => initPlayer();
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }

    return () => {
      if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
    };
  }, [source, url, initialOffset]);

  function startYT() {
    if (ytPlayerRef.current?.seekTo) {
      ytPlayerRef.current.seekTo(initialOffset, true);
    }
    if (ytPlayerRef.current?.playVideo) {
      ytPlayerRef.current.playVideo();
    }
    setStarted(true);
    onStarted?.();
  }

  if (source === 'youtube') {
    return (
      <div ref={containerRef} className="relative w-full h-full video-wrapper select-none" style={{ aspectRatio: '16/9' }}>
        <div id="yt-player" className="w-full h-full" />

        {/* Overlay to block YT controls / clicks */}
        <div
          className="absolute inset-0 z-10"
          style={{ background: 'transparent' }}
          onContextMenu={(e) => e.preventDefault()}
        />

        {!started && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center cursor-pointer"
            style={{ background: 'rgba(0,0,0,0.72)' }}
            onClick={startYT}
          >
            <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(145deg,#2a9fd6,#1a6fb5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 24px rgba(26,111,181,0.45)' }}>
                <svg style={{ width: 30, height: 30, fill: '#fff', marginLeft: 4 }} viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            <p className="text-white font-semibold mt-4 text-lg">Clique para assistir ao vivo</p>
          </div>
        )}
      </div>
    );
  }

  // Upload player
  return (
    <div ref={containerRef} className="relative w-full h-full video-wrapper select-none" style={{ aspectRatio: '16/9' }}>
      {url ? (
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ display: started ? 'block' : 'none' }}
          playsInline
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
        >
          <source src={url} />
        </video>
      ) : null}

      {!started && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
          style={{ background: '#0a0a0f' }}
          onClick={startUpload}
        >
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(145deg,#2a9fd6,#1a6fb5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 24px rgba(26,111,181,0.45)' }}>
              <svg style={{ width: 30, height: 30, fill: '#fff', marginLeft: 4 }} viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
          <p className="text-white font-semibold mt-4 text-lg">Clique para assistir ao vivo</p>
        </div>
      )}
    </div>
  );
}
