/**
 * DiffSummaryBar - Visual bar showing diff positions across the entire dataset
 * Design: Dark Forge — compact bar with red markers for diffs
 */

interface DiffSummaryBarProps {
  totalElements: number;
  diffIndices: Set<number>;
  height?: number;
}

export default function DiffSummaryBar({ totalElements, diffIndices, height = 24 }: DiffSummaryBarProps) {
  if (totalElements === 0) return null;

  // Create a bitmap of diff positions, bucketed into pixel-width segments
  const bucketCount = 200;
  const buckets = new Array(bucketCount).fill(0);
  const elementsPerBucket = totalElements / bucketCount;

  diffIndices.forEach(idx => {
    const bucket = Math.min(bucketCount - 1, Math.floor(idx / elementsPerBucket));
    buckets[bucket]++;
  });

  const maxBucket = Math.max(...buckets, 1);

  return (
    <div className="rounded-lg bg-secondary/30 border border-border/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Diff Map</p>
        <p className="text-[11px] text-muted-foreground">
          <span className="text-rose-400 font-mono">{diffIndices.size}</span> diffs across{' '}
          <span className="font-mono">{totalElements.toLocaleString()}</span> elements
        </p>
      </div>
      <div className="relative rounded overflow-hidden" style={{ height }}>
        <div className="absolute inset-0 bg-secondary/50" />
        <svg
          viewBox={`0 0 ${bucketCount} ${height}`}
          preserveAspectRatio="none"
          className="w-full h-full relative"
        >
          {buckets.map((count, i) => {
            if (count === 0) return null;
            const barHeight = (count / maxBucket) * height;
            return (
              <rect
                key={i}
                x={i}
                y={height - barHeight}
                width={1}
                height={barHeight}
                className="fill-rose-500/70"
              />
            );
          })}
        </svg>
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] font-mono text-muted-foreground">0</span>
        <span className="text-[10px] font-mono text-muted-foreground">{totalElements.toLocaleString()}</span>
      </div>
    </div>
  );
}
