/**
 * DataDistribution - Mini histogram showing value distribution
 * Design: Dark Forge — subtle chart with primary blue bars
 */

import { useMemo } from 'react';
import { type DecodedData, DTYPE_INFO } from '@/lib/binaryDecoder';

interface DataDistributionProps {
  data: DecodedData;
  height?: number;
}

export default function DataDistribution({ data, height = 60 }: DataDistributionProps) {
  const histogram = useMemo(() => {
    const finiteValues = data.values.filter((v) => Number.isFinite(v));
    if (finiteValues.length < 2) return null;

    const min = Math.min(...finiteValues);
    const max = Math.max(...finiteValues);
    if (min === max) return null;

    const binCount = Math.min(40, Math.max(10, Math.floor(Math.sqrt(finiteValues.length))));
    const binWidth = (max - min) / binCount;
    const bins = new Array(binCount).fill(0);

    for (const v of finiteValues) {
      const idx = Math.min(binCount - 1, Math.floor((v - min) / binWidth));
      bins[idx]++;
    }

    const maxBin = Math.max(...bins);
    return { bins, maxBin, min, max, binWidth, binCount };
  }, [data]);

  if (!histogram) return null;

  const { bins, maxBin, min, max, binCount } = histogram;
  const barWidth = 100 / binCount;

  return (
    <div className="rounded-lg bg-secondary/30 border border-border/50 p-3">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Value Distribution</p>
      <div className="relative" style={{ height }}>
        <svg
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {bins.map((count, i) => {
            const barHeight = maxBin > 0 ? (count / maxBin) * (height - 4) : 0;
            return (
              <rect
                key={i}
                x={i * barWidth + 0.2}
                y={height - barHeight - 2}
                width={Math.max(0, barWidth - 0.4)}
                height={barHeight}
                rx={0.3}
                className="fill-primary/40"
              />
            );
          })}
        </svg>
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] font-mono text-muted-foreground">{min.toPrecision(3)}</span>
        <span className="text-[10px] font-mono text-muted-foreground">{max.toPrecision(3)}</span>
      </div>
    </div>
  );
}
