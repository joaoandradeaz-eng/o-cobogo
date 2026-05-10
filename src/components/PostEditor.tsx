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
import Image from '@tiptap/extension-image';
import { useEffect, useRef, useState } from 'react';
import type { CloudinaryConfig, ImagePosition } from '../lib/cloudinary';
import { uploadToCloudinary } from '../lib/cloudinary';

type Props = {
  initialHtml?: string;
  onChange?: (html: string) => void;
  onEditorReady?: (editor: Editor) => void;
  placeholder?: string;
  contentClassName?: string;
  cloudinary?: CloudinaryConfig;
  onUploadStart?: () => void;
  onUploadEnd?: (success: boolean) => void;
};

const COLOR_PALETTE = [
  { name: 'Preto',     hex: '#1B1612' },
  { name: 'Cinza',     hex: '#6B6055' },
  { name: 'Terra',     hex: '#B85A1F' },
  { name: 'Terra escuro', hex: '#8C3F12' },
  { name: 'Navy',      hex: '#1E3A8A' },
  { name: 'Bordô',     hex: '#6B2C2C' },
];

const HIGHLIGHT_PALETTE = [
  { name: 'Amarelo', hex: '#FFE066' },
  { name: 'Rosa',    hex: '#FFB3D1' },
  { name: 'Verde',   hex: '#B3E6B3' },
  { name: 'Azul',    hex: '#B3DFF5' },
  { name: 'Laranja', hex: '#FFC99A' },
];

/** Custom Image node with `position` attribute (center | left | right | full) */
const PositionedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      position: {
        default: 'center',
        parseHTML: (el) => el.getAttribute('data-position') ?? 'center',
        renderHTML: (attrs) => {
          const pos = attrs.position ?? 'center';
          return {
            'data-position': pos,
            class: `img-pos-${pos}`,
          };
        },
      },
    };
  },
});

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

function HighlightPopover({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const currentColor = (editor.getAttributes('highlight').color ?? '').toLowerCase();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const apply = (color: string) => {
    editor.chain().focus().setHighlight({ color }).run();
    onClose();
  };

  const remove = () => {
    editor.chain().focus().unsetHighlight().run();
    onClose();
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
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#666', marginBottom: 8 }}>
        Marcador
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {HIGHLIGHT_PALETTE.map((c) => (
          <button
            key={c.hex}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); apply(c.hex); }}
            title={c.name}
            style={{
              width: 28, height: 22, borderRadius: 3,
              background: c.hex, cursor: 'pointer',
              border: currentColor === c.hex.toLowerCase() ? '2px solid #000' : '1px solid #ccc',
            }}
          />
        ))}
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
        × remover marcador
      </button>
    </div>
  );
}

function BubbleToolbar({ editor }: { editor: Editor }) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
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
      <div style={{ position: 'relative' }}>
        <ToolbarButton
          active={editor.isActive('highlight')}
          onClick={() => setShowHighlightPicker((v) => !v)}
          label={<span style={{ background: 'rgba(255,224,102,.7)', padding: '0 3px', borderRadius: 2, color: '#222', fontWeight: 600 }}>abc</span>}
          title="Marcador (escolha cor)"
        />
        {showHighlightPicker && <HighlightPopover editor={editor} onClose={() => setShowHighlightPicker(false)} />}
      </div>
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

function ImageToolbar({ editor }: { editor: Editor }) {
  const currentPos = (editor.getAttributes('image').position ?? 'center') as ImagePosition;
  const setPos = (p: ImagePosition) => {
    editor.chain().focus().updateAttributes('image', { position: p }).run();
  };
  const remove = () => {
    editor.chain().focus().deleteSelection().run();
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
      }}
    >
      <ToolbarButton active={currentPos === 'center'} onClick={() => setPos('center')} label="◉ centro" title="Centralizada" />
      <ToolbarButton active={currentPos === 'left'} onClick={() => setPos('left')} label="◧ esq" title="Esquerda (text-wrap)" />
      <ToolbarButton active={currentPos === 'right'} onClick={() => setPos('right')} label="◨ dir" title="Direita (text-wrap)" />
      <ToolbarButton active={currentPos === 'full'} onClick={() => setPos('full')} label="▭ full" title="Largura cheia" />
      <div style={{ width: 1, background: '#333', margin: '4px 2px' }} />
      <ToolbarButton onClick={remove} label="× remover" title="Remover imagem" />
    </div>
  );
}

export default function PostEditor({
  initialHtml,
  onChange,
  onEditorReady,
  placeholder,
  contentClassName,
  cloudinary,
  onUploadStart,
  onUploadEnd,
}: Props) {
  const cloudinaryRef = useRef(cloudinary);
  cloudinaryRef.current = cloudinary;

  const uploadFile = async (file: File, editor: Editor) => {
    const cfg = cloudinaryRef.current;
    if (!cfg?.cloudName || !cfg?.uploadPreset) {
      alert('Cloudinary não configurado nas env vars do Vercel.');
      return;
    }
    onUploadStart?.();
    try {
      const url = await uploadToCloudinary(file, cfg);
      editor.chain().focus().setImage({ src: url }).run();
      onUploadEnd?.(true);
    } catch (err: any) {
      alert(`Upload falhou: ${err?.message ?? err}`);
      onUploadEnd?.(false);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: placeholder ?? 'Comece a escrever…' }),
      Superscript,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      PositionedImage.configure({ inline: false, allowBase64: false }),
    ],
    content: initialHtml ?? '',
    editorProps: {
      attributes: { class: contentClassName ?? '' },
      handleDrop(view, event, _slice, moved) {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []);
        const images = files.filter((f) => f.type.startsWith('image/'));
        if (images.length === 0) return false;
        event.preventDefault();
        images.forEach((file) => uploadFile(file, editor!));
        return true;
      },
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items ?? []);
        const imageItems = items.filter((it) => it.type.startsWith('image/'));
        if (imageItems.length === 0) return false;
        event.preventDefault();
        imageItems.forEach((it) => {
          const f = it.getAsFile();
          if (f) uploadFile(f, editor!);
        });
        return true;
      },
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
        .ProseMirror img{ max-width:100%; height:auto; }
        .ProseMirror img.ProseMirror-selectednode{ outline: 2px solid var(--terra); }
      `}</style>
      <BubbleMenu
        editor={editor}
        shouldShow={({ editor, from, to }) => from !== to && !editor.isActive('image')}
      >
        <BubbleToolbar editor={editor} />
      </BubbleMenu>
      <BubbleMenu
        editor={editor}
        shouldShow={({ editor }) => editor.isActive('image')}
      >
        <ImageToolbar editor={editor} />
      </BubbleMenu>
      <EditorContent editor={editor} />
    </>
  );
}
