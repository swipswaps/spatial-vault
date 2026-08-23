import { useRef, useState, useCallback, type ChangeEvent } from 'react';
import { Play, Pause, Volume2, VolumeX, Captions, AlertTriangle } from 'lucide-react';

interface WebGLPlayerProps {
  src: string;
  vttSrc?: string;
  initialTime?: number;
  title?: string;
  onTimeUpdate?: (seconds: number) => void;
}

export function WebGLPlayerWithSubtitles({
  src,
  vttSrc,
  initialTime = 0,
  title,
  onTimeUpdate,
}: WebGLPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    if (initialTime > 0) video.currentTime = initialTime;
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    onTimeUpdate?.(video.currentTime);
  };

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch((e) => setError(e.message));
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const toggleSubtitles = useCallback(() => {
    setSubtitlesEnabled((prev) => !prev);
  }, []);

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const seekTime = parseFloat(e.target.value);
    video.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return (
    <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', background: '#0f172a', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid #334155' }}>
      {title && (
        <div style={{ color: '#f8fafc', fontSize: '0.9rem', fontWeight: 600, padding: '0.75rem 1rem 0.5rem' }}>
          {title}
        </div>
      )}

      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onVolumeChange={(e) => setIsMuted(e.currentTarget.muted)}
        style={{ width: '100%', aspectRatio: '16/9', background: '#000', display: 'block' }}
      >
        {vttSrc && (
          <track kind="subtitles" src={vttSrc} srcLang="en" label="English" default={subtitlesEnabled} />
        )}
      </video>

      {error && (
        <div style={{ padding: '0.5rem 1rem', color: '#f87171', fontSize: '0.8rem' }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <div style={{ padding: '0.75rem 1rem', background: '#1e293b' }}>
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          style={{ width: '100%', marginBottom: '0.75rem', accentColor: '#6366f1', cursor: 'pointer' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={togglePlay}
              style={{ background: '#6366f1', border: 'none', borderRadius: '0.375rem', color: '#fff', padding: '0.4rem 0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              <span style={{ fontSize: '0.85rem' }}>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            <button onClick={toggleMute} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            <button
              onClick={toggleSubtitles}
              style={{ background: 'transparent', border: 'none', color: subtitlesEnabled ? '#6366f1' : '#94a3b8', cursor: 'pointer' }}
            >
              <Captions size={18} />
            </button>

            <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#94a3b8' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <span style={{ fontSize: '0.75rem', color: '#10b981', fontFamily: 'monospace' }}>
            Native HTML5 Player
          </span>
        </div>
      </div>
    </div>
  );
}
