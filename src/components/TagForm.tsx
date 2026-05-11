import { useEffect, useRef, useState } from 'react';

type TagFormProps = {
  mode: 'create' | 'edit';
  initial?: {
    slug: string;
    name: string;
    color: string;
    textColor: string;
    parent: string | null;
    description: string;
    piece: string;
    order: number;
  };
  /** Outras tags pra dropdown de parent (não inclui a tag sendo editada) */
  availableParents: Array<{ slug: string; name: string; parent: string | null }>;
  /** Cobogó symbols inline pra preview do piece. Renderizado pelo parent .astro. */
};

const PIECES = [
  { value: 'grade', label: 'Grade' },
  { value: 'circulos', label: 'Círculos' },
  { value: 'labirinto', label: 'Labirinto' },
  { value: 'flor', label: 'Flor' },
  { value: 'octogonos', label: 'Octógonos' },
  { value: 'estrelas', label: 'Estrelas' },
  { value: 'barroca', label: 'Barroca' },
];

const PALETTE_BG = [
  '#E5C9B0', '#D4C9B4', '#E8D7C5', '#D9DCD0',
  '#1B1612', '#8C3F12', '#5C5A56', '#1A1A1A',
  '#C73838', '#3A6B47', '#2B3F6E', '#E8A945',
];

const PALETTE_TEXT = [
  '#1B1612', '#3A322A', '#6B6055', '#5A3922',
  '#8C3F12', '#3F4838', '#3F2E18', '#1A1A1A',
  '#f9f9f6', '#FFFFFF', '#E5C9B0', '#E8A945',
];

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function SwatchPicker({
  label,
  value,
  onChange,
  swatches,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  swatches: string[];
}) {
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', color: '#666', marginBottom: 6 }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c}
            style={{
              width: 26, height: 26, borderRadius: 3,
              background: c, cursor: 'pointer',
              border: value.toLowerCase() === c.toLowerCase() ? '2px solid #000' : '1px solid #bbb',
            }}
          />
        ))}
      </div>
      <input
        type="text"
        value={hex}
        onChange={(e) => setHex(e.target.value)}
        onBlur={() => {
          if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(hex.trim())) {
            onChange(hex.trim());
          } else {
            setHex(value);
          }
        }}
        placeholder="#RRGGBB"
        style={{
          fontSize: 12, padding: '4px 8px', border: '1px solid #ccc',
          borderRadius: 3, fontFamily: 'ui-monospace, monospace', width: 110,
        }}
      />
    </div>
  );
}

export default function TagForm({ mode, initial, availableParents }: TagFormProps) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [color, setColor] = useState(initial?.color ?? '#E5C9B0');
  const [textColor, setTextColor] = useState(initial?.textColor ?? '#8C3F12');
  const [parent, setParent] = useState<string>(initial?.parent ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [piece, setPiece] = useState(initial?.piece ?? 'grade');
  const [order, setOrder] = useState<number>(initial?.order ?? 100);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRebadge, setPendingRebadge] = useState<{ affected: Array<{ id: string; title: string }>; count: number } | null>(null);

  // auto-slug do nome em create mode (até o usuário editar slug manualmente)
  useEffect(() => {
    if (!isEdit && !slugManuallyEdited) {
      setSlug(slugify(name));
    }
  }, [name, isEdit, slugManuallyEdited]);

  const slugChanged = isEdit && initial && slug !== initial.slug;

  const submit = async (forceRebadge = false) => {
    setError(null);
    setSubmitting(true);
    try {
      const body = {
        name: name.trim(),
        slug: slug.trim(),
        color: color.trim(),
        textColor: textColor.trim(),
        parent: parent.trim() || null,
        description: description.trim(),
        piece,
        order: Number(order),
        forceRebadge,
      };
      const url = isEdit
        ? `/api/tags/update/${encodeURIComponent(initial!.slug)}`
        : '/api/tags/create';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'rename_requires_rebadge') {
          setPendingRebadge({ affected: data.affected, count: data.count });
          return;
        }
        setError(data.error ?? `Erro ${res.status}`);
        return;
      }
      const verb = isEdit ? 'Tag atualizada' : 'Tag criada';
      const extras = data.rebadged ? `\n${data.rebadged} artigo(s) re-tagueado(s).` : '';
      alert(`${verb}!${extras}\nVercel está rebuildando — em ~1 min as mudanças entram no ar.`);
      window.location.href = '/admin/tags';
    } catch (err: any) {
      setError(err.message ?? 'erro inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtra parents (nunca pode ser ela mesma, nem uma child dela — limitamos a 1 nível)
  const validParents = availableParents.filter((p) => {
    if (isEdit && initial && p.slug === initial.slug) return false; // não ser a própria
    if (p.parent !== null) return false; // só tags de topo podem ser parent (1 nível)
    return true;
  });

  const canSubmit = name.trim() && slug.trim() && color && textColor && !submitting;

  return (
    <>
      <style>{`
        .tf-grid { display:grid; grid-template-columns: 1fr 1fr; gap:24px; }
        @media (max-width:760px){ .tf-grid { grid-template-columns: 1fr; } }
        .tf-field { margin-bottom: 16px; }
        .tf-field label { display:block; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.1em; color:#666; margin-bottom:6px; }
        .tf-field input[type=text], .tf-field input[type=number], .tf-field select, .tf-field textarea {
          width:100%; padding:8px 10px; border:1px solid #ccc; border-radius:4px;
          font-size:14px; font-family:inherit; background:#fff;
          box-sizing: border-box;
        }
        .tf-field textarea { min-height: 60px; resize: vertical; }
        .tf-field-row { display:flex; gap:8px; align-items:flex-end; }
        .tf-preview {
          display:inline-block; padding:5px 10px; border-radius:2px;
          font-family: ui-monospace, monospace; font-size:10px; font-weight:600;
          letter-spacing:.16em; text-transform:uppercase;
        }
        .tf-btn { padding:10px 18px; border:none; border-radius:4px; font-weight:600; cursor:pointer; }
        .tf-btn:disabled { opacity:.4; cursor:not-allowed; }
        .tf-btn-primary { background:#d88854; color:#fff; }
        .tf-btn-secondary { background:#eee; color:#333; }
        .tf-error { padding:10px 14px; background:#fee; border:1px solid #fbb; border-radius:4px; color:#900; font-size:13px; margin-bottom:14px; }
        .tf-warn { padding:12px 16px; background:#fef3c7; border:1px solid #f59e0b; border-radius:4px; color:#92400e; font-size:13px; margin-bottom:14px; }
        .tf-piece-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:6px; }
        .tf-piece-grid button { aspect-ratio:1; border:2px solid transparent; background:#f5f5f5; border-radius:4px; cursor:pointer; padding:6px; display:flex; align-items:center; justify-content:center; }
        .tf-piece-grid button.on { border-color:#d88854; background:#fff5ed; }
        .tf-piece-grid button svg { width:100%; height:100%; }
      `}</style>

      {error && <div className="tf-error">{error}</div>}

      {pendingRebadge && (
        <div className="tf-warn">
          <strong>Esse rename vai re-taguear {pendingRebadge.count} artigo(s):</strong>
          <ul style={{ margin: '6px 0 10px 18px' }}>
            {pendingRebadge.affected.map((a) => (
              <li key={a.id}><em>{a.title}</em></li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="tf-btn tf-btn-primary" onClick={() => { setPendingRebadge(null); submit(true); }} disabled={submitting}>
              Confirmar e re-taguear
            </button>
            <button type="button" className="tf-btn tf-btn-secondary" onClick={() => setPendingRebadge(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="tf-grid">
        <div>
          <div className="tf-field">
            <label>Nome</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Política" />
          </div>

          <div className="tf-field">
            <label>Slug {isEdit && '(mude com cuidado — vai re-taguear artigos)'}</label>
            <input type="text" value={slug} onChange={(e) => { setSlug(slugify(e.target.value)); setSlugManuallyEdited(true); }} placeholder="ex: politica" />
            {slugChanged && (
              <div style={{ fontSize: 11, color: '#b87b22', marginTop: 4 }}>
                Slug mudou: ao salvar, artigos com a tag <code>{initial!.slug}</code> serão re-tagueados pra <code>{slug}</code>.
              </div>
            )}
          </div>

          <SwatchPicker label="Cor de fundo" value={color} onChange={setColor} swatches={PALETTE_BG} />
          <SwatchPicker label="Cor do texto" value={textColor} onChange={setTextColor} swatches={PALETTE_TEXT} />

          <div className="tf-field">
            <label>Preview</label>
            <span className="tf-preview" style={{ background: color, color: textColor }}>
              {name || 'Sem nome'}
            </span>
          </div>
        </div>

        <div>
          <div className="tf-field">
            <label>Tag-pai (hierarquia opcional)</label>
            <select value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">— sem pai (tag de topo) —</option>
              {validParents.map((p) => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="tf-field">
            <label>Peça cobogó (ícone visual)</label>
            <div className="tf-piece-grid">
              {PIECES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={piece === p.value ? 'on' : ''}
                  onClick={() => setPiece(p.value)}
                  title={p.label}
                  style={{ color }}
                >
                  <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                    <use href={`#cobogo-${p.value}`} width="100" height="100" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          <div className="tf-field">
            <label>Descrição (opcional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Curta descrição — usada futuramente em página de arquivo da tag." />
          </div>

          <div className="tf-field">
            <label>Ordem (menor = primeiro)</label>
            <input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} step={1} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <a href="/admin/tags" className="tf-btn tf-btn-secondary" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Cancelar
        </a>
        <button type="button" className="tf-btn tf-btn-primary" disabled={!canSubmit} onClick={() => submit(false)}>
          {submitting ? 'Salvando…' : (isEdit ? 'Salvar' : 'Criar tag')}
        </button>
      </div>
    </>
  );
}
