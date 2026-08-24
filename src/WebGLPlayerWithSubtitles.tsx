/**
 * WebGLPlayerWithSubtitles – renders MP4 with WebGL and subtitles.
 * Props:
 *   src          : MP4 URL
 *   subtitleSrc  : .vtt or .ass URL (used if WASM available)
 *   vttFallbackSrc: native VTT fallback (used if WASM fails)
 *   initialTime  : start seconds
 *   title        : displayed above controls
 *   onTimeUpdate : callback on progress
 *   onError      : called on video load failure
 *   onDebugUpdate: sends diagnostic info
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Captions, AlertTriangle } from 'lucide-react';

interface Props {
  src: string;
  subtitleSrc?: string;
  vttFallbackSrc?: string;
  initialTime?: number;
  title?: string;
  onTimeUpdate?: (seconds: number) => void;
  onError?: (src: string) => void;
  onDebugUpdate?: (info: any) => void;
}

export function WebGLPlayerWithSubtitles({
  src,
  subtitleSrc,
  vttFallbackSrc,
  initialTime = 0,
  title,
  onTimeUpdate,
  onError,
  onDebugUpdate,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const subCanvasRef = useRef<HTMLCanvasElement>(null);
  const workerInstanceRef = useRef<any>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [wasmFailed, setWasmFailed] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);

  const emitDebug = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const info = {
      src: video.src,
      isYouTube: false,
      readyState: video.readyState,
      error: video.error ? { code: video.error.code, message: video.error.message } : null,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      duration: video.duration || undefined,
    };
    if (onDebugUpdate) onDebugUpdate(info);
  }, [onDebugUpdate]);

  // --- WebGL renderer ---
  useEffect(() => {
    const canvas = glCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    let gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) return;

    const vsSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
      }
    `;
    const fsSource = `
      precision mediump float;
      uniform sampler2D u_image;
      varying vec2 v_texCoord;
      void main() {
        gl_FragColor = texture2D(u_image, v_texCoord);
      }
    `;
    const createShader = (glContext: WebGLRenderingContext, type: number, source: string) => {
      const shader = glContext.createShader(type);
      if (!shader) return null;
      glContext.shaderSource(shader, source);
      glContext.compileShader(shader);
      return shader;
    };
    const vertShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vertShader || !fragShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    let animationFrameId: number;
    const renderFrame = () => {
      if (video.readyState >= video.HAVE_CURRENT_DATA && !gl.isContextLost()) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          gl.viewport(0, 0, canvas.width, canvas.height);
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      animationFrameId = requestAnimationFrame(renderFrame);
    };
    renderFrame();

    return () => {
      cancelAnimationFrame(animationFrameId);
      gl.deleteTexture(texture);
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(texCoordBuffer);
      gl.deleteProgram(program);
    };
  }, [src]);

  // --- Subtitles (WASM + fallback) ---
  useEffect(() => {
    const video = videoRef.current;
    const subCanvas = subCanvasRef.current;
    if (!video || !subCanvas || !subtitleSrc) return;

    let isSubtitlesLoaded = false;
    const handleWorkerError = (event: ErrorEvent) => {
      if (event.filename && event.filename.includes('subtitles-octopus')) {
        console.warn('Worker error:', event.message);
        setWasmFailed(true);
      }
    };
    window.addEventListener('error', handleWorkerError);

    const fallbackTimer = setTimeout(() => {
      if (!isSubtitlesLoaded) {
        console.warn('WASM timeout → VTT fallback');
        setWasmFailed(true);
      }
    }, 3000);

    try {
      if ((window as any).SubtitlesOctopus) {
        workerInstanceRef.current = new (window as any).SubtitlesOctopus({
          video,
          canvas: subCanvas,
          subUrl: subtitleSrc,
          workerUrl: '/wasm/subtitles-octopus-worker.js',
          wasmUrl: '/wasm/subtitles-octopus-worker.wasm',
          fonts: ['/fonts/Roboto-Bold.ttf'],
          debug: false,
          onerror: (err: any) => {
            console.error('SubtitlesOctopus error:', err);
            setWasmFailed(true);
          },
          ondrop: () => {
            isSubtitlesLoaded = true;
            clearTimeout(fallbackTimer);
          },
        });
      } else {
        setWasmFailed(true);
      }
    } catch (err) {
      console.error('Failed to init SubtitlesOctopus:', err);
      setWasmFailed(true);
    }

    return () => {
      clearTimeout(fallbackTimer);
      window.removeEventListener('error', handleWorkerError);
      if (workerInstanceRef.current) {
        try { workerInstanceRef.current.dispose(); } catch (e) {}
        workerInstanceRef.current = null;
      }
    };
  }, [subtitleSrc]);

  // --- Video event handlers ---
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    if (initialTime > 0) {
      videoRef.current.currentTime = initialTime;
    }
    emitDebug();
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    setCurrentTime(current);
    if (onTimeUpdate) onTimeUpdate(current);
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    console.error('Video error:', video.error);
    if (onError) onError(video.src);
    emitDebug();
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleSubtitles = () => {
    if (workerInstanceRef.current && !wasmFailed) {
      if (subtitlesEnabled) workerInstanceRef.current.freeTrack();
      else if (subtitleSrc) workerInstanceRef.current.setTrackByUrl(subtitleSrc);
    }
    setSubtitlesEnabled(!subtitlesEnabled);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const seekTime = parseFloat(e.target.value);
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return (
    <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', background: '#0f172a', borderRadius: '0.75rem', overflow: 'hidden' }}>
      <video
        ref={videoRef}
        src={src}
        playsInline
        crossOrigin="anonymous"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onError={handleVideoError}
        style={{ display: 'none' }}
      >
        {wasmFailed && vttFallbackSrc && (
          <track kind="subtitles" src={vttFallbackSrc} default={subtitlesEnabled} srcLang="en" label="English" />
        )}
      </video>

      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000' }}>
        <canvas ref={glCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }} />
        {!wasmFailed && (
          <canvas ref={subCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }} />
        )}
      </div>

      <div style={{ padding: '0.75rem 1rem', background: '#1e293b' }}>
        {title && <div style={{ color: '#f8fafc', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>{title}</div>}
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
            <button onClick={togglePlay} style={{ background: '#6366f1', border: 'none', borderRadius: '0.375rem', color: '#fff', padding: '0.4rem 0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              <span style={{ fontSize: '0.85rem' }}>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
            <button onClick={toggleMute} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button onClick={toggleSubtitles} style={{ background: 'transparent', border: 'none', color: subtitlesEnabled ? '#6366f1' : '#94a3b8', cursor: 'pointer' }}>
              <Captions size={18} />
            </button>
            <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#94a3b8' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          <div>
            {wasmFailed ? (
              <span style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <AlertTriangle size={14} /> Native VTT Fallback Active
              </span>
            ) : (
              <span style={{ fontSize: '0.75rem', color: '#10b981', fontFamily: 'monospace' }}>
                WASM Engine Ready
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
