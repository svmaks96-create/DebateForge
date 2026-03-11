const severityColors = {
  low: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  medium: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  high: 'bg-red-500/20 text-red-300 border-red-500/30',
  minor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  moderate: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  major: 'bg-red-500/20 text-red-300 border-red-500/30',
};

export default function FallacyBadge({ type, severity }) {
  const color = severityColors[severity] || severityColors.medium;

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${color}`}>
      {type}
    </span>
  );
}
