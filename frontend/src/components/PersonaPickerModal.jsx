import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import api from '../api';

export default function PersonaPickerModal({ onSelect, onClose }) {
  const [personas, setPersonas] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      const params = search ? { search } : {};
      api.get('/personas', { params }).then(res => {
        setPersonas(res.data.personas);
        setLoading(false);
      }).catch(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timeout);
  }, [search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
         onClick={onClose}>
      <div className="w-full max-w-lg mx-4 bg-[#1A1D27] border border-white/10 rounded-xl shadow-2xl max-h-[70vh] flex flex-col"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-gray-200">Persona Library</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-3 border-b border-white/10">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search personas..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white/[0.04] border border-white/10 rounded-lg text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : personas.length === 0 ? (
            <p className="text-center text-gray-600 text-sm py-8">
              {search ? 'No personas match your search' : 'No personas saved yet'}
            </p>
          ) : (
            personas.map(p => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="w-full text-left p-3 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/20 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-gray-200 truncate">{p.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{p.expertise}</p>
                  </div>
                  {p.is_template && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 shrink-0">
                      Template
                    </span>
                  )}
                </div>
                {p.tags?.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {p.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
