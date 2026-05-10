import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Superscript from '@tiptap/extension-superscript';
import { useEffect } from 'react';

type Props = {
  initialHtml?: string;
  onChange?: (html: string) => void;
  onEditorReady?: (editor: Editor) => void;
  placeholder?: string;
  contentClassName?: string;
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
        background: active ? '#fff' : 'transparent',
        color: active ? '#111' : '#fff',
        opacity: active ? 1 : 0.85,
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
    ],
    content: initialHtml ?? '',
    editorProps: {
      attributes: {
        class: contentClassName ?? '',
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
      `}</style>
      <BubbleMenu editor={editor}>
        <BubbleToolbar editor={editor} />
      </BubbleMenu>
      <EditorContent editor={editor} />
    </>
  );
}
