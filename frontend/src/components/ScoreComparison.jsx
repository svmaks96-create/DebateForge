import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const dimensions = ['specificity', 'relevance', 'recency', 'authority'];

export default function ScoreComparison({ evidenceQuality }) {
  if (!evidenceQuality) return null;

  const pro = evidenceQuality.pro || {};
  const con = evidenceQuality.con || {};

  const data = dimensions.map((dim) => ({
    name: dim.charAt(0).toUpperCase() + dim.slice(1),
    Pro: pro[dim] ?? 0,
    Con: con[dim] ?? 0,
  }));

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Evidence Quality
      </h4>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barGap={4} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#1E2130',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              fontSize: 12,
              color: '#E5E7EB',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }}
          />
          <Bar dataKey="Pro" fill="#3B82F6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Con" fill="#F59E0B" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
