import { type DType, type ByteOrder, type FormatDetectionResult, DTYPE_INFO, DTYPE_GROUPS } from '@/lib/binaryDecoder';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

interface DTypeSelectorProps {
  dtype: DType;
  byteOrder: ByteOrder;
  onDTypeChange: (dtype: DType) => void;
  onByteOrderChange: (order: ByteOrder) => void;
  showHex?: boolean;
  onShowHexChange?: (show: boolean) => void;
  columns?: number;
  onColumnsChange?: (cols: number) => void;
  offset?: number;
  onOffsetChange?: (offset: number) => void;
  precision?: number;
  onPrecisionChange?: (p: number) => void;
  compact?: boolean;
  formatInfo?: FormatDetectionResult | null;
  autoDetected?: boolean;
}

export default function DTypeSelector({
  dtype,
  byteOrder,
  onDTypeChange,
  onByteOrderChange,
  showHex,
  onShowHexChange,
  columns,
  onColumnsChange,
  offset,
  onOffsetChange,
  precision,
  onPrecisionChange,
  compact = false,
  formatInfo,
  autoDetected,
}: DTypeSelectorProps) {
  return (
    <div className="space-y-3">
      {/* Format detection info */}
      {formatInfo && (
        <div className="flex items-center gap-2 flex-wrap">
          <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">{formatInfo.description}</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
            formatInfo.confidence === 'high' ? 'border-emerald-500/40 text-emerald-400' :
            formatInfo.confidence === 'medium' ? 'border-amber-500/40 text-amber-400' :
            'border-muted-foreground/40 text-muted-foreground'
          }`}>
            {formatInfo.format}
          </Badge>
          {autoDetected && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">
              auto-detected
            </Badge>
          )}
        </div>
      )}

      <div className={`flex flex-wrap items-end gap-4 ${compact ? 'gap-3' : 'gap-4'}`}>
        {/* DType */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Data Type</Label>
          <Select value={dtype} onValueChange={(v) => onDTypeChange(v as DType)}>
            <SelectTrigger className="w-[170px] h-9 text-sm bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DTYPE_GROUPS).map(([group, types]) => (
                <div key={group}>
                  <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    {group}
                  </div>
                  {types.map((t) => (
                    <SelectItem key={t} value={t} className="text-sm">
                      <span className="font-mono">{t}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        ({DTYPE_INFO[t].bytes}B)
                      </span>
                      {t === 'hifloat8' && (
                        <span className="ml-1.5 px-1 py-0.5 text-[9px] font-semibold uppercase rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
                          beta
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Byte Order */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Byte Order</Label>
          <Select value={byteOrder} onValueChange={(v) => onByteOrderChange(v as ByteOrder)}>
            <SelectTrigger className="w-[130px] h-9 text-sm bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="little">Little Endian</SelectItem>
              <SelectItem value="big">Big Endian</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Offset */}
        {onOffsetChange !== undefined && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Byte Offset</Label>
            <input
              type="number"
              min={0}
              value={offset ?? 0}
              onChange={(e) => onOffsetChange(Math.max(0, parseInt(e.target.value) || 0))}
              className="h-9 w-[90px] rounded-md border border-border bg-secondary/50 px-3 text-sm font-mono text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}

        {/* Columns */}
        {onColumnsChange && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Columns</Label>
            <Select value={String(columns ?? 8)} onValueChange={(v) => onColumnsChange(Number(v))}>
              <SelectTrigger className="w-[80px] h-9 text-sm bg-secondary/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[4, 8, 12, 16, 20, 24, 32].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Precision */}
        {onPrecisionChange && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Precision</Label>
            <Select value={String(precision ?? 6)} onValueChange={(v) => onPrecisionChange(Number(v))}>
              <SelectTrigger className="w-[80px] h-9 text-sm bg-secondary/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Show Hex */}
        {onShowHexChange !== undefined && (
          <div className="flex items-center gap-2 pb-0.5">
            <Switch
              checked={showHex ?? false}
              onCheckedChange={onShowHexChange}
              className="data-[state=checked]:bg-primary"
            />
            <Label className="text-xs text-muted-foreground">Show Hex</Label>
          </div>
        )}
      </div>
    </div>
  );
}
