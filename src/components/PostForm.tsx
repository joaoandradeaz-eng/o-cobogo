import { useState } from 'react';
import PostEditor from './PostEditor';

const CATEGORIES = [
  { value: 'ensaio', label: 'Ensaio' },
  { value: 'reportagem', label: 'Reportagem' },
  { value: 'critica', label: 'Crítica' },
  { value: 'entrevista', label: 'Entrevista' },
  { value: 'memoria', label: 'Memória' },
  { value: 'cidade-casa', label: 'Cidade & Casa' },
];

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
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

  const toggleCategory = (value: string) => {
    setCategories((cur) =>
      cur.includes(value) ? cur.filter((c) => c !== value) : [...cur, value]
    );
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
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Erro ${res.status}`);
        return;
      }

      const verb = draft ? 'Rascunho salvo' : 'Publicado';
      alert(`${verb}!\nO Vercel está rebuildando — em ~1 min seu post estará no ar.\nSlug: ${data.slug}`);
      window.location.href = '/admin';
    } catch (err: any) {
      setError(err.message ?? 'Erro inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = title.trim() && dek.trim() && categories.length > 0 && bodyHtml.trim() && !submitting;

  return (
    <>
      <style>{`
        .pf-form{ font-family: system-ui, sans-serif; max-width: 760px; margin: 0 auto; padding: 24px; color:#111; }
        .pf-meta{ display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 18px;
                  padding: 14px; background:#fafafa; border:1px solid #eee; border-radius:8px; font-size: 13px; }
        .pf-meta label{ display:flex; flex-direction:column; gap:4px; color:#555; font-weight:500; }
        .pf-meta input[type=date],.pf-meta input[type=text]{
          padding:6px 8px; border:1px solid #ddd; border-radius:4px; font-size:13px;
        }
        .pf-cats{ display:flex; flex-wrap:wrap; gap:6px; margin-bottom:18px; }
        .pf-cats label{
          font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.08em;
          padding: 6px 10px; border:1px solid #ddd; border-radius:4px; cursor:pointer;
          user-select:none;
        }
        .pf-cats label.checked{ background:#d88854; color:#fff; border-color:#d88854; }
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

        .pf-actions{
          margin-top: 32px; padding-top:20px; border-top:1px solid #eee;
          display:flex; justify-content:space-between; align-items:center; gap:12px;
        }
        .pf-actions .left{ color:#888; font-size:13px; }
        .pf-actions .right{ display:flex; gap:8px; }
        .pf-btn{
          padding: 10px 18px; border:none; border-radius:6px; font-size:14px;
          font-weight:600; cursor:pointer; transition: opacity .12s, background .12s;
        }
        .pf-btn:disabled{ opacity:.4; cursor:not-allowed; }
        .pf-btn-secondary{ background:#eee; color:#333; }
        .pf-btn-secondary:hover:not(:disabled){ background:#ddd; }
        .pf-btn-primary{ background:#d88854; color:#fff; }
        .pf-btn-primary:hover:not(:disabled){ background:#c47842; }

        .pf-error{
          margin-top: 12px; padding:10px 14px; background:#fee; border:1px solid #fbb;
          border-radius:4px; color:#900; font-size:13px;
        }
        .pf-back{ display:inline-block; margin-bottom: 16px; color:#888; font-size:13px; text-decoration:none; }
        .pf-back:hover{ color:#555; }
      `}</style>

      <div className="pf-form">
        <a href="/admin" className="pf-back">← Voltar pro dashboard</a>

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
          <label style={{ alignSelf: 'end' }}>
            <span style={{ color: '#888', fontSize: 12 }}>Slug derivado do título</span>
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

        <PostEditor onChange={setBodyHtml} placeholder="Comece a escrever…" />

        <div className="pf-actions">
          <span className="left">
            {submitting ? 'Salvando…' : canSubmit ? 'Pronto pra publicar' : 'Preencha título, dek, categoria e corpo'}
          </span>
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
              Publicar
            </button>
          </div>
        </div>

        {error && <div className="pf-error">{error}</div>}
      </div>
    </>
  );
}
