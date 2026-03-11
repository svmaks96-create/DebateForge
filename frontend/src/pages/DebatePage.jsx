import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, ArrowLeft, ArrowDown, Loader } from 'lucide-react';
import api from '../api';
import useDebateStream from '../hooks/useDebateStream';
import LiveViewer from '../components/LiveViewer';
import AnalysisDashboard from '../components/AnalysisDashboard';

const roundTypeLabels = {
  opening: 'Opening',
  rebuttal: 'Rebuttal',
  cross_exam: 'Cross-Examination',
  closing: 'Closing',
};

const confidenceBannerColors = {
  high: 'from-green-600/20 to-emerald-900/10 border-green-500/30',
  moderate: 'from-yellow-600/20 to-yellow-900/10 border-yellow-500/30',
  low: 'from-orange-600/20 to-orange-900/10 border-orange-500/30',
  uncertain: 'from-gray-600/20 to-gray-900/10 border-gray-500/30',
};

const confidenceBadgeColors = {
  high: 'bg-green-500/20 text-green-400 border-green-500/30',
  moderate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  uncertain: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function SynthesisBanner({ verdict }) {
  if (!verdict) return null;

  const synthesis = verdict.synthesis;
  if (!synthesis) {
    // Legacy verdict — show minimal fallback
    return <LegacyVerdictBanner verdict={verdict} />;
  }

  const confidence = synthesis.confidence_level || 'uncertain';
  const bannerCls = confidenceBannerColors[confidence] || confidenceBannerColors.uncertain;
  const badgeCls = confidenceBadgeColors[confidence] || confidenceBadgeColors.uncertain;

  return (
    <div className={`rounded-xl border bg-gradient-to-r ${bannerCls} p-5 mb-6`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <FileText size={24} className="mt-0.5 flex-shrink-0 text-gray-300" />
          <div className="min-w-0">
            <p className="text-sm text-gray-200 leading-relaxed font-medium">
              {synthesis.bottom_line}
            </p>
          </div>
        </div>
        <div className="flex-shrink-0">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${badgeCls}`}>
            {confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence
          </span>
        </div>
      </div>
    </div>
  );
}

function LegacyVerdictBanner({ verdict }) {
  const winner = verdict.verdict;
  const score = verdict.score || {};

  const colorMap = {
    PRO: 'from-blue-600/30 to-blue-900/20 border-blue-500/40',
    CON: 'from-amber-600/30 to-amber-900/20 border-amber-500/40',
    DRAW: 'from-gray-600/30 to-gray-900/20 border-gray-500/40',
  };
  const textMap = {
    PRO: 'text-blue-300',
    CON: 'text-amber-300',
    DRAW: 'text-gray-300',
  };

  if (!winner) return null;

  return (
    <div className={`rounded-xl border bg-gradient-to-r ${colorMap[winner] || colorMap.DRAW} p-5 mb-6`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="min-w-0">
            <div className={`text-xl font-bold ${textMap[winner] || 'text-gray-300'}`}>
              {winner === 'DRAW' ? 'Draw' : `${winner} Wins`}
            </div>
            {verdict.executive_summary && (
              <p className="text-sm text-gray-400 mt-1">{verdict.executive_summary}</p>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-blue-400 font-medium">PRO {score.pro ?? '–'}</span>
            <span className="text-gray-600">vs</span>
            <span className="text-amber-400 font-medium">CON {score.con ?? '–'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentBadge({ agent, side }) {
  const isPro = side === 'pro';
  const bg = isPro ? 'bg-blue-500/10 border-blue-500/20' : 'bg-amber-500/10 border-amber-500/20';
  const prefixColor = isPro ? 'text-blue-400' : 'text-amber-400';

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${bg}`}>
      <span className={`text-xs font-bold ${prefixColor}`}>{agent.argument_prefix}</span>
      <span className="text-xs text-gray-300 truncate max-w-[140px]">{agent.title}</span>
    </div>
  );
}

function StatusBar({ status, currentRound, totalRounds, formatName }) {
  const roundLabel = currentRound
    ? `Round ${currentRound.number}${totalRounds ? ` of ${totalRounds}` : ''}: ${
        roundTypeLabels[currentRound.type] || currentRound.type
      }`
    : '';

  return (
    <div className="flex items-center gap-3 text-xs text-gray-500">
      {formatName && (
        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">{formatName}</span>
      )}
      {roundLabel && (
        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">{roundLabel}</span>
      )}
      {status === 'running' && (
        <span className="flex items-center gap-1.5 text-blue-400">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Live
        </span>
      )}
      {status === 'judging' && (
        <span className="flex items-center gap-1.5 text-amber-400">
          <FileText size={12} />
          Synthesizing…
        </span>
      )}
      {status === 'completed' && (
        <span className="text-green-400">Completed</span>
      )}
      {status === 'error' && (
        <span className="text-red-400">Error</span>
      )}
    </div>
  );
}

function SynthesizingOverlay() {
  return (
    <div className="flex items-center justify-center gap-3 py-8 my-4 rounded-xl border border-violet-500/20 bg-violet-500/5">
      <FileText size={20} className="text-violet-400 animate-pulse" />
      <span className="text-violet-300 font-medium">Synthesizing insights…</span>
    </div>
  );
}

export default function DebatePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [debate, setDebate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const analysisRef = useRef(null);

  // Determine if we should stream (only for running/configuring debates)
  const shouldStream = debate && ['running', 'configuring'].includes(debate.status);

  const stream = useDebateStream(shouldStream ? id : null);

  // Fetch debate details on mount
  useEffect(() => {
    api.get(`/debates/${id}`)
      .then((res) => {
        setDebate(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setFetchError(err.response?.data?.detail || 'Failed to load debate');
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-52px)]">
        <Loader size={24} className="text-gray-500 animate-spin" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-52px)] gap-4">
        <p className="text-red-400">{fetchError}</p>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to Home
        </button>
      </div>
    );
  }

  // Merge data: use stream data for live debates, DB data for completed ones
  const isLive = shouldStream;
  const effectiveStatus = isLive
    ? (stream.status === 'connecting' ? (debate.status === 'configuring' ? 'configuring' : debate.status) : stream.status)
    : debate.status;

  // Build arguments from the right source
  let displayArgs;
  let displayRounds = [];
  let displayVerdict;

  if (isLive && stream.arguments.pro.length + stream.arguments.con.length > 0) {
    // Use streamed arguments
    displayArgs = stream.arguments;
    displayVerdict = stream.verdict;
  } else if (debate.rounds && debate.rounds.length > 0) {
    // Build from fetched debate detail (review mode)
    const pro = [];
    const con = [];
    displayRounds = debate.rounds;

    for (const round of debate.rounds) {
      for (const arg of round.arguments || []) {
        // Find the agent for this argument
        const agent = (debate.agents || []).find((a) => a.id === arg.agent_id);
        const enriched = {
          ...arg,
          id: arg.argument_index,
          type: arg.arg_type,
          agentPrefix: agent?.argument_prefix || '?',
          agentTitle: agent?.title || 'Agent',
          roundNumber: round.round_number,
          roundType: round.round_type,
          round_number: round.round_number,
        };
        if (arg.agent_side === 'pro') pro.push(enriched);
        else con.push(enriched);
      }
    }
    displayArgs = { pro, con };
    displayVerdict = debate.verdict;
  } else {
    displayArgs = isLive ? stream.arguments : { pro: [], con: [] };
    displayVerdict = isLive ? stream.verdict : debate.verdict;
  }

  const currentRound = isLive ? stream.currentRound : null;
  const totalRounds = isLive
    ? stream.totalRounds
    : debate.format_config?.rounds?.length || 0;
  const formatName = debate.format_config?.format_name || '';
  const agents = debate.agents || [];
  const proAgents = agents.filter((a) => a.side === 'pro');
  const conAgents = agents.filter((a) => a.side === 'con');

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      {/* Back link */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-300 transition-colors cursor-pointer"
      >
        <ArrowLeft size={12} /> Back
      </button>

      {/* Topic */}
      <h1 className="text-xl font-semibold text-gray-100 leading-snug">{debate.topic}</h1>

      {/* Status bar */}
      <StatusBar
        status={effectiveStatus}
        currentRound={currentRound}
        totalRounds={totalRounds}
        formatName={formatName}
      />

      {/* Agent badges */}
      {agents.length > 0 && (
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 flex-wrap">
            {proAgents.map((a) => (
              <AgentBadge key={a.id} agent={a} side="pro" />
            ))}
          </div>
          <span className="text-gray-600 text-xs font-medium">vs</span>
          <div className="flex items-center gap-2 flex-wrap">
            {conAgents.map((a) => (
              <AgentBadge key={a.id} agent={a} side="con" />
            ))}
          </div>
        </div>
      )}

      {/* Synthesis/verdict banner + jump to analysis */}
      {effectiveStatus === 'completed' && displayVerdict && (
        <div>
          <SynthesisBanner verdict={displayVerdict} />
          <div className="flex justify-end -mt-4 mb-2">
            <button
              type="button"
              onClick={() => analysisRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10"
            >
              <ArrowDown size={12} /> Jump to Analysis
            </button>
          </div>
        </div>
      )}

      {/* Synthesizing overlay */}
      {effectiveStatus === 'judging' && <SynthesizingOverlay />}

      {/* Configuring state */}
      {effectiveStatus === 'configuring' && (
        <div className="flex items-center justify-center gap-3 py-12 text-gray-500">
          <Loader size={18} className="animate-spin" />
          <span>Waiting for debate to start…</span>
        </div>
      )}

      {/* Arguments */}
      {effectiveStatus !== 'configuring' && (
        <LiveViewer
          arguments={displayArgs}
          animate={isLive}
          rounds={displayRounds}
        />
      )}

      {/* Analysis dashboard for completed debates */}
      {effectiveStatus === 'completed' && displayVerdict && (
        <div ref={analysisRef} className="mt-8 border-t border-white/10 pt-6">
          <AnalysisDashboard
            debateId={id}
            verdict={displayVerdict}
            arguments={displayArgs}
            agents={agents}
          />
        </div>
      )}
    </div>
  );
}
