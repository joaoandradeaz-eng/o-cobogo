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

type Props = {
  authorName?: string;
  cloudinary?: { cloudName: string; uploadPreset: string };
  /** Tags disponíveis (vêm do server, lidas de src/content/tags/) */
  tags?: TagOption[];
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
  savedAt: number;
};

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

export default function ArticleEditor({ authorName = 'João Andrade', cloudinary, tags = [] }: Props) {
  const [title, setTitle] = useState('');
  const [dek, setDek] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [date, setDate] = useState(todayISO());
  const [readTime, setReadTime] = useState('5 min');
  const [linhaFina, setLinhaFina] = useState('');
  const [linhaFinaLabel, setLinhaFinaLabel] = useState('Linha-fina');
  const [showLinhaFina, setShowLinhaFina] = useState(false);
  const [notas, setNotas] = useState<string[]>([]);
  const [bodyHtml, setBodyHtml] = useState('');

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

  // Restore from localStorage on mount
  useEffect(() => {
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
        setRestoredFromDraft(true);
      } else {
        clearDraft();
      }
    }
    initialMountedRef.current = true;
    setEditorReady(true);
  }, []);

  // Auto-save (debounced)
  useEffect(() => {
    if (!initialMountedRef.current) return;
    if (!title && !bodyHtml && !dek) return;
    setAutosaveStatus('pending');
    const t = setTimeout(() => {
      saveDraft({ title, dek, categories, date, readTime, linhaFina, linhaFinaLabel, notas, bodyHtml });
      setAutosaveStatus('saved');
    }, 1500);
    return () => clearTimeout(t);
  }, [title, dek, categories, date, readTime, linhaFina, linhaFinaLabel, notas, bodyHtml]);

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
      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          dek,
          categories,
          date,
          readTime,
          draft,
          bodyHtml,
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
      clearDraft();
      const verb = draft ? 'Rascunho salvo' : 'Publicado';
      alert(`${verb}!\nO Vercel está rebuildando — em ~1 min seu post estará no ar.\nSlug: ${data.slug}`);
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
            {autosaveStatus === 'pending' && 'salvando…'}
            {autosaveStatus === 'saved' && '✓ salvo localmente'}
            {autosaveStatus === 'idle' && (
              canPublish
                ? 'pronto pra publicar'
                : canSaveDraft
                  ? 'rascunho ok (faltam campos pra publicar)'
                  : 'comece a escrever'
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
            Salvar rascunho
          </button>
          <button
            type="button"
            className="ed-btn ed-btn-primary"
            disabled={!canPublish}
            onClick={() => submit(false)}
          >
            {submitting ? 'Publicando…' : 'Publicar'}
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

      {/* ========= HERO IMAGE (placeholder Phase 5) ========= */}
      <div className="art-hero">
        <figure>
          <div className="ph">imagem · placeholder · upload na fase 5</div>
        </figure>
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
