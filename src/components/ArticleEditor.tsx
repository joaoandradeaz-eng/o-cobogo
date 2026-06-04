import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import PostEditor from './PostEditor';
import { TableGridPicker } from './TableExtensions';
import { ChartModal } from './ChartExtension';

type TagOption = { value: string; label: string; color?: string; textColor?: string };

const STORAGE_KEY = 'ocobogo_draft_v3';

const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateBR(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`;
}

type InitialValues = {
  title: string;
  dek: string;
  categories: string[];
  date: string;
  readTime: string;
  linhaFina: string;
  linhaFinaLabel: string;
  notas: string[];
  bodyHtml: string;
  draft: boolean;
  heroImage?: string;
  heroCaption?: string;
  heroPosition?: string;
  heroZoom?: number;
};

type Props = {
  authorName?: string;
  cloudinary?: { cloudName: string; uploadPreset: string };
  /** Tags disponíveis (vêm do server, lidas de src/content/tags/) */
  tags?: TagOption[];
  /** 'create' (padrão) ou 'edit'. No modo edit o slug é travado e o post existente é reescrito. */
  mode?: 'create' | 'edit';
  /** Slug do artigo sendo editado (obrigatório no modo edit). */
  slug?: string;
  /** Valores iniciais para pré-preencher o editor no modo edit. */
  initial?: InitialValues;
};

type Snapshot = {
  title: string;
  dek: string;
  categories: string[];
  date: string;
  readTime: string;
  linhaFina: string;
  linhaFinaLabel: string;
  notas: string[];
  bodyHtml: string;
  heroImage: string;
  heroCaption: string;
  heroPosX: number;
  heroPosY: number;
  heroZoom: number;
  savedAt: number;
};

/** "50% 30%" → {x:50,y:30}; valores ausentes/ruins caem no centro (50). */
function parseHeroPosition(pos?: string): { x: number; y: number } {
  if (!pos) return { x: 50, y: 50 };
  const m = pos.match(/(-?\d+(?:\.\d+)?)%?\s+(-?\d+(?:\.\d+)?)%?/);
  if (!m) return { x: 50, y: 50 };
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  return { x: clamp(Number(m[1])), y: clamp(Number(m[2])) };
}

const clampPct = (n: number) => Math.min(100, Math.max(0, n));
const clampZoom = (n: number) => Math.min(3, Math.max(1, n));

function loadDraft(): Snapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

function saveDraft(s: Omit<Snapshot, 'savedAt'>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, savedAt: Date.now() }));
  } catch {}
}

function clearDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      className={className}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
    />
  );
}

export default function ArticleEditor({
  authorName = 'João Andrade',
  cloudinary,
  tags = [],
  mode = 'create',
  slug,
  initial,
}: Props) {
  const isEdit = mode === 'edit';
  const [title, setTitle] = useState(initial?.title ?? '');
  const [dek, setDek] = useState(initial?.dek ?? '');
  const [categories, setCategories] = useState<string[]>(initial?.categories ?? []);
  const [date, setDate] = useState(initial?.date || todayISO());
  const [readTime, setReadTime] = useState(initial?.readTime || '5 min');
  const [linhaFina, setLinhaFina] = useState(initial?.linhaFina ?? '');
  const [linhaFinaLabel, setLinhaFinaLabel] = useState(initial?.linhaFinaLabel ?? 'Linha-fina');
  const [showLinhaFina, setShowLinhaFina] = useState(!!initial?.linhaFina);
  const [notas, setNotas] = useState<string[]>(initial?.notas ?? []);
  const [bodyHtml, setBodyHtml] = useState(initial?.bodyHtml ?? '');
  const [heroImage, setHeroImage] = useState(initial?.heroImage ?? '');
  const [heroCaption, setHeroCaption] = useState(initial?.heroCaption ?? '');
  const [heroPosX, setHeroPosX] = useState(parseHeroPosition(initial?.heroPosition).x);
  const [heroPosY, setHeroPosY] = useState(parseHeroPosition(initial?.heroPosition).y);
  const [heroZoom, setHeroZoom] = useState(initial?.heroZoom ?? 1);
  const [heroUploading, setHeroUploading] = useState(false);
  const heroInputRef = useRef<HTMLInputElement | null>(null);
  const heroFigureRef = useRef<HTMLElement | null>(null);
  const heroZoomRef = useRef(heroZoom);
  heroZoomRef.current = heroZoom;
  const heroDragRef = useRef({ active: false, startX: 0, startY: 0, baseX: 50, baseY: 50 });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saved' | 'pending'>('idle');
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const initialMountedRef = useRef(false);
  const editorRef = useRef<Editor | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Restore from localStorage on mount (só no modo create — edição parte do conteúdo real)
  useEffect(() => {
    if (isEdit) {
      initialMountedRef.current = true;
      setEditorReady(true);
      return;
    }
    const draft = loadDraft();
    if (draft && (draft.title || draft.bodyHtml || draft.dek)) {
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
        setLinhaFina(draft.linhaFina || '');
        setLinhaFinaLabel(draft.linhaFinaLabel ?? 'Linha-fina');
        setShowLinhaFina(!!draft.linhaFina);
        setNotas(draft.notas || []);
        setBodyHtml(draft.bodyHtml);
        setHeroImage(draft.heroImage || '');
        setHeroCaption(draft.heroCaption || '');
        setHeroPosX(typeof draft.heroPosX === 'number' ? draft.heroPosX : 50);
        setHeroPosY(typeof draft.heroPosY === 'number' ? draft.heroPosY : 50);
        setHeroZoom(typeof draft.heroZoom === 'number' ? draft.heroZoom : 1);
        setRestoredFromDraft(true);
      } else {
        clearDraft();
      }
    }
    initialMountedRef.current = true;
    setEditorReady(true);
  }, []);

  // Auto-save (debounced) — só no modo create
  useEffect(() => {
    if (isEdit) return;
    if (!initialMountedRef.current) return;
    if (!title && !bodyHtml && !dek) return;
    setAutosaveStatus('pending');
    const t = setTimeout(() => {
      saveDraft({ title, dek, categories, date, readTime, linhaFina, linhaFinaLabel, notas, bodyHtml, heroImage, heroCaption, heroPosX, heroPosY, heroZoom });
      setAutosaveStatus('saved');
    }, 1500);
    return () => clearTimeout(t);
  }, [title, dek, categories, date, readTime, linhaFina, linhaFinaLabel, notas, bodyHtml, heroImage, heroCaption, heroPosX, heroPosY, heroZoom]);

  // beforeunload
  useEffect(() => {
    const hasContent = title.trim() || bodyHtml.trim() || dek.trim();
    if (!hasContent) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [title, bodyHtml, dek]);

  const toggleCategory = (value: string) => {
    setCategories((cur) => (cur.includes(value) ? cur.filter((c) => c !== value) : [...cur, value]));
  };

  const renumberSupsInBody = (deletedIdx: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = editor.getHTML();
    const newHtml = html.replace(/<sup>(\d+)<\/sup>/g, (_match, n: string) => {
      const num = parseInt(n, 10);
      if (num === deletedIdx + 1) return ''; // remove orphaned sup
      if (num > deletedIdx + 1) return `<sup>${num - 1}</sup>`;
      return `<sup>${num}</sup>`;
    });
    if (newHtml !== html) {
      editor.commands.setContent(newHtml);
    }
  };

  const removeNotaAt = (idx: number) => {
    renumberSupsInBody(idx);
    setNotas((cur) => cur.filter((_, j) => j !== idx));
  };

  const triggerImageUpload = () => fileInputRef.current?.click();

  const insertTable = (rows: number, cols: number) => {
    if (!editorRef.current) return;
    editorRef.current
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run();
  };

  const insertChart = (html: string) => {
    if (!editorRef.current) return;
    editorRef.current
      .chain()
      .focus()
      .insertContent({ type: 'chart', attrs: { html } })
      .run();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editorRef.current) return;
    if (!cloudinary?.cloudName || !cloudinary?.uploadPreset) {
      alert('Cloudinary não configurado nas env vars do Vercel.');
      return;
    }
    setUploading(true);
    try {
      const { uploadToCloudinary } = await import('../lib/cloudinary');
      const url = await uploadToCloudinary(file, cloudinary);
      editorRef.current.chain().focus().setImage({ src: url }).run();
    } catch (err: any) {
      alert(`Upload falhou: ${err?.message ?? err}`);
    } finally {
      setUploading(false);
    }
  };

  const triggerHeroUpload = () => heroInputRef.current?.click();

  const handleHeroSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!cloudinary?.cloudName || !cloudinary?.uploadPreset) {
      alert('Cloudinary não configurado nas env vars do Vercel.');
      return;
    }
    setHeroUploading(true);
    try {
      const { uploadToCloudinary } = await import('../lib/cloudinary');
      const url = await uploadToCloudinary(file, cloudinary);
      setHeroImage(url);
    } catch (err: any) {
      alert(`Upload da capa falhou: ${err?.message ?? err}`);
    } finally {
      setHeroUploading(false);
    }
  };

  // Arrastar a capa (clique/dedo) pra reposicionar o foco dentro da moldura.
  const onHeroPointerDown = (e: React.PointerEvent) => {
    if (!heroImage) return;
    e.preventDefault();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    heroDragRef.current = { active: true, startX: e.clientX, startY: e.clientY, baseX: heroPosX, baseY: heroPosY };
  };
  const onHeroPointerMove = (e: React.PointerEvent) => {
    const d = heroDragRef.current;
    if (!d.active || !heroFigureRef.current) return;
    const rect = heroFigureRef.current.getBoundingClientRect();
    const z = heroZoomRef.current || 1;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    // arrastar a foto pra direita revela mais o lado esquerdo → diminui X
    setHeroPosX(clampPct(d.baseX - (dx / (rect.width * z)) * 100));
    setHeroPosY(clampPct(d.baseY - (dy / (rect.height * z)) * 100));
  };
  const endHeroDrag = () => { heroDragRef.current.active = false; };

  // Pinça do trackpad (Mac) chega como wheel + ctrlKey — vira zoom da capa.
  useEffect(() => {
    const el = heroFigureRef.current;
    if (!el || !heroImage) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // só pinça; scroll normal passa direto
      e.preventDefault();
      setHeroZoom((z) => clampZoom(z - e.deltaY * 0.01));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [heroImage]);

  const insertFootnote = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const n = notas.length + 1;
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'text',
        text: String(n),
        marks: [{ type: 'superscript' }],
      })
      .unsetMark('superscript')
      .run();
    setNotas((cur) => [...cur, '']);
    requestAnimationFrame(() => {
      const target = document.getElementById(`nota-edit-${n}`);
      target?.focus();
    });
  };

  const submit = async (draft: boolean) => {
    setError(null);
    setSubmitting(true);
    try {
      const endpoint = isEdit ? '/api/posts/update' : '/api/posts/create';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: isEdit ? slug : undefined,
          title,
          dek,
          categories,
          date,
          readTime,
          draft,
          bodyHtml,
          heroImage: heroImage.trim() || undefined,
          heroCaption: heroImage.trim() && heroCaption.trim() ? heroCaption.trim() : undefined,
          heroPosition: heroImage.trim() ? `${Math.round(heroPosX)}% ${Math.round(heroPosY)}%` : undefined,
          heroZoom: heroImage.trim() ? Number(heroZoom.toFixed(2)) : undefined,
          linhaFina: showLinhaFina && linhaFina.trim() ? linhaFina : undefined,
          linhaFinaLabel: showLinhaFina && linhaFina.trim() ? linhaFinaLabel.trim() : undefined,
          notas: notas.filter((n) => n.trim()).length ? notas.filter((n) => n.trim()) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Erro ${res.status}`);
        return;
      }
      if (!isEdit) clearDraft();
      const verb = isEdit
        ? (draft ? 'Alterações salvas como rascunho' : 'Alterações publicadas')
        : (draft ? 'Rascunho salvo' : 'Publicado');
      alert(`${verb}!\nO Vercel está rebuildando — em ~1 min a mudança estará no ar.\nSlug: ${data.slug}`);
      window.location.href = '/admin';
    } catch (err: any) {
      setError(err.message ?? 'Erro inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  const hasAnyContent = !!(title.trim() || dek.trim() || bodyHtml.trim());
  const canSaveDraft = hasAnyContent && !submitting;
  const canPublish =
    title.trim() && dek.trim() && categories.length > 0 && bodyHtml.trim() && !submitting;

  const dateBR = formatDateBR(date);

  return (
    <>
      <style>{`
        /* === sticky admin bar === */
        .ed-stickybar{
          position:sticky; top:0; z-index:50;
          background:rgba(249,249,246,.94);
          backdrop-filter: saturate(180%) blur(6px);
          border-bottom:1px solid var(--rule);
          padding: 10px 24px;
          display:flex; align-items:center; justify-content:space-between; gap:12px;
          font-family: var(--mono); font-size: 12px;
        }
        .ed-stickybar .left{ display:flex; align-items:center; gap:14px; color:var(--ink-3); }
        .ed-stickybar a.back{ color:var(--ink-3); text-decoration:none; }
        .ed-stickybar a.back:hover{ color:var(--ink); }
        .ed-status.saved{ color:#2c7a4d; }
        .ed-status.pending{ color:#b87b22; }
        .ed-stickybar .right{ display:flex; gap:8px; align-items:center; }
        .ed-btn{
          padding: 8px 16px; border:none; border-radius:4px; font-size:12px;
          font-weight:600; cursor:pointer; transition: opacity .12s, background .12s;
          font-family: var(--mono); letter-spacing:.06em; text-transform:uppercase;
        }
        .ed-btn:disabled{ opacity:.4; cursor:not-allowed; }
        .ed-btn-secondary{ background:#e8e3d6; color:var(--ink-2); }
        .ed-btn-secondary:hover:not(:disabled){ background:#dcd5c2; }
        .ed-btn-primary{ background:var(--terra); color:#fff; }
        .ed-btn-primary:hover:not(:disabled){ background:var(--terra-deep); }

        /* === insert tools toolbar === */
        .ed-tools{
          display:flex; align-items:center; gap:8px;
          padding: 8px 24px;
          border-bottom: 1px solid var(--rule);
          font-family: var(--mono); font-size: 11px; color: var(--ink-3);
        }
        .ed-tools .lbl{ letter-spacing:.14em; text-transform:uppercase; }
        .ed-tools button{
          background:transparent; border:1px solid var(--rule-strong);
          color: var(--ink-2); padding: 4px 10px; border-radius:3px;
          cursor:pointer; font-family: var(--mono); font-size: 11px;
          transition: background .12s, color .12s, border-color .12s;
        }
        .ed-tools button:hover{ background: var(--ink); color:#fff; border-color: var(--ink); }
        .ed-tools button.on{ background: var(--terra); color:#fff; border-color: var(--terra); }

        .ed-restored{
          margin: 14px auto 0; max-width: 920px;
          padding:8px 16px; background:#fff7e0; border:1px solid #f0d97a;
          border-radius:4px; font-size:13px; color:#7a5a10; font-family: var(--serif);
        }
        .ed-error{
          margin: 14px auto 0; max-width: 920px;
          padding:10px 14px; background:#fee; border:1px solid #fbb;
          border-radius:4px; color:#900; font-size:13px; font-family: var(--serif);
        }

        /* === inline editable styles === */
        .ed-tags{
          display:flex; flex-wrap:wrap; gap:6px;
          margin-bottom:14px;
        }
        .ed-tags .tag{
          cursor:pointer; user-select:none;
          opacity:.35; transition: opacity .12s, transform .08s;
        }
        .ed-tags .tag.on{ opacity: 1; }
        .ed-tags .tag:hover{ transform: translateY(-1px); }

        textarea.ed-h1{
          width:100%; resize:none; border:none; outline:none; padding:0; background:transparent;
          font-family:var(--serif); font-weight:700;
          font-variation-settings:"opsz" 60;
          font-size:64px; line-height:1.04; letter-spacing:-.02em;
          color:#000; overflow:hidden; box-sizing: border-box; display: block;
        }
        textarea.ed-h1::placeholder{ color:#bbb; font-style: italic; font-weight: 500; }
        @media (max-width:980px){ textarea.ed-h1{ font-size:48px; } }
        @media (max-width:760px){ textarea.ed-h1{ font-size:38px; } }

        textarea.ed-dek{
          width:100%; resize:none; border:none; outline:none; padding:0; background:transparent;
          margin-top:24px;
          font-family:var(--serif); font-style:italic;
          font-size:22px; line-height:1.35; color:var(--ink-2); font-weight:400;
          overflow:hidden; box-sizing: border-box; display: block;
        }
        textarea.ed-dek::placeholder{ color:#bbb; }
        @media (max-width:980px){ textarea.ed-dek{ font-size:20px; } }

        /* admin meta panel */
        .ed-meta-panel{
          margin-top: 14px;
          padding: 10px 14px;
          background: #f6f3eb;
          border: 1px dashed var(--rule-strong);
          border-radius: 4px;
          display: flex; flex-wrap: wrap; gap: 14px;
          font-family: var(--mono); font-size: 11px;
          color: var(--ink-3);
        }
        .ed-meta-panel label{ display:flex; align-items:center; gap:6px; }
        .ed-meta-panel input{
          font-family: var(--mono); font-size: 12px;
          padding: 3px 6px; border:1px solid var(--rule-strong);
          background:#fff; border-radius:3px; color: var(--ink);
        }

        /* linha-fina label editing */
        .art-body .linha-fina .ed-linhafina-label{
          font-family:var(--mono); font-size:10.5px;
          letter-spacing:.16em; text-transform:uppercase; color:var(--ink-3);
          background: transparent; border: none; outline: none; padding: 0;
          margin-bottom: 10px; width: 220px;
        }
        .art-body .linha-fina .ed-linhafina-label::placeholder{ color:#ccc; }

        /* linha-fina value editing — width:100% sem balance */
        .art-body .linha-fina .ed-linhafina{
          width:100%; resize:none; border:none; outline:none; padding:0; background:transparent;
          font-family:var(--serif); font-style:italic;
          font-size:26px; line-height:1.3; color:#000;
          overflow:hidden; box-sizing: border-box; display: block;
          /* NOTA: text-wrap:balance removido aqui — atrapalha o feedback visual da edição */
        }
        .art-body .linha-fina .ed-linhafina::placeholder{ color:#bbb; }
        @media (max-width:760px){
          .art-body .linha-fina .ed-linhafina{ font-size:21px; }
        }
        .art-body .linha-fina .ed-linhafina-actions{
          display:flex; justify-content:flex-end; margin-top:4px;
        }
        .art-body .linha-fina .ed-linhafina-actions button{
          background:none; border:none; color: var(--ink-3);
          font-family: var(--mono); font-size:10px; letter-spacing:.12em;
          text-transform: uppercase; cursor: pointer; padding:0;
        }
        .art-body .linha-fina .ed-linhafina-actions button:hover{ color: var(--terra-deep); }

        /* notas editing */
        .art-body .notas .ed-nota-row{
          display:flex; align-items:flex-start; gap:8px;
        }
        .art-body .notas .ed-nota-row textarea{
          flex:1; resize:none; border:none; outline:none; background:transparent;
          font-family:var(--serif); font-size:16px; line-height:1.5; color:var(--ink-2);
          padding:0; overflow:hidden; box-sizing: border-box;
        }
        .art-body .notas .ed-nota-row textarea::placeholder{ color:#bbb; font-style: italic; }
        .art-body .notas .ed-nota-row button.del{
          background:none; border:none; color: var(--ink-3);
          cursor: pointer; font-size: 14px; padding: 0 4px;
        }
        .art-body .notas .ed-nota-row button.del:hover{ color: #b00; }

        /* sup styling no editor — visualmente igual ao publicado */
        .art-body .col sup{
          color: var(--terra);
          font-weight: 600;
          padding: 0 1px;
        }

        .art-body .col.ProseMirror{ caret-color: var(--terra); }
      `}</style>

      <div className="ed-stickybar">
        <div className="left">
          <a className="back" href="/admin">← dashboard</a>
          <span className={`ed-status ${autosaveStatus}`}>
            {isEdit ? (
              <>editando: <em>{slug}</em></>
            ) : (
              <>
                {autosaveStatus === 'pending' && 'salvando…'}
                {autosaveStatus === 'saved' && '✓ salvo localmente'}
                {autosaveStatus === 'idle' && (
                  canPublish
                    ? 'pronto pra publicar'
                    : canSaveDraft
                      ? 'rascunho ok (faltam campos pra publicar)'
                      : 'comece a escrever'
                )}
              </>
            )}
          </span>
        </div>
        <div className="right">
          <button
            type="button"
            className="ed-btn ed-btn-secondary"
            disabled={!canSaveDraft}
            onClick={() => submit(true)}
          >
            {isEdit ? 'Despublicar (rascunho)' : 'Salvar rascunho'}
          </button>
          <button
            type="button"
            className="ed-btn ed-btn-primary"
            disabled={!canPublish}
            onClick={() => submit(false)}
          >
            {submitting
              ? (isEdit ? 'Salvando…' : 'Publicando…')
              : (isEdit ? 'Salvar alterações' : 'Publicar')}
          </button>
        </div>
      </div>

      <div className="ed-tools">
        <span className="lbl">Inserir:</span>
        <button
          type="button"
          className={showLinhaFina ? 'on' : ''}
          onClick={() => setShowLinhaFina((v) => !v)}
        >
          {showLinhaFina ? '✓ Linha-fina' : '+ Linha-fina'}
        </button>
        <button type="button" onClick={insertFootnote} title="Inserir nota numerada na posição do cursor">
          + Nota (no cursor)
        </button>
        <button type="button" onClick={triggerImageUpload} disabled={uploading} title="Subir imagem (ou cole/arraste no editor)">
          {uploading ? '⏳ subindo…' : '+ Imagem'}
        </button>
        <div style={{ position: 'relative' }}>
          <button type="button" onClick={() => setShowTablePicker((v) => !v)} title="Inserir tabela (escolha tamanho)">
            + Tabela
          </button>
          {showTablePicker && (
            <TableGridPicker
              onSelect={(r, c) => insertTable(r, c)}
              onClose={() => setShowTablePicker(false)}
            />
          )}
        </div>
        <button type="button" onClick={() => setShowChartModal(true)} title="Inserir gráfico (cole SVG/HTML que o Claude gerou pra você)">
          + Gráfico
        </button>
        <ChartModal
          open={showChartModal}
          onClose={() => setShowChartModal(false)}
          onInsert={insertChart}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelected}
          style={{ display: 'none' }}
        />
        <span style={{ marginLeft: 'auto', opacity: 0.6 }}>
          (selecione texto pra B/I/link/H2/quote · arraste/cole imagens direto · clica numa célula pra ver controles da tabela)
        </span>
      </div>

      {restoredFromDraft && (
        <div className="ed-restored">✓ Rascunho restaurado do navegador.</div>
      )}
      {error && <div className="ed-error">{error}</div>}

      {/* ========= ARTICLE HEADER ========= */}
      <header className="art-hd">
        <div className="ed-tags tags">
          {tags.length === 0 ? (
            <span style={{ fontSize: 12, color: '#888', fontFamily: 'ui-monospace, monospace' }}>
              nenhuma tag definida ainda. crie em <a href="/admin/tags/novo" style={{ color: 'var(--terra)' }}>/admin/tags/novo</a>
            </span>
          ) : (
            tags.map((cat) => {
              const isOn = categories.includes(cat.value);
              const styleAttr = isOn && cat.color
                ? { background: cat.color, color: cat.textColor ?? '#000' }
                : undefined;
              return (
                <span
                  key={cat.value}
                  className={`tag ${isOn ? 'on' : ''}`}
                  style={styleAttr}
                  onClick={() => toggleCategory(cat.value)}
                  title={isOn ? 'Remover categoria' : 'Adicionar categoria'}
                >
                  {cat.label}
                </span>
              );
            })
          )}
        </div>
        <div className="rule"></div>

        <AutoTextarea
          className="ed-h1"
          value={title}
          onChange={setTitle}
          placeholder="Título do artigo…"
          ariaLabel="Título"
        />

        <AutoTextarea
          className="ed-dek"
          value={dek}
          onChange={setDek}
          placeholder="Subtítulo / dek (italics com *asteriscos*)…"
          ariaLabel="Subtítulo"
        />

        <div className="byline">
          <span className="bit byline-author">
            <span className="by-author">
              <img
                src="/assets/joao-andrade-48.jpg"
                alt=""
                width={24}
                height={24}
                style={{ borderRadius: '50%' }}
              />
              por <span>{authorName}</span>
            </span>
          </span>
          <span className="sep">·</span>
          <span className="bit">{dateBR || 'data ?'}</span>
          <span className="sep">·</span>
          <span className="bit">{readTime || '? min'}</span>
        </div>

        <div className="ed-meta-panel">
          <label>
            data:
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            tempo de leitura:
            <input
              type="text"
              value={readTime}
              onChange={(e) => setReadTime(e.target.value)}
              placeholder="ex: 8 min"
              style={{ width: 80 }}
            />
          </label>
        </div>
      </header>

      {/* ========= HERO IMAGE (capa do artigo) ========= */}
      <div className="art-hero">
        <figure
          ref={heroFigureRef as React.RefObject<HTMLElement>}
          onPointerDown={onHeroPointerDown}
          onPointerMove={onHeroPointerMove}
          onPointerUp={endHeroDrag}
          onPointerCancel={endHeroDrag}
          style={heroImage ? { cursor: 'grab', touchAction: 'none', userSelect: 'none' } : undefined}
        >
          {heroImage ? (
            <img
              src={heroImage}
              alt={heroCaption || 'Capa do artigo'}
              draggable={false}
              style={{
                objectPosition: `${heroPosX}% ${heroPosY}%`,
                transform: `scale(${heroZoom})`,
                transformOrigin: `${heroPosX}% ${heroPosY}%`,
                pointerEvents: 'none',
              }}
            />
          ) : (
            <button
              type="button"
              className="ph"
              onClick={triggerHeroUpload}
              disabled={heroUploading}
              style={{ border: 'none', cursor: heroUploading ? 'wait' : 'pointer' }}
            >
              {heroUploading ? '⏳ subindo capa…' : '+ imagem de capa · clique para subir'}
            </button>
          )}
        </figure>
        {heroImage && (
          <>
            {/* Enquadramento dentro da moldura fixa: foco + zoom */}
            <div className="hero-frame-ctl" style={{
              marginTop: 12, padding: '14px 16px',
              border: '1px solid var(--rule)', borderRadius: 4,
              display: 'grid', gap: 10,
              fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--ink-2)',
            }}>
              <p style={{ margin: 0, fontSize: 12, fontStyle: 'italic', color: 'var(--ink-3)' }}>
                Arraste a imagem para reposicionar · pince com dois dedos no trackpad para dar zoom — ou use os controles abaixo.
              </p>
              <label style={{ display: 'grid', gridTemplateColumns: '92px 1fr', alignItems: 'center', gap: 12 }}>
                <span>Vertical</span>
                <input type="range" min={0} max={100} step={1} value={heroPosY}
                  onChange={(e) => setHeroPosY(Number(e.target.value))}
                  aria-label="Enquadramento vertical (topo ↔ base)" />
              </label>
              <label style={{ display: 'grid', gridTemplateColumns: '92px 1fr', alignItems: 'center', gap: 12 }}>
                <span>Horizontal</span>
                <input type="range" min={0} max={100} step={1} value={heroPosX}
                  onChange={(e) => setHeroPosX(Number(e.target.value))}
                  aria-label="Enquadramento horizontal (esquerda ↔ direita)" />
              </label>
              <label style={{ display: 'grid', gridTemplateColumns: '92px 1fr', alignItems: 'center', gap: 12 }}>
                <span>Zoom {heroZoom.toFixed(2)}×</span>
                <input type="range" min={1} max={3} step={0.05} value={heroZoom}
                  onChange={(e) => setHeroZoom(Number(e.target.value))}
                  aria-label="Zoom da capa" />
              </label>
              <button type="button"
                onClick={() => { setHeroPosX(50); setHeroPosY(50); setHeroZoom(1); }}
                style={{ justifySelf: 'start', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--serif)', fontSize: 12, color: 'var(--ink-3)', textDecoration: 'underline', padding: 0 }}>
                ↺ centralizar e tirar zoom
              </button>
            </div>
            <input
              type="text"
              value={heroCaption}
              onChange={(e) => setHeroCaption(e.target.value)}
              placeholder="Legenda da capa (opcional)…"
              aria-label="Legenda da capa"
              style={{
                width: '100%', marginTop: 12, padding: '6px 0',
                border: 'none', borderBottom: '1px solid var(--rule)',
                background: 'transparent', fontFamily: 'var(--serif)',
                fontSize: 15, color: 'var(--ink-2)', textAlign: 'center',
              }}
            />
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 10 }}>
              <button type="button" onClick={triggerHeroUpload} disabled={heroUploading}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--ink-3)', textDecoration: 'underline' }}>
                {heroUploading ? '⏳ subindo…' : '↻ trocar capa'}
              </button>
              <button type="button" onClick={() => { setHeroImage(''); setHeroCaption(''); setHeroPosX(50); setHeroPosY(50); setHeroZoom(1); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--ink-3)', textDecoration: 'underline' }}>
                × remover capa
              </button>
            </div>
          </>
        )}
        <input ref={heroInputRef} type="file" accept="image/*" onChange={handleHeroSelected} style={{ display: 'none' }} />
      </div>

      {/* ========= BODY ========= */}
      <section className="art-body">
        {showLinhaFina && (
          <aside className="linha-fina">
            <input
              type="text"
              className="ed-linhafina-label"
              value={linhaFinaLabel}
              onChange={(e) => setLinhaFinaLabel(e.target.value)}
              placeholder="(rótulo opcional — apague pra esconder)"
              aria-label="Rótulo da linha-fina"
            />
            <AutoTextarea
              className="ed-linhafina"
              value={linhaFina}
              onChange={setLinhaFina}
              placeholder="Frase-âncora em itálico (use *asteriscos* pra mais ênfase)…"
              ariaLabel="Linha-fina"
            />
            <div className="ed-linhafina-actions">
              <button type="button" onClick={() => { setLinhaFina(''); setShowLinhaFina(false); }}>
                remover
              </button>
            </div>
          </aside>
        )}

        {editorReady && (
          <PostEditor
            initialHtml={bodyHtml}
            onChange={setBodyHtml}
            onEditorReady={(ed) => { editorRef.current = ed; }}
            placeholder="Comece a escrever…"
            contentClassName="col"
            cloudinary={cloudinary}
            onUploadStart={() => setUploading(true)}
            onUploadEnd={() => setUploading(false)}
          />
        )}

        {notas.length > 0 && (
          <aside className="notas">
            <div className="label">Notas</div>
            <ol>
              {notas.map((nota, i) => (
                <li key={i}>
                  <div className="ed-nota-row">
                    <textarea
                      id={`nota-edit-${i + 1}`}
                      ref={(el) => {
                        if (el) {
                          el.style.height = 'auto';
                          el.style.height = el.scrollHeight + 'px';
                        }
                      }}
                      value={nota}
                      onChange={(e) =>
                        setNotas((cur) => cur.map((n, j) => (j === i ? e.target.value : n)))
                      }
                      placeholder="Texto da nota (use *asteriscos* pra itálico)…"
                      aria-label={`Nota ${i + 1}`}
                      rows={1}
                    />
                    <button
                      type="button"
                      className="del"
                      title="Remover nota (e renumerar os sups no corpo)"
                      onClick={() => removeNotaAt(i)}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        )}
      </section>
    </>
  );
}
