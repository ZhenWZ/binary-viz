/**
 * Home Page - Binary Data Visualizer
 * Design: Dark Forge — Modern Dark IDE Aesthetic
 * Persistent top toolbar with mode tabs, full-screen content area
 */

import { useState } from 'react';
import { Binary, GitCompareArrows, FileText, Info } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import DecodeMode from './DecodeMode';
import CompareMode from './CompareMode';
import TxtCompareMode from './TxtCompareMode';

type Mode = 'decode' | 'compare' | 'txt-compare';

const MODES = [
  { id: 'decode' as Mode, label: 'Decode', icon: Binary, description: 'Decode a binary file with correct dtype' },
  { id: 'compare' as Mode, label: 'Compare', icon: GitCompareArrows, description: 'Compare two binary files side-by-side' },
  { id: 'txt-compare' as Mode, label: 'Txt vs Bin', icon: FileText, description: 'Compare text values with binary data' },
];

export default function Home() {
  const [mode, setMode] = useState<Mode>('decode');

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Toolbar */}
      <header className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-5 h-14">
          {/* Logo + Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
              <Binary className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground tracking-tight leading-none">
                Binary Data Visualizer
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                PyTorch & NumPy binary dump inspector
              </p>
            </div>
          </div>

          {/* Mode Tabs */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="bg-secondary/50 h-9">
              {MODES.map((m) => (
                <TabsTrigger
                  key={m.id}
                  value={m.id}
                  className="text-xs gap-1.5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary px-3"
                >
                  <m.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{m.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground hidden md:block">
              {MODES.find((m) => m.id === mode)?.description}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-1.5 rounded-md hover:bg-accent transition-colors">
                  <Info className="w-4 h-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                <p className="font-semibold mb-1">Supported formats:</p>
                <p>Binary: .bin, .pt, .npy, .raw, or any binary dump</p>
                <p>Text: .txt, .csv, .log with numeric values</p>
                <p className="mt-1 font-semibold">Supported dtypes:</p>
                <p>float16, bfloat16, float32, float64, int8/16/32/64, uint8/16/32/64, bool</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full p-4 lg:p-5">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {mode === 'decode' && <DecodeMode />}
            {mode === 'compare' && <CompareMode />}
            {mode === 'txt-compare' && <TxtCompareMode />}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
