/**
 * TxtCompareMode - Parse text data and compare with binary file
 * Design: Dark Forge — left panel for txt input, right panel for binary data, diff highlighting
 */

import { useState, useMemo, useCallback } from 'react';
import {
  type DType,
  type ByteOrder,
  decodeBinary,
  parseTxtData,
  compareTxtWithBinary,
  formatValue,
} from '@/lib/binaryDecoder';
import FileDropZone from '@/components/FileDropZone';
import DTypeSelector from '@/components/DTypeSelector';
import DataTable from '@/components/DataTable';
import DiffSummaryBar from '@/components/DiffSummaryBar';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Upload, ArrowUp, ArrowDown, Search } from 'lucide-react';

export default function TxtCompareMode() {
  const [txtContent, setTxtContent] = useState('');
  const [txtFileName, setTxtFileName] = useState('');
  const [binBuffer, setBinBuffer] = useState<ArrayBuffer | null>(null);
  const [binFileName, setBinFileName] = useState('');
  const [dtype, setDType] = useState<DType>('float32');
  const [byteOrder, setByteOrder] = useState<ByteOrder>('little');
  const [showHex, setShowHex] = useState(false);
  const [columns, setColumns] = useState(8);
  const [tolerance, setTolerance] = useState(0);
  const [precision, setPrecision] = useState(6);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [txtPage, setTxtPage] = useState(0);
  const [searchIndex, setSearchIndex] = useState('');

  // Handle txt file upload
  const handleTxtFile = useCallback((buf: ArrayBuffer, name: string) => {
    const decoder = new TextDecoder();
    const text = decoder.decode(buf);
    setTxtContent(text);
    setTxtFileName(name);
  }, []);

  const handleBinFile = useCallback((buf: ArrayBuffer, name: string) => {
    setBinBuffer(buf);
    setBinFileName(name);
  }, []);

  // Parse txt values
  const txtValues = useMemo(() => {
    if (!txtContent.trim()) return [];
    return parseTxtData(txtContent);
  }, [txtContent]);

  // Decode binary
  const decoded = useMemo(() => {
    if (!binBuffer) return null;
    try { return decodeBinary(binBuffer, dtype, byteOrder); }
    catch { return null; }
  }, [binBuffer, dtype, byteOrder]);

  // Compare
  const comparison = useMemo(() => {
    if (txtValues.length === 0 || !decoded) return null;
    return compareTxtWithBinary(txtValues, decoded, tolerance);
  }, [txtValues, decoded, tolerance]);

  const ROWS_PER_PAGE = 200;
  const totalTxtRows = Math.ceil(txtValues.length / columns);
  const totalTxtPages = Math.ceil(totalTxtRows / ROWS_PER_PAGE);

  const visibleTxtRows = useMemo(() => {
    const startRow = txtPage * ROWS_PER_PAGE;
    const endRow = Math.min(startRow + ROWS_PER_PAGE, totalTxtRows);
    const rows: { rowIndex: number; cells: { index: number; value: number }[] }[] = [];

    for (let r = startRow; r < endRow; r++) {
      const cells: { index: number; value: number }[] = [];
      for (let c = 0; c < columns; c++) {
        const idx = r * columns + c;
        if (idx < txtValues.length) {
          cells.push({ index: idx, value: txtValues[idx] });
        }
      }
      rows.push({ rowIndex: r, cells });
    }
    return rows;
  }, [txtValues, txtPage, columns, totalTxtRows]);

  const handleTxtSearch = useCallback(() => {
    const idx = parseInt(searchIndex, 10);
    if (!isNaN(idx) && idx >= 0 && idx < txtValues.length) {
      const targetRow = Math.floor(idx / columns);
      const targetPage = Math.floor(targetRow / ROWS_PER_PAGE);
      setTxtPage(targetPage);
    }
  }, [searchIndex, txtValues.length, columns]);

  const navigateDiff = useCallback((direction: 'next' | 'prev') => {
    if (!comparison || comparison.diffIndices.size === 0) return;
    const sorted = Array.from(comparison.diffIndices).sort((a, b) => a - b);
    const currentStart = txtPage * ROWS_PER_PAGE * columns;
    const currentCenter = currentStart + Math.floor(ROWS_PER_PAGE * columns / 2);

    let target: number;
    if (direction === 'next') {
      target = sorted.find(i => i > currentCenter) ?? sorted[0];
    } else {
      target = [...sorted].reverse().find(i => i < currentCenter) ?? sorted[sorted.length - 1];
    }

    const targetRow = Math.floor(target / columns);
    const targetPage = Math.floor(targetRow / ROWS_PER_PAGE);
    setTxtPage(targetPage);
  }, [comparison, txtPage, columns]);

  const bothLoaded = txtValues.length > 0 && decoded;

  return (
    <div className="flex flex-col h-full gap-5">
      {/* File Upload Row */}
      <div className="shrink-0 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Text File (Parsed Values)</Label>
          <FileDropZone
            onFileLoaded={handleTxtFile}
            file={txtFileName ? { name: txtFileName, size: txtContent.length } : null}
            onClear={() => { setTxtContent(''); setTxtFileName(''); }}
            compact={!!txtFileName}
            accept=".txt,.csv,.log,.json,.py"
            label="Drop text file here"
            description=".txt, .csv, .log — any text with numeric values"
          />
          {!txtFileName && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Or paste text data directly:</Label>
              <textarea
                value={txtContent}
                onChange={(e) => setTxtContent(e.target.value)}
                placeholder="Paste tensor/array values here...&#10;e.g.: tensor([1.0, 2.0, 3.0, 4.0])&#10;or: 1.0 2.0 3.0 4.0&#10;or: 1.0, 2.0, 3.0, 4.0"
                className="w-full h-28 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-mono text-foreground outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-muted-foreground/50"
              />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Binary File (Full Data)</Label>
          <FileDropZone
            onFileLoaded={handleBinFile}
            file={binBuffer ? { name: binFileName, size: binBuffer.byteLength } : null}
            onClear={() => { setBinBuffer(null); setBinFileName(''); }}
            compact={!!binBuffer}
            label="Drop binary file here"
            description=".bin, .pt, .npy, .raw"
          />
        </div>
      </div>

      {/* Controls */}
      <AnimatePresence>
        {(txtValues.length > 0 || binBuffer) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="shrink-0 flex flex-wrap items-end gap-4"
          >
            <DTypeSelector
              dtype={dtype}
              byteOrder={byteOrder}
              onDTypeChange={setDType}
              onByteOrderChange={setByteOrder}
              showHex={showHex}
              onShowHexChange={setShowHex}
              columns={columns}
              onColumnsChange={setColumns}
              precision={precision}
              onPrecisionChange={setPrecision}
              compact
            />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tolerance</Label>
              <input
                type="number"
                min={0}
                step="any"
                value={tolerance}
                onChange={(e) => setTolerance(Math.max(0, parseFloat(e.target.value) || 0))}
                className="h-9 w-[110px] rounded-md border border-border bg-secondary/50 px-3 text-sm font-mono text-foreground outline-none focus:ring-1 focus:ring-ring"
                placeholder="0"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comparison Summary */}
      <AnimatePresence>
        {comparison && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="shrink-0"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="rounded-lg bg-secondary/30 border border-border/50 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Txt Values</p>
                <p className="text-sm font-mono font-semibold text-foreground">{comparison.txtLength.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-secondary/30 border border-border/50 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Bin Elements</p>
                <p className="text-sm font-mono font-semibold text-foreground">{comparison.binLength.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-secondary/30 border border-border/50 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Compared</p>
                <p className="text-sm font-mono font-semibold text-foreground">{comparison.totalCompared.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-secondary/30 border border-border/50 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Differences</p>
                <p className="text-sm font-mono font-semibold text-rose-400">
                  {comparison.diffCount.toLocaleString()}
                  <span className="text-[11px] text-muted-foreground ml-1.5 font-normal">
                    {comparison.totalCompared > 0 ? `${((comparison.diffCount / comparison.totalCompared) * 100).toFixed(2)}%` : ''}
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-secondary/30 border border-border/50 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Matches</p>
                <p className="text-sm font-mono font-semibold text-emerald-400">
                  {comparison.matchCount.toLocaleString()}
                  <span className="text-[11px] text-muted-foreground ml-1.5 font-normal">
                    {comparison.totalCompared > 0 ? `${((comparison.matchCount / comparison.totalCompared) * 100).toFixed(2)}%` : ''}
                  </span>
                </p>
              </div>
            </div>
            {comparison.txtLength !== comparison.binLength && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                Length mismatch: Text has {comparison.txtLength} values, binary has {comparison.binLength} elements.
                Only the first {comparison.totalCompared} elements are compared.
              </div>
            )}
            {comparison.diffCount > 0 && (
              <div className="mt-2">
                <DiffSummaryBar
                  totalElements={comparison.totalCompared}
                  diffIndices={comparison.diffIndices}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Side-by-side: Txt values table + Binary data table */}
      {bothLoaded ? (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Txt Values Panel */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-xl border border-border bg-card overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card/50 shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  Txt: {txtFileName || 'Pasted Data'}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {txtValues.length.toLocaleString()} values
                </span>
              </div>
              <div className="flex items-center gap-2">
                {comparison && comparison.diffIndices.size > 0 && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => navigateDiff('prev')} className="p-1 rounded hover:bg-accent transition-colors" title="Previous diff">
                      <ArrowUp className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => navigateDiff('next')} className="p-1 rounded hover:bg-accent transition-colors" title="Next diff">
                      <ArrowDown className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-1 bg-secondary/50 rounded-md px-2 py-1">
                  <Search className="w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchIndex}
                    onChange={(e) => setSearchIndex(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTxtSearch()}
                    placeholder="Go to index..."
                    className="bg-transparent text-xs text-foreground w-24 outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr>
                    <th className="text-left text-[11px] font-medium text-muted-foreground px-3 py-2 border-b border-border w-20">Offset</th>
                    {Array.from({ length: columns }, (_, i) => (
                      <th key={i} className="text-right text-[11px] font-medium text-muted-foreground px-2 py-2 border-b border-border">+{i}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleTxtRows.map(({ rowIndex, cells }) => (
                    <tr key={rowIndex} className="hover:bg-secondary/20 transition-colors">
                      <td className="text-[11px] font-mono text-muted-foreground px-3 py-1 border-b border-border/50 select-none">
                        {(rowIndex * columns).toString().padStart(6, '0')}
                      </td>
                      {cells.map((cell) => (
                        <td
                          key={cell.index}
                          className={`
                            text-right text-[12px] font-mono px-2 py-1 border-b border-border/50
                            transition-colors cursor-default
                            ${comparison?.diffIndices.has(cell.index) ? 'bg-rose-500/20 text-rose-300' : ''}
                            ${hoverIndex === cell.index ? 'bg-primary/10' : ''}
                          `}
                          onMouseEnter={() => setHoverIndex(cell.index)}
                          onMouseLeave={() => setHoverIndex(null)}
                          title={`[${cell.index}] = ${cell.value}`}
                        >
                          {formatValue(cell.value, dtype, precision)}
                        </td>
                      ))}
                      {cells.length < columns &&
                        Array.from({ length: columns - cells.length }, (_, i) => (
                          <td key={`empty-${i}`} className="border-b border-border/50" />
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalTxtPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-card/50 shrink-0">
                <span className="text-xs text-muted-foreground">Page {txtPage + 1} of {totalTxtPages}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setTxtPage(0)} disabled={txtPage === 0} className="px-2 py-1 text-xs rounded bg-secondary/50 text-foreground disabled:opacity-30 hover:bg-secondary transition-colors">First</button>
                  <button onClick={() => setTxtPage(Math.max(0, txtPage - 1))} disabled={txtPage === 0} className="px-2 py-1 text-xs rounded bg-secondary/50 text-foreground disabled:opacity-30 hover:bg-secondary transition-colors">Prev</button>
                  <button onClick={() => setTxtPage(Math.min(totalTxtPages - 1, txtPage + 1))} disabled={txtPage >= totalTxtPages - 1} className="px-2 py-1 text-xs rounded bg-secondary/50 text-foreground disabled:opacity-30 hover:bg-secondary transition-colors">Next</button>
                  <button onClick={() => setTxtPage(totalTxtPages - 1)} disabled={txtPage >= totalTxtPages - 1} className="px-2 py-1 text-xs rounded bg-secondary/50 text-foreground disabled:opacity-30 hover:bg-secondary transition-colors">Last</button>
                </div>
              </div>
            )}
          </motion.div>

          {/* Binary Data Panel */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <DataTable
              data={decoded!}
              diffIndices={comparison?.diffIndices}
              highlightColor="red"
              showHex={showHex}
              columns={columns}
              precision={precision}
              label={`Bin: ${binFileName}`}
              onHoverIndex={setHoverIndex}
              hoverIndex={hoverIndex}
            />
          </motion.div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-lg">
            <div className="flex items-center justify-center gap-6 opacity-30">
              <FileText className="w-16 h-16 text-primary" />
              <span className="text-3xl text-muted-foreground">vs</span>
              <Upload className="w-16 h-16 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground/70">Text vs Binary Comparison</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Load a text file (or paste values) and a binary file to compare parsed text values against decoded binary data
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
