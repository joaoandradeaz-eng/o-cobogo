import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';

/** NodeView do editor: renderiza o SVG/HTML salvo em node.attrs.html
    com dangerouslySetInnerHTML. Mostra delete button quando selecionado. */
function ChartNodeView({ node, deleteNode, selected }: any) {
  const html = node.attrs.html ?? '';

  return (
    <NodeViewWrapper
      as="div"
      className="chart"
      data-chart=""
      style={{ position: 'relative', outline: selected ? '2px solid var(--terra)' : 'none', borderRadius: 4 }}
    >
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {selected && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); deleteNode(); }}
          style={{
            position: 'absolute',
            top: -10, right: -10,
            width: 24, height: 24,
            background: '#b00', color: '#fff',
            border: '2px solid #fff',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: 14, lineHeight: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            zIndex: 10,
          }}
          title="Remover gráfico"
        >×</button>
      )}
    </NodeViewWrapper>
  );
}

/** Custom Node "chart" — atom block com atributo `html` (SVG/HTML cru). */
export const Chart = Node.create({
  name: 'chart',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      html: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).innerHTML,
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-chart]' }];
  },

  renderHTML({ node }) {
    // Retornar um DOM node real (válido em DOMOutputSpec do ProseMirror).
    // DOMSerializer serializa esse node de volta pra string preservando o innerHTML SVG.
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-chart', '');
    wrapper.className = 'chart';
    wrapper.innerHTML = node.attrs.html ?? '';
    return wrapper as any;
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChartNodeView);
  },
});

/* ============================ Modal de inserção ============================ */

export function ChartModal({
  open,
  onClose,
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (html: string) => void;
}) {
  const [code, setCode] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setCode('');
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const handleInsert = () => {
    const v = code.trim();
    if (!v) {
      alert('Cole um SVG ou HTML válido.');
      return;
    }
    onInsert(v);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 20,
          maxWidth: 900,
          width: '100%',
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column', gap: 12,
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Inserir gráfico</h2>
          <span style={{ fontSize: 12, color: '#888' }}>Cole o SVG ou HTML — peça pro Claude gerar pra você no chat</span>
        </div>
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ...'> ... </svg>"
          spellCheck={false}
          style={{
            width: '100%',
            minHeight: 200,
            maxHeight: '40vh',
            padding: 10,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 12,
            border: '1px solid #ddd',
            borderRadius: 4,
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        {code.trim() && (
          <div>
            <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>
              Preview
            </div>
            <div
              style={{
                border: '1px dashed #ccc',
                borderRadius: 4,
                padding: 16,
                background: '#f9f9f6',
                maxHeight: '30vh',
                overflow: 'auto',
                textAlign: 'center',
              }}
              dangerouslySetInnerHTML={{ __html: code }}
            />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px', border: '1px solid #ccc', background: '#f5f5f5',
              borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500,
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleInsert}
            style={{
              padding: '8px 18px', border: 'none', background: 'var(--terra, #B85A1F)',
              color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            Inserir gráfico
          </button>
        </div>
      </div>
    </div>
  );
}
