import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, ArrowLeft, ArrowDown, Loader, StopCircle } from 'lucide-react';
import api from '../api';
import useDebateStream from '../hooks/useDebateStream';
import LiveViewer from '../components/LiveViewer';
import AnalysisDashboard from '../components/AnalysisDashboard';

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
};

const roundTypeLabels = {
  opening: 'Opening',
  discussion: 'Discussion',
  exploration: 'Exploration',
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

function SynthesisBanner({ synthesis }) {
  if (!synthesis) return null;
  const confidence = synthesis.confidence_level || synthesis.bottom_line ? 'uncertain' : null;
  if (!synthesis.bottom_line) return null;

  const level = synthesis.confidence_level || 'uncertain';
  const bannerCls = confidenceBannerColors[level] || confidenceBannerColors.uncertain;
  const badgeCls = confidenceBadgeColors[level] || confidenceBadgeColors.uncertain;

  return (
    <div className={`rounded-xl border bg-gradient-to-r ${bannerCls} p-5 mb-6`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <FileText size={24} className="mt-0.5 flex-shrink-0 text-gray-300" />
          <p className="text-sm text-gray-200 leading-relaxed font-medium">
            {synthesis.bottom_line}
          </p>
        </div>
        <div className="flex-shrink-0">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${badgeCls}`}>
            {level.charAt(0).toUpperCase() + level.slice(1)} confidence
          </span>
        </div>
      </div>
    </div>
  );
}

function CouncilBadge({ member }) {
  const prefix = member.argument_prefix;
  const color = SEAT_COLORS[prefix] || SEAT_COLORS.A;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${color.bg}`}>
      <span className={`text-xs font-bold ${color.text}`}>{prefix}</span>
      <span className="text-xs text-gray-300 truncate max-w-[140px]">{member.title}</span>
    </div>
  );
}

function PositionCard({ position }) {
  const prefix = position.agent_prefix;
  const color = SEAT_COLORS[prefix] || SEAT_COLORS.A;
  const stanceColor = STANCE_COLORS[position.overall_stance] || STANCE_COLORS.uncertain;

  return (
    <div className={`border-l-2 rounded-r-lg p-4 bg-white/[0.03] animate-arg-in`}
      style={{ borderLeftColor: prefix === 'A' ? '#3B82F6' : prefix === 'B' ? '#F59E0B' : prefix === 'C' ? '#10B981' : prefix === 'D' ? '#8B5CF6' : prefix === 'E' ? '#F43F5E' : '#06B6D4' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${color.bg} ${color.text}`}>
          {prefix}
        </span>
        <span className="text-xs text-gray-400">{position.agent_title}</span>
        <span className={`text-xs font-medium ${stanceColor}`}>
          {position.overall_stance}
        </span>
        <span className="text-[10px] text-gray-500 font-mono">{position.confidence}/10</span>
      </div>
      <p className="text-sm text-gray-200 leading-relaxed">{position.position_summary}</p>
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
      {status === 'reflecting' && (
        <span className="flex items-center gap-1.5 text-blue-400">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Final Positions
        </span>
      )}
      {status === 'verifying' && (
        <span className="flex items-center gap-1.5 text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Verifying…
        </span>
      )}
      {status === 'synthesizing' && (
        <span className="flex items-center gap-1.5 text-violet-400">
          <FileText size={12} />
          Synthesizing…
        </span>
      )}
      {status === 'completed' && (
        <span className="text-green-400">Completed</span>
      )}
      {status === 'stopped' && (
        <span className="text-orange-400">Stopped</span>
      )}
      {status === 'error' && (
        <span className="text-red-400">Error</span>
      )}
    </div>
  );
}

export default function DebatePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [debate, setDebate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [stopping, setStopping] = useState(false);
  const analysisRef = useRef(null);

  // Determine if we should stream (only for running/configuring debates)
  const shouldStream = debate && ['running', 'configuring', 'reflecting', 'verifying', 'synthesizing'].includes(debate.status);

  const stream = useDebateStream(shouldStream ? id : null);

  // Fetch debate details on mount
  useEffect(() => {
    api.get(`/debates/${id}`)
      .then((res) => {
        setDebate(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setFetchError(err.response?.data?.detail || 'Failed to load deliberation');
        setLoading(false);
      });
  }, [id]);

  const handleStop = async () => {
    if (stopping) return;
    setStopping(true);
    try {
      await api.post(`/debates/${id}/stop`);
    } catch (err) {
      console.error('Failed to stop deliberation:', err);
      setStopping(false);
    }
  };

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

  const canStop = !stopping && ['running', 'reflecting', 'verifying', 'synthesizing'].includes(effectiveStatus);

  // Build arguments from the right source
  let displayArgs = [];
  let displayRounds = [];
  let displaySynthesis = null;
  let displayPositions = [];

  if (isLive && stream.arguments.length > 0) {
    // Use streamed arguments (flat array)
    displayArgs = stream.arguments;
    displaySynthesis = stream.synthesis;
    displayPositions = stream.positions;
  } else if (debate.rounds && debate.rounds.length > 0) {
    // Build from fetched debate detail (review mode)
    const councilMembers = debate.council_members || [];
    displayRounds = debate.rounds;

    for (const round of debate.rounds) {
      for (const arg of round.arguments || []) {
        const agent = councilMembers.find((a) => a.id === arg.agent_id);
        displayArgs.push({
          ...arg,
          argument_index: arg.argument_index,
          arg_type: arg.arg_type,
          agentPrefix: agent?.argument_prefix || '?',
          agentTitle: agent?.title || 'Agent',
          roundNumber: round.round_number,
          roundType: round.round_type,
          round_number: round.round_number,
        });
      }
    }

    // For completed debates, synthesis comes from the debate object
    if (debate.synthesis?.synthesis) {
      displaySynthesis = debate.synthesis.synthesis;
    }
  } else {
    displayArgs = isLive ? stream.arguments : [];
    displaySynthesis = isLive ? stream.synthesis : (debate.synthesis?.synthesis || null);
    displayPositions = isLive ? stream.positions : [];
  }

  const currentRound = isLive ? stream.currentRound : null;
  const totalRounds = isLive
    ? stream.totalRounds
    : debate.format_config?.rounds?.length || 0;
  const formatName = debate.format_config?.format_name || '';
  const councilMembers = debate.council_members || [];
  const verificationReport = debate.verification_report || null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      {/* Back link */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-300 transition-colors cursor-pointer"
      >
        <ArrowLeft size={12} /> Back
      </button>

      {/* Topic */}
      <h1 className="text-xl font-semibold text-gray-100 leading-snug">{debate.topic}</h1>

      {/* Status bar + stop button */}
      <div className="flex items-center justify-between">
        <StatusBar
          status={effectiveStatus}
          currentRound={currentRound}
          totalRounds={totalRounds}
          formatName={formatName}
        />
        {canStop && (
          <button
            onClick={handleStop}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg border border-red-500/20"
          >
            <StopCircle size={14} />
            Stop
          </button>
        )}
        {stopping && effectiveStatus !== 'stopped' && (
          <span className="flex items-center gap-1.5 text-xs text-orange-400">
            <Loader size={12} className="animate-spin" />
            Stopping…
          </span>
        )}
      </div>

      {/* Council member badges */}
      {councilMembers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {councilMembers.map((m) => (
            <CouncilBadge key={m.id} member={m} />
          ))}
        </div>
      )}

      {/* Synthesis banner + jump to analysis */}
      {effectiveStatus === 'completed' && displaySynthesis && (
        <div>
          <SynthesisBanner synthesis={displaySynthesis} />
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

      {/* Configuring state */}
      {effectiveStatus === 'configuring' && (
        <div className="flex items-center justify-center gap-3 py-12 text-gray-500">
          <Loader size={18} className="animate-spin" />
          <span>Waiting for deliberation to start…</span>
        </div>
      )}

      {/* Arguments — conversation thread */}
      {effectiveStatus !== 'configuring' && (
        <LiveViewer
          arguments={displayArgs}
          animate={isLive}
          status={effectiveStatus}
          rounds={displayRounds}
          verificationReport={verificationReport}
        />
      )}

      {/* Position cards during reflecting phase */}
      {(effectiveStatus === 'reflecting' || effectiveStatus === 'verifying' || effectiveStatus === 'synthesizing' || effectiveStatus === 'completed') && displayPositions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Final Positions
          </h3>
          {displayPositions.map((pos) => (
            <PositionCard key={pos.agent_prefix} position={pos} />
          ))}
        </div>
      )}

      {/* Analysis dashboard for completed debates */}
      {effectiveStatus === 'completed' && (
        <div ref={analysisRef} className="mt-8 border-t border-white/10 pt-6">
          <AnalysisDashboard
            debateId={id}
            synthesis={displaySynthesis}
            councilMembers={councilMembers}
            verificationReport={verificationReport}
          />
        </div>
      )}
    </div>
  );
}
