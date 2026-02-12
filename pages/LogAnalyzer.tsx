import React, { useState, useRef, useEffect } from 'react';
import EditorHeader from '../components/EditorHeader.tsx';

interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    details?: string;
    tags?: string[];
}

const LogAnalyzer: React.FC = () => {
    const [logInput, setLogInput] = useState('');
    const [parsedLogs, setParsedLogs] = useState<LogEntry[]>([]);
    const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTag, setSelectedTag] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [viewMode, setViewMode] = useState<'raw' | 'transaction'>('raw');

    const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pageSize = 50;

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedLogs);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedLogs(newExpanded);
    };

    // --- 交易配對邏輯 ---
    interface Transaction {
        id: string;
        requestLog: LogEntry;
        responseLog?: LogEntry;
        duration?: number;
        status: 'success' | 'error' | 'pending';
        keyInfo: string;
        timestamp: string;
    }

    const [transactions, setTransactions] = useState<Transaction[]>([]);

    useEffect(() => {
        if (viewMode === 'transaction' && parsedLogs.length > 0) {
            groupTransactions();
        }
    }, [viewMode, parsedLogs]);

    const groupTransactions = () => {
        const groups: Transaction[] = [];
        const pendingMap = new Map<string, LogEntry>(); // Key -> Request Log

        // 用來提取識別碼的正則表達式，針對常見欄位
        // 支援多種常見的 Key，例如 ShopId, OrderCode, TSCode, TMCode, ShippingOrderCode
        // 注意：有些 log 可能包含多個 Key，這裡優先取前面的或者特定的
        const keyPatterns = [
            /"(TSCode|TMCode|ShippingOrderCode|OrderCode|Shopid|ShopId)"\s*[:=]\s*"?([^",}]+)"?/g
        ];

        // 提取一組識別 Key (例如 "ShopId:12345|OrderCode:ABC")
        const extractKeys = (content: string): string[] => {
            const keys: string[] = [];
            keyPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    // match[1] 是 Key 名稱 (如 OrderCode)
                    // match[2] 是 Value (如 ABC)
                    // 忽略 null 或空值
                    if (match[2] && match[2] !== 'null') {
                        keys.push(`${match[1]}:${match[2]}`);
                    }
                }
            });
            return keys; // 返回找到的所有 Key
        };

        // 交易配對邏輯優化
        // 1. 遍歷 Log
        // 2. 遇到 Request，找出它的 Key，存入 pendingMap (可能會有多個 Key 指向同一個 Request)
        // 3. 遇到 Response，找出它的 Key，去 pendingMap 找是否有對應的 Request

        // 為了避免複雜的多對多，這裡採用「第一個匹配到的 Key」作為主要關聯
        // 或者建立一個反向索引

        const requestLookup = new Map<string, LogEntry>(); // KeyString -> RequestLog

        parsedLogs.forEach(log => {
            const lowerMsg = log.message.toLowerCase();
            // 寬鬆認定：有 "request" 且有 "{" 視為請求
            // 有 "response" 視為回應
            const isRequest = (lowerMsg.includes('request') && log.message.includes('{')) || log.message.includes('InputChainData');
            const isResponse = (lowerMsg.includes('response') && (log.message.includes('{') || log.message.includes('OutputChainData')));

            const keys = extractKeys(log.message);
            if (keys.length === 0) return; // 沒 Key 就不處理配對

            if (isRequest) {
                // 將此 Request 註冊到它擁有的每一個 Key 上
                // 如果同一個 Key 已經有舊的 Request，這裡會覆蓋 (假設是新的交易開始)
                // 為了更精準，其實應該要看時間，但在單執行緒日誌中，覆蓋通常是合理的（舊的沒回應就是 Timeout 或 Log 遺失）
                keys.forEach(k => requestLookup.set(k, log));
            }
            else if (isResponse) {
                // 在 Response 中找 Key，看能不能對應到某個 Request
                let matchedRequest: LogEntry | undefined;
                let matchedKey = '';

                for (const k of keys) {
                    if (requestLookup.has(k)) {
                        matchedRequest = requestLookup.get(k);
                        matchedKey = k;
                        break; // 找到一個配對就停止
                    }
                }

                if (matchedRequest) {
                    // 找到配對，建立交易
                    // 計算時間差 (毫秒)
                    const reqTime = new Date(matchedRequest.timestamp).getTime();
                    const resTime = new Date(log.timestamp).getTime();
                    const duration = resTime - reqTime;

                    // 避免重複添加 (例如 Response 有多個 Key 都對應到同一個 Request，我們只加一次)
                    // 這裡簡化處理：直接 Push

                    // 檢查是否已經存在這個 Request 的交易紀錄 (防止重複)
                    // 但因為我們是遍歷，Response 是新的，所以應該還好。
                    // 唯一問題是：如果一個 Request 對應多個 Response (分段回應?) -> 這裡會變成多筆交易

                    groups.push({
                        id: `${matchedKey}-${resTime}`, // 唯一 ID
                        requestLog: matchedRequest,
                        responseLog: log,
                        duration: isNaN(duration) ? 0 : duration,
                        status: (log.level === 'ERROR' || log.message.includes('"Status":"Error"') || log.message.includes('"ReturnCode": "API')) ? (log.message.includes('"ReturnCode": "API0001"') ? 'success' : 'error') : 'success',
                        keyInfo: matchedKey, // 顯示是用哪個 Key 配對成功的
                        timestamp: matchedRequest.timestamp
                    });

                    // 配對成功後，是否要移除 Request？
                    // 如果是 1 Req -> 1 Res 模型，應該移除。
                    // 如果是 1 Req -> N Res，則不移除。
                    // 為了避免後續錯誤配對 (例如下一個同 Key 的 Request 進來前，又來一個 Response)，通常移除比較安全

                    // 這裡選擇移除該 Key 的對應，但也移除該 Request 對應的其他 Key? 
                    // 複雜度有點高，先只移除當前 Key
                    requestLookup.delete(matchedKey);
                }
            }
        });

        // 排序：最新的在上面 (或依據時間)
        groups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setTransactions(groups);
    };

    const tryFormatJSON = (str: string) => {
        try {
            // 嘗試尋找 JSON 物件或陣列的開頭
            const match = str.match(/[{[]/);
            if (!match) return null;
            const jsonStartIndex = match.index!;
            const jsonStr = str.slice(jsonStartIndex);
            const parsed = JSON.parse(jsonStr);
            return JSON.stringify(parsed, null, 2);
        } catch (e) {
            return null;
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadProgress(0);

        const reader = new FileReader();

        reader.onprogress = (event) => {
            if (event.lengthComputable) {
                const progress = Math.round((event.loaded / event.total) * 100);
                setUploadProgress(progress);
            }
        };

        reader.onload = (event) => {
            const content = event.target?.result as string;
            setLogInput(content);
            analyzeLogs(content);
            setIsUploading(false);
            setUploadProgress(100);
            setTimeout(() => setUploadProgress(0), 1000);
        };

        reader.onerror = () => {
            setIsUploading(false);
            setUploadProgress(0);
        };

        reader.readAsText(file);
    };

    const analyzeLogs = (logText: string) => {
        const lines = logText.split('\n').filter(line => line.trim());
        const parsed: LogEntry[] = [];

        const extractTag = (line: string, timestamp?: string) => {
            let body = line;
            if (timestamp) {
                body = line.slice(line.indexOf(timestamp) + timestamp.length);
            }
            body = body
                .replace(/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(\.\d+)?\s*/, '')
                .replace(/^\.\d+\s*/, '')
                .replace(/^\d+\s*/, '')
                .trim();

            // 規則 1: 匹配 "Key:" 模式 (例如 "InitialData:", "response:", "處理檔案:", "SendSlackMessage API :")
            // 允許中文、英文、空格，但遇到冒號停止
            const colonMatch = body.match(/^([^:\r\n]{1,50})\s*:/);
            if (colonMatch) {
                return colonMatch[1].trim();
            }

            // 規則 2: 匹配 "Key{" 模式 (例如 "request{", "取得訂單明細request{")
            const braceMatch = body.match(/^([^{:\r\n]{1,50})\s*\{/);
            if (braceMatch) {
                // 如果抓到的是 Json 字串的開頭 (如 "InitialData:{" 的 "InitialData")
                // 這裡通常會被規則 1 處理掉，除非沒有冒號
                return braceMatch[1].trim();
            }

            // 規則 3: 匹配 "Key Value" 模式的前兩個詞 (例如 "EtlFlowService constructor")
            // 這可能會比較寬鬆，視情況調整

            // 預設: 抓取第一個詞
            const genericMatch = body.match(/^[^\s{:]+/);
            return genericMatch ? genericMatch[0] : '';
        };

        lines.forEach(line => {
            const timestampMatch = line.match(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(\.\d+)?/);
            const levelMatch = line.match(/\b(ERROR|WARN|INFO|DEBUG)\b/i);
            const timestamp = timestampMatch ? timestampMatch[0] : '';
            const tag = extractTag(line, timestamp);
            const tags = tag ? [tag] : [];

            parsed.push({
                timestamp: timestamp || new Date().toISOString(),
                level: levelMatch ? levelMatch[1].toUpperCase() : 'INFO',
                message: line,
                details: line, // 保留完整行以供檢視
                tags
            });
        });

        setParsedLogs(parsed);
    };

    const handleAnalyze = () => {
        if (logInput.trim()) {
            analyzeLogs(logInput);
        }
    };

    const clearAll = () => {
        setLogInput('');
        setParsedLogs([]);
        setSearchTerm('');
        setFilter('all');
        setUploadProgress(0);
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const filteredLogs = parsedLogs.filter(log => {
        const matchesLevel = filter === 'all' || log.level.toLowerCase() === filter;
        const searchUpper = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || log.message.toLowerCase().includes(searchUpper);

        // 標籤篩選：如果 selectedTag 是 "all"，則視為符合。
        const matchesTag = selectedTag === 'all' || (log.tags ?? []).includes(selectedTag);

        // 使用者要求：文字搜尋 和 標籤過濾 之間使用 OR 邏輯
        // 但 Level 過濾通常是為了聚焦錯誤等級，比較適合維持 AND 邏輯
        // 邏輯改為：(符合 Level) AND ((符合 Search) OR (符合 Tag))
        // 特別注意：如果都沒有設定 Search 和 Tag，應該顯示全部 (即 matchesSearch 為 true 時因為沒內容)

        // 當 Search 為空且 Tag 為 All 時 => Show All
        if (!searchTerm && selectedTag === 'all') {
            return matchesLevel;
        }

        // 當有設定 Search 或 Tag 時 => 取聯集 (OR)
        // 注意：matchesSearch 在空字串時是 true，這裡要區分「有搜尋內容」的情況
        const hasSearchTerm = !!searchTerm;
        const isTagSelected = selectedTag !== 'all';

        const hitSearch = hasSearchTerm && log.message.toLowerCase().includes(searchUpper);
        const hitTag = isTagSelected && (log.tags ?? []).includes(selectedTag);

        return matchesLevel && (hitSearch || hitTag);
    });

    const availableTags = Array.from(
        new Set(parsedLogs.flatMap(log => log.tags ?? []))
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [filter, searchTerm, selectedTag, parsedLogs.length]);

    const filteredTransactions = transactions.filter(tx => {
        if (!searchTerm) return true;
        const searchUpper = searchTerm.toLowerCase();
        const inReq = tx.requestLog.message.toLowerCase().includes(searchUpper);
        const inRes = tx.responseLog?.message.toLowerCase().includes(searchUpper);
        const inKey = tx.keyInfo.toLowerCase().includes(searchUpper);
        return inReq || inRes || inKey;
    });

    const currentListLength = viewMode === 'raw' ? filteredLogs.length : filteredTransactions.length;
    const totalPages = Math.max(1, Math.ceil(currentListLength / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const paginatedLogs = filteredLogs.slice(startIndex, startIndex + pageSize);
    const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + pageSize);

    const getLogLevelColor = (level: string) => {
        switch (level.toUpperCase()) {
            case 'ERROR':
                return 'text-red-400 bg-red-900/20 border-red-500/30';
            case 'WARN':
                return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30';
            case 'INFO':
                return 'text-blue-400 bg-blue-900/20 border-blue-500/30';
            default:
                return 'text-slate-400 bg-slate-900/20 border-slate-500/30';
        }
    };

    const stats = {
        total: parsedLogs.length,
        errors: parsedLogs.filter(l => l.level === 'ERROR').length,
        warnings: parsedLogs.filter(l => l.level === 'WARN').length,
        info: parsedLogs.filter(l => l.level === 'INFO').length
    };

    return (
        <>
            {/* 操作按鈕區域 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                <button
                    onClick={handleAnalyze}
                    disabled={!logInput}
                    className="group relative overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-2 px-3 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed pro-shadow-lg hover:scale-[1.02] text-xs"
                >
                    <div className="relative z-10 flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span>分析日誌</span>
                    </div>
                </button>

                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="group relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white font-semibold py-2 px-3 rounded-lg border border-slate-700 transition-all duration-300 pro-shadow hover:pro-shadow-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <div className="relative z-10 flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span>{isUploading ? '上傳中...' : '上傳日誌檔案'}</span>
                    </div>
                </button>

                <button
                    onClick={clearAll}
                    className="group relative overflow-hidden bg-slate-800/50 hover:bg-red-900/30 text-slate-300 hover:text-red-400 font-semibold py-2 px-3 rounded-lg border border-slate-700 hover:border-red-500/50 transition-all duration-300 pro-shadow text-xs"
                >
                    <div className="flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>清除全部</span>
                    </div>
                </button>
            </div>

            <input type="file" ref={fileInputRef} className="hidden" accept=".log,.txt" onChange={handleFileUpload} />

            {/* 上傳進度條 */}
            {isUploading && (
                <div className="mb-3 bg-slate-800/50 backdrop-blur-sm p-3 rounded-lg border border-slate-700/50 pro-shadow">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400 font-medium">上傳進度</span>
                        <span className="text-xs text-indigo-400 font-bold">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 h-2 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${uploadProgress}%` }}
                        >
                            <div className="w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                        </div>
                    </div>
                </div>
            )}

            {/* 統計資訊卡片 */}
            {parsedLogs.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    <div className="bg-slate-800/50 backdrop-blur-sm p-2 rounded-lg border border-slate-700/50 pro-shadow">
                        <div className="text-slate-400 text-[10px] font-semibold mb-0.5">總日誌數</div>
                        <div className="text-lg font-bold text-white">{stats.total}</div>
                    </div>
                    <div className="bg-red-900/20 backdrop-blur-sm p-2 rounded-lg border border-red-500/30 pro-shadow">
                        <div className="text-red-400 text-[10px] font-semibold mb-0.5">錯誤</div>
                        <div className="text-lg font-bold text-red-400">{stats.errors}</div>
                    </div>
                    <div className="bg-yellow-900/20 backdrop-blur-sm p-2 rounded-lg border border-yellow-500/30 pro-shadow">
                        <div className="text-yellow-400 text-[10px] font-semibold mb-0.5">警告</div>
                        <div className="text-lg font-bold text-yellow-400">{stats.warnings}</div>
                    </div>
                    <div className="bg-blue-900/20 backdrop-blur-sm p-2 rounded-lg border border-blue-500/30 pro-shadow">
                        <div className="text-blue-400 text-[10px] font-semibold mb-0.5">資訊</div>
                        <div className="text-lg font-bold text-blue-400">{stats.info}</div>
                    </div>
                </div>
            )}

            {/* 主要內容區域 */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-grow overflow-hidden">
                {/* 日誌分析結果區 */}
                <div className="flex flex-col h-[600px] lg:h-full bg-slate-900/50 rounded-2xl border border-slate-700/50 pro-shadow overflow-hidden lg:col-span-4">
                    <div className="flex flex-col gap-2 px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700/50">
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
                            <span className="text-sm font-bold text-slate-200 uppercase tracking-wider">分析結果</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-3 py-1 text-xs rounded-lg transition-all ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600'}`}
                            >
                                全部
                            </button>
                            <button
                                onClick={() => setFilter('error')}
                                className={`px-3 py-1 text-xs rounded-lg transition-all ${filter === 'error' ? 'bg-red-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600'}`}
                            >
                                錯誤
                            </button>
                            <button
                                onClick={() => setFilter('warn')}
                                className={`px-3 py-1 text-xs rounded-lg transition-all ${filter === 'warn' ? 'bg-yellow-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600'}`}
                            >
                                警告
                            </button>
                            <button
                                onClick={() => setFilter('info')}
                                className={`px-3 py-1 text-xs rounded-lg transition-all ${filter === 'info' ? 'bg-blue-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600'}`}
                            >
                                資訊
                            </button>
                        </div>

                        <div className="w-full">
                            <div className="relative group w-full">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 pointer-events-none">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="搜尋內容 (與標籤為 OR 關係)..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 text-sm bg-slate-700/50 text-slate-200 border border-slate-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setSelectedTag('all')}
                                className={`px-3 py-1 text-xs rounded-lg transition-all ${selectedTag === 'all' ? 'bg-slate-200 text-slate-900' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'}`}
                            >
                                全部標籤
                            </button>
                            {availableTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => setSelectedTag(tag)}
                                    className={`px-3 py-1 text-xs rounded-lg transition-all ${selectedTag === tag ? 'bg-indigo-500 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'}`}
                                    title={tag}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700/50 bg-slate-900/40">
                        <div className="flex items-center gap-4">
                            <div className="text-xs text-slate-400">
                                顯示第 <span className="text-slate-200 font-semibold">{currentListLength === 0 ? 0 : startIndex + 1}</span>
                                {' '}–{' '}
                                <span className="text-slate-200 font-semibold">{Math.min(startIndex + pageSize, currentListLength)}</span>
                                {' '}筆 / 共{' '}
                                <span className="text-slate-200 font-semibold">{currentListLength}</span> 筆
                            </div>

                            <div className="flex bg-slate-800/50 rounded-lg p-0.5 border border-slate-700/50">
                                <button
                                    onClick={() => setViewMode('raw')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'raw' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    原始列表
                                </button>
                                <button
                                    onClick={() => setViewMode('transaction')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'transaction' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    交易檢視 (Beta)
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={safePage === 1}
                                className="px-2 py-1 text-xs rounded-md border border-slate-700 text-slate-300 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                上一頁
                            </button>
                            <span className="text-xs text-slate-400">{safePage} / {totalPages}</span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={safePage === totalPages}
                                className="px-2 py-1 text-xs rounded-md border border-slate-700 text-slate-300 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                下一頁
                            </button>
                        </div>
                    </div>

                    <div className="flex-grow overflow-auto p-4 space-y-2">
                        {/* Raw Mode 渲染邏輯 */}
                        {viewMode === 'raw' && (
                            parsedLogs.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-500">
                                    <div className="text-center">
                                        <svg className="w-16 h-16 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <p>尚未分析任何日誌</p>
                                    </div>
                                </div>
                            ) : (
                                paginatedLogs.map((log, index) => {
                                    const logId = `${startIndex + index}-${log.timestamp}`;
                                    const isExpanded = expandedLogs.has(logId);
                                    const formattedJSON = tryFormatJSON(log.message);
                                    const hasJSON = !!formattedJSON;

                                    return (
                                        <div
                                            key={logId}
                                            className={`p-3 rounded-lg border ${getLogLevelColor(log.level)} font-mono text-xs transition-all hover:scale-[1.01] ${hasJSON ? 'cursor-pointer hover:bg-opacity-80' : ''}`}
                                            onClick={() => hasJSON && toggleExpand(logId)}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="flex flex-col gap-1 min-w-[60px]">
                                                    <span className="font-bold">{log.level}</span>
                                                    {hasJSON && (
                                                        <span className="text-[10px] text-slate-500 bg-slate-900/50 px-1 rounded border border-slate-700 w-fit">
                                                            {isExpanded ? '收合' : '展開 JSON'}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-slate-400 min-w-[140px]">{log.timestamp.replace('T', ' ').split('.')[0]}</span>
                                                <div className="flex-1 overflow-hidden">
                                                    <div className={`text-slate-200 break-all ${!isExpanded && hasJSON ? 'line-clamp-2' : ''}`}>
                                                        {log.message}
                                                    </div>
                                                    {isExpanded && hasJSON && (
                                                        <div className="mt-3 relative group">
                                                            <div className="absolute -inset-2 bg-slate-900/50 rounded-lg -z-10"></div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    navigator.clipboard.writeText(formattedJSON);
                                                                }}
                                                                className="absolute top-2 right-2 z-10 p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-md transition-colors border border-slate-700/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                                title="複製 JSON 內容"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                                                </svg>
                                                            </button>
                                                            <pre className="p-3 rounded bg-slate-950 border border-slate-800 text-green-400 overflow-x-auto text-[11px] leading-relaxed shadow-inner font-mono">
                                                                {formattedJSON}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )
                        )}

                        {/* Transaction Mode (新功能) */}
                        {viewMode === 'transaction' && (
                            filteredTransactions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 text-slate-500 border border-dashed border-slate-700 rounded-lg">
                                    <svg className="w-12 h-12 mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <p>{searchTerm ? '找不到符合搜尋條件的交易' : '找不到可配對的 Request/Response 交易'}</p>
                                    <span className="text-xs mt-1 text-slate-600">目前支援依據 ShopId, TSCode, OrderCode 等欄位自動配對</span>
                                </div>
                            ) : (
                                paginatedTransactions.map(tx => {
                                    const isExpanded = expandedLogs.has(tx.id);
                                    const reqJSON = tryFormatJSON(tx.requestLog.message);
                                    const resJSON = tx.responseLog ? tryFormatJSON(tx.responseLog.message) : null;

                                    return (
                                        <div key={tx.id} className="border border-slate-700/50 rounded-lg bg-slate-800/20 overflow-hidden mb-2">
                                            <div
                                                className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-800/40 transition-colors"
                                                onClick={() => toggleExpand(tx.id)}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-2 h-2 rounded-full ${tx.status === 'success' ? 'bg-green-500' : tx.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                                    <span className="text-xs font-mono text-slate-400">{tx.timestamp.replace('T', ' ').split('.')[0]}</span>
                                                    <span className="text-xs font-bold text-slate-200 bg-slate-700/50 px-2 py-0.5 rounded border border-slate-600/50">
                                                        {tx.keyInfo.split(':')[0]} <span className="text-slate-400 font-normal">{tx.keyInfo.split(':')[1]}</span>
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs">
                                                    {tx.duration !== undefined && (
                                                        <span className={`font-mono ${tx.duration > 1000 ? 'text-yellow-400' : 'text-green-400'}`}>
                                                            {tx.duration}ms
                                                        </span>
                                                    )}
                                                    <span className="text-slate-500">
                                                        {isExpanded ? '收合詳情' : '查看詳情'}
                                                    </span>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="p-3 border-t border-slate-700/50 bg-slate-900/30 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {/* Request Section */}
                                                    <div className="space-y-2">
                                                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Request</div>
                                                        <pre className="text-[10px] text-slate-300 font-mono bg-slate-950 p-2 rounded border border-slate-800 overflow-x-auto">
                                                            {reqJSON || tx.requestLog.message}
                                                        </pre>
                                                    </div>

                                                    {/* Response Section */}
                                                    <div className="space-y-2">
                                                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Response</div>
                                                        {tx.responseLog ? (
                                                            <pre className={`text-[10px] font-mono bg-slate-950 p-2 rounded border border-slate-800 overflow-x-auto ${tx.status === 'error' ? 'text-red-300 border-red-900/30' : 'text-green-300'}`}>
                                                                {resJSON || tx.responseLog.message}
                                                            </pre>
                                                        ) : (
                                                            <div className="text-xs text-slate-500 italic p-2">等待回應中...</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )
                        )}
                    </div>
                </div>

                {/* 日誌輸入區 */}
                <div className="flex flex-col h-[600px] lg:h-full bg-slate-900/50 rounded-2xl border border-slate-700/50 pro-shadow overflow-hidden lg:col-span-1">
                    <EditorHeader
                        title="日誌輸入"
                        secondaryLabel="清除"
                        secondaryAction={() => setLogInput('')}
                    />
                    <div className="relative flex-grow overflow-hidden">
                        <textarea
                            className="w-full h-full bg-slate-900 text-cyan-300 p-6 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 leading-relaxed"
                            placeholder="📋 在此貼上您的日誌內容或上傳日誌檔案..."
                            value={logInput}
                            onChange={(e) => setLogInput(e.target.value)}
                            spellCheck={false}
                        />
                    </div>
                </div>
            </div>
        </>
    );
};

export default LogAnalyzer;
