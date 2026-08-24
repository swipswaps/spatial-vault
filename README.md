# Spatial Media Vault

A video search and playback tool that combines semantic search, 3D timeline visualisation, and a hybrid video player (YouTube iframe + WebGL MP4 player).

## Features

- **Semantic search** – vector search over video transcripts using a FastAPI backend with SentenceTransformers + FAISS (optional, falls back to client‑side mock data).
- **3D spatial timeline** – interactive Three.js scene showing search results as clickable spheres.
- **Hybrid video player**:
  - YouTube URLs → embedded iframe with `modestbranding` and `rel=0` to reduce ads.
  - MP4 files → WebGL‑accelerated player with WASM subtitles (fallback to native VTT).
- **Debug panel** – shows video metadata, backend status, and captures the last 20 `console.error` messages directly in the UI.

## Live Demo

[https://swipswaps.github.io/spatial-vault/](https://swipswaps.github.io/spatial-vault/)

*Note: the live site will show "Client‑Side Static (Fallback)" because it cannot reach a local backend. To enable backend search, run the FastAPI server locally and use `npm run dev`.*

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm
- (optional) Python 3.9+ for the backend

### Frontend (GitHub Pages)

# Clone the repository
git clone https://github.com/swipswaps/spatial-vault.git
cd spatial-vault

# Install dependencies
npm install

# Run locally
npm run dev
Open http://localhost:5173

Backend (FastAPI – optional)

cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
The frontend will auto‑detect the backend and show "FastAPI Vector Search (Active)" when it's reachable.

Project Structure

spatial-vault/
├── public/                     # static assets (video.mp4, subtitles, wasm)
├── src/
│   ├── App.tsx                 # main app – search, timeline, hybrid player
│   ├── WebGLPlayerWithSubtitles.tsx  # MP4 + WebGL + WASM subtitles
│   ├── SpatialTimeline.tsx     # Three.js 3D timeline
│   ├── ThumbnailTimeline.tsx   # screenshot strip
│   ├── ErrorBoundary.tsx       # React error boundaries
│   └── ...
├── backend/                    # FastAPI + SentenceTransformers + FAISS
├── dist/                       # built frontend (deployed to gh-pages)
└── README.md
Deployment
The frontend is deployed to GitHub Pages via gh-pages:

npm run build
npx gh-pages -d dist
The backend is containerised (Docker) but not required for the live demo.

How the Video Player Works
URL contains	Player used
youtu.be or youtube.com	<iframe> embed (with modestbranding)
anything else (MP4)	WebGLPlayerWithSubtitles (WebGL + WASM)
The debug panel (click Show Debug) shows the current URL, player type, readyState, and any errors – making it easy to diagnose playback issues.

Known Issues
Local Network Access warnings: The live site tries to reach http://localhost:8000/health for backend health checks. This fails and is expected – the warnings do not affect video playback.

YouTube ads: Even with modestbranding=1&rel=0, YouTube may still show ads to non‑Premium users. YouTube Premium subscribers should see no ads if signed in.

License
MIT (or whichever you choose)

Contributing
Open an issue or pull request. For major changes, please discuss first.

Enjoy your Spatial Media Vault! 🚀
