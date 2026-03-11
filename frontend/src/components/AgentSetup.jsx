import { useState } from 'react';
import { Users, BookOpen, PenLine, Cpu } from 'lucide-react';
import IdentityCard from './IdentityCard';
import PersonaPickerModal from './PersonaPickerModal';

const panelSizes = [1, 2, 3, 4];
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

function AgentSlot({ agent, side, index, onUpdate }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const prefixes = side === 'pro' ? ['A','C','E','G'] : ['B','D','F','H'];
  const prefix = prefixes[index] || '?';

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
    <div className={`rounded-lg border p-3 bg-white/[0.02] ${
      side === 'pro' ? 'border-blue-500/15' : 'border-amber-500/15'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-mono font-bold ${
          side === 'pro' ? 'text-blue-400' : 'text-amber-400'
        }`}>
          Agent {prefix}
        </span>
        <div className="flex rounded-md overflow-hidden border border-white/10">
          {modes.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-2 py-1 text-[10px] flex items-center gap-1 transition-colors cursor-pointer ${
                agent.mode === m.id
                  ? side === 'pro' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
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
        <div className={`flex items-center justify-center h-20 rounded border border-dashed ${
          side === 'pro' ? 'border-blue-500/20 text-blue-500/40' : 'border-amber-500/20 text-amber-500/40'
        }`}>
          <span className="text-xs">Will be auto-generated</span>
        </div>
      )}

      {agent.mode === 'auto' && agent.identity && (
        <IdentityCard
          identity={agent.identity}
          side={side}
          onChange={identity => onUpdate({ ...agent, identity })}
        />
      )}

      {agent.mode === 'library' && !agent.identity && (
        <>
          <button
            onClick={() => setPickerOpen(true)}
            className={`w-full h-20 rounded border border-dashed flex items-center justify-center gap-2 text-xs transition-colors cursor-pointer ${
              side === 'pro'
                ? 'border-blue-500/20 text-blue-400/60 hover:border-blue-500/40 hover:text-blue-400'
                : 'border-amber-500/20 text-amber-400/60 hover:border-amber-500/40 hover:text-amber-400'
            }`}
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
            side={side}
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
          side={side}
          onChange={identity => onUpdate({ ...agent, identity })}
        />
      )}
    </div>
  );
}

export default function AgentSetup({ panelSize, onPanelSizeChange, agents, onAgentsChange }) {
  function updateAgent(side, index, agent) {
    const newAgents = { ...agents };
    newAgents[side] = [...agents[side]];
    newAgents[side][index] = agent;
    onAgentsChange(newAgents);
  }

  return (
    <div>
      <div className="flex items-center justify-center gap-2 mb-5">
        <Users size={16} className="text-gray-500" />
        <span className="text-xs text-gray-500 mr-2">Panel Size</span>
        {panelSizes.map(size => (
          <button
            key={size}
            onClick={() => onPanelSizeChange(size)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-all cursor-pointer ${
              panelSize === size
                ? 'border-blue-500/50 bg-blue-500/15 text-blue-400'
                : 'border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'
            }`}
          >
            {size}v{size}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PRO Side */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Pro</span>
          </div>
          <div className="space-y-3">
            {agents.pro.map((agent, i) => (
              <AgentSlot
                key={i}
                agent={agent}
                side="pro"
                index={i}
                onUpdate={a => updateAgent('pro', i, a)}
              />
            ))}
          </div>
        </div>

        {/* CON Side */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Con</span>
          </div>
          <div className="space-y-3">
            {agents.con.map((agent, i) => (
              <AgentSlot
                key={i}
                agent={agent}
                side="con"
                index={i}
                onUpdate={a => updateAgent('con', i, a)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
