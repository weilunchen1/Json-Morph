
import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom/client';

// --- Types ---
interface JSONState {
  input: string;
  output: string;
  error: string | null;
  fileName: string | null;
}

type TransformType = 'nullify' | 'smart' | 'compact' | 'format' | 'clean_format';

// --- Services (Transformer Logic) ---
const isDateString = (val: string): boolean => {
  if (typeof val !== 'string' || val.length < 5) return false;
  const d = new Date(val);
  return !isNaN(d.getTime()) && (
    /^\d{4}-\d{2}-\d{2}/.test(val) || 
    /^\d{4}\/\d{2}\/\d{2}/.test(val) ||
    (val.includes('T') && (val.endsWith('Z') || val.includes('+') || val.includes('-')))
  );
};

const nullifyTransform = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(item => nullifyTransform(item));
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = nullifyTransform(obj[key]);
    }
    return newObj;
  }
  return null;
};

const smartTransform = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(item => smartTransform(item));
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = smartTransform(obj[key]);
    }
    return newObj;
  }

  const type = typeof obj;
  if (type === 'string') {
    if (isDateString(obj)) {
      try {
        return new Date(obj).toISOString();
      } catch {
        return new Date().toISOString();
      }
    }
    return "";
  }
  if (type === 'number') {
    // 隨機返回 0 或負數 (模擬常見的 mocking 需求)
    return Math.random() > 0.5 ? 0 : -1;
  }
  if (type === 'boolean') {
    return false;
  }
  return null;
};

// --- Components ---
const EditorHeader = ({ title, onAction, actionLabel, secondaryAction, secondaryLabel, disabled }: any) => (
  <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 rounded-t-lg">
    <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{title}</span>
    <div className="flex gap-2">
      {secondaryAction && (
        <button
          onClick={secondaryAction}
          disabled={disabled}
          className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors disabled:opacity-50"
        >
          {secondaryLabel}
        </button>
      )}
      {onAction && (
        <button
          onClick={onAction}
          disabled={disabled}
          className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors disabled:opacity-50"
        >
          {actionLabel}
        </button>
      )}
    </div>
  </div>
);

// --- Main App ---
const App: React.FC = () => {
  const [state, setState] = useState<JSONState>({
    input: '',
    output: '',
    error: null,
    fileName: null
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const sanitizeInput = (text: string) => {
    if (!text) return "";
    return text
      .replace(/[\u00A0\u1680​\u180e\u2000-\u200a\u202f\u205f\u3000]/g, ' ') 
      .replace(/[\n\r\t]+/g, ' ') 
      .replace(/[“”]/g, '"') 
      .replace(/[‘’]/g, "'") 
      .replace(/\s+/g, ' ') 
      .trim();
  };

  const triggerTransform = (type: TransformType) => {
    try {
      let rawInput = state.input;
      
      if (type === 'clean_format') {
        rawInput = sanitizeInput(rawInput);
        setState(prev => ({ ...prev, input: rawInput }));
      }

      let data = JSON.parse(rawInput);
      let transformedContent: string;

      if (typeof data === 'string' && (data.trim().startsWith('{') || data.trim().startsWith('['))) {
        try {
          data = JSON.parse(data);
        } catch (e) { }
      }

      switch (type) {
        case 'compact':
          transformedContent = JSON.stringify(data);
          break;
        case 'nullify':
          transformedContent = JSON.stringify(nullifyTransform(data), null, 2);
          break;
        case 'smart':
          transformedContent = JSON.stringify(smartTransform(data), null, 2);
          break;
        default:
          transformedContent = JSON.stringify(data, null, 2);
          break;
      }

      setState(prev => ({
        ...prev,
        output: transformedContent,
        error: null
      }));
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setState(prev => ({ 
        ...prev, 
        error: `解析失敗: ${errorMessage}\n\n建議：請點擊「深度清理並格式化」來處理潛在的不可見字元。` 
      }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setState(prev => ({
        ...prev,
        input: event.target?.result as string,
        fileName: file.name,
        error: null
      }));
    };
    reader.readAsText(file);
  };

  const clearAll = () => {
    setState({ input: '', output: '', error: null, fileName: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const grid16Style = {
    display: 'grid',
    gridTemplateColumns: 'repeat(16, minmax(0, 1fr))',
    gap: '1rem'
  };

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <span className="bg-indigo-600 p-2 rounded-lg text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z"/><path d="M10 21.9V14L2.1 9.1"/><path d="m10 14 11.9-6.9"/><path d="M14 19.8v-8.1"/><path d="M18 17.5V9.4"/></svg>
          </span>
          JSON Morph
        </h1>
        <p className="text-slate-400 font-medium">專業資料轉換器 - 16 格精密三行佈局</p>
      </header>

      {/* 第一行按鈕：4/4/4/4 */}
      <div style={grid16Style} className="mb-4">
        <button 
          onClick={() => triggerTransform('clean_format')} 
          disabled={!state.input} 
          className="col-span-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-2 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 border border-cyan-400/30 overflow-hidden text-sm truncate"
        >
          深度清理並格式化
        </button>
        <button 
          onClick={() => triggerTransform('format')} 
          disabled={!state.input} 
          className="col-span-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-2 rounded-xl transition-all disabled:opacity-50 text-sm truncate"
        >
          標準格式化
        </button>
        <button 
          onClick={() => triggerTransform('compact')} 
          disabled={!state.input} 
          className="col-span-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-2 rounded-xl transition-all disabled:opacity-50 text-sm truncate"
        >
          壓縮為單行
        </button>
        <div className="col-span-4"></div>
      </div>

      {/* 第二行按鈕：4/4/8 */}
      <div style={grid16Style} className="mb-4">
        <button 
          onClick={() => triggerTransform('nullify')} 
          disabled={!state.input} 
          className="col-span-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 px-2 rounded-xl border border-slate-700 transition-all disabled:opacity-50 text-sm truncate"
        >
          全部轉為 Null
        </button>
        <button 
          onClick={() => triggerTransform('smart')} 
          disabled={!state.input} 
          className="col-span-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-2 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20 text-sm truncate"
        >
          依格式轉換 (Smart)
        </button>
        <div className="col-span-8"></div>
      </div>

      {/* 第三行按鈕：12/4 */}
      <div style={grid16Style} className="mb-8">
        <div className="col-span-12"></div>
        <button 
          onClick={clearAll} 
          className="col-span-4 bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-2 rounded-xl transition-all shadow-lg shadow-red-500/20 text-sm truncate"
        >
          清空 (Clear)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow min-h-[500px]">
        <div className="flex flex-col h-full">
          <EditorHeader 
            title="輸入內容" 
            actionLabel="上傳檔案" 
            onAction={() => fileInputRef.current?.click()} 
            secondaryLabel="貼上範例" 
            secondaryAction={() => setState(p => ({...p, input: '{\n  "grossMarginId": 3,\n  "brandId": 4,\n  "createdDatetime": "2026-01-26T09:34:22.878Z",\n  "validFlag": true\n}'}))}
          />
          <textarea 
            className="flex-grow bg-slate-900 text-indigo-300 p-4 font-mono text-sm resize-none focus:outline-none border-x border-b border-slate-700 rounded-b-lg" 
            placeholder="在此貼上您的 JSON 資料..."
            value={state.input} 
            onChange={e => setState(p => ({...p, input: e.target.value}))} 
          />
          <input type="file" ref={fileInputRef} className="hidden" accept=".json,.txt" onChange={handleFileUpload} />
        </div>

        <div className="flex flex-col h-full">
          <EditorHeader 
            title="轉換結果" 
            actionLabel="下載 JSON" 
            onAction={() => {
              const blob = new Blob([state.output], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = state.fileName ? `morph_${state.fileName}` : 'result.json'; a.click();
            }} 
            disabled={!state.output} 
            secondaryLabel="複製" 
            secondaryAction={() => navigator.clipboard.writeText(state.output)} 
          />
          <div className="relative flex-grow h-full">
            {state.error ? (
              <div className="w-full h-full bg-red-900/10 border-x border-b border-red-500/50 p-6 text-red-400 font-mono text-xs rounded-b-lg flex flex-col items-start overflow-auto gap-4">
                <div className="flex items-center gap-2 font-bold text-sm text-red-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  JSON 解析失敗
                </div>
                <pre className="whitespace-pre-wrap leading-relaxed">{state.error}</pre>
              </div>
            ) : (
              <textarea 
                className="w-full h-full bg-slate-900/50 text-emerald-400 p-4 font-mono text-sm resize-none focus:outline-none border-x border-b border-slate-700 rounded-b-lg" 
                readOnly 
                placeholder="結果將顯示在此..."
                value={state.output} 
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
