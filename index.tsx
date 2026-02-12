
import React, { useState, useRef, useMemo, memo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

// --- Types ---
interface JSONState {
  input: string;
  output: string;
  error: string | null;
  fileName: string | null;
}

interface RawLogEntry {
  id: string;
  timestamp: string;
  tag: string;
  content: string;
  hasJsonHint: boolean;
}

type TabType = 'json' | 'log';
type TransformType = 'nullify' | 'smart' | 'compact' | 'format' | 'clean_format';

// --- Transformer Logic ---
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
  if (Array.isArray(obj)) return obj.map(item => nullifyTransform(item));
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) newObj[key] = nullifyTransform(obj[key]);
    return newObj;
  }
  return null;
};

const smartTransform = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(item => smartTransform(item));
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) newObj[key] = smartTransform(obj[key]);
    return newObj;
  }
  const type = typeof obj;
  if (type === 'string') return isDateString(obj) ? new Date(obj).toISOString() : "";
  if (type === 'number') return Math.random() > 0.5 ? 0 : -1;
  if (type === 'boolean') return false;
  return null;
};

// --- Sub-Components ---
const EditorHeader = ({ title, onAction, actionLabel, secondaryAction, secondaryLabel, disabled }: any) => (
  <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 rounded-t-lg">
    <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{title}</span>
    <div className="flex gap-2">
      {secondaryAction && (
        <button onClick={secondaryAction} disabled={disabled} className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors disabled:opacity-50">{secondaryLabel}</button>
      )}
      {onAction && (
        <button onClick={onAction} disabled={disabled} className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors disabled:opacity-50">{actionLabel}</button>
      )}
    </div>
  </div>
);

const LogItem = memo(({ log, isExpanded, onToggle, onSendToTool, highlight }: { 
  log: RawLogEntry, 
  isExpanded: boolean, 
  onToggle: () => void,
  onSendToTool: (data: string) => void,
  highlight?: string
}) => {
  const [parsedCache, setParsedCache] = useState<any>(null);

  const displayJson = useMemo(() => {
    if (!isExpanded || !log.hasJsonHint) return null;
    if (parsedCache) return parsedCache;
    try {
      const p = JSON.parse(log.content);
      setParsedCache(p);
      return p;
    } catch (e) {
      return null;
    }
  }, [isExpanded, log.content, log.hasJsonHint]);

  // 簡單的高亮搜尋文字邏輯
  const renderContent = (text: string) => {
    if (!highlight || !text) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === highlight.toLowerCase() 
        ? <span key={i} className="bg-yellow-500/30 text-yellow-200 px-0.5 rounded">{part}</span> 
        : part
    );
  };

  return (
    <div className={`shrink-0 min-h-[48px] bg-slate-900 border rounded-xl overflow-hidden transition-all duration-200 ${isExpanded ? 'border-indigo-500 ring-1 ring-indigo-500/20 shadow-lg shadow-indigo-500/10' : 'border-slate-800 hover:border-slate-700'}`}>
      <div className="flex items-center gap-4 px-4 py-3 cursor-pointer select-none" onClick={onToggle}>
        <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap min-w-[140px] opacity-70">{log.timestamp || 'RAW'}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter border shrink-0 ${
          log.tag.toLowerCase().includes('response') ? 'bg-emerald-900/20 text-emerald-400 border-emerald-500/30' : 
          log.tag.toLowerCase().includes('request') ? 'bg-blue-900/20 text-blue-400 border-blue-500/30' : 
          'bg-slate-800 text-slate-400 border-slate-700'
        }`}>
          {log.tag}
        </span>
        <p className="text-sm text-slate-400 truncate font-mono flex-grow min-w-0">
          {renderContent(log.content)}
        </p>
        <div className="flex items-center gap-3 shrink-0">
          {log.hasJsonHint && <span className="bg-indigo-900/20 text-indigo-400 text-[9px] px-1.5 py-0.5 rounded border border-indigo-500/30 font-bold tracking-widest">JSON</span>}
          <svg className={`text-slate-600 transition-transform ${isExpanded ? 'rotate-180 text-indigo-400' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-800 bg-slate-950/40 animate-in slide-in-from-top-1 duration-200">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Detail View</span>
            <div className="flex gap-2">
              {displayJson && <button onClick={(e) => { e.stopPropagation(); onSendToTool(JSON.stringify(displayJson, null, 2)); }} className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded shadow-lg font-bold transition-all">傳送至 JSON Morph</button>}
              <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(log.content); }} className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded border border-slate-700 font-bold transition-all">複製原始文字</button>
            </div>
          </div>
          {displayJson ? (
            <pre className="text-xs bg-slate-950 p-4 rounded-lg overflow-auto max-h-[400px] border border-slate-800 text-emerald-300 whitespace-pre font-mono shadow-inner custom-scrollbar">{JSON.stringify(displayJson, null, 2)}</pre>
          ) : (
            <div className="text-xs bg-slate-950 p-4 rounded-lg border border-slate-800 text-slate-300 whitespace-pre-wrap font-mono leading-relaxed shadow-inner">{renderContent(log.content)}</div>
          )}
        </div>
      )}
    </div>
  );
});

// --- Main App ---
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('log');
  const [jsonState, setJsonState] = useState<JSONState>({ input: '', output: '', error: null, fileName: null });
  const [rawLogs, setRawLogs] = useState<RawLogEntry[]>([]);
  const [logFileName, setLogFileName] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logFileInputRef = useRef<HTMLInputElement>(null);
  const logListRef = useRef<HTMLDivElement>(null);

  const sanitizeInput = (text: string) => text.replace(/[\u00A0\u1680​\u180e\u2000-\u200a\u202f\u205f\u3000]/g, ' ').replace(/[\n\r\t]+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();

  const handleLogFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    setLogFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      
      const processed = lines.map((line, idx) => {
        const match = line.match(/^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3})\s+(.*)$/);
        let timestamp = '', tag = 'RAW', content = line;
        if (match) {
          timestamp = match[1];
          const remainder = match[2];
          const colonIdx = remainder.indexOf(':');
          if (colonIdx !== -1 && colonIdx < 60) {
            tag = remainder.substring(0, colonIdx).trim();
            content = remainder.substring(colonIdx + 1).trim();
          } else {
            content = remainder;
          }
        }
        const hasJsonHint = (content.startsWith('{') && content.endsWith('}')) || (content.startsWith('[') && content.endsWith(']'));
        return { id: `l-${idx}`, timestamp, tag, content, hasJsonHint };
      });
      
      setRawLogs(processed);
      setCurrentPage(1);
      setSearchTerm('');
      setSelectedTags([]);
      setIsParsing(false);
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const allTags = useMemo(() => {
    const tags = Array.from(new Set(rawLogs.map(l => l.tag)));
    return tags.sort();
  }, [rawLogs]);

  const filteredLogs = useMemo(() => {
    let result = rawLogs;
    if (selectedTags.length > 0) {
      result = result.filter(l => selectedTags.includes(l.tag));
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(l => l.content.toLowerCase().includes(term));
    }
    return result;
  }, [rawLogs, selectedTags, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  
  // 當過濾條件改變時，確保頁碼不超出範圍
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [filteredLogs.length, totalPages]);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage]);

  const triggerJsonTransform = (type: TransformType) => {
    try {
      let input = jsonState.input;
      if (type === 'clean_format') {
        input = sanitizeInput(input);
        setJsonState(p => ({ ...p, input }));
      }
      const data = JSON.parse(input);
      let out = "";
      if (type === 'format' || type === 'clean_format') out = JSON.stringify(data, null, 2);
      else if (type === 'compact') out = JSON.stringify(data);
      else if (type === 'nullify') out = JSON.stringify(nullifyTransform(data), null, 2);
      else if (type === 'smart') out = JSON.stringify(smartTransform(data), null, 2);
      setJsonState(p => ({ ...p, output: out, error: null }));
    } catch (e: any) { setJsonState(p => ({ ...p, error: `解析失敗: ${e.message}` })); }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    setCurrentPage(1);
    setExpandedLogId(null);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
    setExpandedLogId(null);
  };

  const grid16Style = { display: 'grid', gridTemplateColumns: 'repeat(16, minmax(0, 1fr))', gap: '1rem' };

  return (
    <div className="h-screen flex flex-col p-4 md:p-8 max-w-7xl mx-auto font-sans bg-slate-950 text-slate-200 overflow-hidden">
      <header className="shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span className="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>
            </span>
            DevHub Tools
          </h1>
          <nav className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-2xl">
            <button onClick={() => setActiveTab('json')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'json' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>JSON Morph</button>
            <button onClick={() => setActiveTab('log')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'log' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Log Analyzer</button>
          </nav>
        </div>
      </header>

      <main className="flex-grow flex flex-col overflow-hidden">
        {activeTab === 'json' ? (
          <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="shrink-0">
              <div style={grid16Style} className="mb-4">
                <button onClick={() => triggerJsonTransform('clean_format')} disabled={!jsonState.input} className="col-span-4 bg-cyan-600 hover:bg-cyan-500 py-3 rounded-xl font-bold text-sm disabled:opacity-50 truncate transition-all shadow-lg">深度清理並格式化</button>
                <button onClick={() => triggerJsonTransform('format')} disabled={!jsonState.input} className="col-span-4 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold text-sm disabled:opacity-50 truncate transition-all shadow-lg">標準格式化</button>
                <button onClick={() => triggerJsonTransform('compact')} disabled={!jsonState.input} className="col-span-4 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-bold text-sm disabled:opacity-50 truncate transition-all shadow-lg">壓縮為單行</button>
                <div className="col-span-4"></div>
              </div>
              <div style={grid16Style} className="mb-4">
                <button onClick={() => triggerJsonTransform('nullify')} disabled={!jsonState.input} className="col-span-4 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl font-bold text-sm border border-slate-700 truncate transition-all">全部轉為 Null</button>
                <button onClick={() => triggerJsonTransform('smart')} disabled={!jsonState.input} className="col-span-4 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold text-sm shadow-lg truncate transition-all">依格式轉換 (Smart)</button>
                <div className="col-span-8"></div>
              </div>
              <div style={grid16Style} className="mb-8">
                <div className="col-span-12"></div>
                <button onClick={() => setJsonState({ input: '', output: '', error: null, fileName: null })} className="col-span-4 bg-red-600 hover:bg-red-500 py-3 rounded-xl font-bold text-sm shadow-lg truncate transition-all">清空 (Clear)</button>
              </div>
            </div>

            <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 mb-4">
              <div className="flex flex-col min-h-0">
                <EditorHeader title="輸入 JSON" actionLabel="上傳" onAction={() => fileInputRef.current?.click()} secondaryLabel="範例" secondaryAction={() => setJsonState(p => ({...p, input: '{"id":1,"status":"ok","items":[{"p":100}]}'}))} />
                <textarea className="flex-grow bg-slate-900 text-indigo-300 p-4 font-mono text-sm resize-none focus:outline-none border-x border-b border-slate-800 rounded-b-lg shadow-inner custom-scrollbar" value={jsonState.input} onChange={e => setJsonState(p => ({...p, input: e.target.value}))} />
                <input type="file" ref={fileInputRef} className="hidden" accept=".json,.txt" onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const r = new FileReader(); r.onload = (ev) => setJsonState(p => ({...p, input: ev.target?.result as string})); r.readAsText(f);
                }} />
              </div>
              <div className="flex flex-col min-h-0">
                <EditorHeader title="輸出結果" actionLabel="下載" onAction={() => {
                  const b = new Blob([jsonState.output], {type:'application/json'}); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href=u; a.download='result.json'; a.click();
                }} disabled={!jsonState.output} secondaryLabel="複製" secondaryAction={() => navigator.clipboard.writeText(jsonState.output)} />
                <div className="flex-grow bg-slate-900 border-x border-b border-slate-800 rounded-b-lg p-4 font-mono text-sm overflow-auto shadow-inner custom-scrollbar">
                  {jsonState.error ? <div className="text-red-400 p-3 bg-red-950/20 rounded border border-red-900/50">{jsonState.error}</div> : <pre className="text-emerald-400 whitespace-pre-wrap">{jsonState.output || "等待輸出..."}</pre>}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full animate-in fade-in duration-300 min-h-0">
            <div className="shrink-0 grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="md:col-span-1 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2 tracking-widest shrink-0">標籤過濾 ({allTags.length})</h3>
                <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[120px] pb-2 custom-scrollbar">
                  {allTags.map(tag => (
                    <button key={tag} onClick={() => toggleTag(tag)}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all border shrink-0 ${selectedTags.includes(tag) ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}>{tag}</button>
                  ))}
                  {allTags.length > 0 && <button onClick={() => { setSelectedTags([]); setCurrentPage(1); }} className="text-[10px] font-bold text-red-500 hover:underline px-1 shrink-0">RESET</button>}
                </div>
              </div>
              <div className="md:col-span-3 bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col gap-4 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="z-10">
                    <h3 className="text-xl font-bold text-white mb-1 truncate max-w-md">{logFileName || '點擊右側上傳日誌'}</h3>
                    <p className="text-sm text-slate-500 font-mono italic">
                      {rawLogs.length > 0 ? `總計 ${rawLogs.length.toLocaleString()} 行 | 過濾後 ${filteredLogs.length.toLocaleString()} 筆` : '支援 .log / .txt 格式'}
                    </p>
                  </div>
                  <div className="flex gap-3 z-10 shrink-0">
                    <button onClick={() => logFileInputRef.current?.click()} className="bg-indigo-600 hover:bg-indigo-500 px-8 py-3 rounded-xl font-bold text-sm shadow-xl shadow-indigo-500/20 transition-all">選擇 Log 檔案</button>
                    {rawLogs.length > 0 && <button onClick={() => { setRawLogs([]); setLogFileName(null); setSelectedTags([]); setSearchTerm(''); setCurrentPage(1); }} className="bg-slate-800 hover:bg-red-900/30 text-red-400 px-4 py-3 rounded-xl font-bold text-sm border border-slate-700 transition-all">移除</button>}
                  </div>
                </div>
                
                {/* 搜尋列 */}
                <div className="relative z-10 w-full">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  </div>
                  <input 
                    type="text" 
                    placeholder="搜尋日誌內容 (Keyword Search)..." 
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-700 rounded-lg bg-slate-950 text-indigo-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono text-sm"
                  />
                  {searchTerm && (
                    <button onClick={() => { setSearchTerm(''); setCurrentPage(1); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                  )}
                </div>

                <input type="file" ref={logFileInputRef} className="hidden" accept=".log,.txt" onChange={handleLogFileUpload} />
                {isParsing && <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-20"><div className="flex items-center gap-4"><div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div><span className="font-bold text-indigo-400 text-lg">正在解析海量日誌...</span></div></div>}
              </div>
            </div>

            {/* 日誌列表區域 */}
            <div className="flex-grow flex flex-col min-h-0 mb-4 bg-slate-900/20 rounded-2xl border border-slate-800/50 p-2 overflow-hidden">
              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-600">
                  <svg className="mb-4 opacity-20" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12 a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                  <p className="font-bold">尚未有符合條件的日誌</p>
                </div>
              ) : (
                <div ref={logListRef} className="flex flex-col gap-2 h-full overflow-y-auto pr-2 custom-scrollbar">
                  {paginatedLogs.map(log => (
                    <LogItem 
                      key={log.id} 
                      log={log} 
                      isExpanded={expandedLogId === log.id}
                      onToggle={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                      onSendToTool={(data) => { setJsonState(p => ({ ...p, input: data })); setActiveTab('json'); }}
                      highlight={searchTerm}
                    />
                  ))}
                  <div className="py-4 text-center text-[10px] text-slate-700 font-mono uppercase tracking-[0.2em]">End of Page {currentPage}</div>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="shrink-0 flex items-center justify-center gap-4 py-4 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm">
                <button 
                  disabled={currentPage === 1} 
                  onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); logListRef.current?.scrollTo(0,0); }}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-20 text-slate-300 transition-all border border-slate-700"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                
                <div className="flex items-center gap-3 font-mono text-sm">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Page</span>
                  <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg px-2 shadow-inner">
                    <input 
                      type="number" 
                      min="1" 
                      max={totalPages} 
                      value={currentPage} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1 && val <= totalPages) setCurrentPage(val);
                      }}
                      className="w-12 bg-transparent py-1 text-center text-indigo-400 font-bold focus:outline-none"
                    />
                    <span className="text-slate-600 px-2">/</span>
                    <span className="text-slate-400 pr-1">{totalPages}</span>
                  </div>
                </div>

                <button 
                  disabled={currentPage === totalPages} 
                  onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); logListRef.current?.scrollTo(0,0); }}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-20 text-slate-300 transition-all border border-slate-700"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            )}
          </div>
        )}
      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(30, 41, 59, 0.3); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4f46e5; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
