import { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowRight, ExternalLink, Paperclip, CheckCircle, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';

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

const VERIFICATION_BADGES = {
  verified:       { icon: CheckCircle,   label: 'Verified',     cls: 'bg-green-500/15 text-green-400 border-green-500/30' },
  partially_true: { icon: AlertTriangle, label: 'Partially True', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  disputed:       { icon: AlertTriangle, label: 'Disputed',     cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  false:          { icon: XCircle,       label: 'False',        cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  unverifiable:   { icon: HelpCircle,    label: 'Unverifiable', cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
};

const SOURCE_TYPE_STYLES = {
  academic:   'bg-purple-500/15 text-purple-400 border-purple-500/30',
  government: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  news:       'bg-green-500/15 text-green-400 border-green-500/30',
  company:    'bg-amber-500/15 text-amber-400 border-amber-500/30',
  web:        'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

export default function ArgumentCard({ argument, animate = false, verificationReport = null }) {
  const [expanded, setExpanded] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const prefix = argument.agentPrefix || argument.agent_prefix || '?';
  const seatColor = SEAT_COLORS[prefix] || SEAT_COLORS.A;
  const stance = STANCE_CONFIG[argument.stance] || STANCE_CONFIG.neutral;
  const argType = argument.arg_type || argument.type || 'claim';
  const targets = argument.targets || [];
  const confidence = argument.confidence ?? null;
  const citations = argument.citations || [];
  const hasToulmin = argument.grounds || argument.warrant || argument.backing || argument.qualifier;

  // Find verification status for this argument
  const argIndex = argument.argument_index || argument.id;
  const verifiedClaim = verificationReport?.verified_claims?.find(
    (vc) => vc.source_argument === argIndex
  );
  const verificationBadge = verifiedClaim ? VERIFICATION_BADGES[verifiedClaim.verification_status] : null;

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

        {/* Citation count badge */}
        {citations.length > 0 ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 inline-flex items-center gap-1">
            <Paperclip size={9} /> {citations.length} source{citations.length !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-[10px] text-gray-600">No sources</span>
        )}

        {/* Verification badge */}
        {verificationBadge && (() => {
          const VIcon = verificationBadge.icon;
          return (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${verificationBadge.cls}`}>
              <VIcon size={9} /> {verificationBadge.label}
            </span>
          );
        })()}

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

      {/* Collapsible Sources */}
      {citations.length > 0 && (
        <div className="mt-3 border-t border-white/5 pt-2">
          <button
            onClick={() => setSourcesOpen(!sourcesOpen)}
            className="flex items-center gap-1 text-xs text-cyan-500 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            {sourcesOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Sources ({citations.length})
          </button>
          {sourcesOpen && (
            <div className="mt-2 space-y-2">
              {citations.map((cite, i) => {
                const typeCls = SOURCE_TYPE_STYLES[cite.source_type] || SOURCE_TYPE_STYLES.web;
                return (
                  <div key={i} className="bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={cite.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-1 min-w-0"
                      >
                        <span className="truncate">{cite.title || cite.url}</span>
                        <ExternalLink size={10} className="flex-shrink-0" />
                      </a>
                      {cite.source_type && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${typeCls}`}>
                          {cite.source_type}
                        </span>
                      )}
                      {cite.date && (
                        <span className="text-[10px] text-gray-600">{cite.date}</span>
                      )}
                    </div>
                    {cite.snippet && (
                      <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{cite.snippet}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
