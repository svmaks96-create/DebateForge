import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

const axes = [
  { key: 'claim_score', label: 'Claim' },
  { key: 'grounds_score', label: 'Grounds' },
  { key: 'warrant_score', label: 'Warrant' },
  { key: 'backing_score', label: 'Backing' },
  { key: 'qualifier_score', label: 'Qualifier' },
];

function scoreColor(val) {
  if (val >= 8) return 'text-green-400';
  if (val >= 5) return 'text-yellow-400';
  return 'text-red-400';
}

export default function ToulminBreakdown({ analysis, side, claim }) {
  if (!analysis) return null;

  const isPro = side === 'pro';
  const fillColor = isPro ? 'rgba(59,130,246,0.3)' : 'rgba(245,158,11,0.3)';
  const strokeColor = isPro ? '#3B82F6' : '#F59E0B';

  const data = axes.map((a) => ({
    axis: a.label,
    score: analysis[a.key] ?? 0,
  }));

  const overall = analysis.overall_strength ?? 0;

  return (
    <div className="flex items-start gap-4 bg-white/[0.03] border border-white/5 rounded-xl p-4">
      {/* Radar chart */}
      <div className="w-48 h-44 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: '#9CA3AF', fontSize: 10 }}
            />
            <PolarRadiusAxis
              domain={[0, 10]}
              tick={{ fill: '#6B7280', fontSize: 9 }}
              axisLine={false}
            />
            <Radar
              dataKey="score"
              stroke={strokeColor}
              fill={fillColor}
              fillOpacity={1}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <span className={`text-2xl font-bold ${scoreColor(overall)}`}>
            {overall.toFixed(1)}
          </span>
          <span className="text-xs text-gray-500">overall strength</span>
        </div>

        {claim && (
          <p className="text-sm text-gray-300 leading-relaxed mb-3 line-clamp-3">{claim}</p>
        )}

        {/* Score list */}
        <div className="grid grid-cols-5 gap-2">
          {axes.map((a) => {
            const val = analysis[a.key] ?? 0;
            return (
              <div key={a.key} className="text-center">
                <div className={`text-sm font-semibold ${scoreColor(val)}`}>{val.toFixed?.(1) ?? val}</div>
                <div className="text-[10px] text-gray-600">{a.label}</div>
              </div>
            );
          })}
        </div>

        {analysis.notes && (
          <p className="mt-3 text-xs text-gray-500 italic">{analysis.notes}</p>
        )}
      </div>
    </div>
  );
}
