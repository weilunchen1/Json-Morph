
import React, { useState, useRef, useMemo, memo } from 'react';
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
  parsedJson?: any;
  isRequest: boolean;
  isResponse: boolean;
  extractedIds: string[];
}

interface LogSession {
  id: string;
  sessionId: string; 
  request?: RawLogEntry;
  response?: RawLogEntry;
  others: RawLogEntry[];
  timestamp: string;
  status?: 'success' | 'failure';
}

type TabType = 'json' | 'log';
type ViewMode = 'list' | 'paired';

// --- Utils ---
const isDateString = (val: string): boolean => {
  if (val.length < 5) return false;
  const d = new Date(val);
  return !isNaN(d.getTime()) && (
    /^\d{4}-\d{2}-\d{2}/.test(val) || 
    /^\d{4}\/\d{2}\/\d{2}/.test(val) ||
    val.includes('T') && (val.endsWith('Z') || val.includes('+') || val.includes('-'))
  );
};

const sanitizeInput = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero Width
    .replace(/[\u3000]/g, ' ')             // 全形轉半形
    .replace(/[\u201C\u201D]/g, '"')       // 智慧引號
    .replace(/[\u2018\u2019]/g, "'")       // 智慧單引號
    .trim();
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
  if (type === 'string') {
    if (isDateString(obj)) {
      try { return new Date(obj).toISOString(); } catch { return obj; }
    }
    return "";
  }
  if (type === 'number') return Math.random() > 0.5 ? 0 : -1;
  if (type === 'boolean') return false;
  return null;
};

const ID_PATTERNS = [/TM\d{8,}[A-Z0-9]*/g, /TS\d{8,}[A-Z0-9]*/g, /TG\d{8,}[A-Z0-9]*/g, /J\d{15,}/g];

const extractAllIds = (text: string, json: any): string[] => {
  const ids = new Set<string>();
  ID_PATTERNS.forEach(p => { const ms = text.match(p); if (ms) ms.forEach(m => ids.add(m)); });
  if (json && typeof json === 'object') {
    const keys = ['TMCode', 'TSCode', 'TGCode', 'OrderCode', 'ShippingOrderCode', 'ShopId'];
    const traverse = (o: any) => {
      for (const k in o) {
        if (keys.includes(k) && typeof o[k] === 'string') ids.add(o[k]);
        else if (o[k] && typeof o[k] === 'object') traverse(o[k]);
      }
    };
    traverse(json);
  }
  return Array.from(ids);
};

// --- Components ---
const SessionCard = memo(({ session, highlight, onSendToTool }: { session: LogSession, highlight: string, onSendToTool: (d: string) => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusBadge = session.status === 'success' ? <span className="bg-emerald-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black">SUCCESS</span> : 
                      session.status === 'failure' ? <span className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black">FAILURE</span> : null;

  return (
    <div className={`shrink-0 bg-slate-900 border rounded-xl overflow-hidden transition-all mb-2 ${isExpanded ? 'border-indigo-500' : 'border-slate-800'}`}>
      <div className="flex items-center gap-4 px-4 py-3 cursor-pointer select-none" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex flex-col min-w-[120px]">
          <span className="text-[9px] font-mono text-slate-500">{session.timestamp.split(' ')[1] || session.timestamp}</span>
          <span className="text-xs font-bold text-indigo-400 font-mono truncate">{session.sessionId}</span>
        </div>
        <div className="flex gap-2 items-center">
          {statusBadge}
          <div className="flex gap-1">
            {session.request && <span className="bg-blue-900/30 text-blue-400 text-[9px] px-1.5 py-0.5 rounded border border-blue-500/20 font-bold">REQ</span>}
            {session.response && <span className="bg-emerald-900/30 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">RES</span>}
          </div>
        </div>
        <p className="text-xs text-slate-500 truncate flex-grow opacity-60 font-mono ml-4">
          {session.request?.content.substring(0, 100) || session.others[0]?.content.substring(0, 80)}
        </p>
      </div>
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-800 bg-slate-950/40 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[session.request, session.response].map((log, i) => log && (
            <div key={i} className="flex flex-col gap-2">
              <div className={`p-3 rounded-lg border border-slate-700/50 text-xs font-mono break-all whitespace-pre-wrap ${i === 0 ? 'bg-blue-950/10' : 'bg-emerald-950/10'}`}>
                <div className="text-[9px] font-black opacity-40 mb-2 uppercase">{i === 0 ? 'Request' : 'Response'}</div>
                {log.content}
              </div>
              <button onClick={() => onSendToTool(log.content)} className="text-[10px] self-start text-indigo-400 hover:underline">傳送至轉換工具</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('json');
  const [jsonState, setJsonState] = useState<JSONState>({ input: '', output: '', error: null, fileName: null });
  const [logState, setLogState] = useState<{ logs: RawLogEntry[], fileName: string | null, searchTerm: string, viewMode: ViewMode, selectedTags: string[] }>({ 
    logs: [], fileName: null, searchTerm: '', viewMode: 'paired', selectedTags: [] 
  });
  
  const jsonFileInput = useRef<HTMLInputElement>(null);
  const logFileInput = useRef<HTMLInputElement>(null);

  // --- JSON Handlers ---
  const handleJsonAction = (type: 'sanitize' | 'format' | 'minify' | 'nullify' | 'smart') => {
    try {
      let raw = jsonState.input;
      if (type === 'sanitize') raw = sanitizeInput(raw);
      const parsed = JSON.parse(raw);
      let res;
      if (type === 'sanitize' || type === 'format') res = JSON.stringify(parsed, null, 2);
      else if (type === 'minify') res = JSON.stringify(parsed);
      else if (type === 'nullify') res = JSON.stringify(nullifyTransform(parsed), null, 2);
      else res = JSON.stringify(smartTransform(parsed), null, 2);
      setJsonState(p => ({ ...p, input: type === 'sanitize' ? raw : p.input, output: res, error: null }));
    } catch (e) { setJsonState(p => ({ ...p, error: "JSON 語法解析錯誤" })); }
  };

  // --- Log Handlers ---
  const handleLogUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = (ev.target?.result as string).split(/\r?\n/).filter(l => l.trim());
      const processed = lines.map((line, idx) => {
        const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3})\s+(.*)$/);
        let timestamp = '', remainder = line;
        if (tsMatch) { timestamp = tsMatch[1]; remainder = tsMatch[2]; }
        const isRequest = remainder.toLowerCase().includes('request');
        const isResponse = remainder.toLowerCase().includes('response');
        let tag = isRequest ? 'REQ' : isResponse ? 'RES' : 'LOG';
        const colonIdx = remainder.indexOf(':');
        if (colonIdx > 0 && colonIdx < 30) tag = remainder.substring(0, colonIdx).trim();
        // Fixed typo: iRequest -> isRequest
        return { id: `l-${idx}`, timestamp, tag, content: remainder, isRequest, isResponse, extractedIds: extractAllIds(remainder, null), hasJsonHint: true };
      });
      setLogState(p => ({ ...p, logs: processed, fileName: file.name }));
    };
    reader.readAsText(file);
  };

  const sessions = useMemo(() => {
    const list: LogSession[] = [];
    const used = new Set<string>();
    for (let i = 0; i < logState.logs.length; i++) {
      const log = logState.logs[i];
      if (used.has(log.id)) continue;
      if (log.isRequest) {
        // Fixed: idx -> i
        const session: LogSession = { id: `s-${log.id}`, sessionId: log.extractedIds[0] || `REQ-${i}`, request: log, others: [], timestamp: log.timestamp };
        used.add(log.id);
        for (let j = i + 1; j < logState.logs.length; j++) {
          const next = logState.logs[j];
          if (used.has(next.id)) continue;
          if (next.isResponse && (log.extractedIds.some(id => next.extractedIds.includes(id)) || !session.response)) {
            session.response = next;
            used.add(next.id);
            if (next.content.toLowerCase().includes('success')) session.status = 'success';
            else if (next.content.toLowerCase().includes('fail') || next.content.toLowerCase().includes('error')) session.status = 'failure';
            break;
          }
        }
        list.push(session);
      }
    }
    logState.logs.forEach(l => { if (!used.has(l.id)) list.push({ id: `u-${l.id}`, sessionId: l.tag, others: [l], timestamp: l.timestamp }); });
    return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [logState.logs]);

  const filteredLogs = useMemo(() => {
    const term = logState.searchTerm.toLowerCase();
    return logState.viewMode === 'list' 
      ? logState.logs.filter(l => l.content.toLowerCase().includes(term))
      : sessions.filter(s => s.sessionId.toLowerCase().includes(term) || (s.request?.content.toLowerCase().includes(term)) || (s.response?.content.toLowerCase().includes(term)));
  }, [logState.logs, sessions, logState.searchTerm, logState.viewMode]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col p-6 md:p-10">
      <div className="w-full max-w-7xl mx-auto flex flex-col h-full">
        {/* Top Tab Bar */}
        <div className="flex justify-between items-center mb-10">
          <header className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 7.7l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5z"/><path d="M10 21.9V14L2.1 9.1"/><path d="m10 14 11.9-6.9"/></svg>
            </div>
            <h1 className="text-3xl font-black text-white">{activeTab === 'json' ? 'JSON Tools' : 'Log Analyzer'}</h1>
          </header>
          <nav className="flex bg-[#1e293b] p-1 rounded-xl shadow-xl border border-slate-800">
            <button onClick={() => setActiveTab('json')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'json' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>JSON 工具</button>
            <button onClick={() => setActiveTab('log')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'log' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>日誌分析</button>
          </nav>
        </div>

        {activeTab === 'json' ? (
          <div className="flex flex-col animate-in fade-in">
            {/* 3+2 Button Layout from Screenshot */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="md:col-span-3 grid grid-cols-3 gap-3">
                <button onClick={() => handleJsonAction('sanitize')} className="bg-[#0e526a] hover:bg-[#126582] text-white font-bold py-4 px-2 rounded-xl text-sm shadow-lg transition-all active:scale-95">深度清理並格式化</button>
                <button onClick={() => handleJsonAction('format')} className="bg-[#1e3a8a] hover:bg-[#254ab1] text-white font-bold py-4 px-2 rounded-xl text-sm shadow-lg transition-all active:scale-95">標準格式化</button>
                <button onClick={() => handleJsonAction('minify')} className="bg-[#065f46] hover:bg-[#047857] text-white font-bold py-4 px-2 rounded-xl text-sm shadow-lg transition-all active:scale-95">壓縮為單行</button>
                
                <button onClick={() => handleJsonAction('nullify')} className="bg-[#1e293b] hover:bg-[#334155] text-white font-bold py-4 px-2 rounded-xl text-sm shadow-lg transition-all active:scale-95 border border-slate-800">全部轉為 Null</button>
                <button onClick={() => handleJsonAction('smart')} className="bg-[#3730a3] hover:bg-[#4338ca] text-white font-bold py-4 px-2 rounded-xl text-sm shadow-lg transition-all active:scale-95">依格式轉換 (Smart)</button>
              </div>
              <div className="flex items-end justify-end">
                <button onClick={() => setJsonState({ input: '', output: '', error: null, fileName: null })} className="w-full py-5 bg-[#e11d48] hover:bg-[#f43f5e] text-white font-black rounded-2xl text-lg shadow-[0_0_20px_rgba(225,29,72,0.3)] transition-all active:scale-95">清空 (Clear)</button>
              </div>
            </div>

            {/* Twin Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[550px]">
              <div className="bg-[#1e293b]/50 rounded-2xl border border-slate-800 flex flex-col overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#1e293b]/80">
                  <span className="font-black text-slate-100 uppercase text-xs tracking-widest">輸入內容</span>
                  <div className="flex gap-2">
                    <button onClick={() => setJsonState(p => ({ ...p, input: JSON.stringify({"id":"J123456789012345","user":{"name":"Test User","date":"2023-10-01 10:00:00"},"meta":{"active":true}},null,2) }))} className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-bold py-1.5 px-3 rounded-lg transition-all">貼上範例</button>
                    <button onClick={() => jsonFileInput.current?.click()} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg transition-all">上傳檔案</button>
                  </div>
                </div>
                <textarea className="flex-grow bg-transparent p-6 font-mono text-sm text-indigo-200 outline-none resize-none custom-scrollbar" placeholder="在此貼上您的 JSON 資料..." value={jsonState.input} onChange={e => setJsonState(p => ({ ...p, input: e.target.value, error: null }))} />
                <input type="file" ref={jsonFileInput} className="hidden" accept=".json" onChange={e => {
                  const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => setJsonState(p => ({ ...p, input: ev.target?.result as string, fileName: f.name })); r.readAsText(f); }
                }} />
              </div>
              <div className="bg-[#1e293b]/50 rounded-2xl border border-slate-800 flex flex-col overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#1e293b]/80">
                  <span className="font-black text-slate-100 uppercase text-xs tracking-widest">轉換結果</span>
                  <div className="flex gap-2">
                    <button onClick={() => navigator.clipboard.writeText(jsonState.output)} className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-bold py-1.5 px-3 rounded-lg transition-all">複製</button>
                    <button onClick={() => { const b = new Blob([jsonState.output], {type:'application/json'}); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href=u; a.download='res.json'; a.click(); }} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg transition-all">下載 JSON</button>
                  </div>
                </div>
                <div className="flex-grow relative overflow-hidden">
                  {jsonState.error ? <div className="p-6 text-red-400 font-bold">{jsonState.error}</div> : 
                    <textarea className="w-full h-full bg-transparent p-6 font-mono text-sm text-emerald-400 outline-none resize-none custom-scrollbar" readOnly value={jsonState.output} placeholder="結果將顯示在此..." />}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full animate-in fade-in">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-grow relative">
                <input type="text" placeholder="搜尋日誌內容或代碼..." className="w-full bg-[#1e293b] border border-slate-800 rounded-xl py-4 px-12 font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={logState.searchTerm} onChange={e => setLogState(p => ({ ...p, searchTerm: e.target.value }))} />
                <svg className="absolute left-4 top-4 text-slate-500" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              <div className="flex gap-2 shrink-0">
                <div className="flex bg-[#1e293b] p-1 rounded-xl border border-slate-800">
                  <button onClick={() => setLogState(p => ({ ...p, viewMode: 'paired' }))} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${logState.viewMode === 'paired' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>會話綁定</button>
                  <button onClick={() => setLogState(p => ({ ...p, viewMode: 'list' }))} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${logState.viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>原始清單</button>
                </div>
                <button onClick={() => logFileInput.current?.click()} className="bg-indigo-600 hover:bg-indigo-500 px-6 rounded-xl font-bold text-sm shadow-lg">上傳 .log 檔案</button>
                <input type="file" ref={logFileInput} className="hidden" accept=".log,.txt" onChange={handleLogUpload} />
              </div>
            </div>
            
            <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 h-[600px]">
              {filteredLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 uppercase tracking-widest font-black opacity-20">
                  <svg className="mb-4" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1.707.293l5.414 5.414a1 1 0 0 1.293.707V19a2 2 0 0 1-2 2z"/></svg>
                  無日誌資料
                </div>
              ) : (
                filteredLogs.map((item: any) => logState.viewMode === 'paired' ? (
                  <SessionCard key={item.id} session={item} highlight={logState.searchTerm} onSendToTool={d => { setJsonState(p => ({ ...p, input: d })); setActiveTab('json'); }} />
                ) : (
                  <div key={item.id} className="bg-slate-900 border border-slate-800 p-3 rounded-xl mb-2 font-mono text-xs hover:border-slate-600">
                    <div className="flex items-center gap-2 mb-1 opacity-50">
                      <span>{item.timestamp}</span>
                      <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-bold">{item.tag}</span>
                    </div>
                    <p className="text-slate-300 break-all leading-relaxed">{item.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4f46e5; }`}</style>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
