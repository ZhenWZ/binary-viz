import { type DType, type ByteOrder, DTYPE_INFO } from '@/lib/binaryDecoder';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

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
}

const DTYPE_GROUPS = {
  'Floating Point': ['float16', 'bfloat16', 'float32', 'float64'] as DType[],
  'Signed Integer': ['int8', 'int16', 'int32', 'int64'] as DType[],
  'Unsigned Integer': ['uint8', 'uint16', 'uint32', 'uint64'] as DType[],
  'Other': ['bool'] as DType[],
};

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
}: DTypeSelectorProps) {
  return (
    <div className={`flex flex-wrap items-end gap-4 ${compact ? 'gap-3' : 'gap-4'}`}>
      {/* DType */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Data Type</Label>
        <Select value={dtype} onValueChange={(v) => onDTypeChange(v as DType)}>
          <SelectTrigger className="w-[160px] h-9 text-sm bg-secondary/50 border-border">
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
  );
}
