/**
 * BitGrid — renders a single entry's bit pattern with field annotations and diff highlighting.
 */

import { type BitField } from '@/lib/bitUtils';
import { type DType } from '@/lib/binaryDecoder';

interface BitGridProps {
  bits: string;
  fields: BitField[];
  diffIndices: Set<number>;
  hexValue: string;
  decodedValue: string;
  dtype: DType;
  label: string;
  showFieldLabels?: boolean;
}

const FIELD_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/40',   text: 'text-amber-400' },
  sky:     { bg: 'bg-sky-500/10',      border: 'border-sky-500/40',     text: 'text-sky-400' },
  emerald: { bg: 'bg-emerald-500/10',  border: 'border-emerald-500/40', text: 'text-emerald-400' },
  violet:  { bg: 'bg-violet-500/10',   border: 'border-violet-500/40',  text: 'text-violet-400' },
  slate:   { bg: 'bg-slate-500/5',     border: 'border-slate-500/30',   text: 'text-slate-400' },
  zinc:    { bg: 'bg-zinc-500/5',      border: 'border-zinc-500/30',    text: 'text-zinc-400' },
};

export default function BitGrid({
  bits,
  fields,
  diffIndices,
  hexValue,
  decodedValue,
  label,
  showFieldLabels = false,
}: BitGridProps) {
  return (
    <div className="space-y-1">
      {/* Field annotation header (shown once above the first entry) */}
      {showFieldLabels && fields.length > 0 && (
        <div className="flex gap-0">
          {fields.map((f) => {
            const colors = FIELD_COLORS[f.color] || FIELD_COLORS.slate;
            const width = f.end - f.start;
            return (
              <div
                key={f.name}
                className={`flex items-center justify-center text-[9px] font-medium ${colors.text} ${colors.bg} border-b-2 ${colors.border}`}
                style={{ width: `${width * 24}px`, minWidth: `${width * 24}px` }}
              >
                {width >= 3 ? f.name : ''}
              </div>
            );
          })}
        </div>
      )}

      {/* Entry row */}
      <div className="flex items-center gap-3">
        {/* Label */}
        <span className="text-[11px] text-muted-foreground font-medium w-10 shrink-0 text-right">
          {label}
        </span>

        {/* Bit cells */}
        <div className="flex gap-0">
          {bits.split('').map((bit, i) => {
            const isDiff = diffIndices.has(i);
            const isByteBoundary = i > 0 && i % 8 === 0;
            // Find which field this bit belongs to
            const field = fields.find((f) => i >= f.start && i < f.end);
            const fieldColors = field ? FIELD_COLORS[field.color] || FIELD_COLORS.slate : FIELD_COLORS.slate;

            return (
              <span
                key={i}
                className={`
                  inline-flex items-center justify-center w-6 h-7
                  font-mono text-[13px] font-medium select-none
                  transition-colors
                  ${isByteBoundary ? 'ml-1.5' : ''}
                  ${isDiff
                    ? 'bg-rose-500/25 text-rose-300 font-bold'
                    : `${fieldColors.bg} text-foreground/70`
                  }
                  ${i === 0 ? 'rounded-l-sm' : ''}
                  ${i === bits.length - 1 ? 'rounded-r-sm' : ''}
                `}
                title={`Bit ${i}${field ? ` (${field.name})` : ''}: ${bit}`}
              >
                {bit}
              </span>
            );
          })}
        </div>

        {/* Decoded value + hex */}
        <div className="shrink-0 flex items-center gap-3">
          <span className="font-mono text-sm text-foreground font-semibold min-w-[80px]">
            {decodedValue}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground/60">
            {hexValue}
          </span>
        </div>
      </div>
    </div>
  );
}
