"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle, XCircle } from "lucide-react";
import type { ExplainResponse, QuizQuestion } from "@/lib/types";

interface Props {
  result: ExplainResponse;
  onReset: () => void;
}

function QuizCard({
  question,
  index,
}: {
  question: QuizQuestion;
  index: number;
}) {
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const optionLetters = ["A", "B", "C", "D"] as const;

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white shadow-sm">
      <p className="font-medium text-gray-800">
        Q{index + 1}. {question.q}
      </p>

      <div className="grid grid-cols-1 gap-2">
        {question.options.map((opt, i) => {
          const isCorrect = i === question.answerIndex;
          const isSelected = selected === i;

          let className =
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm border transition-colors min-h-[44px] text-left";

          if (!revealed) {
            className +=
              isSelected
                ? " bg-orange-100 border-orange-400"
                : " bg-gray-50 border-gray-200 hover:bg-orange-50 hover:border-orange-300";
          } else {
            if (isCorrect) {
              className += " bg-green-100 border-green-500 text-green-800";
            } else if (isSelected && !isCorrect) {
              className += " bg-red-100 border-red-400 text-red-700";
            } else {
              className += " bg-gray-50 border-gray-200 text-gray-500";
            }
          }

          return (
            <button
              key={i}
              type="button"
              onClick={() => !revealed && setSelected(i)}
              className={className}
              aria-pressed={isSelected}
              aria-label={`Option ${optionLetters[i]}: ${opt}`}
            >
              {revealed && isCorrect && (
                <CheckCircle size={16} className="text-green-600 shrink-0" />
              )}
              {revealed && isSelected && !isCorrect && (
                <XCircle size={16} className="text-red-500 shrink-0" />
              )}
              <span className="font-semibold mr-1">{optionLetters[i]}.</span>
              {opt}
            </button>
          );
        })}
      </div>

      {/* Reveal toggle */}
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        className="flex items-center gap-1 text-sm text-blue-600 hover:underline min-h-[44px] px-1"
        aria-expanded={revealed}
      >
        {revealed ? (
          <>
            <ChevronUp size={16} /> Hide answer
          </>
        ) : (
          <>
            <ChevronDown size={16} /> Reveal answer
          </>
        )}
      </button>

      {revealed && (
        <p className="text-sm text-gray-600 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
          💡 {question.explanation}
        </p>
      )}
    </div>
  );
}

export default function ResultView({ result, onReset }: Props) {
  const [quizOpen, setQuizOpen] = useState(true);

  return (
    <div
      className="w-full max-w-lg space-y-5"
      role="region"
      aria-label="Explanation and quiz results"
      aria-live="polite"
    >
      {/* Meta badge */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
        {result.meta.subject && (
          <span className="bg-orange-100 text-orange-700 rounded-full px-3 py-1">
            📚 {result.meta.subject}
          </span>
        )}
        <span className="bg-blue-100 text-blue-700 rounded-full px-3 py-1">
          🤖 {result.meta.model}
        </span>
        {result.meta.usedVision && (
          <span className="bg-green-100 text-green-700 rounded-full px-3 py-1">
            👁️ Vision
          </span>
        )}
      </div>

      {/* Explanation */}
      <div className="bg-white rounded-2xl shadow-md p-5 space-y-3">
        <h2 className="text-lg font-bold text-orange-600">📖 Explanation</h2>
        <div
          className="text-gray-800 leading-relaxed whitespace-pre-wrap text-base"
          dangerouslySetInnerHTML={{
            __html: formatExplanation(result.explanation),
          }}
        />
      </div>

      {/* Practice questions */}
      {result.questions.length > 0 && (
        <div className="bg-gray-50 rounded-2xl shadow-sm p-5 space-y-4">
          <button
            type="button"
            onClick={() => setQuizOpen((v) => !v)}
            className="flex w-full items-center justify-between text-lg font-bold text-orange-600 min-h-[44px]"
            aria-expanded={quizOpen}
          >
            <span>✏️ Practice Questions</span>
            {quizOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {quizOpen && (
            <div className="space-y-4">
              {result.questions.map((q, i) => (
                <QuizCard key={i} question={q} index={i} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reset button */}
      <button
        type="button"
        onClick={onReset}
        className="w-full border-2 border-orange-400 text-orange-600 hover:bg-orange-50 font-semibold rounded-xl py-3 text-base transition-colors min-h-[52px]"
      >
        ← Explain another page
      </button>
    </div>
  );
}

// ── Markdown-lite formatter ───────────────────────────────────────────────────

/**
 * formatExplanation
 *
 * Very lightweight converter: turns ## headings, **bold**, and bullet lines
 * into safe HTML. No external library needed.
 */
function formatExplanation(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split("\n")
    .map((line) => {
      if (/^##\s+(.+)/.test(line)) {
        return `<h3 class="text-base font-bold text-gray-900 mt-3">${line.replace(/^##\s+/, "")}</h3>`;
      }
      if (/^\*\s+/.test(line) || /^-\s+/.test(line)) {
        return `<li class="ml-4 list-disc">${line.replace(/^[\*\-]\s+/, "")}</li>`;
      }
      const bold = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      return bold ? `<p>${bold}</p>` : "<br/>";
    })
    .join("");
}

