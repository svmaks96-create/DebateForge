import { useState, useEffect, Component } from 'react';
import {
  FileText, Columns, Handshake, Lightbulb, Loader, CheckCircle,
  AlertTriangle, HelpCircle, ArrowUpDown,
} from 'lucide-react';
import api from '../api';

// Legacy imports — kept for backward compat with old debates
import ScoreComparison from './ScoreComparison';
import ToulminBreakdown from './ToulminBreakdown';
import FallacyBadge from './FallacyBadge';
import PanelAnalysis from './PanelAnalysis';

const synthesisTabs = [
  { id: 'synthesis', label: 'Synthesis', icon: FileText },
  { id: 'arguments', label: 'Arguments For & Against', icon: Columns },
  { id: 'consensus', label: 'Consensus & Tensions', icon: Handshake },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
];

class TabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-8">
          <p className="text-sm text-red-400">Failed to render this tab.</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── Helpers ─── */

const confidenceColors = {
  high: 'bg-green-500/20 text-green-400 border-green-500/30',
  moderate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  uncertain: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const strengthColors = {
  strong: 'bg-green-500/20 text-green-400',
  moderate: 'bg-yellow-500/20 text-yellow-400',
  weak: 'bg-red-500/20 text-red-400',
};

function ConfidenceBadge({ level }) {
  const cls = confidenceColors[level] || confidenceColors.uncertain;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>
      {level ? level.charAt(0).toUpperCase() + level.slice(1) : 'Unknown'} confidence
    </span>
  );
}

function StrengthBadge({ strength }) {
  const cls = strengthColors[strength] || 'bg-gray-500/20 text-gray-400';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${cls}`}>
      {strength}
    </span>
  );
}

/* ─── Tab 1: Synthesis ─── */
function SynthesisTab({ synthesis }) {
  return (
    <div className="space-y-5">
      {/* Bottom line card */}
      <div className="rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-600/10 to-violet-600/10 p-6">
        <p className="text-base text-gray-100 leading-relaxed font-medium">
          {synthesis.bottom_line}
        </p>
        <div className="mt-3">
          <ConfidenceBadge level={synthesis.confidence_level} />
        </div>
      </div>

      {/* Nuanced conclusion */}
      {synthesis.nuanced_conclusion && (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Nuanced Conclusion
          </h4>
          <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
            {synthesis.nuanced_conclusion}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tab 2: Arguments For & Against ─── */
function ArgumentsTab({ synthesis }) {
  const strengthOrder = { strong: 0, moderate: 1, weak: 2 };
  const sortByStrength = (args) =>
    [...(args || [])].sort(
      (a, b) => (strengthOrder[a.strength] ?? 3) - (strengthOrder[b.strength] ?? 3)
    );

  const argsFor = sortByStrength(synthesis.arguments_for);
  const argsAgainst = sortByStrength(synthesis.arguments_against);

  const renderArg = (arg, i, tint) => {
    const borderCls = tint === 'blue' ? 'border-blue-500/15' : 'border-amber-500/15';
    const bgCls = tint === 'blue' ? 'bg-blue-500/5' : 'bg-amber-500/5';

    return (
      <div key={i} className={`rounded-xl border ${borderCls} ${bgCls} p-4 space-y-2`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-gray-200 font-medium leading-snug flex-1">
            {arg.argument}
          </p>
          <StrengthBadge strength={arg.strength} />
        </div>

        {arg.agent_confidence != null && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 uppercase">Agent confidence</span>
            <div className="flex-1 max-w-[100px] h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gray-400"
                style={{ width: `${Math.min((arg.agent_confidence / 10) * 100, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400 font-mono">{arg.agent_confidence}/10</span>
          </div>
        )}

        {arg.supporting_evidence && (
          <p className="text-xs text-gray-400 leading-relaxed">{arg.supporting_evidence}</p>
        )}

        {arg.caveats && (
          <div className="bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500 italic">{arg.caveats}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Arguments For */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-blue-400/70 uppercase tracking-wider">
          Arguments For
        </h4>
        {argsFor.length > 0 ? (
          argsFor.map((arg, i) => renderArg(arg, i, 'blue'))
        ) : (
          <p className="text-xs text-gray-600 py-4 text-center">No arguments for recorded.</p>
        )}
      </div>

      {/* Arguments Against */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-amber-400/70 uppercase tracking-wider">
          Arguments Against
        </h4>
        {argsAgainst.length > 0 ? (
          argsAgainst.map((arg, i) => renderArg(arg, i, 'amber'))
        ) : (
          <p className="text-xs text-gray-600 py-4 text-center">No arguments against recorded.</p>
        )}
      </div>
    </div>
  );
}

/* ─── Tab 3: Consensus & Tensions ─── */
function ConsensusTab({ synthesis }) {
  const agreements = synthesis.areas_of_agreement || [];
  const tensions = synthesis.unresolved_tensions || [];

  return (
    <div className="space-y-6">
      {/* Areas of agreement */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Areas of Agreement
        </h4>
        {agreements.length > 0 ? (
          <div className="space-y-2">
            {agreements.map((point, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-green-500/15 bg-green-500/5 p-4"
              >
                <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-300 leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600 py-4 text-center">No areas of agreement identified.</p>
        )}
      </div>

      {/* Unresolved tensions */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Unresolved Tensions
        </h4>
        {tensions.length > 0 ? (
          <div className="space-y-3">
            {tensions.map((t, i) => (
              <div
                key={i}
                className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-200 font-medium leading-snug">{t.tension}</p>
                </div>
                {t.why_unresolved && (
                  <p className="text-xs text-gray-400 leading-relaxed ml-[22px]">
                    {t.why_unresolved}
                  </p>
                )}
                {t.what_would_resolve_it && (
                  <div className="ml-[22px] bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2">
                    <span className="text-[10px] text-amber-400/70 font-semibold uppercase">
                      What would resolve it
                    </span>
                    <p className="text-xs text-gray-300 mt-0.5">{t.what_would_resolve_it}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600 py-4 text-center">No unresolved tensions identified.</p>
        )}
      </div>
    </div>
  );
}

/* ─── Tab 4: Insights ─── */
function InsightsTab({ synthesis }) {
  const insights = synthesis.key_insights || [];
  const gaps = synthesis.evidence_gaps || [];

  return (
    <div className="space-y-6">
      {/* Key insights */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Key Insights
        </h4>
        {insights.length > 0 ? (
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-violet-500/15 bg-violet-500/5 p-4"
              >
                <Lightbulb size={16} className="text-violet-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-300 leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600 py-4 text-center">No key insights recorded.</p>
        )}
      </div>

      {/* Evidence gaps */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Evidence Gaps
        </h4>
        {gaps.length > 0 ? (
          <div className="space-y-2">
            {gaps.map((gap, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-4"
              >
                <HelpCircle size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-400 leading-relaxed">{gap}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600 py-4 text-center">No evidence gaps identified.</p>
        )}
      </div>
    </div>
  );
}

/* ─── Legacy Analysis (old verdict format) ─── */
function LegacyAnalysis({ verdict, argumentAnalyses, args, agents }) {
  const [sortBy, setSortBy] = useState('strength');

  const sorted = [...(argumentAnalyses || [])].sort((a, b) => {
    if (sortBy === 'strength') return (b.overall_strength ?? 0) - (a.overall_strength ?? 0);
    return (a.argument_index || '').localeCompare(b.argument_index || '');
  });

  const proLetters = new Set(['A', 'C', 'E', 'G']);
  const getSide = (idx) => (idx && !proLetters.has(idx.charAt(0)) ? 'con' : 'pro');

  const findClaim = (idx) => {
    if (!args) return null;
    const all = [...(args.pro || []), ...(args.con || [])];
    return all.find((a) => (a.argument_index || a.id) === idx)?.claim;
  };

  return (
    <div className="space-y-5">
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <p className="text-xs text-amber-400">
          This debate used an older analysis format. Showing legacy view.
        </p>
      </div>

      {verdict.executive_summary && (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Summary</h4>
          <p className="text-sm text-gray-300 leading-relaxed">{verdict.executive_summary}</p>
        </div>
      )}

      {verdict.recommendation && (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Recommendation</h4>
          <p className="text-sm text-gray-300 leading-relaxed">{verdict.recommendation}</p>
        </div>
      )}

      <ScoreComparison evidenceQuality={verdict.evidence_quality} />

      {sorted.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Argument Scores
            </h4>
            <button
              onClick={() => setSortBy(sortBy === 'strength' ? 'order' : 'strength')}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
            >
              <ArrowUpDown size={12} />
              {sortBy === 'strength' ? 'By strength' : 'By order'}
            </button>
          </div>
          {sorted.map((analysis) => {
            const side = getSide(analysis.argument_index);
            return (
              <div key={analysis.argument_index}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      side === 'pro' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {analysis.argument_index}
                  </span>
                  <span className="text-[10px] uppercase text-gray-600">{side}</span>
                </div>
                <ToulminBreakdown analysis={analysis} side={side} claim={findClaim(analysis.argument_index)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function AnalysisDashboard({ debateId, verdict: initialVerdict, arguments: args, agents }) {
  const [activeTab, setActiveTab] = useState('synthesis');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!debateId) return;
    api.get(`/debates/${debateId}/analysis`)
      .then((res) => {
        setAnalysis(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Failed to load analysis');
        setLoading(false);
      });
  }, [debateId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size={20} className="text-gray-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-400 text-center py-8">{error}</p>;
  }

  // Determine if this is synthesis format or legacy
  const synthesis = analysis?.synthesis || initialVerdict?.synthesis;

  if (synthesis) {
    // New synthesis format
    const tabs = synthesisTabs;

    return (
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Synthesis
        </h2>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-white/10 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveTab(tab.id); }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer border-b-2 -mb-px whitespace-nowrap ${
                  active
                    ? 'border-white/60 text-gray-200'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="pt-2">
          <TabErrorBoundary key={activeTab}>
            {activeTab === 'synthesis' && <SynthesisTab synthesis={synthesis} />}
            {activeTab === 'arguments' && <ArgumentsTab synthesis={synthesis} />}
            {activeTab === 'consensus' && <ConsensusTab synthesis={synthesis} />}
            {activeTab === 'insights' && <InsightsTab synthesis={synthesis} />}
          </TabErrorBoundary>
        </div>
      </div>
    );
  }

  // Legacy format fallback
  const verdict = analysis?.verdict || initialVerdict;
  if (!verdict) {
    return <p className="text-sm text-gray-600 text-center py-8">No analysis data available.</p>;
  }

  const argumentAnalyses = analysis?.argument_analyses?.length
    ? analysis.argument_analyses
    : verdict.argument_analysis || [];

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Legacy Analysis
      </h2>
      <LegacyAnalysis
        verdict={verdict}
        argumentAnalyses={argumentAnalyses}
        args={args}
        agents={agents}
      />
    </div>
  );
}
