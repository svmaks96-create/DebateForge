import { useState, useEffect, Component } from 'react';
import {
  FileText, Columns, Handshake, Lightbulb, Loader, CheckCircle,
  AlertTriangle, HelpCircle, Users, ChevronDown, ChevronRight, Eye,
  Paperclip, Search,
} from 'lucide-react';
import api from '../api';

const SEAT_COLORS = {
  A: { bg: 'bg-[#3B82F6]/10 border-[#3B82F6]/20', text: 'text-[#3B82F6]' },
  B: { bg: 'bg-[#F59E0B]/10 border-[#F59E0B]/20', text: 'text-[#F59E0B]' },
  C: { bg: 'bg-[#10B981]/10 border-[#10B981]/20', text: 'text-[#10B981]' },
  D: { bg: 'bg-[#8B5CF6]/10 border-[#8B5CF6]/20', text: 'text-[#8B5CF6]' },
  E: { bg: 'bg-[#F43F5E]/10 border-[#F43F5E]/20', text: 'text-[#F43F5E]' },
  F: { bg: 'bg-[#06B6D4]/10 border-[#06B6D4]/20', text: 'text-[#06B6D4]' },
};

const STANCE_COLORS = {
  supportive: 'text-green-400',
  critical: 'text-red-400',
  mixed: 'text-amber-400',
  uncertain: 'text-gray-400',
  neutral: 'text-gray-400',
};

const synthesisTabs = [
  { id: 'synthesis', label: 'Synthesis', icon: FileText },
  { id: 'themes', label: 'Themes', icon: Columns },
  { id: 'positions', label: 'Council Positions', icon: Users },
  { id: 'consensus', label: 'Consensus & Gaps', icon: Handshake },
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

const confidenceColors = {
  high: 'bg-green-500/20 text-green-400 border-green-500/30',
  moderate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  uncertain: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const consensusColors = {
  high: 'border-green-500/20 bg-green-500/5',
  medium: 'border-yellow-500/20 bg-yellow-500/5',
  low: 'border-red-500/20 bg-red-500/5',
};

function ConfidenceBadge({ level }) {
  const cls = confidenceColors[level] || confidenceColors.uncertain;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>
      {level ? level.charAt(0).toUpperCase() + level.slice(1) : 'Unknown'} confidence
    </span>
  );
}

/* --- Evidence Quality Section --- */
function EvidenceQualitySection({ assessment }) {
  const {
    total_citations = 0,
    agents_citing = [],
    strongest_citation,
    unsupported_claims = [],
    evidence_gaps = [],
  } = assessment;

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Search size={14} className="text-cyan-400" />
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Evidence Quality
        </h4>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Paperclip size={12} className="text-cyan-400" />
          <span className="text-sm text-gray-200 font-medium">{total_citations}</span>
          <span className="text-xs text-gray-500">total citations</span>
        </div>
        {agents_citing.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Cited by:</span>
            {agents_citing.map((prefix) => {
              const color = SEAT_COLORS[prefix] || SEAT_COLORS.A;
              return (
                <span key={prefix} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color.bg} ${color.text}`}>
                  {prefix}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Strongest citation */}
      {strongest_citation && (
        <div className="bg-green-500/5 border border-green-500/15 rounded-lg px-3 py-2">
          <span className="text-[10px] text-green-400/70 font-semibold uppercase">Strongest Citation</span>
          <p className="text-xs text-gray-300 mt-0.5">
            <span className="text-gray-500 font-mono">{strongest_citation.argument_id}</span>
            {' — '}{strongest_citation.why}
          </p>
        </div>
      )}

      {/* Unsupported claims */}
      {unsupported_claims.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-[10px] text-gray-500 uppercase font-semibold">Unsupported Claims</h5>
          {unsupported_claims.map((claim, i) => (
            <div key={i} className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">
              <AlertTriangle size={12} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-300">{claim}</p>
            </div>
          ))}
        </div>
      )}

      {/* Evidence gaps */}
      {evidence_gaps.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-[10px] text-gray-500 uppercase font-semibold">Evidence Gaps</h5>
          {evidence_gaps.map((gap, i) => (
            <div key={i} className="flex items-start gap-2 bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2">
              <HelpCircle size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-400">{gap}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --- Tab 1: Synthesis --- */
function SynthesisTab({ synthesis }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-600/10 to-violet-600/10 p-6">
        <p className="text-base text-gray-100 leading-relaxed font-medium">
          {synthesis.bottom_line}
        </p>
        <div className="mt-3">
          <ConfidenceBadge level={synthesis.confidence_level} />
        </div>
      </div>

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

      {/* Evidence Quality — only shown if evidence_assessment exists */}
      {synthesis.evidence_assessment && (
        <EvidenceQualitySection assessment={synthesis.evidence_assessment} />
      )}
    </div>
  );
}

/* --- Tab 2: Themes --- */
function ThemeCard({ theme }) {
  const [expanded, setExpanded] = useState(false);
  const conCls = consensusColors[theme.consensus_level] || consensusColors.medium;
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div className={`rounded-xl border ${conCls}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-5 cursor-pointer flex items-start justify-between gap-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Chevron size={14} className="text-gray-500 flex-shrink-0 mt-0.5" />
          <h4 className="text-sm text-gray-100 font-semibold">{theme.theme}</h4>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-gray-500 whitespace-nowrap">
          {theme.consensus_level} consensus
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-3">
          <p className="text-sm text-gray-300 leading-relaxed">{theme.summary}</p>

          {/* Perspectives from each agent */}
          {(theme.perspectives || []).length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/5">
              {theme.perspectives.map((p, j) => {
                const color = SEAT_COLORS[p.agent_prefix] || SEAT_COLORS.A;
                const stanceColor = STANCE_COLORS[p.stance] || STANCE_COLORS.neutral;
                return (
                  <div key={j} className="flex items-start gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${color.bg} ${color.text}`}>
                      {p.agent_prefix}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{p.agent_title}</span>
                        <span className={`text-[10px] font-medium ${stanceColor}`}>{p.stance}</span>
                        <span className="text-[10px] text-gray-500 font-mono">{p.confidence}/10</span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed mt-0.5">{p.view}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {theme.key_tension && (
            <div className="bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2">
              <span className="text-[10px] text-amber-400/70 font-semibold uppercase">Key Tension</span>
              <p className="text-xs text-gray-300 mt-0.5">{theme.key_tension}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThemesTab({ synthesis }) {
  const themes = synthesis.themes || [];

  if (themes.length === 0) {
    return <p className="text-xs text-gray-600 py-4 text-center">No themes identified.</p>;
  }

  return (
    <div className="space-y-4">
      {themes.map((theme, i) => (
        <ThemeCard key={i} theme={theme} />
      ))}
    </div>
  );
}

/* --- Tab 3: Council Positions --- */
const SEAT_HEX = { A: '#3B82F6', B: '#F59E0B', C: '#10B981', D: '#8B5CF6', E: '#F43F5E', F: '#06B6D4' };

function PositionsTab({ synthesis, positions }) {
  // Use positions from API if available, fall back to synthesis individual_positions
  const posData = positions.length > 0 ? positions : (synthesis.individual_positions || []);

  if (posData.length === 0) {
    return <p className="text-xs text-gray-600 py-4 text-center">No position data available.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {posData.map((pos, i) => {
        const prefix = pos.agent_prefix;
        const color = SEAT_COLORS[prefix] || SEAT_COLORS.A;
        const stanceColor = STANCE_COLORS[pos.overall_stance] || STANCE_COLORS.uncertain;
        const borderHex = SEAT_HEX[prefix] || SEAT_HEX.A;

        return (
          <div
            key={i}
            className="rounded-xl border-l-4 border border-white/5 bg-white/[0.03] p-5 space-y-3"
            style={{ borderLeftColor: borderHex }}
          >
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${color.bg} ${color.text}`}>
                {prefix}
              </span>
              <span className="text-sm text-gray-200 font-medium">{pos.agent_title}</span>
              <span className={`text-xs font-medium ${stanceColor}`}>{pos.overall_stance}</span>
            </div>

            <div className="text-center py-1">
              <span className="text-2xl font-bold text-gray-100">{pos.confidence}</span>
              <span className="text-xs text-gray-500 ml-1">/10</span>
            </div>

            <p className="text-sm text-gray-300 leading-relaxed">{pos.position_summary}</p>

            {(pos.key_concerns || []).length > 0 && (
              <div>
                <h5 className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Key Concerns</h5>
                <ul className="space-y-1">
                  {pos.key_concerns.map((c, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-gray-400">
                      <AlertTriangle size={10} className="text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>{typeof c === 'string' ? c : c.concern || JSON.stringify(c)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(pos.key_supports || []).length > 0 && (
              <div>
                <h5 className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Key Supports</h5>
                <ul className="space-y-1">
                  {pos.key_supports.map((s, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-gray-400">
                      <CheckCircle size={10} className="text-green-400 mt-0.5 flex-shrink-0" />
                      <span>{typeof s === 'string' ? s : s.point || JSON.stringify(s)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {pos.would_change_mind && (
              <div className="bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2">
                <span className="text-[10px] text-blue-400/70 font-semibold uppercase">Would change mind if</span>
                <p className="text-xs text-gray-300 mt-0.5">{pos.would_change_mind}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* --- Tab 4: Consensus & Gaps --- */
function ConsensusTab({ synthesis }) {
  const consensus = synthesis.council_consensus || [];
  const disagreements = synthesis.major_disagreements || [];
  const blindSpots = synthesis.blind_spots || [];
  const openQuestions = synthesis.open_questions || [];

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Council Consensus
        </h4>
        {consensus.length > 0 ? (
          <div className="space-y-2">
            {consensus.map((point, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-green-500/15 bg-green-500/5 p-4">
                <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-300 leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600 py-4 text-center">No consensus points identified.</p>
        )}
      </div>

      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Major Disagreements
        </h4>
        {disagreements.length > 0 ? (
          <div className="space-y-3">
            {disagreements.map((d, i) => (
              <div key={i} className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-200 font-medium leading-snug">{d.topic}</p>
                </div>

                {(d.camps || []).map((camp, j) => (
                  <div key={j} className="ml-[22px] flex items-start gap-2">
                    <div className="flex gap-1 flex-shrink-0">
                      {(camp.agents || []).map((prefix) => {
                        const color = SEAT_COLORS[prefix] || SEAT_COLORS.A;
                        return (
                          <span key={prefix} className={`text-[10px] font-bold px-1 py-0.5 rounded ${color.bg} ${color.text}`}>
                            {prefix}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-300">{camp.position}</p>
                  </div>
                ))}

                {d.why_unresolvable && (
                  <div className="ml-[22px] bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2">
                    <span className="text-[10px] text-amber-400/70 font-semibold uppercase">Why unresolvable</span>
                    <p className="text-xs text-gray-300 mt-0.5">{d.why_unresolvable}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600 py-4 text-center">No major disagreements identified.</p>
        )}
      </div>

      {blindSpots.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Blind Spots
          </h4>
          <div className="space-y-2">
            {blindSpots.map((spot, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-4">
                <Eye size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-400 leading-relaxed">{spot}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {openQuestions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Open Questions
          </h4>
          <div className="space-y-2">
            {openQuestions.map((q, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-4">
                <HelpCircle size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-400 leading-relaxed">{q}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Tab 5: Insights --- */
function InsightsTab({ synthesis }) {
  const insights = synthesis.key_insights || [];

  if (insights.length === 0) {
    return <p className="text-xs text-gray-600 py-4 text-center">No key insights recorded.</p>;
  }

  return (
    <div className="space-y-2">
      {insights.map((insight, i) => (
        <div key={i} className="flex items-start gap-3 rounded-xl border border-violet-500/15 bg-violet-500/5 p-4">
          <Lightbulb size={16} className="text-violet-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-300 leading-relaxed">{insight}</p>
        </div>
      ))}
    </div>
  );
}

/* --- Main Dashboard --- */
export default function AnalysisDashboard({ debateId, synthesis: initialSynthesis, councilMembers = [] }) {
  const [activeTab, setActiveTab] = useState('synthesis');
  const [analysis, setAnalysis] = useState(null);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!debateId) return;

    Promise.all([
      api.get(`/debates/${debateId}/analysis`),
      api.get(`/debates/${debateId}/positions`).catch(() => ({ data: [] })),
    ])
      .then(([analysisRes, positionsRes]) => {
        setAnalysis(analysisRes.data);
        setPositions(positionsRes.data || []);
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

  const synthesis = analysis?.synthesis?.synthesis || analysis?.synthesis || initialSynthesis;

  if (!synthesis) {
    return <p className="text-sm text-gray-600 text-center py-8">No analysis data available.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Analysis
      </h2>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/10 overflow-x-auto">
        {synthesisTabs.map((tab) => {
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
          {activeTab === 'themes' && <ThemesTab synthesis={synthesis} />}
          {activeTab === 'positions' && <PositionsTab synthesis={synthesis} positions={positions} />}
          {activeTab === 'consensus' && <ConsensusTab synthesis={synthesis} />}
          {activeTab === 'insights' && <InsightsTab synthesis={synthesis} />}
        </TabErrorBoundary>
      </div>
    </div>
  );
}
