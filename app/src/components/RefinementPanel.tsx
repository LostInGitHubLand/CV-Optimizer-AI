import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, PenTool, Palette, FileText, Sparkles, Send, CheckCircle } from "lucide-react";

interface RefinementPanelProps {
  onRefine: (writerInstruction: string, designerInstruction: string, editedMarkdown: string | null) => void;
  onSatisfied: () => void;
  disabled: boolean;
  awaitingReview: boolean;
  currentMarkdown: string;
}

type TabKey = "writer" | "designer" | "writeText";

const WRITER_SUGGESTIONS = [
  "Make the summary more concise and punchy",
  "Add emphasis on cloud architecture and DevOps",
  "Use stronger action verbs for the latest role",
  "Quantify achievements with specific metrics",
  "Highlight leadership experience more prominently",
  "Reorder experience to put most relevant first",
];

const DESIGNER_SUGGESTIONS = [
  "Switch to single-column layout",
  "Switch to sidebar-left layout",
  "Switch to sidebar-right layout",
  "Make experience a timeline",
  "Make experience as cards",
  "Make education as editorial flow",
  "Use skills as expertise bars",
  "Switch to dark theme",
  "Switch to minimal-swiss theme",
  "Switch to glassmorphism theme",
  "Move skills to sidebar",
  "Move languages to sidebar",
];

export default function RefinementPanel({
  onRefine,
  onSatisfied,
  disabled,
  awaitingReview,
  currentMarkdown,
}: RefinementPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("writer");
  const [writerText, setWriterText] = useState("");
  const [designerText, setDesignerText] = useState("");
  const [markdownText, setMarkdownText] = useState(currentMarkdown);
  const [hasMarkdownEdit, setHasMarkdownEdit] = useState(false);

  // Sync markdownText when currentMarkdown changes (e.g. after a refinement)
  useEffect(() => {
    setMarkdownText(currentMarkdown);
    setHasMarkdownEdit(false);
  }, [currentMarkdown]);

  // Track if the user has edited the markdown (for the dot indicator)
  const handleMarkdownChange = (value: string) => {
    setMarkdownText(value);
    setHasMarkdownEdit(value !== currentMarkdown);
  };

  const handleRefine = () => {
    // If the user has edited the markdown (even if on Writer tab), pass the edited version
    // This ensures markdown changes are always preserved when refining
    const editedMarkdown = hasMarkdownEdit ? markdownText : null;
    onRefine(writerText.trim(), designerText.trim(), editedMarkdown);
    setWriterText("");
    setDesignerText("");
  };

  const insertSuggestion = (suggestion: string) => {
    if (activeTab === "writer") {
      setWriterText(suggestion);
    } else {
      setDesignerText(suggestion);
    }
  };

  const hasContent =
    activeTab === "writeText"
      ? hasMarkdownEdit // Write Text tab is refinable only if edits were made
      : writerText.trim().length > 0 || designerText.trim().length > 0 || hasMarkdownEdit;

  return (
    <Card className="overflow-hidden border border-slate-700/50 shadow-2xl bg-[#0a0a1a]/95 backdrop-blur-xl rounded-2xl animate-slide-up-delay-3">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-slate-900 via-[#0f0f2a] to-slate-900 text-white hover:opacity-95 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/10 backdrop-blur-sm">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-bold">Refine Your Optimized CV</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {awaitingReview
                ? "Refinement in progress..."
                : "Content changes, direct text editing, or layout adjustments"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 hidden sm:inline">Click to {isOpen ? "collapse" : "expand"}</span>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="p-5 space-y-4 bg-[#0a0a1a]">
          {/* Tab Switcher — 3 tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("writer")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "writer"
                  ? "bg-pink-500 text-white shadow-lg shadow-pink-500/25"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              <PenTool className="w-4 h-4" />
              Writer
              {writerText.trim() && (
                <span className="w-2 h-2 rounded-full bg-white" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("writeText")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "writeText"
                  ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              <FileText className="w-4 h-4" />
              Write Text
              {hasMarkdownEdit && (
                <span className="w-2 h-2 rounded-full bg-white" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("designer")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "designer"
                  ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              <Palette className="w-4 h-4" />
              Designer
              {designerText.trim() && (
                <span className="w-2 h-2 rounded-full bg-white" />
              )}
            </button>
          </div>

          {/* Content Area */}
          <div className="space-y-2">
            {activeTab === "writer" && (
              <>
                <label className="text-sm font-semibold text-pink-400 flex items-center gap-2">
                  <PenTool className="w-4 h-4" />
                  Content Instructions
                </label>
                <p className="text-xs text-slate-500">Wording, emphasis, structure, skills to highlight...</p>
                <Textarea
                  placeholder="e.g., Make the summary more concise, add emphasis on cloud architecture..."
                  value={writerText}
                  onChange={(e) => setWriterText(e.target.value)}
                  className="min-h-[100px] resize-none bg-slate-800/50 border-slate-700 text-slate-200 placeholder:text-slate-600 focus-visible:ring-pink-400 focus-visible:border-pink-400"
                  disabled={disabled}
                />
              </>
            )}

            {activeTab === "writeText" && (
              <>
                <label className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Edit Markdown Directly
                </label>
                <p className="text-xs text-slate-500">
                  The full Markdown CV is shown below. Edit it directly — your changes are sent to the Writer for sync and validation. You can then switch to the Writer tab to add instructions.
                </p>
                <Textarea
                  placeholder="Markdown CV content..."
                  value={markdownText}
                  onChange={(e) => handleMarkdownChange(e.target.value)}
                  className="min-h-[300px] resize-y bg-slate-800/50 border-slate-700 text-slate-200 placeholder:text-slate-600 focus-visible:ring-cyan-400 focus-visible:border-cyan-400 font-mono text-xs leading-relaxed"
                  disabled={disabled}
                />
                <p className="text-xs text-slate-500">
                  {markdownText.length} characters
                  {hasMarkdownEdit && " · Edited (will be used when you click Refine)"}
                </p>
              </>
            )}

            {activeTab === "designer" && (
              <>
                <label className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Design Instructions
                </label>
                <p className="text-xs text-slate-500">Layout, theme, colors, section variants, spacing...</p>
                <Textarea
                  placeholder="e.g., Switch to sidebar-left layout, make it more colorful, use skills as expertise bars..."
                  value={designerText}
                  onChange={(e) => setDesignerText(e.target.value)}
                  className="min-h-[100px] resize-none bg-slate-800/50 border-slate-700 text-slate-200 placeholder:text-slate-600 focus-visible:ring-amber-400 focus-visible:border-amber-400"
                  disabled={disabled}
                />
              </>
            )}
          </div>

          {/* Suggestion Chips (only for Writer and Designer tabs) */}
          {activeTab !== "writeText" && (
            <div className="flex flex-wrap gap-2">
              {(activeTab === "writer" ? WRITER_SUGGESTIONS : DESIGNER_SUGGESTIONS).map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => insertSuggestion(suggestion)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 ${
                    activeTab === "writer"
                      ? "bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                  }`}
                  disabled={disabled}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={handleRefine}
              disabled={disabled || !hasContent}
              className="flex-1 bg-gradient-to-r from-pink-500 via-amber-500 to-emerald-500 hover:opacity-90 text-white font-semibold h-11 rounded-xl shadow-lg"
            >
              <Send className="w-4 h-4 mr-2" />
              Refine
            </Button>
            <Button
              onClick={onSatisfied}
              disabled={disabled}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white font-semibold h-11 rounded-xl shadow-lg shadow-emerald-500/20"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              I'm so satisfied
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
