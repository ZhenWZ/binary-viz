import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { type DecodedData, formatValue, getHexBytes } from '@/lib/binaryDecoder';
import { Search, ArrowUp, ArrowDown, Copy, Check } from 'lucide-react';

interface DataTableProps {
  data: DecodedData;
  diffIndices?: Set<number>;
  highlightColor?: 'red' | 'green' | 'blue';
  showHex?: boolean;
  label?: string;
  onHoverIndex?: (index: number | null) => void;
  hoverIndex?: number | null;
  columns?: number;
  precision?: number;
}

const ROWS_PER_PAGE = 200;

function copyViaTextarea(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export default function DataTable({
  data,
  diffIndices,
  highlightColor = 'red',
  showHex = false,
  label,
  onHoverIndex,
  hoverIndex,
  columns = 8,
  precision = 6,
}: DataTableProps) {
  const [page, setPage] = useState(0);
  const [searchIndex, setSearchIndex] = useState('');
  const [jumpToIndex, setJumpToIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const totalRows = Math.ceil(data.elementCount / columns);
  const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);

  // Reset page when data changes
  useEffect(() => {
    setPage(0);
  }, [data.elementCount, columns]);

  const visibleRows = useMemo(() => {
    const startRow = page * ROWS_PER_PAGE;
    const endRow = Math.min(startRow + ROWS_PER_PAGE, totalRows);
    const rows: { rowIndex: number; cells: { index: number; value: number; hex: string }[] }[] = [];

    for (let r = startRow; r < endRow; r++) {
      const cells: { index: number; value: number; hex: string }[] = [];
      for (let c = 0; c < columns; c++) {
        const idx = r * columns + c;
        if (idx < data.elementCount) {
          cells.push({
            index: idx,
            value: data.values[idx],
            hex: showHex ? getHexBytes(data.rawBytes, idx, data.bytesPerElement, data.dataOffset ?? 0) : '',
          });
        }
      }
      rows.push({ rowIndex: r, cells });
    }
    return rows;
  }, [data, page, columns, showHex, totalRows]);

  const diffStats = useMemo(() => {
    if (!diffIndices) return null;
    const startIdx = page * ROWS_PER_PAGE * columns;
    const endIdx = Math.min(startIdx + ROWS_PER_PAGE * columns, data.elementCount);
    let count = 0;
    for (let i = startIdx; i < endIdx; i++) {
      if (diffIndices.has(i)) count++;
    }
    return { pageCount: count, totalCount: diffIndices.size };
  }, [diffIndices, page, columns, data.elementCount]);

  const handleSearch = useCallback(() => {
    const idx = parseInt(searchIndex, 10);
    if (!isNaN(idx) && idx >= 0 && idx < data.elementCount) {
      const targetRow = Math.floor(idx / columns);
      const targetPage = Math.floor(targetRow / ROWS_PER_PAGE);
      setPage(targetPage);
      setJumpToIndex(idx);
    }
  }, [searchIndex, data.elementCount, columns]);

  const navigateDiff = useCallback((direction: 'next' | 'prev') => {
    if (!diffIndices || diffIndices.size === 0) return;
    const sorted = Array.from(diffIndices).sort((a, b) => a - b);
    const currentStart = page * ROWS_PER_PAGE * columns;
    const currentCenter = currentStart + Math.floor(ROWS_PER_PAGE * columns / 2);

    let target: number;
    if (direction === 'next') {
      target = sorted.find(i => i > currentCenter) ?? sorted[0];
    } else {
      target = [...sorted].reverse().find(i => i < currentCenter) ?? sorted[sorted.length - 1];
    }

    const targetRow = Math.floor(target / columns);
    const targetPage = Math.floor(targetRow / ROWS_PER_PAGE);
    setPage(targetPage);
    setJumpToIndex(target);
  }, [diffIndices, page, columns]);

  useEffect(() => {
    if (jumpToIndex !== null) {
      // Scroll the target cell into view
      requestAnimationFrame(() => {
        const cell = tableRef.current?.querySelector(`[data-index="${jumpToIndex}"]`);
        if (cell) {
          cell.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      });
      const timer = setTimeout(() => setJumpToIndex(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [jumpToIndex]);

  const handleCopyAll = useCallback(() => {
    const text = data.values.map(v => formatValue(v, data.dtype, precision)).join('\n');
    const onSuccess = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
        // Fallback for clipboard API failure
        copyViaTextarea(text);
        onSuccess();
      });
    } else {
      // Fallback for non-secure contexts (HTTP)
      copyViaTextarea(text);
      onSuccess();
    }
  }, [data, precision]);

  const getHighlightClass = (index: number) => {
    if (jumpToIndex === index) return 'ring-2 ring-yellow-400/60 bg-yellow-400/15';
    if (diffIndices?.has(index)) {
      switch (highlightColor) {
        case 'red': return 'bg-rose-500/15 text-rose-300';
        case 'green': return 'bg-emerald-500/15 text-emerald-300';
        case 'blue': return 'bg-blue-500/15 text-blue-300';
      }
    }
    if (hoverIndex === index) return 'bg-primary/8';
    return '';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-card/80 shrink-0">
        <div className="flex items-center gap-3">
          {label && <span className="text-sm font-semibold text-foreground truncate max-w-[200px]">{label}</span>}
          <span className="text-[11px] text-muted-foreground font-mono">
            {data.elementCount.toLocaleString()} elements
          </span>
          {diffStats && diffStats.totalCount > 0 && (
            <span className="text-[11px] text-rose-400 font-mono px-1.5 py-0.5 rounded bg-rose-500/10">
              {diffStats.totalCount.toLocaleString()} diffs
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Copy button */}
          <button
            onClick={handleCopyAll}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="Copy all values"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
          {/* Diff navigation */}
          {diffIndices && diffIndices.size > 0 && (
            <div className="flex items-center gap-0.5 border-l border-border pl-2">
              <button
                onClick={() => navigateDiff('prev')}
                className="p-1 rounded hover:bg-accent transition-colors"
                title="Previous diff"
              >
                <ArrowUp className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={() => navigateDiff('next')}
                className="p-1 rounded hover:bg-accent transition-colors"
                title="Next diff"
              >
                <ArrowDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          )}
          {/* Search */}
          <div className="flex items-center gap-1 bg-secondary/40 rounded-md px-2 py-1 border border-border/50 focus-within:border-primary/30 transition-colors">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchIndex}
              onChange={(e) => setSearchIndex(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Go to index..."
              className="bg-transparent text-xs text-foreground w-24 outline-none placeholder:text-muted-foreground/50"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div ref={tableRef} className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-card">
            <tr>
              <th className="text-left text-[10px] font-semibold text-muted-foreground/70 px-3 py-2 border-b border-border w-20 uppercase tracking-wider">
                Offset
              </th>
              {Array.from({ length: columns }, (_, i) => (
                <th
                  key={i}
                  className="text-right text-[10px] font-semibold text-muted-foreground/70 px-2 py-2 border-b border-border uppercase tracking-wider"
                >
                  +{i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ rowIndex, cells }) => (
              <tr
                key={rowIndex}
                className={`transition-colors ${rowIndex % 2 === 0 ? 'bg-transparent' : 'bg-secondary/8'} hover:bg-secondary/20`}
              >
                <td className="text-[11px] font-mono text-muted-foreground/60 px-3 py-1 border-b border-border/30 select-none">
                  {(rowIndex * columns).toString().padStart(6, '0')}
                </td>
                {cells.map((cell) => (
                  <td
                    key={cell.index}
                    data-index={cell.index}
                    className={`
                      text-right text-[12px] font-mono px-2 py-1 border-b border-border/30
                      transition-colors cursor-default
                      ${getHighlightClass(cell.index)}
                    `}
                    onMouseEnter={() => onHoverIndex?.(cell.index)}
                    onMouseLeave={() => onHoverIndex?.(null)}
                    title={`[${cell.index}] = ${cell.value}${showHex ? `\nHex: ${cell.hex}` : ''}`}
                  >
                    <span className="block leading-snug">{formatValue(cell.value, data.dtype, precision)}</span>
                    {showHex && (
                      <span className="block text-[9px] text-muted-foreground/40 leading-tight">{cell.hex}</span>
                    )}
                  </td>
                ))}
                {cells.length < columns &&
                  Array.from({ length: columns - cells.length }, (_, i) => (
                    <td key={`empty-${i}`} className="border-b border-border/30" />
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-card/80 shrink-0">
          <span className="text-[11px] text-muted-foreground font-mono">
            Page {page + 1} / {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <PaginationButton onClick={() => setPage(0)} disabled={page === 0}>First</PaginationButton>
            <PaginationButton onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>Prev</PaginationButton>
            <PaginationButton onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>Next</PaginationButton>
            <PaginationButton onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>Last</PaginationButton>
          </div>
        </div>
      )}
    </div>
  );
}

function PaginationButton({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 py-1 text-[11px] rounded-md bg-secondary/40 text-foreground border border-border/50 disabled:opacity-25 hover:bg-secondary/70 hover:border-border transition-all"
    >
      {children}
    </button>
  );
}
