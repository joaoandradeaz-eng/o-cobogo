import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';

type Props = {
  initialHtml?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
};

function ToolbarButton({
  active,
  onClick,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      style={{
        border: 'none',
        background: active ? '#111' : 'transparent',
        color: active ? '#fff' : '#fff',
        opacity: active ? 1 : 0.7,
        padding: '6px 10px',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        borderRadius: 4,
        transition: 'background .12s',
      }}
    >
      {label}
    </button>
  );
}

function BubbleToolbar({ editor }: { editor: Editor }) {
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
        gap: 2,
        background: '#111',
        borderRadius: 6,
        padding: 4,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
      <ToolbarButton
        active={editor.isActive('link')}
        onClick={setLink}
        label="🔗"
        title="Link"
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
    </div>
  );
}

export default function PostEditor({ initialHtml, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Escreva aqui…',
      }),
    ],
    content: initialHtml ?? '',
    editorProps: {
      attributes: {
        class: 'tiptap-prose',
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  useEffect(() => () => editor?.destroy(), [editor]);

  if (!editor) return null;

  return (
    <>
      <style>{`
        .tiptap-prose{
          outline:none; min-height:60vh;
          font-family: 'Source Serif 4', Georgia, serif;
          font-size: 21px; line-height: 1.65; color:#222;
        }
        .tiptap-prose p{ margin: 0 0 1.2em; }
        .tiptap-prose h2{ font-family: system-ui, sans-serif; font-size: 32px; margin: 1.5em 0 .4em; line-height:1.15; }
        .tiptap-prose h3{ font-family: system-ui, sans-serif; font-size: 24px; margin: 1.2em 0 .3em; line-height:1.2; }
        .tiptap-prose blockquote{
          border-left: 3px solid #d88854; padding-left: 16px;
          color:#555; font-style: italic; margin: 1em 0;
        }
        .tiptap-prose a{ color:#d88854; text-decoration:underline; }
        .tiptap-prose ul,.tiptap-prose ol{ padding-left: 1.5em; margin: 0 0 1.2em; }
        .tiptap-prose strong{ font-weight: 700; }
        .tiptap-prose em{ font-style: italic; }
        .tiptap-prose p.is-editor-empty:first-child::before{
          content: attr(data-placeholder); float:left; color:#bbb; pointer-events:none; height:0;
        }
      `}</style>
      <BubbleMenu editor={editor}>
        <BubbleToolbar editor={editor} />
      </BubbleMenu>
      <EditorContent editor={editor} />
    </>
  );
}
