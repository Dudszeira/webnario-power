'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  source: 'upload' | 'youtube';
  url: string;
  initialOffset: number; // seconds to seek to on load
  videoDuration?: number; // accepted for API compatibility but not rendered
  onTimeUpdate?: (seconds: number) => void;
  onStarted?: () => void;
  allowPause?: boolean; // if false (default for upload), hides play/pause button
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

export default function VideoPlayer({ source, url, initialOffset, onTimeUpdate, onStarted, allowPause = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoStartAttemptedRef = useRef(false);

  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);

  const [showToast, setShowToast] = useState(false);

  const playTimestampRef = useRef<number | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ytIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks whether the user intentionally paused (vs YouTube auto-pausing)
  const userPausedRef = useRef(false);

  // Trigger Toast Notification
  function triggerToast() {
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 2500);
  }

  // Record wall-clock start time when play begins (used by the security guard)
  useEffect(() => {
    if (!started) return;
    playTimestampRef.current = Date.now();
  }, [started]);

  // Auto-start upload video on mount (muted to satisfy browser autoplay policy)
  useEffect(() => {
    if (source !== 'upload' || !url || autoStartAttemptedRef.current) return;
    autoStartAttemptedRef.current = true;

    const video = videoRef.current;
    if (!video) return;

    const tryStart = () => {
      video.currentTime = initialOffset;
      video.muted = true;
      setMuted(true);
      video.play()
        .then(() => {
          setStarted(true);
          setPlaying(true);
          onStarted?.();
        })
        .catch(() => {
          // Autoplay blocked — cover screen stays so user can click to start
        });
    };

    if (video.readyState >= 2) {
      tryStart();
    } else {
      video.addEventListener('canplay', tryStart, { once: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, url]);

  // Sync volume & mute for both players
  useEffect(() => {
    if (source === 'upload') {
      const video = videoRef.current;
      if (video) {
        video.volume = muted ? 0 : volume / 100;
        video.muted = muted;
      }
    } else if (source === 'youtube' && ytPlayerRef.current) {
      if (ytPlayerRef.current.setVolume) {
        ytPlayerRef.current.setVolume(muted ? 0 : volume);
      }
      if (ytPlayerRef.current.mute && ytPlayerRef.current.unMute) {
        if (muted) ytPlayerRef.current.mute();
        else ytPlayerRef.current.unMute();
      }
    }
  }, [volume, muted, source]);

  // Upload Player Logic
  useEffect(() => {
    if (source !== 'upload') return;
    const video = videoRef.current;
    if (!video) return;

    const handleTime = () => {
      const cur = Math.floor(video.currentTime);
      onTimeUpdate?.(cur);

      // Security Guard: Prevent skipping forward beyond live simulation
      const currentLiveLimit = initialOffset + (playTimestampRef.current ? Math.floor((Date.now() - playTimestampRef.current) / 1000) : 0);
      if (video.currentTime > currentLiveLimit + 2) {
        video.currentTime = Math.max(0, currentLiveLimit);
        triggerToast();
      }
    };

    video.addEventListener('timeupdate', handleTime);
    return () => video.removeEventListener('timeupdate', handleTime);
  }, [source, onTimeUpdate, initialOffset]);

  function startUpload() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = initialOffset;
    video.play()
      .then(() => {
        setPlaying(true);
      })
      .catch(() => {});
    setStarted(true);
    onStarted?.();
  }

  // YouTube Player Logic
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
          onReady: (event: any) => {
            // Muted autoplay via JS API (browsers allow muted programmatic play)
            event.target.mute();
            event.target.seekTo(initialOffset, true);
            event.target.playVideo();
          },
          onStateChange: (e: any) => {
            const YT_PAUSED = 2;
            const YT_PLAYING = 1;
            const YT_BUFFERING = 3;

            if (e.data === YT_PAUSED) {
              if (!userPausedRef.current) {
                // YouTube auto-paused (e.g. "are you still watching?") — resume silently
                if (ytPlayerRef.current) ytPlayerRef.current.playVideo();
                return;
              }
              // User intentionally paused — show overlay
              userPausedRef.current = false;
              setPlaying(false);
              setBuffering(false);
              return;
            }

            const isPlaying = e.data === YT_PLAYING;
            const isBuffering = e.data === YT_BUFFERING;
            setBuffering(isBuffering);
            setPlaying(isPlaying);
            if (isPlaying) {
              setStarted(true);
              setBuffering(false);
              onStarted?.();
              // Unmute after a brief moment once playback is confirmed
              setTimeout(() => {
                if (ytPlayerRef.current) {
                  ytPlayerRef.current.unMute?.();
                  ytPlayerRef.current.setVolume?.(100);
                  setMuted(false);
                }
              }, 400);
            }
          },
        },
      });

      ytIntervalRef.current = setInterval(() => {
        const player = ytPlayerRef.current;
        if (player && typeof player.getCurrentTime === 'function') {
          const cur = Math.floor(player.getCurrentTime());
          onTimeUpdate?.(cur);

          // Security Guard: Prevent skipping forward beyond live simulation
          const currentLiveLimit = initialOffset + (playTimestampRef.current ? Math.floor((Date.now() - playTimestampRef.current) / 1000) : 0);
          if (cur > currentLiveLimit + 2) {
            player.seekTo(Math.max(0, currentLiveLimit), true);
            triggerToast();
          }
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
  }, [source, url, initialOffset, onTimeUpdate, onStarted]);

  function startYT() {
    const player = ytPlayerRef.current;
    if (player) {
      if (player.seekTo) player.seekTo(initialOffset, true);
      if (player.playVideo) player.playVideo();
      if (player.unMute) player.unMute();
      if (player.setVolume) player.setVolume(100);
    }
    setStarted(true);
    setPlaying(true);
    onStarted?.();
  }

  function togglePlay() {
    if (source === 'upload') {
      if (!allowPause) return; // upload leads cannot pause
      const video = videoRef.current;
      if (video) {
        if (playing) {
          video.pause();
          setPlaying(false);
        } else {
          video.play().catch(() => {});
          setPlaying(true);
        }
      }
    } else {
      const player = ytPlayerRef.current;
      if (player) {
        if (playing) {
          userPausedRef.current = true;
          player.pauseVideo();
          setPlaying(false);
        } else {
          userPausedRef.current = false;
          player.playVideo();
          setPlaying(true);
        }
      }
    }
  }

  function handleVolumeChange(val: number) {
    setVolume(val);
    if (val === 0) setMuted(true);
    else setMuted(false);
  }

  // RENDER PLAYER
  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden select-none bg-black group"
      style={{ aspectRatio: '16/9', borderRadius: 12 }}
    >

      {/* 🔇 MUTED NUDGE — shown when upload starts muted */}
      {source === 'upload' && started && muted && (
        <button
          onClick={() => setMuted(false)}
          className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white text-[10.5px] font-bold tracking-wide hover:bg-black/90 transition-colors"
        >
          <svg className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="currentColor" stroke="none" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
          Clique para ativar o som
        </button>
      )}

      {/* ⏱ TOAST DE SEGURANÇA */}
      {showToast && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 bg-black/90 text-white font-bold px-5 py-3 rounded-lg border-l-4 border-blue-500 shadow-2xl backdrop-blur-sm pointer-events-none transition-all duration-300 scale-100 whitespace-nowrap text-xs md:text-sm animate-bounce">
          ⏱ Isso é ao vivo — não é possível avançar
        </div>
      )}

      {/* 🛡️ BLOQUEADORES DE EVENTO DE CLIQUE DO YOUTUBE (Z-INDEX 10) */}
      {source === 'youtube' && (
        <>
          <div className="absolute top-0 left-0 right-0 h-[65px] z-10 cursor-default bg-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-[65px] z-10 cursor-default bg-transparent" />
          <div className="absolute inset-0 z-10 bg-transparent" onContextMenu={(e) => e.preventDefault()} />
        </>
      )}

      {/* SOURCES */}
      {source === 'youtube' ? (
        <div id="yt-player" className="w-full h-full pointer-events-none" />
      ) : (
        url && (
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
        )
      )}

      {/* ▶ OVERLAY DE PLAY QUANDO PAUSADO */}
      {started && !playing && !buffering && (source === 'youtube' || allowPause) && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center cursor-pointer"
          style={{ background: 'rgba(0,0,0,0.38)' }}
          onClick={togglePlay}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center transition-transform hover:scale-105"
            style={{ background: 'rgba(37,99,235,0.88)', boxShadow: '0 0 32px rgba(37,99,235,0.5)' }}
          >
            <svg className="w-6 h-6 fill-white ml-1" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* 🎬 COVER DE INÍCIO */}
      {!started && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 bg-black/85 backdrop-blur-md hover:bg-black/75"
          onClick={source === 'youtube' ? startYT : startUpload}
        >
          <div className="w-[76px] h-[76px] rounded-full bg-blue-500/10 flex items-center justify-center transition-all duration-300 hover:scale-105 group-hover:bg-blue-500/20">
            <div className="w-[58px] h-[58px] rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/40 transition-transform duration-200">
              <svg className="w-6 h-6 fill-white ml-1" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
          <p className="text-white font-bold mt-4 text-base tracking-wide uppercase">Clique para assistir ao vivo</p>
        </div>
      )}

      {/* 🎛️ CONTROLES PERSONALIZADOS (Z-INDEX 20) */}
      {started && (
        <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col px-4 pb-3 pt-8 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 select-none">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Play / Pause button — only for YouTube or when allowPause is true */}
              {(source === 'youtube' || allowPause) && (
                <button
                  onClick={togglePlay}
                  className="w-8 h-8 flex items-center justify-center text-white hover:text-blue-400 transition-colors"
                  title={playing ? 'Pausar' : 'Reproduzir'}
                >
                  {playing ? (
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              )}

            </div>

            <div className="flex items-center gap-3">
              {/* Mute Button */}
              <button
                onClick={() => setMuted(!muted)}
                className="w-8 h-8 flex items-center justify-center text-white hover:text-blue-400 transition-colors"
                title={muted ? 'Ativar som' : 'Mudo'}
              >
                {muted ? (
                  <svg className="w-5 h-5 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="currentColor" stroke="none" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="currentColor" stroke="none" />
                    <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                  </svg>
                )}
              </button>

              {/* Volume Slider */}
              <input
                type="range"
                min="0"
                max="100"
                value={muted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-16 md:w-20 h-1 rounded-lg bg-white/20 appearance-none cursor-pointer accent-blue-500 outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
