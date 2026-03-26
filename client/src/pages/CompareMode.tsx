/**
 * CompareMode - Unified comparison view
 * Supports two source types per side: Binary file or Text (file/paste)
 * Auto-detects format and dtype for binary files
 * Design: Dark Forge — side-by-side panels with diff highlighting
 */

import { useState, useMemo, useCallback } from 'react';
import {
  type DType,
  type ByteOrder,
  type FormatDetectionResult,
  type DecodedData,
  autoDecodeBinary,
  detectFormat,
  compareValues,
  parseTxtData,
  DTYPE_INFO,
  formatValue,
} from '@/lib/binaryDecoder';
import FileDropZone from '@/components/FileDropZone';
import DTypeSelector from '@/components/DTypeSelector';
import DataTable from '@/components/DataTable';
import StatsPanel from '@/components/StatsPanel';
import DiffSummaryBar from '@/components/DiffSummaryBar';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Binary, Upload } from 'lucide-react';

type SourceType = 'binary' | 'text';

interface SourceState {
  type: SourceType;
  buffer: ArrayBuffer | null;
  fileName: string;
  txtContent: string;
  txtFileName: string;
}

const initialSource = (): SourceState => ({
  type: 'binary',
  buffer: null,
  fileName: '',
  txtContent: '',
  txtFileName: '',
});

/**
 * Build a pseudo DecodedData from parsed text values so it can be displayed in DataTable
 */
function txtToDecodedData(values: number[], dtype: DType): DecodedData {
  return {
    values,
    rawBytes: new Uint8Array(0),
    dtype,
    byteOrder: 'little',
    elementCount: values.length,
    totalBytes: values.length * DTYPE_INFO[dtype].bytes,
    bytesPerElement: DTYPE_INFO[dtype].bytes,
  };
}

export default function CompareMode() {
  const [sourceA, setSourceA] = useState<SourceState>(initialSource());
  const [sourceB, setSourceB] = useState<SourceState>(initialSource());

  // Shared decode settings (user can override auto-detected)
  const [overrideDtype, setOverrideDtype] = useState<DType | null>(null);
  const [overrideByteOrder, setOverrideByteOrder] = useState<ByteOrder | null>(null);
  const [showHex, setShowHex] = useState(false);
  const [columns, setColumns] = useState(8);
  const [tolerance, setTolerance] = useState(0);
  const [precision, setPrecision] = useState(6);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [selectedTensorA, setSelectedTensorA] = useState(0);
  const [selectedTensorB, setSelectedTensorB] = useState(0);

  // Format detection for binary sources
  const formatInfoA = useMemo<FormatDetectionResult | null>(() => {
    if (sourceA.type !== 'binary' || !sourceA.buffer) return null;
    return detectFormat(sourceA.buffer, sourceA.fileName);
  }, [sourceA.type, sourceA.buffer, sourceA.fileName]);

  const formatInfoB = useMemo<FormatDetectionResult | null>(() => {
    if (sourceB.type !== 'binary' || !sourceB.buffer) return null;
    return detectFormat(sourceB.buffer, sourceB.fileName);
  }, [sourceB.type, sourceB.buffer, sourceB.fileName]);

  // Use the first binary source's auto-detected dtype as default
  const autoDetectedDtype = formatInfoA?.dtype ?? formatInfoB?.dtype ?? 'float32';
  const autoDetectedByteOrder = formatInfoA?.byteOrder ?? formatInfoB?.byteOrder ?? 'little';
  const effectiveDtype = overrideDtype ?? autoDetectedDtype;
  const effectiveByteOrder = overrideByteOrder ?? autoDetectedByteOrder;

  // Decode/parse source A
  const decodedA = useMemo<DecodedData | null>(() => {
    if (sourceA.type === 'binary') {
      if (!sourceA.buffer) return null;
      try {
        return autoDecodeBinary(
          sourceA.buffer,
          sourceA.fileName,
          overrideDtype ?? undefined,
          overrideByteOrder ?? undefined,
          undefined,
          selectedTensorA,
        );
      } catch { return null; }
    } else {
      const text = sourceA.txtContent.trim();
      if (!text) return null;
      const values = parseTxtData(text);
      if (values.length === 0) return null;
      return txtToDecodedData(values, effectiveDtype);
    }
  }, [sourceA, overrideDtype, overrideByteOrder, effectiveDtype, selectedTensorA]);

  // Decode/parse source B
  const decodedB = useMemo<DecodedData | null>(() => {
    if (sourceB.type === 'binary') {
      if (!sourceB.buffer) return null;
      try {
        return autoDecodeBinary(
          sourceB.buffer,
          sourceB.fileName,
          overrideDtype ?? undefined,
          overrideByteOrder ?? undefined,
          undefined,
          selectedTensorB,
        );
      } catch { return null; }
    } else {
      const text = sourceB.txtContent.trim();
      if (!text) return null;
      const values = parseTxtData(text);
      if (values.length === 0) return null;
      return txtToDecodedData(values, effectiveDtype);
    }
  }, [sourceB, overrideDtype, overrideByteOrder, effectiveDtype, selectedTensorB]);

  // Compare
  const comparison = useMemo(() => {
    if (!decodedA || !decodedB) return null;
    return compareValues(decodedA.values, decodedB.values, tolerance);
  }, [decodedA, decodedB, tolerance]);

  // Handlers
  const handleBinFileA = useCallback((buf: ArrayBuffer, name: string) => {
    setSourceA(prev => ({ ...prev, buffer: buf, fileName: name }));
    setSelectedTensorA(0);
    // Reset overrides so auto-detection kicks in
    setOverrideDtype(null);
    setOverrideByteOrder(null);
  }, []);

  const handleBinFileB = useCallback((buf: ArrayBuffer, name: string) => {
    setSourceB(prev => ({ ...prev, buffer: buf, fileName: name }));
    setSelectedTensorB(0);
    // Reset overrides so auto-detection kicks in for the new file
    setOverrideDtype(null);
    setOverrideByteOrder(null);
  }, []);

  const handleTxtFileA = useCallback((buf: ArrayBuffer, name: string) => {
    const text = new TextDecoder().decode(buf);
    setSourceA(prev => ({ ...prev, txtContent: text, txtFileName: name }));
  }, []);

  const handleTxtFileB = useCallback((buf: ArrayBuffer, name: string) => {
    const text = new TextDecoder().decode(buf);
    setSourceB(prev => ({ ...prev, txtContent: text, txtFileName: name }));
  }, []);

  const clearA = useCallback(() => {
    setSourceA(prev => ({ ...prev, buffer: null, fileName: '', txtContent: '', txtFileName: '' }));
    setSelectedTensorA(0);
  }, []);

  const clearB = useCallback(() => {
    setSourceB(prev => ({ ...prev, buffer: null, fileName: '', txtContent: '', txtFileName: '' }));
    setSelectedTensorB(0);
  }, []);

  const bothLoaded = decodedA && decodedB;

  const hasMultiTensorsA = sourceA.type === 'binary' && formatInfoA?.tensorEntries && formatInfoA.tensorEntries.length > 1;
  const hasMultiTensorsB = sourceB.type === 'binary' && formatInfoB?.tensorEntries && formatInfoB.tensorEntries.length > 1;

  // Primary format info to show (from whichever side is binary)
  const primaryFormatInfo = formatInfoA ?? formatInfoB;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Source Panels */}
      <div className="shrink-0 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source A */}
        <SourcePanel
          label="Source A (Reference)"
          source={sourceA}
          onTypeChange={(t) => { setSourceA({ ...initialSource(), type: t }); setSelectedTensorA(0); }}
          onBinFile={handleBinFileA}
          onTxtFile={handleTxtFileA}
          onTxtChange={(txt) => setSourceA(prev => ({ ...prev, txtContent: txt }))}
          onClear={clearA}
          formatInfo={formatInfoA}
          hasMultiTensors={!!hasMultiTensorsA}
          selectedTensor={selectedTensorA}
          onTensorChange={setSelectedTensorA}
        />
        {/* Source B */}
        <SourcePanel
          label="Source B (Compare)"
          source={sourceB}
          onTypeChange={(t) => { setSourceB({ ...initialSource(), type: t }); setSelectedTensorB(0); }}
          onBinFile={handleBinFileB}
          onTxtFile={handleTxtFileB}
          onTxtChange={(txt) => setSourceB(prev => ({ ...prev, txtContent: txt }))}
          onClear={clearB}
          formatInfo={formatInfoB}
          hasMultiTensors={!!hasMultiTensorsB}
          selectedTensor={selectedTensorB}
          onTensorChange={setSelectedTensorB}
        />
      </div>

      {/* Controls */}
      <AnimatePresence>
        {(decodedA || decodedB) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="shrink-0 flex flex-wrap items-end gap-4"
          >
            <DTypeSelector
              dtype={effectiveDtype}
              byteOrder={effectiveByteOrder}
              onDTypeChange={(d) => setOverrideDtype(d)}
              onByteOrderChange={(o) => setOverrideByteOrder(o)}
              showHex={showHex}
              onShowHexChange={setShowHex}
              columns={columns}
              onColumnsChange={setColumns}
              precision={precision}
              onPrecisionChange={setPrecision}
              formatInfo={primaryFormatInfo}
              autoDetected={!overrideDtype && primaryFormatInfo?.confidence !== 'low'}
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
        {comparison && decodedA && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="shrink-0 space-y-2"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard label="Source A" value={decodedA.elementCount.toLocaleString()} sub="elements" />
              <StatCard label="Source B" value={decodedB?.elementCount.toLocaleString() ?? '0'} sub="elements" />
              <StatCard label="Compared" value={comparison.totalCompared.toLocaleString()} />
              <StatCard
                label="Differences"
                value={comparison.diffCount.toLocaleString()}
                valueClass="text-rose-400"
                sub={comparison.totalCompared > 0 ? `${((comparison.diffCount / comparison.totalCompared) * 100).toFixed(2)}%` : ''}
              />
              <StatCard
                label="Matches"
                value={comparison.matchCount.toLocaleString()}
                valueClass="text-emerald-400"
                sub={comparison.totalCompared > 0 ? `${((comparison.matchCount / comparison.totalCompared) * 100).toFixed(2)}%` : ''}
              />
            </div>
            {decodedA.elementCount !== decodedB!.elementCount && (
              <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                Length mismatch: Source A has {decodedA.elementCount} elements, Source B has {decodedB!.elementCount} elements.
                Only the first {comparison.totalCompared} elements are compared.
              </div>
            )}
            {comparison.diffCount > 0 && (
              <DiffSummaryBar
                totalElements={comparison.totalCompared}
                diffIndices={comparison.diffIndices}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Side-by-side Data Tables */}
      {bothLoaded && (decodedA!.elementCount === 0 || decodedB!.elementCount === 0) ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 max-w-md">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
              <span className="text-2xl text-amber-400">0</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground/70">Empty decoded data</h3>
            <p className="text-sm text-muted-foreground">
              {decodedA!.elementCount === 0 && decodedB!.elementCount === 0
                ? 'Both sources decoded to zero elements.'
                : decodedA!.elementCount === 0
                  ? 'Source A decoded to zero elements.'
                  : 'Source B decoded to zero elements.'}
              {' '}Try a different dtype or check the source data.
            </p>
          </div>
        </div>
      ) : bothLoaded ? (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <DataTable
              data={decodedA!}
              diffIndices={comparison?.diffIndices}
              highlightColor="red"
              showHex={showHex && sourceA.type === 'binary'}
              columns={columns}
              precision={precision}
              label={`A: ${sourceA.type === 'binary' ? sourceA.fileName : (sourceA.txtFileName || 'Text')}`}
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
              data={decodedB!}
              diffIndices={comparison?.diffIndices}
              highlightColor="red"
              showHex={showHex && sourceB.type === 'binary'}
              columns={columns}
              precision={precision}
              label={`B: ${sourceB.type === 'binary' ? sourceB.fileName : (sourceB.txtFileName || 'Text')}`}
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
              <h3 className="text-lg font-semibold text-foreground/70">Load two sources to compare</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Each side can be a binary file or text data. Choose the source type for each panel above.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SourcePanel({
  label,
  source,
  onTypeChange,
  onBinFile,
  onTxtFile,
  onTxtChange,
  onClear,
  formatInfo,
  hasMultiTensors,
  selectedTensor,
  onTensorChange,
}: {
  label: string;
  source: SourceState;
  onTypeChange: (t: SourceType) => void;
  onBinFile: (buf: ArrayBuffer, name: string) => void;
  onTxtFile: (buf: ArrayBuffer, name: string) => void;
  onTxtChange: (txt: string) => void;
  onClear: () => void;
  formatInfo: FormatDetectionResult | null;
  hasMultiTensors: boolean;
  selectedTensor: number;
  onTensorChange: (idx: number) => void;
}) {
  return (
    <div className="space-y-2">
      {/* Header with source type toggle */}
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
        <div className="flex items-center gap-1 bg-secondary/40 rounded-md p-0.5 border border-border/50">
          <button
            onClick={() => onTypeChange('binary')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all ${
              source.type === 'binary'
                ? 'bg-primary/15 text-primary font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Binary className="w-3 h-3" />
            Binary
          </button>
          <button
            onClick={() => onTypeChange('text')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all ${
              source.type === 'text'
                ? 'bg-primary/15 text-primary font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-3 h-3" />
            Text
          </button>
        </div>
      </div>

      {/* Content based on source type */}
      {source.type === 'binary' ? (
        <div className="space-y-2">
          <FileDropZone
            onFileLoaded={onBinFile}
            file={source.buffer ? { name: source.fileName, size: source.buffer.byteLength } : null}
            onClear={onClear}
            compact={!!source.buffer}
            label="Drop binary file"
            description=".bin, .pt, .ptx, .npy, .safetensors, .raw"
          />
          {/* Tensor selector for multi-tensor files */}
          {hasMultiTensors && formatInfo?.tensorEntries && (
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Tensor</Label>
              <Select
                value={String(selectedTensor)}
                onValueChange={(v) => onTensorChange(Number(v))}
              >
                <SelectTrigger className="w-full h-8 text-xs bg-secondary/40 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formatInfo.tensorEntries.map((entry, idx) => (
                    <SelectItem key={idx} value={String(idx)} className="text-xs">
                      <span className="font-mono">{entry.name}</span>
                      {entry.dtype && (
                        <span className="text-muted-foreground ml-1.5">
                          ({entry.dtype}{entry.shape ? ` [${entry.shape.join('×')}]` : ''})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <FileDropZone
            onFileLoaded={onTxtFile}
            file={source.txtFileName ? { name: source.txtFileName, size: source.txtContent.length } : null}
            onClear={onClear}
            compact={!!source.txtFileName}
            accept=".txt,.csv,.log,.json,.py"
            label="Drop text file"
            description=".txt, .csv, .log — any text with numeric values"
          />
          {!source.txtFileName && (
            <textarea
              value={source.txtContent}
              onChange={(e) => onTxtChange(e.target.value)}
              placeholder={"Paste tensor/array values here...\ne.g.: tensor([1.0, 2.0, 3.0])\nor: 1.0 2.0 3.0 4.0"}
              className="w-full h-24 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs font-mono text-foreground outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-muted-foreground/40"
            />
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  valueClass = 'text-foreground',
  sub,
}: {
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg bg-secondary/30 border border-border/50 px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm font-mono font-semibold ${valueClass}`}>
        {value}
        {sub && <span className="text-[11px] text-muted-foreground ml-1.5 font-normal">{sub}</span>}
      </p>
    </div>
  );
}
