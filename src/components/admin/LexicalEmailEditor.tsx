import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Bold, ImagePlus, Italic, Link2, List, Loader2, Underline } from 'lucide-react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  DecoratorNode,
  FORMAT_TEXT_COMMAND,
  createCommand,
  type DOMConversionMap,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalCommand,
  type LexicalEditor,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import { INSERT_UNORDERED_LIST_COMMAND, ListItemNode, ListNode } from '@lexical/list';
import { LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';

type SerializedImageNode = Spread<
  {
    type: 'image';
    version: 1;
    src: string;
    altText: string;
  },
  SerializedLexicalNode
>;

class ImageNode extends DecoratorNode<ReactElement> {
  __src: string;
  __altText: string;

  static getType(): string {
    return 'image';
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__altText, node.__key);
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return new ImageNode(serializedNode.src, serializedNode.altText);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: (domNode: Node) => {
        if (!(domNode instanceof HTMLImageElement)) {
          return null;
        }

        return {
          conversion: () => ({
            node: new ImageNode(domNode.src, domNode.alt || ''),
          }),
          priority: 1,
        };
      },
    };
  }

  constructor(src: string, altText = '', key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__altText = altText;
  }

  exportJSON(): SerializedImageNode {
    return {
      type: 'image',
      version: 1,
      src: this.__src,
      altText: this.__altText,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('img');
    element.setAttribute('src', this.__src);
    if (this.__altText) {
      element.setAttribute('alt', this.__altText);
    }
    return { element };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    span.className = 'inline-block max-w-full';
    return span;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): ReactElement {
    return (
      <img
        src={this.__src}
        alt={this.__altText}
        className="my-2 inline-block h-auto max-w-full rounded-md border border-slate-700"
      />
    );
  }
}

const INSERT_IMAGE_COMMAND: LexicalCommand<{ src: string; altText?: string }> = createCommand();

function $createImageNode(src: string, altText = ''): ImageNode {
  return new ImageNode(src, altText);
}

function InitializeHtmlPlugin({ html }: { html: string }) {
  const [editor] = useLexicalComposerContext();
  const initializedRef = useRef(false);

  if (!initializedRef.current) {
    initializedRef.current = true;
    editor.update(() => {
      const root = $getRoot();
      root.clear();

      const parser = new DOMParser();
      const dom = parser.parseFromString(html || '<p></p>', 'text/html');
      const nodes = $generateNodesFromDOM(editor, dom);
      if (nodes.length > 0) {
        root.append(...nodes);
      }
    });
  }

  return null;
}

function ImageInsertPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      INSERT_IMAGE_COMMAND,
      payload => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return false;
        }

        selection.insertNodes([$createImageNode(payload.src, payload.altText || '')]);
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
  }, [editor]);

  return null;
}

function ToolbarPlugin({
  onUploadImage,
}: {
  onUploadImage: (file: File) => Promise<string>;
}) {
  const [editor] = useLexicalComposerContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-700 bg-[#0b1118] p-2">
      <button
        type="button"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:border-slate-400"
      >
        <Bold className="h-3 w-3" />
        Bold
      </button>
      <button
        type="button"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:border-slate-400"
      >
        <Italic className="h-3 w-3" />
        Italic
      </button>
      <button
        type="button"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
        className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:border-slate-400"
      >
        <Underline className="h-3 w-3" />
        Underline
      </button>
      <button
        type="button"
        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
        className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:border-slate-400"
      >
        <List className="h-3 w-3" />
        Bullet List
      </button>
      <button
        type="button"
        onClick={() => {
          const link = window.prompt('Enter URL');
          if (link) {
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, link);
          }
        }}
        className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:border-slate-400"
      >
        <Link2 className="h-3 w-3" />
        Link
      </button>
      <button
        type="button"
        disabled={uploadingImage}
        onClick={() => fileInputRef.current?.click()}
        className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:border-slate-400 disabled:opacity-50"
      >
        {uploadingImage
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <ImagePlus className="h-3 w-3" />}
        Image
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={async e => {
          const file = e.target.files?.[0];
          if (!file) return;

          setUploadingImage(true);
          try {
            const url = await onUploadImage(file);
            editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
              src: url,
              altText: file.name,
            });
          } finally {
            setUploadingImage(false);
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}

type LexicalEmailEditorProps = {
  initialHtml: string;
  onChange: (nextHtml: string) => void;
  onUploadImage: (file: File) => Promise<string>;
};

export default function LexicalEmailEditor({
  initialHtml,
  onChange,
  onUploadImage,
}: LexicalEmailEditorProps) {
  const initialConfig = useMemo(
    () => ({
      namespace: 'AdminEmailLexicalEditor',
      theme: {},
      onError: (error: Error) => {
        throw error;
      },
      nodes: [LinkNode, ListNode, ListItemNode, ImageNode],
    }),
    []
  );

  return (
    <div className="space-y-2">
      <LexicalComposer initialConfig={initialConfig}>
        <ToolbarPlugin onUploadImage={onUploadImage} />

        <RichTextPlugin
          contentEditable={(
            <ContentEditable
              className="min-h-[220px] w-full overflow-auto rounded-xl border border-slate-700 bg-[#0b1118] px-3 py-2.5 text-sm text-slate-100 focus:border-cyan-400/60 focus:outline-none"
            />
          )}
          placeholder={<div className="pointer-events-none px-3 py-2 text-sm text-slate-500">Write your message...</div>}
          ErrorBoundary={LexicalErrorBoundary}
        />

        <InitializeHtmlPlugin html={initialHtml} />
        <OnChangePlugin
          onChange={(editorState, editor: LexicalEditor) => {
            editorState.read(() => {
              onChange($generateHtmlFromNodes(editor, null));
            });
          }}
        />
        <HistoryPlugin />
        <LinkPlugin />
        <ListPlugin />
        <ImageInsertPlugin />
      </LexicalComposer>
    </div>
  );
}
