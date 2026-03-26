/**
 * DecodeMode - Single binary file decoder and visualizer
 * Design: Dark Forge — layered dark surfaces, electric blue accents, monospace data display
 */

import { useState, useMemo, useCallback } from 'react';
import { type DType, type ByteOrder, decodeBinary } from '@/lib/binaryDecoder';
import FileDropZone from '@/components/FileDropZone';
import DTypeSelector from '@/components/DTypeSelector';
import DataTable from '@/components/DataTable';
import StatsPanel from '@/components/StatsPanel';
import DataDistribution from '@/components/DataDistribution';
import { motion, AnimatePresence } from 'framer-motion';

export default function DecodeMode() {
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [dtype, setDType] = useState<DType>('float32');
  const [byteOrder, setByteOrder] = useState<ByteOrder>('little');
  const [showHex, setShowHex] = useState(false);
  const [columns, setColumns] = useState(8);
  const [offset, setOffset] = useState(0);
  const [precision, setPrecision] = useState(6);

  const handleFileLoaded = useCallback((buf: ArrayBuffer, name: string) => {
    setBuffer(buf);
    setFileName(name);
    setOffset(0);
  }, []);

  const handleClear = useCallback(() => {
    setBuffer(null);
    setFileName('');
    setOffset(0);
  }, []);

  const decoded = useMemo(() => {
    if (!buffer) return null;
    try {
      return decodeBinary(buffer, dtype, byteOrder, offset);
    } catch (e) {
      console.error('Decode error:', e);
      return null;
    }
  }, [buffer, dtype, byteOrder, offset]);

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
            description=".bin, .pt, .npy, .raw, or any binary dump"
          />
        </div>

        <AnimatePresence>
          {buffer && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
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
                offset={offset}
                onOffsetChange={setOffset}
                precision={precision}
                onPrecisionChange={setPrecision}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data Table */}
      {decoded ? (
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
                Drop a binary file above to decode and visualize its contents
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
