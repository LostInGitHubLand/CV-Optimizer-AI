import { useState } from "react";
import { Globe, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

interface UrlInputProps {
  url: string;
  onUrlChange: (url: string) => void;
  fetcherOutput: string | null;
  isFetching: boolean;
}

export default function UrlInput({ url, onUrlChange, fetcherOutput, isFetching }: UrlInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const getStatusIcon = () => {
    if (isFetching) return <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />;
    if (fetcherOutput && !fetcherOutput.startsWith("Error")) return <CheckCircle className="w-4 h-4 text-green-400" />;
    if (fetcherOutput?.startsWith("Error")) return <AlertCircle className="w-4 h-4 text-red-400" />;
    return null;
  };

  return (
    <div className="w-full">
      <h3 className="text-pink-400 text-sm font-semibold mb-3 flex items-center gap-2 neon-text-pink">
        <Globe className="w-4 h-4" />
        Website Profile URL
      </h3>

      <div className="relative">
        <input
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="https://your-website-cv/profile"
          className={`
            cyber-input pr-10
            ${isFocused ? "neon-border" : ""}
            ${fetcherOutput && !fetcherOutput.startsWith("Error") ? "border-green-500/40" : ""}
            ${fetcherOutput?.startsWith("Error") ? "border-red-500/40" : ""}
          `}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {getStatusIcon()}
        </div>
      </div>

      <p className="text-slate-500 text-xs mt-2">
        Enter a link to your personal website
      </p>

      {/* Fetcher Output Panel */}
      {(fetcherOutput || isFetching) && (
        <div
          className={`
            mt-3 rounded-lg p-3 text-xs font-mono overflow-auto max-h-40
            ${fetcherOutput?.startsWith("Error")
              ? "bg-red-500/10 border border-red-500/30 text-red-300"
              : "bg-cyan-500/5 border border-cyan-500/20 text-cyan-200/80"
            }
          `}
        >
          {isFetching && !fetcherOutput ? (
            <div className="flex items-center gap-2 text-cyan-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>FETCHER agent is extracting profile information...</span>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words">{fetcherOutput}</pre>
          )}
        </div>
      )}
    </div>
  );
}
