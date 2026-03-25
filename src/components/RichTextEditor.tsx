import React, { useRef, useCallback, useEffect } from 'react';
import {
  Bold, Italic, Underline, Link, List, ListOrdered,
  Heading2, Heading3, AlignLeft, AlignCenter, AlignRight,
  Strikethrough, Quote,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

type ExecCommandId =
  | 'bold' | 'italic' | 'underline' | 'strikeThrough'
  | 'insertUnorderedList' | 'insertOrderedList'
  | 'justifyLeft' | 'justifyCenter' | 'justifyRight'
  | 'formatBlock' | 'createLink' | 'insertBlockquote';

interface ToolbarButton {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  cmd: ExecCommandId;
  value?: string;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  { label: 'Bold',          icon: Bold,         cmd: 'bold' },
  { label: 'Italic',        icon: Italic,       cmd: 'italic' },
  { label: 'Underline',     icon: Underline,    cmd: 'underline' },
  { label: 'Strikethrough', icon: Strikethrough, cmd: 'strikeThrough' },
  { label: 'H2',            icon: Heading2,     cmd: 'formatBlock', value: 'h2' },
  { label: 'H3',            icon: Heading3,     cmd: 'formatBlock', value: 'h3' },
  { label: 'Quote',         icon: Quote,        cmd: 'formatBlock', value: 'blockquote' },
  { label: 'Bullet list',   icon: List,         cmd: 'insertUnorderedList' },
  { label: 'Ordered list',  icon: ListOrdered,  cmd: 'insertOrderedList' },
  { label: 'Align left',    icon: AlignLeft,    cmd: 'justifyLeft' },
  { label: 'Align center',  icon: AlignCenter,  cmd: 'justifyCenter' },
  { label: 'Align right',   icon: AlignRight,   cmd: 'justifyRight' },
];

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 280 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  // Track whether the editor is being edited to avoid clobbering cursor
  const internalChange = useRef(false);

  // Sync value → DOM only when the value changes from the outside
  useEffect(() => {
    if (!editorRef.current) return;
    if (internalChange.current) { internalChange.current = false; return; }
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const exec = useCallback((cmd: ExecCommandId, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    if (editorRef.current) {
      internalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      internalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleLink = useCallback(() => {
    const url = window.prompt('Enter URL:', 'https://');
    if (url) exec('createLink', url);
  }, [exec]);

  return (
    <div className="border border-gray-700 rounded-sm overflow-hidden focus-within:border-brand-orange transition-colors">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 bg-brand-darker border-b border-gray-700 p-1.5">
        {TOOLBAR_BUTTONS.map(({ label, icon: Icon, cmd, value: val }) => (
          <button
            key={label}
            type="button"
            title={label}
            onMouseDown={e => {
              e.preventDefault();          // keep focus in editor
              exec(cmd, val);
            }}
            className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}

        {/* Link button — needs prompt */}
        <button
          type="button"
          title="Insert link"
          onMouseDown={e => { e.preventDefault(); handleLink(); }}
          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <Link className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder ?? 'Write your content here…'}
        style={{ minHeight }}
        className={[
          'w-full bg-brand-darker text-white p-4 focus:outline-none',
          'prose prose-invert prose-sm max-w-none',
          '[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-gray-500',
        ].join(' ')}
      />
    </div>
  );
}
