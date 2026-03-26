import { useCallback, useState, useRef } from 'react';
import { Upload, FileIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileDropZoneProps {
  onFileLoaded: (buffer: ArrayBuffer, fileName: string) => void;
  accept?: string;
  label?: string;
  description?: string;
  file?: { name: string; size: number } | null;
  onClear?: () => void;
  compact?: boolean;
}

export default function FileDropZone({
  onFileLoaded,
  accept = '*',
  label = 'Drop binary file here',
  description = 'or click to browse',
  file,
  onClear,
  compact = false,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (f: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          onFileLoaded(reader.result, f.name);
        }
      };
      reader.readAsArrayBuffer(f);
    },
    [onFileLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleClick = () => inputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (file && compact) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-secondary/40 border border-border px-4 py-3 group hover:border-primary/30 transition-colors">
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <FileIcon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      className={`
        relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer group
        ${isDragging
          ? 'border-primary bg-primary/5 scale-[1.005] shadow-lg shadow-primary/5'
          : 'border-border/60 hover:border-primary/40 hover:bg-secondary/20'
        }
        ${compact ? 'p-4' : 'p-8'}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />

      <AnimatePresence mode="wait">
        {file ? (
          <motion.div
            key="file"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <FileIcon className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatSize(file.size)}</p>
            </div>
            {onClear && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2"
              >
                Remove file
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex flex-col items-center gap-3"
          >
            <div className={`rounded-lg bg-secondary/40 border border-border/50 flex items-center justify-center group-hover:bg-primary/5 group-hover:border-primary/20 transition-colors ${compact ? 'w-10 h-10' : 'w-14 h-14'}`}>
              <Upload className={`text-muted-foreground group-hover:text-primary transition-colors ${compact ? 'w-5 h-5' : 'w-6 h-6'}`} />
            </div>
            <div className="text-center">
              <p className={`font-medium text-foreground/80 group-hover:text-foreground transition-colors ${compact ? 'text-sm' : 'text-base'}`}>{label}</p>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
