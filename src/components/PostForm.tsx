import { useEffect, useRef, useState } from 'react';
import PostEditor from './PostEditor';

const CATEGORIES = [
  { value: 'ensaio', label: 'Ensaio' },
  { value: 'reportagem', label: 'Reportagem' },
  { value: 'critica', label: 'Crítica' },
  { value: 'entrevista', label: 'Entrevista' },
  { value: 'memoria', label: 'Memória' },
  { value: 'cidade-casa', label: 'Cidade & Casa' },
];

const STORAGE_KEY = 'ocobogo_draft_v1';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type DraftSnapshot = {
  title: string;
  dek: string;
  categories: string[];
  date: string;
  readTime: string;
  bodyHtml: string;
  savedAt: number;
};

function loadDraft(): DraftSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftSnapshot;
  } catch {
    return null;
  }
}

function saveDraft(snapshot: Omit<DraftSnapshot, 'savedAt'>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...snapshot, savedAt: Date.now() }));
  } catch {}
}

function clearDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export default function PostForm() {
  const [title, setTitle] = useState('');
  const [dek, setDek] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [date, setDate] = useState(todayISO());
  const [readTime, setReadTime] = useState('5 min');
  const [bodyHtml, setBodyHtml] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saved' | 'pending'>('idle');
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const initialMountedRef = useRef(false);

  // Restore from localStorage on mount, then mark editor ready
  useEffect(() => {
    const draft = loadDraft();
    if (draft && (draft.title || draft.bodyHtml)) {
      const ageMin = Math.round((Date.now() - draft.savedAt) / 60000);
      const proceed = window.confirm(
        `Você tem um rascunho salvo localmente (${ageMin} min atrás).\n\nRestaurar?`
      );
      if (proceed) {
        setTitle(draft.title);
        setDek(draft.dek);
        setCategories(draft.categories);
        setDate(draft.date || todayISO());
        setReadTime(draft.readTime || '5 min');
        setBodyHtml(draft.bodyHtml);
        setRestoredFromDraft(true);
      } else {
        clearDraft();
      }
    }
    initialMountedRef.current = true;
    setEditorReady(true);
  }, []);

  // Auto-save to localStorage on change (debounced ~1.5s)
  useEffect(() => {
    if (!initialMountedRef.current) return;
    if (!title && !bodyHtml) return;
    setAutosaveStatus('pending');
    const t = setTimeout(() => {
      saveDraft({ title, dek, categories, date, readTime, bodyHtml });
      setAutosaveStatus('saved');
    }, 1500);
    return () => clearTimeout(t);
  }, [title, dek, categories, date, readTime, bodyHtml]);

  // Warn before leaving if there's unsaved content
  useEffect(() => {
    const hasContent = title.trim() || bodyHtml.trim();
    if (!hasContent) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [title, bodyHtml]);

  const toggleCategory = (value: string) => {
    setCategories((cur) => (cur.includes(value) ? cur.filter((c) => c !== value) : [...cur, value]));
  };

  const submit = async (draft: boolean) => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, dek, categories, date, readTime, draft, bodyHtml }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Erro ${res.status}`);
        return;
      }

      clearDraft();
      const verb = draft ? 'Rascunho salvo' : 'Publicado';
      alert(`${verb}!\nO Vercel está rebuildando — em ~1 min seu post estará no ar.\nSlug: ${data.slug}`);
      window.removeEventListener('beforeunload', () => {});
      window.location.href = '/admin';
    } catch (err: any) {
      setError(err.message ?? 'Erro inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    title.trim() && dek.trim() && categories.length > 0 && bodyHtml.trim() && !submitting;

  return (
    <>
      <style>{`
        :root{ --pf-orange:#d88854; --pf-orange-dark:#c47842; }
        body{ background:#fff; }
        .pf-stickybar{
          position:sticky; top:0; z-index:50;
          background:#fff; border-bottom:1px solid #eee;
          padding: 10px 24px;
          display:flex; align-items:center; justify-content:space-between; gap:12px;
          backdrop-filter:saturate(180%) blur(6px);
          background:rgba(255,255,255,.92);
        }
        .pf-stickybar .left{ display:flex; align-items:center; gap:12px; font-size:13px; color:#666;}
        .pf-stickybar a.back{ color:#666; text-decoration:none; }
        .pf-stickybar a.back:hover{ color:#111; }
        .pf-status{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; color:#999; }
        .pf-status.saved{ color:#2c7a4d; }
        .pf-status.pending{ color:#b87b22; }
        .pf-stickybar .right{ display:flex; gap:8px; }
        .pf-btn{
          padding: 8px 16px; border:none; border-radius:6px; font-size:14px;
          font-weight:600; cursor:pointer; transition: opacity .12s, background .12s;
        }
        .pf-btn:disabled{ opacity:.4; cursor:not-allowed; }
        .pf-btn-secondary{ background:#eee; color:#333; }
        .pf-btn-secondary:hover:not(:disabled){ background:#ddd; }
        .pf-btn-primary{ background:var(--pf-orange); color:#fff; }
        .pf-btn-primary:hover:not(:disabled){ background:var(--pf-orange-dark); }

        .pf-form{ font-family: system-ui, sans-serif; max-width: 760px; margin: 0 auto; padding: 24px; color:#111; }
        .pf-restored{
          margin-bottom:14px; padding:8px 12px; background:#fff7e0; border:1px solid #f0d97a;
          border-radius:4px; font-size:12px; color:#7a5a10;
        }

        .pf-meta{ display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px;
                  padding: 14px; background:#fafafa; border:1px solid #eee; border-radius:8px; font-size: 13px; }
        .pf-meta label{ display:flex; flex-direction:column; gap:4px; color:#555; font-weight:500; }
        .pf-meta input[type=date],.pf-meta input[type=text]{
          padding:6px 8px; border:1px solid #ddd; border-radius:4px; font-size:13px;
        }

        .pf-cats{ display:flex; flex-wrap:wrap; gap:6px; margin-bottom:18px; }
        .pf-cats label{
          font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.08em;
          padding: 6px 10px; border:1px solid #ddd; border-radius:4px; cursor:pointer; user-select:none;
        }
        .pf-cats label.checked{ background:var(--pf-orange); color:#fff; border-color:var(--pf-orange); }
        .pf-cats input{ display:none; }

        .pf-title{
          width:100%; border:none; outline:none; padding: 12px 0;
          font-family: 'Source Serif 4', Georgia, serif; font-size: 42px; font-weight: 700;
          line-height:1.1; color:#111;
        }
        .pf-title::placeholder{ color:#bbb; }

        .pf-dek{
          width:100%; border:none; outline:none; padding: 4px 0 18px;
          font-family: 'Source Serif 4', Georgia, serif; font-size: 18px;
          color:#666; line-height:1.4; resize:none;
        }
        .pf-dek::placeholder{ color:#bbb; }

        .pf-error{
          margin-top: 12px; padding:10px 14px; background:#fee; border:1px solid #fbb;
          border-radius:4px; color:#900; font-size:13px;
        }
      `}</style>

      <div className="pf-stickybar">
        <div className="left">
          <a className="back" href="/admin">← Dashboard</a>
          <span className={`pf-status ${autosaveStatus}`}>
            {autosaveStatus === 'pending' && 'salvando rascunho local…'}
            {autosaveStatus === 'saved' && '✓ rascunho local salvo'}
            {autosaveStatus === 'idle' && (canSubmit ? 'pronto pra publicar' : 'preencha título, dek, categoria e corpo')}
          </span>
        </div>
        <div className="right">
          <button
            type="button"
            className="pf-btn pf-btn-secondary"
            disabled={!canSubmit}
            onClick={() => submit(true)}
          >
            Salvar rascunho
          </button>
          <button
            type="button"
            className="pf-btn pf-btn-primary"
            disabled={!canSubmit}
            onClick={() => submit(false)}
          >
            {submitting ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </div>

      <div className="pf-form">
        {restoredFromDraft && (
          <div className="pf-restored">
            ✓ Rascunho restaurado do navegador. Continue de onde parou.
          </div>
        )}

        <div className="pf-meta">
          <label>
            Data
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Tempo de leitura
            <input
              type="text"
              value={readTime}
              onChange={(e) => setReadTime(e.target.value)}
              placeholder="ex: 8 min"
            />
          </label>
        </div>

        <div className="pf-cats">
          {CATEGORIES.map((cat) => (
            <label key={cat.value} className={categories.includes(cat.value) ? 'checked' : ''}>
              <input
                type="checkbox"
                checked={categories.includes(cat.value)}
                onChange={() => toggleCategory(cat.value)}
              />
              {cat.label}
            </label>
          ))}
        </div>

        <input
          className="pf-title"
          placeholder="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="pf-dek"
          placeholder="Subtítulo / dek"
          value={dek}
          rows={2}
          onChange={(e) => setDek(e.target.value)}
        />

        {editorReady && (
          <PostEditor
            initialHtml={bodyHtml}
            onChange={setBodyHtml}
            placeholder="Comece a escrever…"
          />
        )}

        {error && <div className="pf-error">{error}</div>}
      </div>
    </>
  );
}
