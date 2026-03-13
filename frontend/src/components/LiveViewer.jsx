import { useEffect, useRef } from 'react';
import { FileText, Users } from 'lucide-react';
import ArgumentCard from './ArgumentCard';

const roundTypeLabels = {
  opening: 'Opening Perspectives',
  discussion: 'Discussion',
  exploration: 'Exploration',
  closing: 'Closing Statements',
};

function RoundDivider({ roundNumber, roundType }) {
  const label = roundTypeLabels[roundType] || roundType?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '';

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
        Round {roundNumber}: {label}
      </span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

function PhaseDivider({ icon: Icon, text, color }) {
  return (
    <div className={`flex items-center justify-center gap-3 py-6 my-3 rounded-xl border ${color}`}>
      <Icon size={18} className="animate-pulse" />
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
}

export default function LiveViewer({ arguments: args, animate = true, status, rounds = [] }) {
  const endRef = useRef(null);

  // Auto-scroll to latest argument
  useEffect(() => {
    if (!animate) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [args.length, animate, status]);

  // Group arguments by round number
  const groups = [];
  let currentRound = null;

  for (const arg of args) {
    const rn = arg.roundNumber || arg.round_number || 0;
    if (rn !== currentRound) {
      currentRound = rn;
      const roundInfo = rounds.find((r) => r.round_number === rn);
      groups.push({
        roundNumber: rn,
        roundType: roundInfo?.round_type || arg.roundType || '',
        args: [],
      });
    }
    groups[groups.length - 1].args.push(arg);
  }

  return (
    <div className="space-y-3 min-h-[200px]">
      {groups.map((group) => (
        <div key={`r${group.roundNumber}`}>
          <RoundDivider roundNumber={group.roundNumber} roundType={group.roundType} />
          <div className="space-y-3">
            {group.args.map((arg, i) => (
              <ArgumentCard
                key={arg.id || arg.argument_index || `${group.roundNumber}-${i}`}
                argument={arg}
                animate={animate}
              />
            ))}
          </div>
        </div>
      ))}

      {args.length === 0 && status !== 'reflecting' && status !== 'synthesizing' && (
        <div className="text-sm text-gray-600 italic py-8 text-center">
          Waiting for council members to speak…
        </div>
      )}

      {/* Reflecting phase divider */}
      {status === 'reflecting' && (
        <PhaseDivider
          icon={Users}
          text="Council members are stating their final positions…"
          color="border-blue-500/20 bg-blue-500/5 text-blue-300"
        />
      )}

      {/* Synthesizing phase divider */}
      {status === 'synthesizing' && (
        <PhaseDivider
          icon={FileText}
          text="Synthesizing insights across all perspectives…"
          color="border-violet-500/20 bg-violet-500/5 text-violet-300"
        />
      )}

      <div ref={endRef} />
    </div>
  );
}
