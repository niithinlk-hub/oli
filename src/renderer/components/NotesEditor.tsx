import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef } from 'react';

interface Props {
  initialContent: string;
  onChange?: (html: string) => void;
  onSave?: (html: string) => void;
  placeholder?: string;
  flushRef?: { current: { flush: () => void } };
}

/**
 * Tiptap-based notes editor. Stores HTML in the `notes.raw_markdown` column
 * (column kept for schema compat — content is rich HTML, not markdown).
 *
 * Auto-saves with a 1.5s debounce; explicit Save button via onSave.
 */
export function NotesEditor({
  initialContent,
  onChange,
  onSave,
  placeholder = 'Type rough notes during the meeting — Oli will enhance them after.',
  flushRef
}: Props) {
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder })],
    content: initialContent || '',
    editorProps: {
      attributes: {
        class: 'tiptap min-h-[200px]'
      }
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    }
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!editor || !onSave) return;
    const handler = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSave(editor.getHTML());
      }, 1500);
    };
    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editor, onSave]);

  // Reset content when meeting changes (parent should remount, but guard anyway)
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === initialContent) return;
    editor.commands.setContent(initialContent || '', { emitUpdate: false });
  }, [initialContent, editor]);

  // Expose immediate flush (used by Ctrl+S)
  useEffect(() => {
    if (!flushRef) return;
    flushRef.current = {
      flush: () => {
        if (!editor || !onSave) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        onSave(editor.getHTML());
      }
    };
  }, [editor, onSave, flushRef]);

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full">
      <Toolbar editor={editor} />
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean) =>
    `px-2 py-1 rounded-md text-caption font-medium transition ${
      active ? 'bg-oli-blue/10 text-oli-blue' : 'text-ink-secondary hover:bg-surface-cloud'
    }`;

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-line bg-white">
      <button
        type="button"
        className={btn(editor.isActive('heading', { level: 2 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </button>
      <button
        type="button"
        className={btn(editor.isActive('heading', { level: 3 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </button>
      <Sep />
      <button type="button" className={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}>
        B
      </button>
      <button type="button" className={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <em>I</em>
      </button>
      <button type="button" className={btn(editor.isActive('strike'))} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <s>S</s>
      </button>
      <Sep />
      <button type="button" className={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        • List
      </button>
      <button type="button" className={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1. List
      </button>
      <button type="button" className={btn(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        ❝
      </button>
      <button type="button" className={btn(editor.isActive('code'))} onClick={() => editor.chain().focus().toggleCode().run()}>
        {'<>'}
      </button>
    </div>
  );
}

function Sep() {
  return <span className="w-px h-5 bg-line mx-1" />;
}
