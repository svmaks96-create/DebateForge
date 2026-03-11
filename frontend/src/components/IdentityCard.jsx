import { useState } from 'react';
import { Save, Pencil, Check, X } from 'lucide-react';
import api from '../api';

const fields = [
  { key: 'title', label: 'Title', required: true },
  { key: 'expertise', label: 'Expertise' },
  { key: 'priorities', label: 'Priorities' },
  { key: 'style', label: 'Style' },
  { key: 'background', label: 'Background' },
];

export default function IdentityCard({ identity, onChange, side }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function startEdit() {
    setDraft({ ...identity });
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(null);
    setEditing(false);
  }

  function confirmEdit() {
    onChange(draft);
    setEditing(false);
    setDraft(null);
  }

  async function saveToLibrary() {
    setSaving(true);
    try {
      await api.post('/personas', {
        title: identity.title,
        expertise: identity.expertise,
        priorities: identity.priorities,
        style: identity.style,
        background: identity.background || '',
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // silent fail
    } finally {
      setSaving(false);
    }
  }

  const data = editing ? draft : identity;

  return (
    <div className={`rounded-lg border bg-white/[0.02] p-3 ${side === 'pro' ? 'border-blue-500/20' : 'border-amber-500/20'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className={`text-sm font-semibold truncate ${side === 'pro' ? 'text-blue-400' : 'text-amber-400'}`}>
          {data.title || 'Untitled'}
        </h4>
        <div className="flex gap-1 shrink-0">
          {editing ? (
            <>
              <button onClick={confirmEdit} className="p-1 text-green-400 hover:text-green-300 cursor-pointer">
                <Check size={14} />
              </button>
              <button onClick={cancelEdit} className="p-1 text-gray-500 hover:text-gray-300 cursor-pointer">
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <button onClick={startEdit} className="p-1 text-gray-500 hover:text-gray-300 cursor-pointer" title="Edit">
                <Pencil size={13} />
              </button>
              <button
                onClick={saveToLibrary}
                disabled={saving || saved}
                className="p-1 text-gray-500 hover:text-gray-300 disabled:opacity-50 cursor-pointer"
                title="Save to Library"
              >
                {saved ? <Check size={13} className="text-green-400" /> : <Save size={13} />}
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-[10px] text-gray-600 uppercase tracking-wider">{f.label}</label>
              <input
                type="text"
                value={draft[f.key] || ''}
                onChange={e => setDraft({ ...draft, [f.key]: e.target.value })}
                className="w-full mt-0.5 px-2 py-1 text-xs bg-white/[0.04] border border-white/10 rounded text-gray-200 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:outline-none"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {fields.slice(1).map(f => (
            data[f.key] && (
              <p key={f.key} className="text-xs text-gray-400">
                <span className="text-gray-600">{f.label}:</span> {data[f.key]}
              </p>
            )
          ))}
        </div>
      )}
    </div>
  );
}
