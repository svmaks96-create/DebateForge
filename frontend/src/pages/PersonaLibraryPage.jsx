import { useState, useEffect, useRef } from 'react';
import { Search, Plus, X, Check, Trash2, Pencil, Loader, UserCircle } from 'lucide-react';
import api from '../api';

const tagColors = [
  'bg-blue-500/20 text-blue-300 border-blue-500/20',
  'bg-violet-500/20 text-violet-300 border-violet-500/20',
  'bg-emerald-500/20 text-emerald-300 border-emerald-500/20',
  'bg-amber-500/20 text-amber-300 border-amber-500/20',
  'bg-rose-500/20 text-rose-300 border-rose-500/20',
  'bg-cyan-500/20 text-cyan-300 border-cyan-500/20',
  'bg-pink-500/20 text-pink-300 border-pink-500/20',
  'bg-lime-500/20 text-lime-300 border-lime-500/20',
];

function tagColor(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = ((hash << 5) - hash + tag.charCodeAt(i)) | 0;
  return tagColors[Math.abs(hash) % tagColors.length];
}

const emptyForm = { title: '', expertise: '', priorities: '', style: '', background: '', tags: '' };

function PersonaForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || emptyForm);
  const titleRef = useRef(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  function handleSave() {
    if (!form.title.trim() || !form.expertise.trim() || !form.priorities.trim() || !form.style.trim()) return;
    const tags = form.tags
      ? (typeof form.tags === 'string' ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : form.tags)
      : [];
    onSave({ ...form, tags });
  }

  const fieldClass = 'w-full px-3 py-2 text-sm bg-white/[0.03] border border-white/10 rounded-lg text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-all';

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.03] p-4 space-y-3">
      <input ref={titleRef} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Title (e.g., Chief Technology Officer)" className={fieldClass} />
      <textarea value={form.expertise} onChange={e => set('expertise', e.target.value)} placeholder="Expertise" rows={2} className={`${fieldClass} resize-none`} />
      <textarea value={form.priorities} onChange={e => set('priorities', e.target.value)} placeholder="Priorities" rows={2} className={`${fieldClass} resize-none`} />
      <textarea value={form.style} onChange={e => set('style', e.target.value)} placeholder="Argumentation style" rows={2} className={`${fieldClass} resize-none`} />
      <textarea value={form.background} onChange={e => set('background', e.target.value)} placeholder="Background (optional)" rows={2} className={`${fieldClass} resize-none`} />
      <input value={typeof form.tags === 'string' ? form.tags : (form.tags || []).join(', ')} onChange={e => set('tags', e.target.value)} placeholder="Tags (comma-separated)" className={fieldClass} />
      <div className="flex items-center gap-2 pt-1">
        <button onClick={handleSave} disabled={saving || !form.title.trim()} className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors">
          {saving ? <Loader size={12} className="animate-spin" /> : <Check size={12} />}
          Save
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 text-xs text-gray-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function PersonaLibraryPage() {
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const searchTimer = useRef(null);

  function fetchPersonas(query) {
    const params = {};
    if (query) params.search = query;
    if (activeTag) params.tags = activeTag;
    api.get('/personas', { params })
      .then(res => {
        setPersonas(Array.isArray(res.data) ? res.data : res.data.personas || res.data.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { fetchPersonas(search); }, [activeTag]);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchPersonas(search), 300);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // Collect all unique tags
  const allTags = [...new Set(personas.flatMap(p => p.tags || []))].sort();

  const templates = personas.filter(p => p.is_template);
  const custom = personas.filter(p => !p.is_template);

  // Filter by active tag client-side as a fallback
  const filterByTag = (list) =>
    activeTag ? list.filter(p => (p.tags || []).includes(activeTag)) : list;

  const filteredTemplates = filterByTag(templates);
  const filteredCustom = filterByTag(custom);

  async function handleCreate(data) {
    setSaving(true);
    try {
      await api.post('/personas', data);
      setCreating(false);
      fetchPersonas(search);
    } catch { /* */ }
    setSaving(false);
  }

  async function handleUpdate(id, data) {
    setSaving(true);
    try {
      await api.put(`/personas/${id}`, data);
      setEditingId(null);
      fetchPersonas(search);
    } catch { /* */ }
    setSaving(false);
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/personas/${id}`);
      setDeleteConfirm(null);
      fetchPersonas(search);
    } catch { /* */ }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-52px)]">
        <Loader size={24} className="text-gray-500 animate-spin" />
      </div>
    );
  }

  function renderCard(p) {
    if (editingId === p.id) {
      return (
        <PersonaForm
          key={p.id}
          initial={{
            title: p.title,
            expertise: p.expertise,
            priorities: p.priorities,
            style: p.style,
            background: p.background || '',
            tags: (p.tags || []).join(', '),
          }}
          onSave={(data) => handleUpdate(p.id, data)}
          onCancel={() => setEditingId(null)}
          saving={saving}
        />
      );
    }

    return (
      <div
        key={p.id}
        className="rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:border-white/10 transition-colors group"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <UserCircle size={16} className="text-gray-600 shrink-0" />
            <h3 className="text-sm font-medium text-gray-200 truncate">{p.title}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {p.is_template ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 border border-violet-500/20">
                Template
              </span>
            ) : (
              <>
                <button
                  onClick={() => setEditingId(p.id)}
                  className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => setDeleteConfirm(p.id)}
                  className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-2">{p.expertise}</p>

        {(p.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {p.tags.map(tag => (
              <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded border ${tagColor(tag)}`}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Delete confirmation */}
        {deleteConfirm === p.id && (
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
            <span className="text-xs text-red-400">Delete this persona?</span>
            <button
              onClick={() => handleDelete(p.id)}
              className="text-xs px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white cursor-pointer transition-colors"
            >
              Yes, delete
            </button>
            <button
              onClick={() => setDeleteConfirm(null)}
              className="text-xs px-2.5 py-1 rounded text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-100">Persona Library</h1>
        <button
          onClick={() => { setCreating(true); setEditingId(null); }}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors"
        >
          <Plus size={14} />
          Create New Persona
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search personas..."
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/[0.03] border border-white/10 rounded-lg text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-all"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 cursor-pointer">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Tag chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                activeTag === tag
                  ? 'bg-white/10 border-white/20 text-white'
                  : `${tagColor(tag)} hover:opacity-80`
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Create form */}
      {creating && (
        <PersonaForm
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
          saving={saving}
        />
      )}

      {/* Templates section */}
      {filteredTemplates.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Templates</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map(renderCard)}
          </div>
        </section>
      )}

      {/* Custom personas */}
      {filteredCustom.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Custom Personas</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCustom.map(renderCard)}
          </div>
        </section>
      )}

      {/* Empty state */}
      {filteredTemplates.length === 0 && filteredCustom.length === 0 && !creating && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-3">
          <UserCircle size={36} strokeWidth={1.5} />
          <p className="text-sm">No personas found.</p>
        </div>
      )}
    </div>
  );
}
