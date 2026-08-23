import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import { Search, Zap, Server, ExternalLink, Play } from 'lucide-react';
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

const DEFAULT_VIDEO_URL = 'https://media.w3.org/2010/05/sintel/trailer.mp4';
const DEFAULT_SUBTITLE_URL = './subtitles/demo.vtt';

const MOCK_DATA: SearchItem[] = [
  {
    id: '1',
    title: 'Sintel Trailer: Start',
    timestamp: '00:00:00',
    seconds: 0,
    snippet: 'Open-source movie trailer from the Blender Foundation.',
    category: 'Video',
    video_url: DEFAULT_VIDEO_URL,
    subtitle_url: DEFAULT_SUBTITLE_URL,
    score: 1.0,
  },
  {
    id: '2',
    title: 'Sintel Trailer: Middle',
    timestamp: '00:00:30',
    seconds: 30,
    snippet: 'Jump to 30 seconds into the trailer.',
    category: 'Video',
    video_url: DEFAULT_VIDEO_URL,
    subtitle_url: DEFAULT_SUBTITLE_URL,
    score: 1.0,
  },
  {
    id: '3',
    title: 'Sintel Trailer: Later',
    timestamp: '00:01:00',
    seconds: 60,
    snippet: 'Jump to 1 minute into the trailer.',
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

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>(MOCK_DATA);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeVideoUrl, setActiveVideoUrl] = useState(DEFAULT_VIDEO_URL);
  const [activeInitialTime, setActiveInitialTime] = useState(0);
  const [activeSubtitleUrl, setActiveSubtitleUrl] = useState(DEFAULT_SUBTITLE_URL);
  const [activeTitle, setActiveTitle] = useState('Sintel Trailer');

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
        // Only mark as connected if the index is initialized
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
    setActiveTitle(item.title);
    setActiveVideoUrl(item.video_url || DEFAULT_VIDEO_URL);
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
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        item.snippet.toLowerCase().includes(lower)
    );
    setResults(filtered);
    setIsSearching(false);
  };

  const handleSelectSpatialNode = useCallback(
    (node: SpatialNode) => {
      const item = results.find((r) => r.id === node.id);
      if (item) playSearchItem(item);
    },
    [results, playSearchItem]
  );

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
              {item.score !== undefined && (
                <span className="score-badge">{(item.score * 100).toFixed(0)}% match</span>
              )}
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
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
              >
                <Play size={12} /> Play Exact Frame <ExternalLink size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ErrorBoundary fallbackTitle="3D Spatial Timeline Error">
        <SpatialTimeline
          nodes={toSpatialNodes(results)}
          onSelectNode={handleSelectSpatialNode}
        />
      </ErrorBoundary>

      <div className="player-section">
        <ErrorBoundary fallbackTitle="WebGL Video Player Error">
          <WebGLPlayerWithSubtitles
            src={activeVideoUrl}
            vttSrc={activeSubtitleUrl}
            initialTime={activeInitialTime}
            title={activeTitle}
          />
        </ErrorBoundary>
      </div>

      <ThumbnailTimeline onSelectThumbnail={handleThumbnailSelect} />
    </div>
  );
}
