import { TableCell, TableHeader } from '@tiptap/extension-table';
import { mergeAttributes } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import { useState } from 'react';

/** Atributos custom compartilhados por <td> e <th>:
 *  - backgroundColor: cor de fundo (hex ou null)
 *  - cellAlign: text-align dentro da célula
 *  - borders: 4 dígitos TRBL (Top/Right/Bottom/Left), 1 = visível, 0 = sem
 */
const cellAttributes = {
  backgroundColor: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) =>
      el.getAttribute('data-bg') ?? el.style.backgroundColor ?? null,
    renderHTML: () => ({}),
  },
  cellAlign: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) =>
      el.getAttribute('data-align') ?? el.style.textAlign ?? null,
    renderHTML: () => ({}),
  },
  borders: {
    default: '1111',
    parseHTML: (el: HTMLElement) => el.getAttribute('data-borders') ?? '1111',
    renderHTML: () => ({}),
  },
};

function buildCellHTML(tag: 'td' | 'th') {
  return function renderHTML(this: any, { node, HTMLAttributes }: any) {
    const styles: string[] = [];
    if (node.attrs.backgroundColor) styles.push(`background-color: ${node.attrs.backgroundColor}`);
    if (node.attrs.cellAlign) styles.push(`text-align: ${node.attrs.cellAlign}`);
    const b: string = node.attrs.borders ?? '1111';
    if (b !== '1111') {
      if (b[0] === '0') styles.push('border-top: none');
      if (b[1] === '0') styles.push('border-right: none');
      if (b[2] === '0') styles.push('border-bottom: none');
      if (b[3] === '0') styles.push('border-left: none');
    }
    const dataAttrs: Record<string, string> = {};
    if (node.attrs.backgroundColor) dataAttrs['data-bg'] = node.attrs.backgroundColor;
    if (node.attrs.cellAlign) dataAttrs['data-align'] = node.attrs.cellAlign;
    if (b !== '1111') dataAttrs['data-borders'] = b;

    const merged = mergeAttributes(this.options.HTMLAttributes ?? {}, HTMLAttributes, dataAttrs);
    if (styles.length) merged.style = styles.join('; ');
    return [tag, merged, 0];
  };
}

export const StyledTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellAttributes };
  },
  renderHTML: buildCellHTML('td') as any,
});

export const StyledTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellAttributes };
  },
  renderHTML: buildCellHTML('th') as any,
});

/* ============================ UI helpers ============================ */

const CELL_COLOR_PALETTE = [
  '#FDF6E3', '#FFE0B2', '#FFCDD2', '#F8BBD0',
  '#D1C4E9', '#B3E5FC', '#C8E6C9', '#FFF59D',
  '#E0E0E0', '#BCAAA4', '#FFFFFF', '#1B1612',
];

export function CellColorPicker({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const apply = (color: string | null) => {
    editor
      .chain()
      .focus()
      .updateAttributes('tableCell', { backgroundColor: color })
      .updateAttributes('tableHeader', { backgroundColor: color })
      .run();
    onClose();
  };

  return (
    <div
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: 6,
        padding: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        zIndex: 200,
        minWidth: 200,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#666', marginBottom: 6 }}>
        Cor de fundo da célula
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginBottom: 10 }}>
        {CELL_COLOR_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); apply(c); }}
            title={c}
            style={{ width: 24, height: 22, borderRadius: 3, background: c, cursor: 'pointer', border: '1px solid #bbb' }}
          />
        ))}
      </div>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); apply(null); }}
        style={{ width: '100%', fontSize: 11, padding: '4px 0', cursor: 'pointer', borderRadius: 3, border: 'none', background: 'transparent', color: '#888', textAlign: 'left' }}
      >
        × remover cor
      </button>
    </div>
  );
}

/* ============================ Grid picker (insert) ============================ */

export function TableGridPicker({
  onSelect,
  onClose,
  maxRows = 10,
  maxCols = 10,
}: {
  onSelect: (rows: number, cols: number) => void;
  onClose: () => void;
  maxRows?: number;
  maxCols?: number;
}) {
  const [hover, setHover] = useState<{ r: number; c: number }>({ r: 0, c: 0 });

  return (
    <div
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: 6,
        padding: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        zIndex: 200,
      }}
    >
      <div style={{ fontSize: 11, color: '#666', marginBottom: 8, textAlign: 'center', fontFamily: 'var(--mono)' }}>
        {hover.r > 0 ? `${hover.r} × ${hover.c}` : 'escolha o tamanho'}
      </div>
      <div
        onMouseLeave={() => setHover({ r: 0, c: 0 })}
        style={{ display: 'grid', gridTemplateColumns: `repeat(${maxCols}, 18px)`, gap: 2 }}
      >
        {Array.from({ length: maxRows * maxCols }).map((_, i) => {
          const r = Math.floor(i / maxCols) + 1;
          const c = (i % maxCols) + 1;
          const active = r <= hover.r && c <= hover.c;
          return (
            <div
              key={i}
              onMouseEnter={() => setHover({ r, c })}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(r, c);
                onClose();
              }}
              style={{
                width: 18, height: 18,
                background: active ? 'var(--terra)' : '#f0f0f0',
                border: '1px solid #ddd',
                cursor: 'pointer',
                transition: 'background .08s',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
