
import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom/client';

// --- Types ---
interface JSONState {
  input: string;
  output: string;
  error: string | null;
  fileName: string | null;
}

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

  const triggerTransform = (type: 'nullify' | 'smart') => {
    try {
      const parsed = JSON.parse(state.input);
      const transformed = type === 'nullify' ? nullifyTransform(parsed) : smartTransform(parsed);
      setState(prev => ({
        ...prev,
        output: JSON.stringify(transformed, null, 2),
        error: null
      }));
    } catch (err) {
      setState(prev => ({ ...prev, error: "Invalid JSON format." }));
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

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <span className="bg-indigo-600 p-2 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z"/><path d="M10 21.9V14L2.1 9.1"/><path d="m10 14 11.9-6.9"/><path d="M14 19.8v-8.1"/><path d="M18 17.5V9.4"/></svg>
          </span>
          JSON Morph
        </h1>
        <p className="text-slate-400">專業級 JSON 資料結構轉換與清理工具</p>
      </header>

      <div className="flex flex-wrap gap-4 mb-6">
        <button onClick={() => triggerTransform('nullify')} disabled={!state.input} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-xl border border-slate-700 transition-all disabled:opacity-50">
          全部轉為 Null
        </button>
        <button onClick={() => triggerTransform('smart')} disabled={!state.input} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20">
          依格式轉換 (Smart)
        </button>
        <button onClick={clearAll} className="bg-slate-800 hover:bg-red-900/30 hover:text-red-400 text-slate-400 font-semibold py-3 px-6 rounded-xl border border-slate-700 transition-all">
          清空
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow h-[600px]">
        <div className="flex flex-col">
          <EditorHeader title="輸入 JSON" actionLabel="上傳檔案" onAction={() => fileInputRef.current?.click()} secondaryLabel="範例資料" secondaryAction={() => setState(p => ({...p, input: '{\n  "id": 1,\n  "user": "Test",\n  "date": "2023-01-01"\n}'}))} />
          <textarea className="flex-grow bg-slate-900 text-indigo-300 p-4 font-mono text-sm resize-none focus:outline-none border-x border-b border-slate-700 rounded-b-lg" value={state.input} onChange={e => setState(p => ({...p, input: e.target.value}))} />
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
        </div>

        <div className="flex flex-col">
          <EditorHeader title="轉換結果" actionLabel="下載檔案" onAction={() => {
            const blob = new Blob([state.output], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'result.json'; a.click();
          }} disabled={!state.output} secondaryLabel="複製" secondaryAction={() => navigator.clipboard.writeText(state.output)} />
          <textarea className="flex-grow bg-slate-900/50 text-emerald-400 p-4 font-mono text-sm resize-none focus:outline-none border-x border-b border-slate-700 rounded-b-lg" readOnly value={state.output} />
        </div>
      </div>
    </div>
  );
};

// --- Mount ---
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
