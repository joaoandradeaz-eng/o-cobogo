import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { useEffect, useRef, useState } from 'react';

type Props = {
  initialHtml?: string;
  onChange?: (html: string) => void;
  onEditorReady?: (editor: Editor) => void;
  placeholder?: string;
  contentClassName?: string;
};

const COLOR_PALETTE = [
  { name: 'Preto',     hex: '#1B1612' }, // ink
  { name: 'Cinza',     hex: '#6B6055' }, // ink-3
  { name: 'Terra',     hex: '#B85A1F' }, // brand
  { name: 'Terra escuro', hex: '#8C3F12' }, // terra-deep
  { name: 'Navy',      hex: '#1E3A8A' },
  { name: 'Bordô',     hex: '#6B2C2C' },
];

function ToolbarButton({
  active,
  onClick,
  label,
  title,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  label: React.ReactNode;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
      title={title}
      disabled={disabled}
      style={{
        border: 'none',
        background: active ? '#fff' : 'transparent',
        color: active ? '#111' : '#fff',
        opacity: disabled ? 0.3 : active ? 1 : 0.85,
        padding: '5px 8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 3,
        minWidth: 26,
        transition: 'background .12s',
      }}
    >
      {label}
    </button>
  );
}

function ColorPopover({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const [hex, setHex] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const currentColor = editor.getAttributes('textStyle').color ?? '';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const apply = (color: string) => {
    editor.chain().focus().setColor(color).run();
    onClose();
  };

  const remove = () => {
    editor.chain().focus().unsetColor().run();
    onClose();
  };

  const applyHex = () => {
    const v = hex.trim();
    if (!/^#[0-9a-f]{6}$/i.test(v) && !/^#[0-9a-f]{3}$/i.test(v)) {
      alert('Hex inválido. Use formato #RRGGBB ou #RGB.');
      return;
    }
    apply(v);
  };

  return (
    <div
      ref={ref}
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
        zIndex: 100,
        minWidth: 220,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#666', marginBottom: 6 }}>
        Cores curadas
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
        {COLOR_PALETTE.map((c) => (
          <button
            key={c.hex}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); apply(c.hex); }}
            title={`${c.name} (${c.hex})`}
            style={{
              width: 24, height: 24, borderRadius: 4,
              background: c.hex, cursor: 'pointer',
              border: currentColor.toLowerCase() === c.hex.toLowerCase() ? '2px solid #000' : '1px solid #ccc',
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#666', marginBottom: 6 }}>
        Custom (hex)
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        <input
          type="text"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyHex(); } }}
          placeholder="#A8B2D1"
          style={{
            flex: 1, fontSize: 12, padding: '4px 6px', border: '1px solid #ccc',
            borderRadius: 3, fontFamily: 'ui-monospace, monospace',
          }}
        />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); applyHex(); }}
          style={{ fontSize: 11, padding: '4px 10px', cursor: 'pointer', borderRadius: 3, border: '1px solid #ccc', background: '#f5f5f5' }}
        >
          aplicar
        </button>
      </div>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); remove(); }}
        style={{
          width: '100%', fontSize: 11, padding: '4px 0', cursor: 'pointer',
          borderRadius: 3, border: 'none', background: 'transparent', color: '#888',
          textAlign: 'left',
        }}
      >
        × remover cor
      </button>
    </div>
  );
}

function BubbleToolbar({ editor }: { editor: Editor }) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const currentColor = editor.getAttributes('textStyle').color ?? '#1B1612';

  const setLink = () => {
    const previous = editor.getAttributes('link').href;
    const url = window.prompt('URL:', previous ?? '');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 1,
        background: '#111',
        borderRadius: 6,
        padding: 4,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        flexWrap: 'wrap',
        maxWidth: 560,
        position: 'relative',
      }}
    >
      <ToolbarButton
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label={<strong>B</strong>}
        title="Negrito (⌘B)"
      />
      <ToolbarButton
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label={<em>I</em>}
        title="Itálico (⌘I)"
      />
      <div style={{ position: 'relative' }}>
        <ToolbarButton
          active={!!editor.getAttributes('textStyle').color}
          onClick={() => setShowColorPicker((v) => !v)}
          label={<span style={{ color: currentColor, background: '#fff', padding: '0 3px', borderRadius: 2, fontWeight: 700 }}>A</span>}
          title="Cor do texto"
        />
        {showColorPicker && <ColorPopover editor={editor} onClose={() => setShowColorPicker(false)} />}
      </div>
      <ToolbarButton
        active={editor.isActive('highlight')}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        label={<span style={{ background: 'rgba(255,224,102,.7)', padding: '0 3px', borderRadius: 2, color: '#222', fontWeight: 600 }}>abc</span>}
        title="Realçar (marcador)"
      />
      <ToolbarButton
        active={editor.isActive('link')}
        onClick={setLink}
        label="🔗 link"
        title="Adicionar link"
      />
      <div style={{ width: 1, background: '#333', margin: '4px 2px' }} />
      <ToolbarButton
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        label="H2"
        title="Subtítulo"
      />
      <ToolbarButton
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        label="H3"
        title="Sub-subtítulo"
      />
      <ToolbarButton
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        label="❝"
        title="Citação"
      />
      <div style={{ width: 1, background: '#333', margin: '4px 2px' }} />
      <ToolbarButton
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="•"
        title="Lista com bullets"
      />
      <ToolbarButton
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="1."
        title="Lista numerada"
      />
      <div style={{ width: 1, background: '#333', margin: '4px 2px' }} />
      <ToolbarButton
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        label="⬅"
        title="Alinhar à esquerda"
      />
      <ToolbarButton
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        label="↔"
        title="Centralizar"
      />
      <ToolbarButton
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        label="➡"
        title="Alinhar à direita"
      />
      <ToolbarButton
        active={editor.isActive({ textAlign: 'justify' })}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        label="☰"
        title="Justificar"
      />
    </div>
  );
}

export default function PostEditor({
  initialHtml,
  onChange,
  onEditorReady,
  placeholder,
  contentClassName,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: placeholder ?? 'Comece a escrever…' }),
      Superscript,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
    ],
    content: initialHtml ?? '',
    editorProps: {
      attributes: { class: contentClassName ?? '' },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor) onEditorReady?.(editor);
    return () => editor?.destroy();
  }, [editor]);

  if (!editor) return null;

  return (
    <>
      <style>{`
        .ProseMirror{ outline: none; min-height: 60vh; }
        .ProseMirror p.is-editor-empty:first-child::before{
          content: attr(data-placeholder);
          float:left; color:#bbb; pointer-events:none; height:0;
          font-style: italic;
        }
      `}</style>
      <BubbleMenu editor={editor}>
        <BubbleToolbar editor={editor} />
      </BubbleMenu>
      <EditorContent editor={editor} />
    </>
  );
}
