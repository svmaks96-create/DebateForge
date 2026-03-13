import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, FileText, Loader, Inbox, Users } from 'lucide-react';
import api from '../api';

const statusStyles = {
  configuring: 'bg-gray-500/20 text-gray-400',
  running: 'bg-blue-500/20 text-blue-400 animate-pulse',
  reflecting: 'bg-amber-500/20 text-amber-400',
  synthesizing: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-green-500/20 text-green-400',
  error: 'bg-red-500/20 text-red-400',
};

const filters = ['all', 'running', 'completed', 'error'];

function relativeTime(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getBottomLine(synthesis) {
  if (!synthesis) return null;
  if (synthesis.synthesis?.bottom_line) return synthesis.synthesis.bottom_line;
  if (synthesis.bottom_line) return synthesis.bottom_line;
  return null;
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [debates, setDebates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const params = {};
    if (filter !== 'all') params.status = filter;
    api.get('/debates', { params })
      .then(res => {
        setDebates(Array.isArray(res.data) ? res.data : res.data.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-52px)]">
        <Loader size={24} className="text-gray-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Deliberation History</h1>
        <div className="flex gap-1.5">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-lg border transition-colors cursor-pointer capitalize ${
                filter === f
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'bg-transparent border-white/5 text-gray-500 hover:text-gray-300 hover:border-white/10'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {debates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-3">
          <Inbox size={36} strokeWidth={1.5} />
          <p className="text-sm">No deliberations yet. Start one from the home page.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {debates.map(d => {
            const formatName = d.format_config?.format_name;
            const bottomLine = getBottomLine(d.synthesis);

            return (
              <button
                key={d.id}
                onClick={() => navigate(`/debate/${d.id}`)}
                className="w-full text-left rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 p-4 transition-all cursor-pointer group"
              >
                {/* Top: topic + status */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm text-gray-200 leading-snug group-hover:text-white transition-colors line-clamp-2">
                    {d.topic?.length > 80 ? d.topic.slice(0, 80) + '...' : d.topic}
                  </p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${statusStyles[d.status] || 'bg-gray-500/20 text-gray-400'}`}>
                    {d.status}
                  </span>
                </div>

                {/* Bottom line preview for completed */}
                {d.status === 'completed' && bottomLine && (
                  <div className="mb-2 flex items-start gap-2">
                    <FileText size={12} className="text-green-400 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                      {bottomLine.length > 100 ? bottomLine.slice(0, 100) + '...' : bottomLine}
                    </p>
                  </div>
                )}

                {/* Bottom row: meta */}
                <div className="flex items-center gap-2 text-[11px] text-gray-600 mt-1">
                  {formatName && (
                    <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5">{formatName}</span>
                  )}
                  {d.council_size && (
                    <span className="flex items-center gap-1">
                      <Users size={10} />
                      {d.council_size} members
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1 shrink-0">
                    <Clock size={10} />
                    {relativeTime(d.created_at)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
