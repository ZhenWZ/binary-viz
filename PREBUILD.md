# Binary Data Visualizer v1.1.0 — Prebuild

This branch contains prebuilt production artifacts. No build step required.

## Quick Setup

```bash
# Clone just this branch
git clone -b prebuild/v1.1.0 --single-branch https://github.com/ZhenWZ/binary-viz.git
cd binary-viz

# Install runtime dependency
npm install express

# Start the server
NODE_ENV=production node dist/index.js
```

The app will be available at `http://localhost:3000`.

## What's Included

```
dist/
├── index.js                          # Node.js Express server
└── public/
    ├── index.html                    # Main app (367 KB)
    └── assets/
        ├── index-Bs53-4p0.js         # App bundle (551 KB)
        └── index-D3YVVmGp.css        # Styles (124 KB)
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3000`  | Server port |
| `NODE_ENV` | —     | Set to `production` for correct static file serving |

## Changes in v1.1.0

**Bug Fixes (#1–#10):**
- Fix PyTorch compressed ZIP entry decoding
- Fix histogram crash on large arrays (>100k elements)
- Add int64/uint64 precision loss warning (values > 2⁵³)
- Fix hex display offset, median calculation, compare mode reset
- Fix `formatBytes` for files > 1 TB
- Fix DiffSummaryBar memory usage
- Improve text parser robustness
- Add feedback for empty/zero-byte files

**New:**
- CI test infrastructure (94 unit tests)
- GitHub Actions workflows for testing and releases
- Type safety improvements
