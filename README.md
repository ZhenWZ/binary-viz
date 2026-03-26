# Binary Data Visualizer

A browser-based tool for inspecting, decoding, and comparing binary tensor dumps from PyTorch, NumPy, Safetensors, and raw binary files. Built with React, Vite, and Tailwind CSS, the application runs entirely in the browser with no server-side processing — all file parsing and decoding happens client-side via the JavaScript `ArrayBuffer` API.

---

## Features

### Decode Mode

Load a single binary file and inspect its contents as decoded numeric values. The tool **auto-detects** the file format and data type whenever possible, displaying a confidence badge alongside the detection result. You can always override the detected settings manually.

After decoding, the interface presents a statistics panel (min, max, mean, standard deviation, median), a value distribution histogram, and a paginated data table with optional hex byte display.

### Compare Mode

Compare two data sources side-by-side with element-by-element diff highlighting. Each side independently supports two source types:

| Source Type | Description |
|---|---|
| **Binary** | Any supported binary file (.bin, .pt, .ptx, .npy, .safetensors, .raw) |
| **Text** | A text file or pasted string containing numeric values (e.g., `tensor([1.0, 2.0, 3.0])`) |

This means you can compare binary-vs-binary, binary-vs-text, or text-vs-text. The comparison view includes a diff summary bar, match/difference counts with percentages, a visual diff map, and synchronized hover highlighting across both panels. A configurable **tolerance** parameter allows approximate matching for floating-point comparisons.

### Supported File Formats

| Format | Extensions | Auto-Detection | Notes |
|---|---|---|---|
| NumPy | `.npy` | High confidence | Reads the `.npy` header to extract dtype, shape, byte order, and data offset |
| PyTorch | `.pt`, `.ptx`, `.pth`, `.bin` | High confidence (with `.pkl`) | Parses the ZIP archive structure to locate tensor data entries |
| Safetensors | `.safetensors` | High confidence | Reads the JSON header to extract tensor metadata and data offsets |
| Raw binary | `.bin`, `.raw`, any | Low confidence (heuristic) | Guesses dtype from file extension and size divisibility |

For PyTorch and Safetensors files containing multiple tensors, a **tensor selector** dropdown lets you choose which tensor to inspect.

### Supported Data Types

| Category | Types |
|---|---|
| FP8 | `float8_e4m3` (OCP E4M3FN), `float8_e5m2` (OCP E5M2), `float8_e8m0` (MX scale format) |
| Floating Point | `float16` (IEEE 754), `bfloat16` (Brain float), `float32`, `float64` |
| Signed Integer | `int8`, `int16`, `int32`, `int64` |
| Unsigned Integer | `uint8`, `uint16`, `uint32`, `uint64` |
| Other | `bool` |

### Text Parsing

The text parser handles common tensor print formats from PyTorch and NumPy, including:

- `tensor([1.0, 2.0, 3.0, 4.0])` — PyTorch tensor repr
- `array([1.0, 2.0, 3.0])` — NumPy array repr
- `1.0 2.0 3.0 4.0` — space-separated values
- `1.0, 2.0, 3.0` — comma-separated values
- Special values: `NaN`, `inf`, `-inf`, `true`, `false`

---

## Prerequisites

- **Node.js** 18 or later
- **pnpm** 10 or later (the project uses pnpm as its package manager)

If you do not have pnpm installed, you can enable it via Node.js corepack:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

---

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd binary-viz
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Start the Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`. The Vite dev server supports hot module replacement, so any code changes will be reflected immediately in the browser.

### 4. Build for Production

```bash
pnpm build
```

This command runs `vite build` to produce an optimized static bundle in the `dist/public/` directory, followed by an esbuild step that bundles the minimal Express server for serving the static files.

### 5. Run the Production Build

```bash
pnpm start
```

This starts the Express server on port 3000 (or the port specified by the `PORT` environment variable), serving the built static files with client-side routing support.

---

## Usage Guide

### Decoding a Binary File

1. Open the application and ensure you are on the **Decode** tab.
2. Drag and drop a binary file onto the drop zone, or click to browse.
3. The tool will attempt to auto-detect the file format and data type. Look for the **format badge** (e.g., `numpy`, `pytorch`, `safetensors`, `raw`) and the **auto-detected** indicator.
4. If the auto-detection is incorrect, use the **Data Type** and **Byte Order** dropdowns to override.
5. For multi-tensor files (PyTorch `.pt` or Safetensors), select the desired tensor from the **Tensor** dropdown.
6. Adjust display settings as needed: **Columns** controls the table width, **Precision** sets decimal places, and the **Show Hex** toggle reveals raw byte values beneath each decoded number.
7. Use the search box in the data table header to jump to a specific element index.

### Comparing Two Sources

1. Switch to the **Compare** tab.
2. For each side (Source A and Source B), choose the source type using the **Binary** / **Text** toggle in the panel header.
3. Load your data:
   - **Binary**: drag and drop or browse for a file.
   - **Text**: drop a text file, or paste values directly into the text area.
4. Once both sides have data, the comparison results appear automatically: a summary row with element counts, difference/match counts and percentages, and a visual diff map.
5. Set a **Tolerance** value for approximate floating-point matching (e.g., `0.001` to ignore differences smaller than that threshold).
6. In the side-by-side data tables, differing elements are highlighted in red. Use the arrow buttons in the table header to navigate between differences.

---

## Project Structure

```
binary-viz/
├── client/
│   ├── index.html                  # HTML entry point
│   ├── src/
│   │   ├── App.tsx                 # Root component with routing and theme
│   │   ├── main.tsx                # React entry point
│   │   ├── index.css               # Global styles and Tailwind theme
│   │   ├── lib/
│   │   │   └── binaryDecoder.ts    # Core decoding, format detection, comparison logic
│   │   ├── pages/
│   │   │   ├── Home.tsx            # Main layout with tab navigation
│   │   │   ├── DecodeMode.tsx      # Single-file decode view
│   │   │   └── CompareMode.tsx     # Side-by-side comparison view
│   │   └── components/
│   │       ├── FileDropZone.tsx     # Drag-and-drop file upload
│   │       ├── DTypeSelector.tsx    # Data type and display controls
│   │       ├── DataTable.tsx        # Paginated data grid with diff highlighting
│   │       ├── StatsPanel.tsx       # Summary statistics display
│   │       ├── DataDistribution.tsx # Value distribution histogram
│   │       └── DiffSummaryBar.tsx   # Visual diff density map
│   └── public/                     # Static assets (favicon, robots.txt)
├── server/
│   └── index.ts                    # Minimal Express server for production
├── package.json
└── vite.config.ts
```

The entire decoding engine lives in `client/src/lib/binaryDecoder.ts`. It handles NumPy `.npy` header parsing, PyTorch ZIP archive traversal, Safetensors JSON header reading, and all dtype conversions including the three FP8 variants. No external binary parsing libraries are used — everything is implemented with `DataView`, `Uint8Array`, and manual bit manipulation.

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the Vite development server with HMR on port 3000 |
| `pnpm build` | Build the production bundle (client + server) |
| `pnpm start` | Serve the production build via Express |
| `pnpm preview` | Preview the production build using Vite's built-in server |
| `pnpm check` | Run TypeScript type checking without emitting files |
| `pnpm format` | Format all files with Prettier |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Animation | Framer Motion |
| Routing | Wouter |
| Language | TypeScript 5.6 |
| Production Server | Express 4 |
| Package Manager | pnpm 10 |

---

## License

MIT
