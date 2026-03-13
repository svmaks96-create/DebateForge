import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Play, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../api';
import FormatSelector from '../components/FormatSelector';
import CouncilSetup from '../components/CouncilSetup';

const emptyAgent = () => ({ mode: 'auto', identity: null, personaId: null });

const statusColors = {
  configuring: 'bg-gray-500/20 text-gray-400',
  running: 'bg-blue-500/20 text-blue-400',
  reflecting: 'bg-amber-500/20 text-amber-400',
  synthesizing: 'bg-violet-500/20 text-violet-400',
  completed: 'bg-green-500/20 text-green-400',
  error: 'bg-red-500/20 text-red-400',
};

export default function HomePage() {
  const navigate = useNavigate();

  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [contextOpen, setContextOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('standard');
  const [councilSize, setCouncilSize] = useState(4);
  const [agents, setAgents] = useState(Array.from({ length: 4 }, emptyAgent));
  const [generating, setGenerating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [recentDebates, setRecentDebates] = useState([]);

  useEffect(() => {
    api.get('/debates', { params: { per_page: 5 } })
      .then(res => setRecentDebates(res.data))
      .catch(() => {});
  }, []);

  const handleCouncilSizeChange = useCallback((size) => {
    setCouncilSize(size);
    setAgents(prev => {
      if (prev.length === size) return prev;
      if (prev.length < size) return [...prev, ...Array.from({ length: size - prev.length }, emptyAgent)];
      return prev.slice(0, size);
    });
  }, []);

  async function handleAutoGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      const res = await api.post('/identities/generate', {
        topic: topic.trim(),
        context: context.trim() || undefined,
        council_size: councilSize,
      });
      setAgents(prev =>
        prev.map((agent, i) =>
          agent.mode === 'auto'
            ? { ...agent, identity: res.data.council[i] || agent.identity }
            : agent
        )
      );
    } catch {
      // TODO: show error toast
    } finally {
      setGenerating(false);
    }
  }

  function allSlotsFilled() {
    return agents.every(a => {
      if (a.mode === 'manual') return !!a.identity?.title?.trim();
      return !!a.identity;
    });
  }

  async function handleStartDeliberation() {
    if (!topic.trim() || !allSlotsFilled()) return;
    setStarting(true);
    try {
      const agentInputs = agents.map(agent => {
        if (agent.personaId) return { persona_id: agent.personaId };
        return {
          title: agent.identity.title,
          expertise: agent.identity.expertise,
          priorities: agent.identity.priorities,
          style: agent.identity.style,
          background: agent.identity.background || '',
        };
      });

      const res = await api.post('/debates', {
        topic: topic.trim(),
        context: context.trim() || undefined,
        format_name: selectedFormat,
        council_size: councilSize,
        agents: agentInputs,
      });

      const debateId = res.data.id;
      await api.post(`/debates/${debateId}/start`);
      navigate(`/debate/${debateId}`);
    } catch {
      setStarting(false);
    }
  }

  const canStart = topic.trim() && allSlotsFilled() && !starting;
  const canGenerate = topic.trim() && !generating;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Section 1: Topic */}
      <section>
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="What should the council deliberate on?"
          className="w-full px-5 py-4 text-lg bg-white/[0.03] border border-white/10 rounded-xl text-gray-100 placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-all"
        />
        <button
          onClick={() => setContextOpen(!contextOpen)}
          className="flex items-center gap-1.5 mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
        >
          {contextOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Add context or constraints
        </button>
        {contextOpen && (
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="Provide any additional context, constraints, or framing for the deliberation..."
            rows={3}
            className="w-full mt-2 px-4 py-3 text-sm bg-white/[0.03] border border-white/10 rounded-lg text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:outline-none resize-none transition-all"
            style={{ animation: 'fadeIn 0.2s ease-in' }}
          />
        )}
      </section>

      {/* Section 2: Format */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Deliberation Format</h2>
        <FormatSelector selected={selectedFormat} onSelect={setSelectedFormat} />
      </section>

      {/* Section 3: Council Setup */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Council Members</h2>
          <button
            onClick={handleAutoGenerate}
            disabled={!canGenerate}
            className="relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer bg-gradient-to-r from-blue-600/20 to-violet-600/20 text-blue-300 border border-blue-500/30 hover:border-blue-400/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                Generating Council...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Auto-Generate Council
              </>
            )}
          </button>
        </div>
        <CouncilSetup
          councilSize={councilSize}
          onCouncilSizeChange={handleCouncilSizeChange}
          agents={agents}
          onAgentsChange={setAgents}
        />
      </section>

      {/* Start Button */}
      <div className="flex justify-center pt-2">
        <button
          onClick={handleStartDeliberation}
          disabled={!canStart}
          className="flex items-center gap-2.5 px-8 py-3.5 text-base font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30"
        >
          {starting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Starting Deliberation...
            </>
          ) : (
            <>
              <Play size={18} fill="currentColor" />
              Start Deliberation
            </>
          )}
        </button>
      </div>

      {/* Recent Deliberations */}
      {recentDebates.length > 0 && (
        <section className="pt-4 border-t border-white/5">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Deliberations</h2>
          <div className="space-y-2">
            {recentDebates.map(d => (
              <button
                key={d.id}
                onClick={() => navigate(`/debate/${d.id}`)}
                className="w-full text-left flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-colors cursor-pointer"
              >
                <span className="text-sm text-gray-300 truncate">{d.topic}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-gray-600">
                    {d.council_size} members
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[d.status] || 'bg-gray-500/20 text-gray-400'}`}>
                    {d.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
