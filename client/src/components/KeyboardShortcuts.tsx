/**
 * KeyboardShortcuts - Shows available keyboard shortcuts
 */

import { useState } from 'react';
import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const shortcuts = [
  { keys: ['Ctrl', 'O'], description: 'Open file (click drop zone)' },
  { keys: ['Enter'], description: 'Jump to index (in search box)' },
  { keys: ['Arrow Up/Down'], description: 'Navigate between diffs' },
];

export default function KeyboardShortcuts() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="p-1.5 rounded-md hover:bg-accent transition-colors" title="Keyboard shortcuts">
          <Keyboard className="w-4 h-4 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{s.description}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((key, j) => (
                  <span key={j}>
                    <kbd className="px-2 py-1 text-xs font-mono rounded bg-secondary border border-border text-foreground">
                      {key}
                    </kbd>
                    {j < s.keys.length - 1 && <span className="text-muted-foreground mx-0.5">+</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
