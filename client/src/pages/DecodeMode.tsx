/**
 * DecodeMode - Single binary file decoder and visualizer
 * Supports auto-detection of NumPy .npy, PyTorch .pt/.ptx, safetensors, and raw binary
 * Design: Dark Forge — layered dark surfaces, electric blue accents, monospace data display
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  type DType,
  type ByteOrder,
  type FormatDetectionResult,
  type DecodedData,
  autoDecodeBinaryAsync,
  detectFormat,
} from '@/lib/binaryDecoder';
import FileDropZone from '@/components/FileDropZone';
import DTypeSelector from '@/components/DTypeSelector';
import DataTable from '@/components/DataTable';
import StatsPanel from '@/components/StatsPanel';
import DataDistribution from '@/components/DataDistribution';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function DecodeMode() {
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [overrideDtype, setOverrideDtype] = useState<DType | null>(null);
  const [overrideByteOrder, setOverrideByteOrder] = useState<ByteOrder | null>(null);
  const [showHex, setShowHex] = useState(false);
  const [columns, setColumns] = useState(8);
  const [overrideOffset, setOverrideOffset] = useState<number | null>(null);
  const [precision, setPrecision] = useState(6);
  const [selectedTensor, setSelectedTensor] = useState(0);

  // Detect format when file is loaded
  const formatInfo = useMemo<FormatDetectionResult | null>(() => {
    if (!buffer) return null;
    return detectFormat(buffer, fileName);
  }, [buffer, fileName]);

  // Effective dtype/byteOrder (auto-detected or overridden)
  const effectiveDtype = overrideDtype ?? formatInfo?.dtype ?? 'float32';
  const effectiveByteOrder = overrideByteOrder ?? formatInfo?.byteOrder ?? 'little';

  const handleFileLoaded = useCallback((buf: ArrayBuffer, name: string) => {
    setBuffer(buf);
    setFileName(name);
    // Reset overrides on new file so auto-detection takes effect
    setOverrideDtype(null);
    setOverrideByteOrder(null);
    setOverrideOffset(null);
    setSelectedTensor(0);
  }, []);

  const handleClear = useCallback(() => {
    setBuffer(null);
    setFileName('');
    setOverrideDtype(null);
    setOverrideByteOrder(null);
    setOverrideOffset(null);
    setSelectedTensor(0);
  }, []);

  const [decoded, setDecoded] = useState<(DecodedData & { formatInfo: FormatDetectionResult }) | null>(null);

  useEffect(() => {
    if (!buffer) { setDecoded(null); return; }
    let cancelled = false;
    autoDecodeBinaryAsync(
      buffer,
      fileName,
      overrideDtype ?? undefined,
      overrideByteOrder ?? undefined,
      overrideOffset ?? undefined,
      selectedTensor,
    )
      .then(result => { if (!cancelled) setDecoded(result); })
      .catch(e => { console.error('Decode error:', e); if (!cancelled) setDecoded(null); });
    return () => { cancelled = true; };
  }, [buffer, fileName, overrideDtype, overrideByteOrder, overrideOffset, selectedTensor]);

  const hasTensors = formatInfo?.tensorEntries && formatInfo.tensorEntries.length > 1;

  return (
    <div className="flex flex-col h-full gap-5">
      {/* File Upload + Controls */}
      <div className="shrink-0 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
          <FileDropZone
            onFileLoaded={handleFileLoaded}
            file={buffer ? { name: fileName, size: buffer.byteLength } : null}
            onClear={handleClear}
            compact={!!buffer}
            label="Drop a binary file here"
            description=".bin, .pt, .ptx, .npy, .safetensors, .raw, or any binary dump"
          />
        </div>

        <AnimatePresence>
          {buffer && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {/* Tensor selector for multi-tensor files */}
              {hasTensors && (
                <div className="flex items-end gap-4 flex-wrap">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Tensor</Label>
                    <Select
                      value={String(selectedTensor)}
                      onValueChange={(v) => setSelectedTensor(Number(v))}
                    >
                      <SelectTrigger className="w-[280px] h-9 text-sm bg-secondary/50 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {formatInfo!.tensorEntries!.map((entry, idx) => (
                          <SelectItem key={idx} value={String(idx)} className="text-sm">
                            <span className="font-mono">{entry.name}</span>
                            {entry.dtype && (
                              <span className="text-muted-foreground ml-2 text-xs">
                                ({entry.dtype}{entry.shape ? ` [${entry.shape.join('×')}]` : ''})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <DTypeSelector
                dtype={effectiveDtype}
                byteOrder={effectiveByteOrder}
                onDTypeChange={(d) => setOverrideDtype(d)}
                onByteOrderChange={(o) => setOverrideByteOrder(o)}
                showHex={showHex}
                onShowHexChange={setShowHex}
                columns={columns}
                onColumnsChange={setColumns}
                offset={overrideOffset ?? formatInfo?.dataOffset ?? 0}
                onOffsetChange={(o) => setOverrideOffset(o)}
                precision={precision}
                onPrecisionChange={setPrecision}
                formatInfo={formatInfo}
                autoDetected={!overrideDtype && formatInfo?.confidence !== 'low'}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stats */}
      <AnimatePresence>
        {decoded && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="shrink-0"
          >
            <div className="space-y-3">
              <StatsPanel data={decoded} />
              <DataDistribution data={decoded} />
              {decoded.hasPrecisionLoss && (
                <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                  Some {decoded.dtype} values exceed 2&#x2075;&#xB3; and may have lost precision. Values beyond &#xB1;9,007,199,254,740,991 are approximate.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data Table */}
      {decoded && decoded.elementCount > 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 min-h-0 rounded-xl border border-border bg-card overflow-hidden"
        >
          <DataTable
            data={decoded}
            showHex={showHex}
            columns={columns}
            precision={precision}
            label={fileName}
          />
        </motion.div>
      ) : decoded && decoded.elementCount === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 max-w-md">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
              <span className="text-2xl text-amber-400">0</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground/70">No elements decoded</h3>
            <p className="text-sm text-muted-foreground">
              The file was loaded but produced zero elements with the current dtype ({decoded.dtype}).
              Try selecting a different dtype or check the file contents.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663472103077/44zCd7HYXUAAc3HQPKSjpf/empty-state-EPgrJ6eE6m8spmc6UkRQjt.webp"
              alt="Drop a file"
              className="w-48 h-48 mx-auto opacity-40"
            />
            <div>
              <h3 className="text-lg font-semibold text-foreground/70">No file loaded</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Drop a binary file above to decode and visualize its contents.
                Format and dtype will be auto-detected when possible.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
