import { useState, useEffect, Component } from 'react';
import { Trophy, BarChart3, AlertTriangle, Zap, ArrowUpDown, Loader } from 'lucide-react';
import api from '../api';
import ScoreComparison from './ScoreComparison';
import ToulminBreakdown from './ToulminBreakdown';
import FallacyBadge from './FallacyBadge';
import PanelAnalysis from './PanelAnalysis';

const tabs = [
  { id: 'overview', label: 'Overview', icon: Trophy },
  { id: 'scores', label: 'Argument Scores', icon: BarChart3 },
  { id: 'fallacies', label: 'Fallacies', icon: AlertTriangle },
  { id: 'moments', label: 'Key Moments', icon: Zap },
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

function scoreColor(val) {
  if (val >= 8) return 'text-green-400';
  if (val >= 5) return 'text-yellow-400';
  return 'text-red-400';
}

function ScoreBar({ label, value, max = 100, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-10 text-right">{label}</span>
      <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-gray-300 w-8">{value}</span>
    </div>
  );
}

/* ─── Overview Tab ─── */
function OverviewTab({ verdict }) {
  const winner = verdict.verdict;
  const confidence = verdict.confidence;
  const score = verdict.score || {};

  const bannerColors = {
    PRO: 'from-blue-600/20 to-blue-900/10 border-blue-500/30',
    CON: 'from-amber-600/20 to-amber-900/10 border-amber-500/30',
    DRAW: 'from-gray-600/20 to-gray-900/10 border-gray-500/30',
  };
  const textColors = {
    PRO: 'text-blue-300',
    CON: 'text-amber-300',
    DRAW: 'text-gray-300',
  };

  return (
    <div className="space-y-5">
      {/* Verdict banner */}
      <div className={`rounded-xl border bg-gradient-to-r ${bannerColors[winner] || bannerColors.DRAW} p-6 text-center`}>
        <Trophy size={32} className={`mx-auto mb-2 ${textColors[winner] || 'text-gray-300'}`} />
        <div className={`text-3xl font-bold ${textColors[winner] || 'text-gray-300'}`}>
          {winner === 'DRAW' ? 'Draw' : `${winner} Wins`}
        </div>
        {confidence != null && (
          <div className="text-sm text-gray-400 mt-1">
            {Math.round(confidence * 100)}% confidence
          </div>
        )}
      </div>

      {/* Score bars */}
      <div className="space-y-2">
        <ScoreBar label="PRO" value={score.pro ?? 0} color="bg-blue-500" />
        <ScoreBar label="CON" value={score.con ?? 0} color="bg-amber-500" />
      </div>

      {/* Executive summary */}
      {verdict.executive_summary && (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Executive Summary
          </h4>
          <p className="text-sm text-gray-300 leading-relaxed">{verdict.executive_summary}</p>
        </div>
      )}

      {/* Recommendation */}
      {verdict.recommendation && (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Recommendation
          </h4>
          <p className="text-sm text-gray-300 leading-relaxed">{verdict.recommendation}</p>
        </div>
      )}

      {/* Evidence quality */}
      <ScoreComparison evidenceQuality={verdict.evidence_quality} />
    </div>
  );
}

/* ─── Argument Scores Tab ─── */
function ScoresTab({ analyses, arguments: args }) {
  const [sortBy, setSortBy] = useState('strength'); // 'strength' | 'order'

  const sorted = [...(analyses || [])].sort((a, b) => {
    if (sortBy === 'strength') return (b.overall_strength ?? 0) - (a.overall_strength ?? 0);
    return (a.argument_index || '').localeCompare(b.argument_index || '');
  });

  // Determine side from argument_index prefix (A,C,E,G = pro; B,D,F,H = con)
  const proLetters = new Set(['A', 'C', 'E', 'G']);
  const getSide = (idx) => {
    if (!idx) return 'pro';
    return proLetters.has(idx.charAt(0)) ? 'pro' : 'con';
  };

  // Find claim text from arguments
  const findClaim = (idx) => {
    if (!args) return null;
    const all = [...(args.pro || []), ...(args.con || [])];
    const match = all.find(
      (a) => (a.argument_index || a.id) === idx
    );
    return match?.claim;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{sorted.length} arguments analyzed</span>
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
            {/* Argument ID label */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  side === 'pro'
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {analysis.argument_index}
              </span>
              <span className="text-[10px] uppercase text-gray-600">{side}</span>
            </div>
            <ToulminBreakdown
              analysis={analysis}
              side={side}
              claim={findClaim(analysis.argument_index)}
            />
          </div>
        );
      })}

      {sorted.length === 0 && (
        <p className="text-sm text-gray-600 text-center py-8">No argument analysis available.</p>
      )}
    </div>
  );
}

/* ─── Fallacies Tab ─── */
function FallaciesTab({ analyses }) {
  // Collect all fallacies across arguments
  const allFallacies = [];
  for (const a of analyses || []) {
    for (const f of a.fallacies || []) {
      allFallacies.push({
        argumentIndex: a.argument_index,
        ...f,
      });
    }
  }

  const proLetters = new Set(['A', 'C', 'E', 'G']);
  const getSide = (idx) => {
    if (!idx) return 'pro';
    return proLetters.has(idx.charAt(0)) ? 'pro' : 'con';
  };

  if (allFallacies.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertTriangle size={24} className="mx-auto text-green-400/60 mb-3" />
        <p className="text-sm text-gray-400">
          No logical fallacies detected — both sides argued cleanly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <span className="text-xs text-gray-500">{allFallacies.length} fallacies detected</span>
      {allFallacies.map((f, i) => {
        const side = getSide(f.argumentIndex);
        return (
          <div
            key={`${f.argumentIndex}-${i}`}
            className="bg-white/[0.03] border border-white/5 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  side === 'pro'
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {f.argumentIndex}
              </span>
              <FallacyBadge type={f.type} severity={f.severity} />
            </div>
            <p className="text-sm text-gray-300">{f.explanation}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Key Moments Tab ─── */
function MomentsTab({ verdict, agents }) {
  const graph = Array.isArray(verdict.dependency_graph) ? verdict.dependency_graph : [];
  const analyses = Array.isArray(verdict.argument_analysis) ? verdict.argument_analysis : [];
  const rebuttal = verdict.rebuttal_assessment || verdict.rebuttal_effectiveness;
  const consistency = verdict.consistency;
  const panelDynamics = verdict.panel_dynamics;

  // Find unaddressed arguments: arguments that are never the "to" target in the dependency graph
  const allIndices = analyses.map((a) => a.argument_index);
  const addressedSet = new Set(graph.map((e) => e.to));
  const unaddressed = allIndices.filter((idx) => !addressedSet.has(idx));

  // Key rebuttals from dependency graph
  const rebuttals = graph.filter(
    (e) => e.relationship === 'rebuts' || e.relationship === 'challenges'
  );

  return (
    <div className="space-y-5">
      {/* Dependency highlights */}
      {rebuttals.length > 0 && (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Argument Interactions
          </h4>
          <div className="space-y-2">
            {rebuttals.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                  {r.from}
                </span>
                <span className="text-gray-600 text-xs">{r.relationship}</span>
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                  {r.to}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unaddressed arguments */}
      {unaddressed.length > 0 && (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Unaddressed Arguments
          </h4>
          <p className="text-xs text-gray-500 mb-2">
            These arguments were never directly rebutted or challenged:
          </p>
          <div className="flex flex-wrap gap-2">
            {unaddressed.map((idx) => (
              <span
                key={idx}
                className="font-mono text-xs px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-400"
              >
                {idx}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Rebuttal assessment */}
      {rebuttal && (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Rebuttal Quality
          </h4>
          <div className="grid grid-cols-2 gap-4">
            {rebuttal.pro && (
              <div>
                <span className="text-[10px] uppercase text-blue-400/70">Pro</span>
                <p className="text-sm text-gray-300 mt-1">{rebuttal.pro}</p>
              </div>
            )}
            {rebuttal.con && (
              <div>
                <span className="text-[10px] uppercase text-amber-400/70">Con</span>
                <p className="text-sm text-gray-300 mt-1">{rebuttal.con}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Consistency */}
      {consistency && (consistency.pro || consistency.con) && (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Consistency Check
          </h4>
          <div className="grid grid-cols-2 gap-4">
            {consistency.pro && (
              <div>
                <span className="text-[10px] uppercase text-blue-400/70">Pro</span>
                <p className="text-sm text-gray-300 mt-1">{consistency.pro}</p>
              </div>
            )}
            {consistency.con && (
              <div>
                <span className="text-[10px] uppercase text-amber-400/70">Con</span>
                <p className="text-sm text-gray-300 mt-1">{consistency.con}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Panel dynamics */}
      {panelDynamics && <PanelAnalysis panelDynamics={panelDynamics} agents={agents} />}
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function AnalysisDashboard({ debateId, verdict: initialVerdict, arguments: args, agents }) {
  const [activeTab, setActiveTab] = useState('overview');
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

  // Use analysis endpoint verdict (most complete), fall back to prop
  const verdict = analysis?.verdict || initialVerdict;
  if (!verdict) {
    return <p className="text-sm text-gray-600 text-center py-8">No analysis data available.</p>;
  }

  // Merge argument analyses: prefer DB-sourced (from analysis endpoint) as they have proper float scores
  const argumentAnalyses = analysis?.argument_analyses?.length
    ? analysis.argument_analyses
    : verdict.argument_analysis || [];

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Full Analysis
      </h2>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/10">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveTab(tab.id); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
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
          {activeTab === 'overview' && <OverviewTab verdict={verdict} />}
          {activeTab === 'scores' && (
            <ScoresTab analyses={argumentAnalyses} arguments={args} />
          )}
          {activeTab === 'fallacies' && <FallaciesTab analyses={argumentAnalyses} />}
          {activeTab === 'moments' && (
            <MomentsTab verdict={verdict} agents={agents} />
          )}
        </TabErrorBoundary>
      </div>
    </div>
  );
}
