import { useState } from 'react';
import { Users, BookOpen, PenLine, Cpu } from 'lucide-react';
import IdentityCard from './IdentityCard';
import PersonaPickerModal from './PersonaPickerModal';

const SEAT_COLORS = [
  { name: 'Blue',    hex: '#3B82F6', border: 'border-blue-500/20', borderDashed: 'border-blue-500/20', text: 'text-blue-400', bg: 'bg-blue-500/20', textMuted: 'text-blue-500/40' },
  { name: 'Amber',   hex: '#F59E0B', border: 'border-amber-500/20', borderDashed: 'border-amber-500/20', text: 'text-amber-400', bg: 'bg-amber-500/20', textMuted: 'text-amber-500/40' },
  { name: 'Emerald', hex: '#10B981', border: 'border-emerald-500/20', borderDashed: 'border-emerald-500/20', text: 'text-emerald-400', bg: 'bg-emerald-500/20', textMuted: 'text-emerald-500/40' },
  { name: 'Purple',  hex: '#8B5CF6', border: 'border-violet-500/20', borderDashed: 'border-violet-500/20', text: 'text-violet-400', bg: 'bg-violet-500/20', textMuted: 'text-violet-500/40' },
  { name: 'Rose',    hex: '#F43F5E', border: 'border-rose-500/20', borderDashed: 'border-rose-500/20', text: 'text-rose-400', bg: 'bg-rose-500/20', textMuted: 'text-rose-500/40' },
  { name: 'Cyan',    hex: '#06B6D4', border: 'border-cyan-500/20', borderDashed: 'border-cyan-500/20', text: 'text-cyan-400', bg: 'bg-cyan-500/20', textMuted: 'text-cyan-500/40' },
];

const PREFIXES = ['A', 'B', 'C', 'D', 'E', 'F'];
const COUNCIL_SIZES = [2, 3, 4, 5, 6];

const modes = [
  { id: 'auto', label: 'Auto-generate', icon: Cpu },
  { id: 'library', label: 'From Library', icon: BookOpen },
  { id: 'manual', label: 'Manual', icon: PenLine },
];

const manualFields = [
  { key: 'title', label: 'Title', required: true },
  { key: 'expertise', label: 'Expertise' },
  { key: 'priorities', label: 'Priorities' },
  { key: 'style', label: 'Style' },
  { key: 'background', label: 'Background' },
];

function AgentSlot({ agent, seatIndex, onUpdate }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const color = SEAT_COLORS[seatIndex];
  const prefix = PREFIXES[seatIndex];

  function setMode(mode) {
    onUpdate({ ...agent, mode, identity: null, personaId: null });
  }

  function setManualField(key, value) {
    const identity = { ...(agent.identity || { title: '', expertise: '', priorities: '', style: '', background: '' }), [key]: value };
    onUpdate({ ...agent, identity });
  }

  function handlePersonaSelect(persona) {
    onUpdate({
      ...agent,
      mode: 'library',
      personaId: persona.id,
      identity: {
        title: persona.title,
        expertise: persona.expertise,
        priorities: persona.priorities,
        style: persona.style,
        background: persona.background || '',
      },
    });
    setPickerOpen(false);
  }

  return (
    <div className={`rounded-lg border p-3 bg-white/[0.02] ${color.border}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color.hex }} />
          <span className={`text-xs font-mono font-bold ${color.text}`}>
            Seat {seatIndex + 1} ({prefix})
          </span>
        </div>
        <div className="flex rounded-md overflow-hidden border border-white/10">
          {modes.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-2 py-1 text-[10px] flex items-center gap-1 transition-colors cursor-pointer ${
                agent.mode === m.id
                  ? `${color.bg} ${color.text}`
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
              }`}
            >
              <m.icon size={10} />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {agent.mode === 'auto' && !agent.identity && (
        <div className={`flex items-center justify-center h-20 rounded border border-dashed ${color.borderDashed} ${color.textMuted}`}>
          <span className="text-xs">Will be auto-generated</span>
        </div>
      )}

      {agent.mode === 'auto' && agent.identity && (
        <IdentityCard
          identity={agent.identity}
          seatIndex={seatIndex}
          onChange={identity => onUpdate({ ...agent, identity })}
        />
      )}

      {agent.mode === 'library' && !agent.identity && (
        <>
          <button
            onClick={() => setPickerOpen(true)}
            className={`w-full h-20 rounded border border-dashed flex items-center justify-center gap-2 text-xs transition-colors cursor-pointer ${color.borderDashed} ${color.textMuted} hover:opacity-80`}
          >
            <BookOpen size={14} />
            Pick from Library
          </button>
          {pickerOpen && (
            <PersonaPickerModal
              onSelect={handlePersonaSelect}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </>
      )}

      {agent.mode === 'library' && agent.identity && (
        <div>
          <IdentityCard
            identity={agent.identity}
            seatIndex={seatIndex}
            onChange={identity => onUpdate({ ...agent, identity })}
          />
          <button
            onClick={() => setPickerOpen(true)}
            className="mt-2 text-[10px] text-gray-500 hover:text-gray-300 cursor-pointer"
          >
            Change persona
          </button>
          {pickerOpen && (
            <PersonaPickerModal
              onSelect={handlePersonaSelect}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>
      )}

      {agent.mode === 'manual' && !agent.identity?.title && (
        <div className="space-y-2">
          {manualFields.map(f => (
            <div key={f.key}>
              <label className="text-[10px] text-gray-600 uppercase tracking-wider">
                {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              <input
                type="text"
                value={agent.identity?.[f.key] || ''}
                onChange={e => setManualField(f.key, e.target.value)}
                placeholder={f.label}
                className="w-full mt-0.5 px-2 py-1.5 text-xs bg-white/[0.04] border border-white/10 rounded text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}

      {agent.mode === 'manual' && agent.identity?.title && (
        <IdentityCard
          identity={agent.identity}
          seatIndex={seatIndex}
          onChange={identity => onUpdate({ ...agent, identity })}
        />
      )}
    </div>
  );
}

export default function CouncilSetup({ councilSize, onCouncilSizeChange, agents, onAgentsChange }) {
  function updateAgent(index, agent) {
    const newAgents = [...agents];
    newAgents[index] = agent;
    onAgentsChange(newAgents);
  }

  return (
    <div>
      <div className="flex items-center justify-center gap-2 mb-5">
        <Users size={16} className="text-gray-500" />
        <span className="text-xs text-gray-500 mr-2">Council Size</span>
        {COUNCIL_SIZES.map(size => (
          <button
            key={size}
            onClick={() => onCouncilSizeChange(size)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-all cursor-pointer ${
              councilSize === size
                ? 'border-blue-500/50 bg-blue-500/15 text-blue-400'
                : 'border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'
            }`}
          >
            {size}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {agents.map((agent, i) => (
          <AgentSlot
            key={i}
            agent={agent}
            seatIndex={i}
            onUpdate={a => updateAgent(i, a)}
          />
        ))}
      </div>
    </div>
  );
}
