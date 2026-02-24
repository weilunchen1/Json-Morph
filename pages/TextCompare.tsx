import React, { useState, useRef } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { ArrowLeftRight, ArrowRight, ArrowLeft, Copy, Trash2 } from 'lucide-react';

interface TextCompareProps {
  theme: 'dark' | 'light';
}

const TextCompare: React.FC<TextCompareProps> = ({ theme }) => {
  const [originalText, setOriginalText] = useState('// 在這裡貼上原始文字');
  const [modifiedText, setModifiedText] = useState('// 在這裡貼上修改後的文字');
  const [language, setLanguage] = useState('plaintext');

  const diffEditorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    diffEditorRef.current = editor;

    // 為右邊 (修改後) 編輯器加入右鍵選單
    editor.getModifiedEditor().addAction({
      id: 'action-copy-right-to-left',
      label: '⬅️ 將游標所在區段修改套用至左側',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1,
      run: () => {
        handleCopyRightToLeft();
      }
    });

    // 為左邊 (原始) 編輯器加入右鍵選單
    editor.getOriginalEditor().addAction({
      id: 'action-copy-left-to-right',
      label: '➡️ 將游標所在區段修改套用至右側',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1,
      run: () => {
        handleCopyLeftToRight();
      }
    });
  };

  const handleCopyLeftToRight = () => {
    if (!diffEditorRef.current) return;

    // Using Monaco's DiffNavigator or manually finding changes.
    const editor = diffEditorRef.current;
    const lineChanges = editor.getLineChanges();
    if (!lineChanges || lineChanges.length === 0) return;

    const originalModel = editor.getModel().original;
    const modifiedModel = editor.getModel().modified;

    // Get cursor position from the modified (right) editor
    const position = editor.getModifiedEditor().getPosition() || editor.getOriginalEditor().getPosition();

    if (!position) {
      setModifiedText(originalModel.getValue());
      return;
    }

    // Find if cursor is inside a change block
    // We check both modified and original line numbers because cursor could be on either side
    const currentLine = position.lineNumber;
    const isCursorOnOriginal = editor.getOriginalEditor().hasWidgetFocus();

    const change = lineChanges.find((c: any) => {
      if (isCursorOnOriginal) {
        // If cursor is on left, check original line ranges
        return currentLine >= c.originalStartLineNumber &&
          currentLine <= (c.originalEndLineNumber || c.originalStartLineNumber);
      } else {
        // If cursor is on right, check modified line ranges
        return currentLine >= c.modifiedStartLineNumber &&
          currentLine <= (c.modifiedEndLineNumber || c.modifiedStartLineNumber);
      }
    });

    if (change) {
      // We found a specific block to replace
      const originalLines = originalModel.getLinesContent();
      const modifiedLines = modifiedModel.getLinesContent();

      // Get the replacement text from the left (original)
      let replacementLines: string[] = [];
      if (change.originalEndLineNumber > 0) {
        replacementLines = originalLines.slice(
          Math.max(0, change.originalStartLineNumber - 1),
          change.originalEndLineNumber
        );
      }

      // Where to remove in the right (modified)
      const startIdx = change.modifiedStartLineNumber > 0 ? change.modifiedStartLineNumber - 1 : change.modifiedStartLineNumber;
      const deleteCount = change.modifiedEndLineNumber > 0 ? (change.modifiedEndLineNumber - startIdx) : 0;

      modifiedLines.splice(startIdx, deleteCount, ...replacementLines);
      setModifiedText(modifiedLines.join('\n'));
    } else {
      // Fallback: Copy all
      setModifiedText(originalModel.getValue());
    }
  };

  const handleCopyRightToLeft = () => {
    if (!diffEditorRef.current) return;

    const editor = diffEditorRef.current;
    const lineChanges = editor.getLineChanges();
    if (!lineChanges || lineChanges.length === 0) return;

    const originalModel = editor.getModel().original;
    const modifiedModel = editor.getModel().modified;

    const position = editor.getOriginalEditor().getPosition() || editor.getModifiedEditor().getPosition();

    if (!position) {
      setOriginalText(modifiedModel.getValue());
      return;
    }

    const currentLine = position.lineNumber;
    const isCursorOnModified = editor.getModifiedEditor().hasWidgetFocus();

    const change = lineChanges.find((c: any) => {
      if (isCursorOnModified) {
        return currentLine >= c.modifiedStartLineNumber &&
          currentLine <= (c.modifiedEndLineNumber || c.modifiedStartLineNumber);
      } else {
        return currentLine >= c.originalStartLineNumber &&
          currentLine <= (c.originalEndLineNumber || c.originalStartLineNumber);
      }
    });

    if (change) {
      const originalLines = originalModel.getLinesContent();
      const modifiedLines = modifiedModel.getLinesContent();

      let replacementLines: string[] = [];
      if (change.modifiedEndLineNumber > 0) {
        replacementLines = modifiedLines.slice(
          Math.max(0, change.modifiedStartLineNumber - 1),
          change.modifiedEndLineNumber
        );
      }

      const startIdx = change.originalStartLineNumber > 0 ? change.originalStartLineNumber - 1 : change.originalStartLineNumber;
      const deleteCount = change.originalEndLineNumber > 0 ? (change.originalEndLineNumber - startIdx) : 0;

      originalLines.splice(startIdx, deleteCount, ...replacementLines);
      setOriginalText(originalLines.join('\n'));
    } else {
      setOriginalText(modifiedModel.getValue());
    }
  };

  const clearAll = () => {
    setOriginalText('');
    setModifiedText('');
  };

  const isDark = theme === 'dark';

  return (
    <div className={`flex-1 flex flex-col gap-4 animate-fade-in`}>
      <header className={`px-6 py-5 rounded-2xl ${isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-gray-200'} border pro-shadow-lg backdrop-blur-sm`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} tracking-tight`}>文字比對工具</h1>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>輕鬆比對與合併兩端文字的差異</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all outline-none border ${isDark
                ? 'bg-slate-900/50 border-slate-700/50 text-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50'
                : 'bg-gray-50 border-gray-200 text-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20'
                }`}
            >
              <option value="plaintext">純文字 (Plain Text)</option>
              <option value="json">JSON</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="xml">XML</option>
              <option value="markdown">Markdown</option>
            </select>
            <button
              onClick={handleCopyLeftToRight}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 pro-shadow group ${isDark
                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200'
                }`}
              title="將游標所在區段左側覆蓋右側 (若無選擇則全部覆蓋)"
            >
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              左覆蓋右 (當前區段)
            </button>
            <button
              onClick={handleCopyRightToLeft}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 pro-shadow group ${isDark
                ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200'
                }`}
              title="將游標所在區段右側覆蓋左側 (若無選擇則全部覆蓋)"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              右覆蓋左 (當前區段)
            </button>
            <button
              onClick={clearAll}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 pro-shadow ${isDark
                ? 'bg-slate-700/50 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-slate-600/50 hover:border-rose-500/30'
                : 'bg-gray-100 hover:bg-rose-50 text-gray-600 hover:text-rose-600 border border-gray-200 hover:border-rose-200'
                }`}
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">清空</span>
            </button>
          </div>
        </div>
      </header>

      <div className={`h-[calc(100vh-250px)] min-h-[500px] w-full rounded-2xl overflow-hidden pro-shadow-lg border ${isDark ? 'border-slate-700/50' : 'border-gray-200'}`}>
        <DiffEditor
          height="100%"
          language={language}
          theme={isDark ? 'vs-dark' : 'light'}
          original={originalText}
          modified={modifiedText}
          onMount={handleEditorDidMount}
          options={{
            renderSideBySide: true,
            originalEditable: true,
            fontSize: 14,
            minimap: { enabled: false },
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            renderMarginRevertIcon: true, // Enable native revert icon
            enableSplitViewResizing: true,
            ignoreTrimWhitespace: false,
            useInlineViewWhenSpaceIsLimited: false,
            renderIndicators: true
          }}
        />
      </div>
    </div>
  );
};

export default TextCompare;
