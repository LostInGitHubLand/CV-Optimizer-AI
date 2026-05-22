import { useState } from "react";
import { Briefcase, AlertTriangle } from "lucide-react";

interface JobAdvertInputProps {
  value: string;
  onChange: (value: string) => void;
}

const MAX_CHARS = 6000;

export default function JobAdvertInput({ value, onChange }: JobAdvertInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const charCount = value.length;
  const isOverLimit = charCount > MAX_CHARS;
  const progressPercent = Math.min((charCount / MAX_CHARS) * 100, 100);

  return (
    <div className="w-full h-full flex flex-col">
      <h3 className="text-purple-400 text-sm font-semibold mb-3 flex items-center gap-2"
        style={{ textShadow: "0 0 10px rgba(168,85,247,0.4)" }}>
        <Briefcase className="w-4 h-4" />
        Job Advertisement
      </h3>

      <div className="relative flex-1">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Paste the job advertisement here. Include the job title, requirements, responsibilities, and any other relevant details..."
          className={`
            cyber-input w-full h-full min-h-[300px] resize-none
            ${isFocused ? "neon-border" : ""}
            ${isOverLimit ? "border-red-500/50" : ""}
          `}
          style={{ lineHeight: "1.6" }}
        />
      </div>

      {/* Character counter */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOverLimit && (
            <div className="flex items-center gap-1 text-red-400 text-xs">
              <AlertTriangle className="w-3 h-3" />
              <span>Over limit by {charCount - MAX_CHARS} characters</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isOverLimit
                  ? "bg-red-500"
                  : progressPercent > 80
                    ? "bg-yellow-400"
                    : "bg-gradient-to-r from-cyan-400 to-cyan-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span
            className={`text-xs font-mono ${
              isOverLimit
                ? "text-red-400"
                : progressPercent > 80
                  ? "text-yellow-400"
                  : "text-slate-400"
            }`}
          >
            {charCount}/{MAX_CHARS}
          </span>
        </div>
      </div>
    </div>
  );
}
