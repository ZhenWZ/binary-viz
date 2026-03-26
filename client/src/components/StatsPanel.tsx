import { useMemo } from 'react';
import { type DecodedData, DTYPE_INFO } from '@/lib/binaryDecoder';

interface StatsPanelProps {
  data: DecodedData;
  diffCount?: number;
  matchCount?: number;
  totalCompared?: number;
}

export default function StatsPanel({ data, diffCount, matchCount, totalCompared }: StatsPanelProps) {
  const stats = useMemo(() => {
    const values = data.values.filter((v) => Number.isFinite(v));
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance);

    const nanCount = data.values.filter((v) => Number.isNaN(v)).length;
    const infCount = data.values.filter((v) => !Number.isFinite(v) && !Number.isNaN(v)).length;
    const zeroCount = data.values.filter((v) => v === 0).length;

    return {
      count: data.elementCount,
      finiteCount: values.length,
      nanCount,
      infCount,
      zeroCount,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      std,
      median: sorted[Math.floor(sorted.length / 2)],
      sum,
    };
  }, [data]);

  if (!stats) return null;

  const info = DTYPE_INFO[data.dtype];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
      <StatCard label="Elements" value={stats.count.toLocaleString()} />
      <StatCard label="Data Type" value={data.dtype} sub={`${info.bytes}B ${data.byteOrder === 'little' ? 'LE' : 'BE'}`} />
      <StatCard label="File Size" value={formatBytes(data.totalBytes)} />
      {info.category === 'float' && (
        <>
          <StatCard label="Min" value={formatNum(stats.min)} />
          <StatCard label="Max" value={formatNum(stats.max)} />
          <StatCard label="Mean" value={formatNum(stats.mean)} />
          <StatCard label="Std Dev" value={formatNum(stats.std)} />
          <StatCard label="Median" value={formatNum(stats.median)} />
        </>
      )}
      {(info.category === 'int' || info.category === 'uint') && (
        <>
          <StatCard label="Min" value={stats.min.toLocaleString()} />
          <StatCard label="Max" value={stats.max.toLocaleString()} />
          <StatCard label="Mean" value={formatNum(stats.mean)} />
          <StatCard label="Sum" value={formatNum(stats.sum)} />
        </>
      )}
      {stats.nanCount > 0 && (
        <StatCard label="NaN Count" value={stats.nanCount.toLocaleString()} variant="warning" />
      )}
      {stats.infCount > 0 && (
        <StatCard label="Inf Count" value={stats.infCount.toLocaleString()} variant="warning" />
      )}
      {diffCount !== undefined && totalCompared !== undefined && (
        <>
          <StatCard
            label="Differences"
            value={diffCount.toLocaleString()}
            sub={`${((diffCount / totalCompared) * 100).toFixed(2)}%`}
            variant="destructive"
          />
          <StatCard
            label="Matches"
            value={(matchCount ?? 0).toLocaleString()}
            sub={`${(((matchCount ?? 0) / totalCompared) * 100).toFixed(2)}%`}
            variant="success"
          />
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  variant = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: 'default' | 'warning' | 'destructive' | 'success';
}) {
  const colorMap = {
    default: 'text-foreground',
    warning: 'text-amber-400',
    destructive: 'text-rose-400',
    success: 'text-emerald-400',
  };

  const borderMap = {
    default: 'border-border/40',
    warning: 'border-amber-500/20',
    destructive: 'border-rose-500/20',
    success: 'border-emerald-500/20',
  };

  return (
    <div className={`rounded-lg bg-secondary/25 border ${borderMap[variant]} px-3 py-2.5 hover:bg-secondary/40 transition-colors`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">{label}</p>
      <p className={`text-sm font-mono font-semibold ${colorMap[variant]} leading-tight`}>
        {value}
        {sub && <span className="text-[10px] text-muted-foreground ml-1 font-normal">{sub}</span>}
      </p>
    </div>
  );
}

function formatNum(n: number): string {
  if (Math.abs(n) < 0.001 && n !== 0) return n.toExponential(4);
  if (Math.abs(n) >= 1e6) return n.toExponential(4);
  return n.toPrecision(6);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
