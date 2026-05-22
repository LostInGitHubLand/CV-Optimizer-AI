import { useState, useCallback } from "react";
import { FileText, Upload, X } from "lucide-react";

interface PdfUploaderProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
}

export default function PdfUploader({ onFileSelect, selectedFile, onClear }: PdfUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type === "application/pdf") {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  return (
    <div className="w-full">
      <h3 className="text-cyan-400 text-sm font-semibold mb-3 flex items-center gap-2 neon-text">
        <FileText className="w-4 h-4" />
        Upload CV (PDF)
      </h3>

      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
            transition-all duration-300
            ${isDragOver
              ? "border-cyan-400 bg-cyan-400/10 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
              : "border-cyan-500/30 hover:border-cyan-400/60 hover:bg-cyan-400/5"
            }
          `}
        >
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <Upload
            className={`w-10 h-10 mx-auto mb-3 transition-all duration-300 ${
              isDragOver ? "text-cyan-300 scale-110" : "text-cyan-500/60"
            }`}
          />
          <p className="text-cyan-300/80 text-sm font-medium">
            {isDragOver ? "Drop PDF here" : "Drag & drop your CV"}
          </p>
          <p className="text-slate-400 text-xs mt-1">or click to browse</p>
          <p className="text-slate-500 text-xs mt-2">PDF files only</p>
        </div>
      ) : (
        <div className="agent-card active p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-cyan-300 text-sm font-medium truncate max-w-[180px]">
                  {selectedFile.name}
                </p>
                <p className="text-slate-500 text-xs">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button
              onClick={onClear}
              className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center
                         hover:bg-red-500/40 transition-colors duration-200"
            >
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
