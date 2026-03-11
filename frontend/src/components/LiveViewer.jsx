import { useEffect, useRef } from 'react';
import ArgumentCard from './ArgumentCard';

function RoundDivider({ roundNumber, roundType }) {
  const label = roundType
    ? roundType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : `Round ${roundNumber}`;

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-[10px] uppercase tracking-wider text-gray-600 font-medium">
        Round {roundNumber} — {label}
      </span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

export default function LiveViewer({ arguments: args, animate = true, rounds = [] }) {
  const proEndRef = useRef(null);
  const conEndRef = useRef(null);

  // Auto-scroll to latest argument
  useEffect(() => {
    if (!animate) return;
    proEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    conEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [args.pro.length, args.con.length, animate]);

  // Build round-grouped structure for each side
  const groupByRound = (sideArgs) => {
    const groups = [];
    let currentRound = null;

    for (const arg of sideArgs) {
      const rn = arg.roundNumber || arg.round_number || 0;
      if (rn !== currentRound) {
        currentRound = rn;
        // Find round type from rounds array or from the argument's context
        const roundInfo = rounds.find((r) => r.round_number === rn);
        groups.push({
          roundNumber: rn,
          roundType: roundInfo?.round_type || arg.roundType || '',
          args: [],
        });
      }
      groups[groups.length - 1].args.push(arg);
    }
    return groups;
  };

  const proGroups = groupByRound(args.pro);
  const conGroups = groupByRound(args.con);

  return (
    <div className="grid grid-cols-2 gap-4 min-h-[300px]">
      {/* Pro column */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-blue-400/70 mb-2">
          Pro
        </div>
        {proGroups.map((group) => (
          <div key={`pro-r${group.roundNumber}`}>
            <RoundDivider roundNumber={group.roundNumber} roundType={group.roundType} />
            <div className="space-y-3 mt-2">
              {group.args.map((arg, i) => (
                <ArgumentCard
                  key={arg.id || arg.argument_index || `pro-${group.roundNumber}-${i}`}
                  argument={arg}
                  side="pro"
                  animate={animate}
                />
              ))}
            </div>
          </div>
        ))}
        {args.pro.length === 0 && (
          <div className="text-sm text-gray-600 italic py-8 text-center">
            Waiting for arguments…
          </div>
        )}
        <div ref={proEndRef} />
      </div>

      {/* Con column */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-amber-400/70 mb-2">
          Con
        </div>
        {conGroups.map((group) => (
          <div key={`con-r${group.roundNumber}`}>
            <RoundDivider roundNumber={group.roundNumber} roundType={group.roundType} />
            <div className="space-y-3 mt-2">
              {group.args.map((arg, i) => (
                <ArgumentCard
                  key={arg.id || arg.argument_index || `con-${group.roundNumber}-${i}`}
                  argument={arg}
                  side="con"
                  animate={animate}
                />
              ))}
            </div>
          </div>
        ))}
        {args.con.length === 0 && (
          <div className="text-sm text-gray-600 italic py-8 text-center">
            Waiting for arguments…
          </div>
        )}
        <div ref={conEndRef} />
      </div>
    </div>
  );
}
