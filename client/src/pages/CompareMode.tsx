/**
 * CompareMode - Compare two binary files side by side
 * Design: Dark Forge — side-by-side panels with diff highlighting
 */

import { useState, useMemo, useCallback } from 'react';
import { type DType, type ByteOrder, decodeBinary, compareData } from '@/lib/binaryDecoder';
import FileDropZone from '@/components/FileDropZone';
import DTypeSelector from '@/components/DTypeSelector';
import DataTable from '@/components/DataTable';
import StatsPanel from '@/components/StatsPanel';
import DiffSummaryBar from '@/components/DiffSummaryBar';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';

interface FileState {
  buffer: ArrayBuffer | null;
  name: string;
}

export default function CompareMode() {
  const [file1, setFile1] = useState<FileState>({ buffer: null, name: '' });
  const [file2, setFile2] = useState<FileState>({ buffer: null, name: '' });
  const [dtype, setDType] = useState<DType>('float32');
  const [byteOrder, setByteOrder] = useState<ByteOrder>('little');
  const [showHex, setShowHex] = useState(false);
  const [columns, setColumns] = useState(8);
  const [tolerance, setTolerance] = useState(0);
  const [precision, setPrecision] = useState(6);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const decoded1 = useMemo(() => {
    if (!file1.buffer) return null;
    try { return decodeBinary(file1.buffer, dtype, byteOrder); }
    catch { return null; }
  }, [file1.buffer, dtype, byteOrder]);

  const decoded2 = useMemo(() => {
    if (!file2.buffer) return null;
    try { return decodeBinary(file2.buffer, dtype, byteOrder); }
    catch { return null; }
  }, [file2.buffer, dtype, byteOrder]);

  const comparison = useMemo(() => {
    if (!decoded1 || !decoded2) return null;
    return compareData(decoded1, decoded2, tolerance);
  }, [decoded1, decoded2, tolerance]);

  const handleFile1 = useCallback((buf: ArrayBuffer, name: string) => {
    setFile1({ buffer: buf, name });
  }, []);

  const handleFile2 = useCallback((buf: ArrayBuffer, name: string) => {
    setFile2({ buffer: buf, name });
  }, []);

  const bothLoaded = decoded1 && decoded2;

  return (
    <div className="flex flex-col h-full gap-5">
      {/* File Upload Row */}
      <div className="shrink-0 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">File A (Reference)</Label>
          <FileDropZone
            onFileLoaded={handleFile1}
            file={file1.buffer ? { name: file1.name, size: file1.buffer.byteLength } : null}
            onClear={() => setFile1({ buffer: null, name: '' })}
            compact={!!file1.buffer}
            label="Drop File A"
            description="Reference binary file"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">File B (Compare)</Label>
          <FileDropZone
            onFileLoaded={handleFile2}
            file={file2.buffer ? { name: file2.name, size: file2.buffer.byteLength } : null}
            onClear={() => setFile2({ buffer: null, name: '' })}
            compact={!!file2.buffer}
            label="Drop File B"
            description="File to compare against"
          />
        </div>
      </div>

      {/* Controls */}
      <AnimatePresence>
        {(file1.buffer || file2.buffer) && (
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

      {/* Comparison Stats */}
      <AnimatePresence>
        {comparison && decoded1 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="shrink-0"
          >
            <div className="space-y-3">
              <StatsPanel
                data={decoded1}
                diffCount={comparison.diffCount}
                matchCount={comparison.matchCount}
                totalCompared={comparison.totalCompared}
              />
              {comparison.diffCount > 0 && (
                <DiffSummaryBar
                  totalElements={comparison.totalCompared}
                  diffIndices={comparison.diffIndices}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Side-by-side Data Tables */}
      {bothLoaded ? (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <DataTable
              data={decoded1!}
              diffIndices={comparison?.diffIndices}
              highlightColor="red"
              showHex={showHex}
              columns={columns}
              precision={precision}
              label={`A: ${file1.name}`}
              onHoverIndex={setHoverIndex}
              hoverIndex={hoverIndex}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <DataTable
              data={decoded2!}
              diffIndices={comparison?.diffIndices}
              highlightColor="red"
              showHex={showHex}
              columns={columns}
              precision={precision}
              label={`B: ${file2.name}`}
              onHoverIndex={setHoverIndex}
              hoverIndex={hoverIndex}
            />
          </motion.div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-lg">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663472103077/44zCd7HYXUAAc3HQPKSjpf/compare-illustration-C73JURWf9mv3J2jKWsgDcH.webp"
              alt="Compare files"
              className="w-64 mx-auto opacity-30"
            />
            <div>
              <h3 className="text-lg font-semibold text-foreground/70">Load two files to compare</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Drop binary files in both panels above to see element-by-element differences highlighted
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
