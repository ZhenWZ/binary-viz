/**
 * HistoryPanel — popover showing recent decode/compare sessions.
 */

import { useState, useEffect, useCallback } from 'react';
import { Clock, Trash2, Binary, GitCompareArrows } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type HistoryEntry, getHistory, clearHistory } from '@/lib/history';

interface HistoryPanelProps {
  onNavigate: (mode: 'decode' | 'compare') => void;
}

export default function HistoryPanel({ onNavigate }: HistoryPanelProps) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Refresh history when panel opens
  useEffect(() => {
    if (open) setHistory(getHistory());
  }, [open]);

  const handleClear = useCallback(() => {
    clearHistory();
    setHistory([]);
  }, []);

  const handleClick = useCallback((entry: HistoryEntry) => {
    onNavigate(entry.mode);
    setOpen(false);
  }, [onNavigate]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = Date.now();
    const diffMs = now - ts;
    if (diffMs < 60_000) return 'just now';
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(!open)}
            className={`p-1.5 rounded-md hover:bg-accent transition-colors ${open ? 'bg-accent' : ''}`}
          >
            <Clock className="w-4 h-4 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        {!open && (
          <TooltipContent side="bottom" className="text-xs">History</TooltipContent>
        )}
      </Tooltip>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-1 z-50 w-80 max-h-96 rounded-lg border border-border bg-card shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/90">
              <span className="text-xs font-semibold text-foreground">Session History</span>
              {history.length > 0 && (
                <button
                  onClick={handleClear}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-auto max-h-80">
              {history.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11px] text-muted-foreground/60">
                  No history yet
                </div>
              ) : (
                history.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => handleClick(entry)}
                    className="w-full text-left px-3 py-2 hover:bg-secondary/30 transition-colors border-b border-border/30 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {entry.mode === 'decode' ? (
                        <Binary className="w-3 h-3 text-primary shrink-0" />
                      ) : (
                        <GitCompareArrows className="w-3 h-3 text-primary shrink-0" />
                      )}
                      <span className="text-xs font-medium text-foreground truncate">
                        {entry.mode === 'decode'
                          ? entry.fileName || 'Unknown file'
                          : `${entry.fileNameA || '?'} vs ${entry.fileNameB || '?'}`}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0 ml-auto">
                        {formatTime(entry.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 ml-5">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {entry.dtype}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {entry.elementCount.toLocaleString()} elements
                      </span>
                      {entry.diffCount != null && entry.diffCount > 0 && (
                        <span className="text-[10px] text-rose-400">
                          {entry.diffCount.toLocaleString()} diffs
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
