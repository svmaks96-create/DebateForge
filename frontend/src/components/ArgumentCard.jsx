import { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';

const typeBadgeColors = {
  claim: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  rebuttal: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  concession: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

export default function ArgumentCard({ argument, side, animate = false }) {
  const [expanded, setExpanded] = useState(false);

  const isPro = side === 'pro';
  const accentBorder = isPro ? 'border-l-blue-500' : 'border-l-amber-500';
  const prefixBg = isPro ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300';
  const badgeColor = typeBadgeColors[argument.type] || typeBadgeColors.claim;

  const hasToulmin = argument.grounds || argument.warrant || argument.backing || argument.qualifier;
  const targets = argument.targets || [];

  return (
    <div
      className={`border-l-2 ${accentBorder} bg-white/[0.03] rounded-r-lg p-4 ${
        animate ? 'animate-arg-in' : ''
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${prefixBg}`}>
          {argument.agentPrefix}
        </span>
        <span className="text-xs text-gray-400">{argument.agentTitle}</span>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${badgeColor}`}>
          {argument.id || argument.argument_index}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeColor}`}>
          {argument.type || argument.arg_type}
        </span>
      </div>

      {/* Targets */}
      {targets.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-gray-500">
          <ArrowRight size={12} />
          <span>Responding to:</span>
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
