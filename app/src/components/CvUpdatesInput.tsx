import { useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";

interface CvUpdatesInputProps {
  value: string;
  onChange: (value: string) => void;
}

const MAX_CHARS = 3000;

export default function CvUpdatesInput({ value, onChange }: CvUpdatesInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const charCount = value.length;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <div className="w-full h-full flex flex-col">
      <h3 className="text-cyan-400 text-sm font-semibold mb-3 flex items-center gap-2 neon-text">
        <Plus className="w-4 h-4" />
        CV Updates
      </h3>

      <div className="relative flex-1">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Add new qualifications, certifications, or work experience to include in your CV...

Examples:
- Added AWS Solutions Architect certification (2025)
- Promoted to Senior Developer at TechNova (Jan 2025)
- Completed Machine Learning Specialization on Coursera"
          className={`
            cyber-input w-full h-full min-h-[150px] resize-none
            ${isFocused ? "neon-border" : ""}
            ${isOverLimit ? "border-red-500/50" : ""}
          `}
          style={{ lineHeight: "1.6" }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOverLimit && (
            <div className="flex items-center gap-1 text-red-400 text-xs">
              <AlertTriangle className="w-3 h-3" />
              <span>Over limit by {charCount - MAX_CHARS}</span>
            </div>
          )}
        </div>
        <span className={`text-xs font-mono ${isOverLimit ? "text-red-400" : "text-slate-400"}`}>
          {charCount}/{MAX_CHARS}
        </span>
      </div>

      <p className="text-slate-500 text-xs mt-1">
        Add new experience, certifications, or qualifications not in your original CV.
        Only verified information will be included.
      </p>
    </div>
  );
}
