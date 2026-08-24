/**
 * App.tsx – Main entry point with search, timeline, and player.
 * YouTube URLs → iframe, MP4 → WebGLPlayerWithSubtitles.
 */
import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import { Search, Zap, Server, ExternalLink, Play, Maximize2, Minimize2, Bug } from 'lucide-react';
import { SpatialTimeline, SpatialNode } from './SpatialTimeline';
import { WebGLPlayerWithSubtitles } from './WebGLPlayerWithSubtitles';
import { ThumbnailTimeline } from './ThumbnailTimeline';
import { ErrorBoundary } from './ErrorBoundary';
import './App.css';

interface SearchItem {
  id: string;
  title: string;
  timestamp: string;
  seconds: number;
  snippet: string;
  category: string;
  video_url: string;
  subtitle_url?: string;
  score?: number;
}

const DEFAULT_VIDEO_URL = '/video.mp4';
const FALLBACK_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const DEFAULT_SUBTITLE_URL = './subtitles/demo.vtt';

const MOCK_DATA: SearchItem[] = [
  {
    id: '1',
    title: 'Big Buck Bunny: Start',
    timestamp: '00:00:00',
    seconds: 0,
    snippet: 'Open-source movie from the Blender Foundation.',
    category: 'Video',
    video_url: DEFAULT_VIDEO_URL,
    subtitle_url: DEFAULT_SUBTITLE_URL,
    score: 1.0,
  },
  {
    id: '2',
    title: 'Big Buck Bunny: Middle',
    timestamp: '00:00:30',
    seconds: 30,
    snippet: 'Jump to 30 seconds into the movie.',
    category: 'Video',
    video_url: DEFAULT_VIDEO_URL,
    subtitle_url: DEFAULT_SUBTITLE_URL,
    score: 1.0,
  },
  {
    id: '3',
    title: 'Big Buck Bunny: Later',
    timestamp: '00:01:00',
    seconds: 60,
    snippet: 'Jump to 1 minute into the movie.',
    category: 'Video',
    video_url: DEFAULT_VIDEO_URL,
    subtitle_url: DEFAULT_SUBTITLE_URL,
    score: 1.0,
  },
];

function toSpatialNodes(items: SearchItem[]): SpatialNode[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    timestamp: item.timestamp,
    seconds: item.seconds,
    category: item.category,
  }));
}

function isYouTubeUrl(url: string): boolean {
  return url.includes('youtu.be') || url.includes('youtube.com');
}

function getYouTubeEmbedUrl(url: string, startSeconds?: number): string {
  // Extract video ID more robustly
  let videoId = '';
  // Try youtu.be format first
  let match = url.match(/youtu\.be\/([^?&]+)/);
  if (match) {
    videoId = match[1];
  } else {
    // Try youtube.com/watch?v=...
    match = url.match(/youtube\.com\/watch\?v=([^&]+)/);
    if (match) {
      videoId = match[1];
    } else {
      // Try youtube.com/embed/...
      match = url.match(/youtube\.com\/embed\/([^?&]+)/);
      if (match) {
        videoId = match[1];
      }
    }
  }
  if (!videoId) {
    console.warn('Could not extract YouTube video ID from:', url);
    return url; // fallback (should not happen)
  }
  let embed = `https://www.youtube.com/embed/${videoId}`;
  const params = new URLSearchParams();
  // Add modestbranding and rel=0 to reduce ads
  params.set('modestbranding', '1');
  params.set('rel', '0');
  if (startSeconds && startSeconds > 0) {
    params.set('start', Math.floor(startSeconds).toString());
  }
  // Add autoplay
  params.set('autoplay', '1');
  embed += '?' + params.toString();
  console.log('Embed URL:', embed);
  return embed;
}

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>(MOCK_DATA);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeVideoUrl, setActiveVideoUrl] = useState(DEFAULT_VIDEO_URL);
  const [activeInitialTime, setActiveInitialTime] = useState(0);
  const [activeSubtitleUrl, setActiveSubtitleUrl] = useState(DEFAULT_SUBTITLE_URL);
  const [activeTitle, setActiveTitle] = useState('Big Buck Bunny');
  const [playerHeight, setPlayerHeight] = useState(480);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [consoleErrors, setConsoleErrors] = useState<string[]>([]);

  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      setConsoleErrors(prev => [...prev.slice(-19), msg]);
      originalConsoleError(...args);
    };
    return () => { console.error = originalConsoleError; };
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('http://localhost:8000/health', {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        setIsBackendConnected(data.status === 'healthy' && data.index_initialized === true);
        return;
      }
    } catch {}
    setIsBackendConnected(false);
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const playSearchItem = useCallback((item: SearchItem) => {
    let url = item.video_url || DEFAULT_VIDEO_URL;
    setActiveTitle(item.title);
    setActiveVideoUrl(url);
    setActiveInitialTime(item.seconds || 0);
    setActiveSubtitleUrl(item.subtitle_url || DEFAULT_SUBTITLE_URL);
  }, []);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setResults(MOCK_DATA);
      return;
    }
    setIsSearching(true);
    if (isBackendConnected === true) {
      try {
        const res = await fetch('http://localhost:8000/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, top_k: 10 }),
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setIsSearching(false);
          return;
        }
      } catch {
        setIsBackendConnected(false);
      }
    }
    const lower = query.toLowerCase();
    const filtered = MOCK_DATA.filter(
      (item) => item.title.toLowerCase().includes(lower) || item.snippet.toLowerCase().includes(lower)
    );
    setResults(filtered);
    setIsSearching(false);
  };

  const handleSelectSpatialNode = useCallback((node: SpatialNode) => {
    const item = results.find((r) => r.id === node.id);
    if (item) playSearchItem(item);
  }, [results, playSearchItem]);

  const handleThumbnailSelect = useCallback((videoUrl: string, timestamp: number) => {
    setActiveVideoUrl(videoUrl);
    setActiveInitialTime(timestamp);
    setActiveTitle(`Thumbnail: ${videoUrl} @ ${timestamp}s`);
  }, []);

  const getStatus = () => {
    if (isBackendConnected === null) return { text: 'Checking backend...', color: '#f59e0b' };
    if (isBackendConnected === true) return { text: 'FastAPI Vector Search (Active)', color: '#10b981' };
    return { text: 'Client-Side Static (Fallback)', color: '#f59e0b' };
  };

  const status = getStatus();
  const toggleHeight = () => setPlayerHeight(prev => prev === 480 ? 720 : 480);
  const toggleDebug = () => setShowDebug(prev => !prev);

  const handleVideoError = (src: string) => {
    if (src === DEFAULT_VIDEO_URL) {
      setActiveVideoUrl(FALLBACK_VIDEO_URL);
    }
  };

  const renderPlayer = () => {
    // Force iframe for any YouTube URL
    if (isYouTubeUrl(activeVideoUrl)) {
      const embedUrl = getYouTubeEmbedUrl(activeVideoUrl, activeInitialTime);
      return (
        <iframe
          src={embedUrl}
          title={activeTitle}
          width="100%"
          height="100%"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ borderRadius: '8px' }}
        />
      );
    }
    // MP4: WebGLPlayer
    return (
      <WebGLPlayerWithSubtitles
        src={activeVideoUrl}
        subtitleSrc={activeSubtitleUrl}
        vttFallbackSrc={activeSubtitleUrl || DEFAULT_SUBTITLE_URL}
        initialTime={activeInitialTime}
        title={activeTitle}
        onDebugUpdate={setDebugInfo}
        onError={handleVideoError}
      />
    );
  };

  return (
    <div className="container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <Zap size={28} color="#6366f1" />
          <h1 style={{ margin: 0 }}>Spatial Media Vault</h1>
        </div>
        <div className="status-badge">
          <Server size={14} color={status.color} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {status.text}
          </span>
        </div>
      </header>

      <form onSubmit={handleSearch} className="search-box">
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="search-input"
            placeholder="Search transcripts or receipts via natural language..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="submit" className="btn" disabled={isSearching}>
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </form>

      <div className="card-grid">
        {results.map((item) => (
          <div key={item.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="badge">{item.category}</span>
              {item.score !== undefined && <span className="score-badge">{(item.score * 100).toFixed(0)}% match</span>}
            </div>
            <h3 className="card-title">{item.title}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.4', margin: 0 }}>
              {item.snippet}
            </p>
            <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                @{item.timestamp}
              </span>
              <button
                onClick={() => playSearchItem(item)}
                className="btn"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <Play size={12} /> Play Exact Frame <ExternalLink size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ErrorBoundary fallbackTitle="3D Spatial Timeline Error">
        <SpatialTimeline nodes={toSpatialNodes(results)} onSelectNode={handleSelectSpatialNode} />
      </ErrorBoundary>

      <div style={{ margin: '1.5rem 0 0.5rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button onClick={toggleHeight} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            {playerHeight === 480 ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            {playerHeight === 480 ? 'Taller' : 'Shorter'}
          </button>
          <button onClick={toggleDebug} style={{ background: 'transparent', border: '1px solid var(--border)', color: showDebug ? 'var(--accent)' : 'var(--text-muted)', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginLeft: '0.5rem' }}>
            <Bug size={14} />
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </button>
        </div>
      </div>

      <div className="player-wrapper" style={{ height: `${playerHeight}px` }}>
        <ErrorBoundary fallbackTitle="Video Player Error">
          {renderPlayer()}
        </ErrorBoundary>
      </div>

      {showDebug && (
        <div style={{
          margin: '0.5rem 0 1.5rem 0',
          padding: '0.75rem 1rem',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          color: '#e2e8f0',
          overflow: 'auto',
          maxHeight: '300px',
          userSelect: 'text',
        }}>
          <div><strong>Video Debug Info</strong></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.3rem 1rem', marginTop: '0.3rem' }}>
            <span style={{ color: '#94a3b8' }}>URL:</span>
            <span style={{ wordBreak: 'break-all' }}>{debugInfo?.src || activeVideoUrl}</span>
            <span style={{ color: '#94a3b8' }}>Type:</span>
            <span>{isYouTubeUrl(activeVideoUrl) ? 'YouTube iframe' : 'MP4 (native)'}</span>
            <span style={{ color: '#94a3b8' }}>readyState:</span>
            <span>{debugInfo?.readyState !== undefined ? debugInfo.readyState : '—'}</span>
            <span style={{ color: '#94a3b8' }}>error:</span>
            <span style={{ color: debugInfo?.error ? '#f87171' : '#10b981' }}>
              {debugInfo?.error ? `Code ${debugInfo.error.code}: ${debugInfo.error.message}` : 'None'}
            </span>
            <span style={{ color: '#94a3b8' }}>video size:</span>
            <span>{debugInfo?.videoWidth && debugInfo?.videoHeight ? `${debugInfo.videoWidth}×${debugInfo.videoHeight}` : '—'}</span>
            <span style={{ color: '#94a3b8' }}>duration:</span>
            <span>{debugInfo?.duration ? `${debugInfo.duration.toFixed(2)}s` : '—'}</span>
          </div>
          <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
            <strong>Backend Status:</strong>
            <span style={{ color: isBackendConnected === true ? '#10b981' : isBackendConnected === null ? '#f59e0b' : '#f87171', marginLeft: '0.5rem' }}>
              {isBackendConnected === true ? '✅ Connected' : isBackendConnected === null ? '⏳ Checking...' : '❌ Not connected'}
            </span>
          </div>
          <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
            <strong>Console Errors (last 20):</strong>
            {consoleErrors.length === 0 ? (
              <span style={{ color: '#10b981', marginLeft: '0.5rem' }}>None captured</span>
            ) : (
              <div style={{ maxHeight: '100px', overflow: 'auto', marginTop: '0.3rem' }}>
                {consoleErrors.map((err, i) => (
                  <div key={i} style={{ color: '#f87171', fontSize: '0.75rem', padding: '0.1rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {err}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ThumbnailTimeline onSelectThumbnail={handleThumbnailSelect} />
    </div>
  );
}
