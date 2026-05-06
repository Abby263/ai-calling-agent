import { Bot, FileText, User } from "lucide-react";

type TranscriptTurn = {
  speaker: "ai" | "callee" | "system";
  text: string;
};

function parseTranscript(transcript: string): TranscriptTurn[] {
  return transcript
    .split(/\r?\n/)
    .map((rawLine) => rawLine.trim())
    .filter(Boolean)
    .map((line): TranscriptTurn => {
      const colon = line.indexOf(":");
      if (colon <= 0) {
        return { speaker: "callee", text: line };
      }
      const speakerRaw = line.slice(0, colon).trim().toLowerCase();
      const text = line.slice(colon + 1).trim();
      if (!text) return { speaker: "system", text: line };
      if (speakerRaw === "ai" || speakerRaw === "agent" || speakerRaw === "assistant") {
        return { speaker: "ai", text };
      }
      if (speakerRaw === "system") {
        return { speaker: "system", text };
      }
      return { speaker: "callee", text };
    });
}

export function CallTranscript({
  transcript,
  calleeLabel,
  emptyMessage = "Transcript not available yet."
}: {
  transcript: string | null | undefined;
  calleeLabel: string;
  emptyMessage?: string;
}) {
  if (!transcript || !transcript.trim()) {
    return (
      <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
        <FileText size={16} className="opacity-70" />
        {emptyMessage}
      </div>
    );
  }

  const turns = parseTranscript(transcript);

  return (
    <div className="grid gap-2">
      {turns.map((turn, index) => {
        if (turn.speaker === "system") {
          return (
            <p
              key={index}
              className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-xs italic text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400"
            >
              {turn.text}
            </p>
          );
        }
        const isAi = turn.speaker === "ai";
        return (
          <div
            key={index}
            className={`flex items-start gap-2.5 ${isAi ? "" : "flex-row-reverse"}`}
          >
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                isAi
                  ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100"
              }`}
              aria-label={isAi ? "AI agent" : calleeLabel}
              title={isAi ? "AI agent" : calleeLabel}
            >
              {isAi ? <Bot size={14} /> : <User size={14} />}
            </span>
            <div
              className={`max-w-[44rem] rounded-2xl px-3.5 py-2 text-sm leading-6 shadow-soft ${
                isAi
                  ? "rounded-tl-sm bg-white text-slate-800 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700"
                  : "rounded-tr-sm bg-brand-gradient text-white"
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">
                {isAi ? "AI agent" : calleeLabel}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words">{turn.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
