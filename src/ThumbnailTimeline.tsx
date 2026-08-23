import { useState, useRef } from 'react';

interface ThumbnailItem {
  filename: string;
  video_url: string;
  timestamp: number;
  dataUrl: string;
}

interface Props {
  onSelectThumbnail: (videoUrl: string, timestamp: number) => void;
}

const MAX_THUMBNAILS = 20;

function resizeImage(dataUrl: string, maxWidth: number, maxHeight: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      const ratio = maxWidth / maxHeight;
      let w = img.width;
      let h = img.height;
      if (w / h > ratio) { w = h * ratio; } else { h = w / ratio; }
      const sx = (img.width - w) / 2;
      const sy = (img.height - h) / 2;
      canvas.width = maxWidth;
      canvas.height = maxHeight;
      ctx.drawImage(img, sx, sy, w, h, 0, 0, maxWidth, maxHeight);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function ThumbnailTimeline({ onSelectThumbnail }: Props) {
  const [items, setItems] = useState<ThumbnailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (fileList: FileList, folderName: string) => {
    setLoading(true);
    setError(null);
    const entries: ThumbnailItem[] = [];
    const pattern = /^(.+)\?t=(\d+)\.png$/;

    const files = Array.from(fileList);
    for (const file of files) {
      if (entries.length >= MAX_THUMBNAILS) break;
      const name = file.name;
      const match = name.match(pattern);
      if (match) {
        const urlRaw = match[1];
        const timestamp = parseInt(match[2], 10);
        let videoUrl = urlRaw;
        if (urlRaw.startsWith('youtu.be_')) {
          videoUrl = 'https://youtu.be/' + urlRaw.replace('youtu.be_', '');
        } else if (urlRaw.startsWith('www.youtube.com_')) {
          videoUrl = 'https://' + urlRaw.replace('_', '/');
        } else if (!urlRaw.startsWith('http')) {
          videoUrl = 'https://' + urlRaw;
        }
        const rawDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        });
        if (rawDataUrl) {
          const resized = await resizeImage(rawDataUrl, 200, 112);
          entries.push({ filename: name, video_url: videoUrl, timestamp, dataUrl: resized });
        }
      }
    }
    entries.sort((a, b) => a.timestamp - b.timestamp);
    setItems(entries);
    setFolderName(folderName);
    setLoading(false);
    if (entries.length === 0) {
      setError('No matching PNG files found. Pattern: <name>?t=<number>.png');
    }
  };

  const selectFolderWithFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const firstFile = files[0];
    const folder = firstFile.webkitRelativePath ? firstFile.webkitRelativePath.split('/')[0] : 'Selected Folder';
    await processFiles(files, folder);
    e.target.value = '';
  };

  const selectFolderWithAPI = async () => {
    if (!('showDirectoryPicker' in window)) {
      selectFolderWithFileInput();
      return;
    }
    try {
      const dirHandle = await (window as any).showDirectoryPicker();
      setFolderName(dirHandle.name);
      setLoading(true);
      setError(null);

      const entries: ThumbnailItem[] = [];
      const pattern = /^(.+)\?t=(\d+)\.png$/;

      async function walkDir(handle: FileSystemDirectoryHandle) {
        for await (const entry of (handle as any).values()) {
          if (entries.length >= MAX_THUMBNAILS) break;
          const name = entry.name;
          if (entry.kind === 'file' && name.endsWith('.png')) {
            const match = name.match(pattern);
            if (match) {
              const urlRaw = match[1];
              const timestamp = parseInt(match[2], 10);
              let videoUrl = urlRaw;
              if (urlRaw.startsWith('youtu.be_')) {
                videoUrl = 'https://youtu.be/' + urlRaw.replace('youtu.be_', '');
              } else if (urlRaw.startsWith('www.youtube.com_')) {
                videoUrl = 'https://' + urlRaw.replace('_', '/');
              } else if (!urlRaw.startsWith('http')) {
                videoUrl = 'https://' + urlRaw;
              }
              const file = await entry.getFile();
              const rawDataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(file);
              });
              if (rawDataUrl) {
                const resized = await resizeImage(rawDataUrl, 200, 112);
                entries.push({ filename: name, video_url: videoUrl, timestamp, dataUrl: resized });
              }
            }
          } else if (entry.kind === 'directory') {
            try {
              const subHandle = await handle.getDirectoryHandle(name);
              await walkDir(subHandle);
            } catch {}
          }
        }
      }

      await walkDir(dirHandle);
      entries.sort((a, b) => a.timestamp - b.timestamp);
      setItems(entries);
      setLoading(false);
      if (entries.length === 0) {
        setError('No matching PNG files found. Pattern: <name>?t=<number>.png');
      }
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return;
      console.error('[Thumbnail] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const selectFolder = () => {
    if ('showDirectoryPicker' in window) {
      selectFolderWithAPI();
    } else {
      selectFolderWithFileInput();
    }
  };

  if (items.length === 0 && !loading && !error && !folderName) {
    return (
      <div style={{ margin: '2rem 0' }}>
        <button
          onClick={selectFolder}
          style={{ padding: '0.75rem 1.5rem', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 500 }}
        >
          📁 Select Screenshots Folder
        </button>
        {/* @ts-ignore – webkitdirectory is not in TypeScript definitions but works in all modern browsers */}
        <input
          ref={fileInputRef}
          type="file"
          // @ts-ignore
          webkitdirectory
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
        {!('showDirectoryPicker' in window) && (
          <span style={{ marginLeft: '1rem', fontSize: '0.8rem', color: '#fbbf24' }}>
            ⚠️ Using fallback (Firefox/Safari)
          </span>
        )}
      </div>
    );
  }

  if (loading) {
    return <div style={{ margin: '2rem 0', padding: '1rem', color: '#94a3b8' }}>⏳ Loading thumbnails from {folderName || 'folder'}...</div>;
  }

  if (error) {
    return (
      <div style={{ margin: '2rem 0', padding: '1rem', color: '#f87171', background: '#1e293b', borderRadius: '8px' }}>
        <strong>Error:</strong> {error}<br />
        <button onClick={() => { setError(null); setItems([]); }} style={{ marginTop: '0.5rem', padding: '0.3rem 1rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  if (items.length === 0 && !loading) {
    return (
      <div style={{ margin: '2rem 0', padding: '1rem', color: '#94a3b8', textAlign: 'center' }}>
        No thumbnails found.<br />
        <button onClick={selectFolder} style={{ marginTop: '0.5rem', padding: '0.3rem 1rem', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Select Another Folder</button>
      </div>
    );
  }

  return (
    <div style={{ margin: '2rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>📸 Screenshot Timeline ({items.length} / {MAX_THUMBNAILS}) {folderName && `– ${folderName}`}</h3>
        <button onClick={selectFolder} style={{ padding: '0.4rem 0.8rem', background: '#334155', color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>Change Folder</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto', padding: '0.5rem', border: '1px solid #334155', borderRadius: '8px', background: '#0f172a' }}>
        {items.map((item, idx) => (
          <div
            key={idx}
            onClick={() => onSelectThumbnail(item.video_url, item.timestamp)}
            style={{
              cursor: 'pointer',
              border: '2px solid transparent',
              borderRadius: '6px',
              overflow: 'hidden',
              transition: 'border-color 0.2s, transform 0.2s',
              background: '#1e293b',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#6366f1';
              e.currentTarget.style.transform = 'scale(1.03)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <img
              src={item.dataUrl}
              alt={item.filename}
              style={{ width: '100%', height: '100px', objectFit: 'cover', display: 'block', background: '#334155' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '';
                (e.target as HTMLImageElement).style.background = '#334155';
                (e.target as HTMLImageElement).textContent = '⚠️';
              }}
            />
            <div style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'monospace', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              @{item.timestamp}s
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
