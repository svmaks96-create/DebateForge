import { useState, useEffect } from 'react';
import api from '../api';

const roundTypeLabels = {
  opening: 'Opening',
  rebuttal: 'Rebuttal',
  cross_exam: 'Cross-Exam',
  closing: 'Closing',
};

export default function FormatSelector({ selected, onSelect }) {
  const [formats, setFormats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/formats').then(res => {
      setFormats(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex-1 h-32 rounded-lg bg-white/[0.03] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {formats.map(fmt => {
        const isSelected = selected === fmt.name;
        return (
          <button
            key={fmt.name}
            onClick={() => onSelect(fmt.name)}
            className={`text-left p-4 rounded-lg border transition-all duration-200 cursor-pointer ${
              isSelected
                ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
            }`}
          >
            <h3 className={`font-semibold text-sm mb-1 ${isSelected ? 'text-blue-400' : 'text-gray-200'}`}>
              {fmt.display_name}
            </h3>
            <p className="text-xs text-gray-500 mb-3">{fmt.description}</p>
            <div className="flex flex-wrap gap-1">
              {fmt.rounds.map((r, i) => (
                <span
                  key={i}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    isSelected ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-gray-500'
                  }`}
                >
                  {roundTypeLabels[r.type] || r.type}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
