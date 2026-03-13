import { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';

const SEAT_COLORS = {
  A: { border: 'border-l-[#3B82F6]', badge: 'bg-[#3B82F6]/20 text-[#3B82F6]' },
  B: { border: 'border-l-[#F59E0B]', badge: 'bg-[#F59E0B]/20 text-[#F59E0B]' },
  C: { border: 'border-l-[#10B981]', badge: 'bg-[#10B981]/20 text-[#10B981]' },
  D: { border: 'border-l-[#8B5CF6]', badge: 'bg-[#8B5CF6]/20 text-[#8B5CF6]' },
  E: { border: 'border-l-[#F43F5E]', badge: 'bg-[#F43F5E]/20 text-[#F43F5E]' },
  F: { border: 'border-l-[#06B6D4]', badge: 'bg-[#06B6D4]/20 text-[#06B6D4]' },
};

const STANCE_CONFIG = {
  supportive: { icon: '\uD83D\uDC4D', label: 'Supportive', cls: 'bg-green-500/15 text-green-400 border-green-500/30' },
  critical:   { icon: '\uD83D\uDC4E', label: 'Critical',   cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  mixed:      { icon: '\u2194\uFE0F',  label: 'Mixed',      cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  neutral:    { icon: '\u2796',  label: 'Neutral',    cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
};

const HIGHLIGHT_TYPES = new Set(['question', 'build_on']);

export default function ArgumentCard({ argument, animate = false }) {
  const [expanded, setExpanded] = useState(false);

  const prefix = argument.agentPrefix || argument.agent_prefix || '?';
  const seatColor = SEAT_COLORS[prefix] || SEAT_COLORS.A;
  const stance = STANCE_CONFIG[argument.stance] || STANCE_CONFIG.neutral;
  const argType = argument.arg_type || argument.type || 'claim';
  const targets = argument.targets || [];
  const confidence = argument.confidence ?? null;
  const hasToulmin = argument.grounds || argument.warrant || argument.backing || argument.qualifier;

  return (
    <div
      className={`border-l-2 ${seatColor.border} bg-white/[0.03] rounded-r-lg p-4 ${
        animate ? 'animate-arg-in' : ''
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${seatColor.badge}`}>
          {prefix}
        </span>
        <span className="text-xs text-gray-400">
          {argument.agentTitle || argument.agent_title || 'Agent'}
        </span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-500">
          {argument.argument_index || argument.id}
        </span>

        {/* Stance badge */}
        <span className={`text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${stance.cls}`}>
          <span>{stance.icon}</span> {stance.label}
        </span>

        {/* Confidence */}
        {confidence != null && (
          <span className="text-[10px] text-gray-500 font-mono">{confidence}/10</span>
        )}

        {/* Highlight question / build_on types */}
        {HIGHLIGHT_TYPES.has(argType) && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 border border-violet-500/30">
            {argType === 'question' ? 'Question' : 'Build On'}
          </span>
        )}
      </div>

      {/* Targets */}
      {targets.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-gray-500">
          <ArrowRight size={12} />
          <span>Responding to</span>
          {targets.map((t) => (
            <span key={t} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400 font-mono text-[10px]">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Claim */}
      <p className="text-sm text-gray-200 leading-relaxed">{argument.claim}</p>

      {/* Summary */}
      {argument.summary && (
        <p className="mt-2 text-xs text-gray-500 italic">{argument.summary}</p>
      )}

      {/* Expandable Toulmin breakdown */}
      {hasToulmin && (
        <div className="mt-3 border-t border-white/5 pt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Toulmin Breakdown
          </button>
          {expanded && (
            <div className="mt-2 space-y-2 text-xs">
              {argument.grounds && (
                <div>
                  <span className="text-gray-500 font-medium">Grounds: </span>
                  <span className="text-gray-400">{argument.grounds}</span>
                </div>
              )}
              {argument.warrant && (
                <div>
                  <span className="text-gray-500 font-medium">Warrant: </span>
                  <span className="text-gray-400">{argument.warrant}</span>
                </div>
              )}
              {argument.backing && (
                <div>
                  <span className="text-gray-500 font-medium">Backing: </span>
                  <span className="text-gray-400">{argument.backing}</span>
                </div>
              )}
              {argument.qualifier && (
                <div>
                  <span className="text-gray-500 font-medium">Qualifier: </span>
                  <span className="text-gray-400">{argument.qualifier}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
