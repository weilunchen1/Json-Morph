import React, { useState, useRef, useEffect } from 'react';
import EditorHeader from '../components/EditorHeader.tsx';

interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    details?: string;
    tags?: string[];
}

interface LogAnalyzerProps {
    theme: 'dark' | 'light';
}

const LogAnalyzer: React.FC<LogAnalyzerProps> = ({ theme }) => {
    const [logInput, setLogInput] = useState('');
    const [parsedLogs, setParsedLogs] = useState<LogEntry[]>([]);
    const [filter, setFilter] = useState<'all' | 'error' | 'success'>('all');
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
        const requestLookup = new Map<string, LogEntry>(); // KeyString -> RequestLog
        const requestsByTime: Array<{ log: LogEntry, keys: string[], time: number }> = []; // 時間序列的 Request 列表

        // 增強的識別碼提取函數
        const extractKeys = (content: string): string[] => {
            const keys: string[] = [];

            // 規則 1: 結構化 JSON 欄位提取
            const structuredPattern = /"(TSCode|TMCode|ShippingOrderCode|OrderCode|Shopid|ShopId)"\s*[:=]\s*"?([^",}]+)"?/g;
            let match;
            while ((match = structuredPattern.exec(content)) !== null) {
                if (match[2] && match[2] !== 'null') {
                    keys.push(`${match[1]}:${match[2]}`);
                }
            }

            // 規則 2: 從純文字中提取數字型識別碼（例如 ErrorMessage 內容）
            // 尋找 8-15 位數字（常見的訂單編號長度）
            const numberPattern = /\b(\d{8,15})\b/g;
            const foundNumbers = new Set<string>();
            while ((match = numberPattern.exec(content)) !== null) {
                foundNumbers.add(match[1]);
            }

            // 將找到的數字標記為 NumberMatch
            foundNumbers.forEach(num => {
                keys.push(`NumberMatch:${num}`);
            });

            return keys;
        };

        // 第一階段：建立 Request 索引
        parsedLogs.forEach(log => {
            const lowerMsg = log.message.toLowerCase();
            const isRequest = (lowerMsg.includes('request') && log.message.includes('{')) || log.message.includes('InputChainData');

            if (isRequest) {
                const keys = extractKeys(log.message);
                const time = new Date(log.timestamp).getTime();

                if (keys.length > 0) {
                    // 註冊到 Key lookup map
                    keys.forEach(k => requestLookup.set(k, log));
                    // 同時記錄時間序列（用於備用配對）
                    requestsByTime.push({ log, keys, time });
                }
            }
        });

        // 第二階段：配對 Response
        parsedLogs.forEach(log => {
            const lowerMsg = log.message.toLowerCase();
            const isResponse = lowerMsg.includes('response') && (log.message.includes('{') || log.message.includes('OutputChainData'));

            if (!isResponse) return;

            const keys = extractKeys(log.message);
            const responseTime = new Date(log.timestamp).getTime();
            let matchedRequest: LogEntry | undefined;
            let matchedKey = '';
            let matchMethod = '';

            // 策略 1: 精確 Key 匹配（優先）
            if (keys.length > 0) {
                for (const k of keys) {
                    if (requestLookup.has(k)) {
                        matchedRequest = requestLookup.get(k);
                        matchedKey = k;
                        matchMethod = 'Key';
                        break;
                    }
                }
            }

            // 策略 2: 時間序列配對（當找不到 Key 匹配時）
            if (!matchedRequest && requestsByTime.length > 0) {
                // 找到時間在 Response 之前且最接近的未配對 Request
                let closestRequest: { log: LogEntry, keys: string[], time: number } | undefined;
                let minTimeDiff = Infinity;

                for (const req of requestsByTime) {
                    const timeDiff = responseTime - req.time;

                    // 只考慮時間在 Response 之前且在合理範圍內的 Request（10 秒內）
                    if (timeDiff > 0 && timeDiff < 10000 && timeDiff < minTimeDiff) {
                        // 檢查這個 Request 是否已經被配對過
                        const alreadyMatched = groups.some(g => g.requestLog === req.log);
                        if (!alreadyMatched) {
                            closestRequest = req;
                            minTimeDiff = timeDiff;
                        }
                    }
                }

                if (closestRequest) {
                    matchedRequest = closestRequest.log;
                    matchedKey = closestRequest.keys[0] || 'Time';
                    matchMethod = 'Time';
                }
            }

            // 建立交易記錄
            if (matchedRequest) {
                const reqTime = new Date(matchedRequest.timestamp).getTime();
                const duration = responseTime - reqTime;

                // 判斷交易狀態：檢查 Status 是否為 Success
                let transactionStatus: 'success' | 'error' = 'success';
                if (log.level === 'ERROR') {
                    transactionStatus = 'error';
                } else if (log.message.includes('"Status"')) {
                    // 提取 Status 的值
                    const statusMatch = log.message.match(/"Status"\s*:\s*"([^"]+)"/);
                    if (statusMatch && statusMatch[1] !== 'Success') {
                        transactionStatus = 'error'; // Failure, Error, 或其他非 Success 值都視為錯誤
                    }
                } else if (log.message.includes('"ReturnCode": "API') && !log.message.includes('"ReturnCode": "API0001"')) {
                    transactionStatus = 'error';
                }

                groups.push({
                    id: `${matchedKey}-${responseTime}`,
                    requestLog: matchedRequest,
                    responseLog: log,
                    duration: isNaN(duration) ? 0 : duration,
                    status: transactionStatus,
                    keyInfo: matchMethod === 'Key' ? matchedKey : `${matchedKey} [時間配對]`,
                    timestamp: matchedRequest.timestamp
                });

                // 從 lookup 中移除（避免重複配對）
                if (matchMethod === 'Key') {
                    requestLookup.delete(matchedKey);
                }
            }
        });

        // 排序：最新的在上面
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
        setTransactions([]);
        setExpandedLogs(new Set());
        setSearchTerm('');
        setFilter('all');
        setSelectedTag('all');
        setViewMode('raw');
        setUploadProgress(0);
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const filteredLogs = parsedLogs.filter(log => {
        const searchUpper = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || log.message.toLowerCase().includes(searchUpper);

        const statusMatch = log.message.match(/"Status"\s*:\s*"([^"]+)"/);
        const isSuccess = (statusMatch && statusMatch[1] === 'Success') || log.message.includes('"ReturnCode": "API0001"');
        const isError = log.level === 'ERROR'
            || (statusMatch && statusMatch[1] !== 'Success')
            || (log.message.includes('"ReturnCode": "API') && !log.message.includes('"ReturnCode": "API0001"'));

        const matchesLevel = filter === 'all'
            || (filter === 'success' && isSuccess)
            || (filter === 'error' && isError);

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
        const matchesStatus = filter === 'all' || tx.status === filter;
        if (!searchTerm) return matchesStatus;
        const searchUpper = searchTerm.toLowerCase();
        const inReq = tx.requestLog.message.toLowerCase().includes(searchUpper);
        const inRes = tx.responseLog?.message.toLowerCase().includes(searchUpper);
        const inKey = tx.keyInfo.toLowerCase().includes(searchUpper);
        return matchesStatus && (inReq || inRes || inKey);
    });

    const currentListLength = viewMode === 'raw' ? filteredLogs.length : filteredTransactions.length;
    const totalPages = Math.max(1, Math.ceil(currentListLength / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const paginatedLogs = filteredLogs.slice(startIndex, startIndex + pageSize);
    const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + pageSize);

    const themeClasses = {
        bg: theme === 'dark' ? 'bg-slate-900/50' : 'bg-white',
        bgAlt: theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-50',
        bgHover: theme === 'dark' ? 'hover:bg-slate-800/40' : 'hover:bg-gray-100',
        text: theme === 'dark' ? 'text-slate-200' : 'text-gray-900',
        textSecondary: theme === 'dark' ? 'text-slate-400' : 'text-gray-600',
        textMuted: theme === 'dark' ? 'text-slate-500' : 'text-gray-500',
        border: theme === 'dark' ? 'border-slate-700/50' : 'border-gray-300',
        borderAlt: theme === 'dark' ? 'border-slate-700' : 'border-gray-300',
        input: theme === 'dark' ? 'bg-slate-700/50 text-slate-200 border-slate-600' : 'bg-white text-gray-900 border-gray-300',
        card: theme === 'dark' ? 'bg-slate-900 text-cyan-300' : 'bg-white text-gray-900',
        cardBorder: theme === 'dark' ? 'border-slate-800' : 'border-gray-200',
        gradient: theme === 'dark' ? 'from-slate-800 to-slate-900' : 'from-gray-100 to-gray-200',
        shadow: theme === 'dark' ? 'pro-shadow' : 'shadow-lg'
    };

    const getLogLevelColor = (level: string) => {
        if (theme === 'light') {
            switch (level.toUpperCase()) {
                case 'ERROR':
                    return 'text-red-700 bg-red-50 border-red-300';
                case 'WARN':
                    return 'text-yellow-700 bg-yellow-50 border-yellow-300';
                case 'INFO':
                    return 'text-blue-700 bg-blue-50 border-blue-300';
                default:
                    return 'text-gray-700 bg-gray-50 border-gray-300';
            }
        }
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
        errors: transactions.filter(tx => tx.status === 'error').length,
        success: transactions.filter(tx => tx.status === 'success').length
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
                    className={`group relative overflow-hidden bg-gradient-to-br ${theme === 'dark' ? 'from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white border-slate-700' : 'from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400 text-gray-900 border-gray-300'} font-semibold py-2 px-3 rounded-lg border transition-all duration-300 pro-shadow hover:pro-shadow-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    <div className="relative z-10 flex items-center justify-center gap-1.5">
                        <svg className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-slate-400 group-hover:text-slate-300' : 'text-gray-600 group-hover:text-gray-800'} transition-colors`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className={`${theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'} backdrop-blur-sm p-2 rounded-lg border ${theme === 'dark' ? 'border-red-500/30' : 'border-red-300'} ${themeClasses.shadow}`}>
                        <div className={`${theme === 'dark' ? 'text-red-400' : 'text-red-700'} text-[10px] font-semibold mb-0.5`}>錯誤</div>
                        <div className={`text-lg font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-700'}`}>{stats.errors}</div>
                    </div>
                    <div className={`${theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50'} backdrop-blur-sm p-2 rounded-lg border ${theme === 'dark' ? 'border-green-500/30' : 'border-green-300'} ${themeClasses.shadow}`}>
                        <div className={`${theme === 'dark' ? 'text-green-400' : 'text-green-700'} text-[10px] font-semibold mb-0.5`}>成功</div>
                        <div className={`text-lg font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>{stats.success}</div>
                    </div>
                    <div className={`${themeClasses.bgAlt} backdrop-blur-sm p-2 rounded-lg border ${themeClasses.border} ${themeClasses.shadow}`}>
                        <div className={`${themeClasses.textSecondary} text-[10px] font-semibold mb-0.5`}>總日誌數</div>
                        <div className={`text-lg font-bold ${themeClasses.text}`}>{stats.total}</div>
                    </div>
                </div>
            )}

            {/* 主要內容區域 */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-grow overflow-hidden">
                {/* 日誌分析結果區 */}
                <div className={`flex flex-col h-[600px] lg:h-full ${themeClasses.bg} rounded-2xl border ${themeClasses.border} ${themeClasses.shadow} overflow-hidden lg:col-span-4`}>
                    <div className={`flex flex-col gap-2 px-6 py-4 bg-gradient-to-r ${themeClasses.gradient} border-b ${themeClasses.border}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
                            <span className={`text-sm font-bold ${themeClasses.text} uppercase tracking-wider`}>分析結果</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-3 py-1 text-xs rounded-lg transition-all ${filter === 'all' ? 'bg-indigo-600 text-white' : `${theme === 'dark' ? 'bg-slate-700/50 text-slate-400 hover:bg-slate-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}`}
                            >
                                全部
                            </button>
                            <button
                                onClick={() => setFilter('error')}
                                className={`px-3 py-1 text-xs rounded-lg transition-all ${filter === 'error' ? 'bg-red-600 text-white' : `${theme === 'dark' ? 'bg-slate-700/50 text-slate-400 hover:bg-slate-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}`}
                            >
                                錯誤
                            </button>
                            <button
                                onClick={() => setFilter('success')}
                                className={`px-3 py-1 text-xs rounded-lg transition-all ${filter === 'success' ? 'bg-green-600 text-white' : `${theme === 'dark' ? 'bg-slate-700/50 text-slate-400 hover:bg-slate-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}`}
                            >
                                成功
                            </button>
                        </div>

                        <div className="w-full">
                            <div className="relative group w-full">
                                <div className={`absolute inset-y-0 left-0 flex items-center pl-3 ${themeClasses.textMuted} pointer-events-none`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="搜尋內容 (與標籤為 OR 關係)..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className={`w-full pl-10 pr-4 py-2 text-sm ${themeClasses.input} rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all`}
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setSelectedTag('all')}
                                className={`px-3 py-1 text-xs rounded-lg transition-all ${selectedTag === 'all' ? `${theme === 'dark' ? 'bg-slate-200 text-slate-900' : 'bg-indigo-100 text-gray-900'}` : `${theme === 'dark' ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}`}
                            >
                                全部標籤
                            </button>
                            {availableTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => setSelectedTag(tag)}
                                    className={`px-3 py-1 text-xs rounded-lg transition-all ${selectedTag === tag ? 'bg-indigo-500 text-white' : `${theme === 'dark' ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}`}
                                    title={tag}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={`flex items-center justify-between px-6 py-3 border-b ${themeClasses.border} ${themeClasses.bgAlt}`}>
                        <div className="flex items-center gap-4">
                            <div className={`text-xs ${themeClasses.textSecondary}`}>
                                顯示第 <span className={`${themeClasses.text} font-semibold`}>{currentListLength === 0 ? 0 : startIndex + 1}</span>
                                {' '}–{' '}
                                <span className={`${themeClasses.text} font-semibold`}>{Math.min(startIndex + pageSize, currentListLength)}</span>
                                {' '}筆 / 共{' '}
                                <span className={`${themeClasses.text} font-semibold`}>{currentListLength}</span> 筆
                            </div>

                            <div className={`flex ${themeClasses.bgAlt} rounded-lg p-0.5 border ${themeClasses.border}`}>
                                <button
                                    onClick={() => setViewMode('raw')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'raw' ? 'bg-indigo-600 text-white shadow-sm' : `${themeClasses.textSecondary} ${theme === 'dark' ? 'hover:text-slate-200' : 'hover:text-gray-900'}`}`}
                                >
                                    原始列表
                                </button>
                                <button
                                    onClick={() => setViewMode('transaction')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'transaction' ? 'bg-indigo-600 text-white shadow-sm' : `${themeClasses.textSecondary} ${theme === 'dark' ? 'hover:text-slate-200' : 'hover:text-gray-900'}`}`}
                                >
                                    交易檢視 (Beta)
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={safePage === 1}
                                className={`px-2 py-1 text-xs rounded-md border ${themeClasses.borderAlt} ${themeClasses.text} ${themeClasses.bgHover} disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                上一頁
                            </button>
                            <span className={`text-xs ${themeClasses.textSecondary}`}>{safePage} / {totalPages}</span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={safePage === totalPages}
                                className={`px-2 py-1 text-xs rounded-md border ${themeClasses.borderAlt} ${themeClasses.text} ${themeClasses.bgHover} disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                下一頁
                            </button>
                        </div>
                    </div>

                    <div className="flex-grow overflow-auto p-4 space-y-2">
                        {/* Raw Mode 渲染邏輯 */}
                        {viewMode === 'raw' && (
                            parsedLogs.length === 0 ? (
                                <div className={`h-full flex items-center justify-center ${themeClasses.textMuted}`}>
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
                                                        <span className={`text-[10px] px-1 rounded border w-fit ${theme === 'dark' ? 'text-slate-500 bg-slate-900/50 border-slate-700' : 'text-gray-600 bg-white/70 border-gray-300'}`}>
                                                            {isExpanded ? '收合' : '展開 JSON'}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`min-w-[140px] ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                                                    {log.timestamp.replace('T', ' ').split('.')[0]}
                                                </span>
                                                <div className="flex-1 overflow-hidden">
                                                    <div className={`${theme === 'dark' ? 'text-slate-200' : 'text-gray-900'} break-all ${!isExpanded && hasJSON ? 'line-clamp-2' : ''}`}>
                                                        {log.message}
                                                    </div>
                                                    {isExpanded && hasJSON && (
                                                        <div className="mt-3 relative group">
                                                            <div className={`absolute -inset-2 rounded-lg -z-10 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-gray-100'}`}></div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    navigator.clipboard.writeText(formattedJSON);
                                                                }}
                                                                className={`absolute top-2 right-2 z-10 p-1.5 rounded-md transition-colors border backdrop-blur-sm opacity-0 group-hover:opacity-100 focus:opacity-100 ${theme === 'dark' ? 'text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border-slate-700/50' : 'text-gray-600 hover:text-gray-900 bg-white/80 hover:bg-white border-gray-300'}`}
                                                                title="複製 JSON 內容"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                                                </svg>
                                                            </button>
                                                            <pre className={`p-3 rounded border overflow-x-auto text-[11px] leading-relaxed shadow-inner font-mono ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-green-400' : 'bg-white border-gray-200 text-emerald-700'}`}>
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
                                <div className={`flex flex-col items-center justify-center p-12 rounded-lg border border-dashed ${theme === 'dark' ? 'text-slate-500 border-slate-700' : 'text-gray-600 border-gray-300'}`}>
                                    <svg className={`w-12 h-12 mb-3 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <p>{searchTerm ? '找不到符合搜尋條件的交易' : '找不到可配對的 Request/Response 交易'}</p>
                                    <span className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-500'}`}>目前支援依據 ShopId, TSCode, OrderCode 等欄位自動配對</span>
                                </div>
                            ) : (
                                paginatedTransactions.map(tx => {
                                    const isExpanded = expandedLogs.has(tx.id);
                                    const reqJSON = tryFormatJSON(tx.requestLog.message);
                                    const resJSON = tx.responseLog ? tryFormatJSON(tx.responseLog.message) : null;

                                    return (
                                        <div key={tx.id} className={`rounded-lg overflow-hidden mb-2 border ${theme === 'dark' ? 'border-slate-700/50 bg-slate-800/20' : 'border-gray-300 bg-white'}`}>
                                            <div
                                                className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/40' : 'hover:bg-gray-100'}`}
                                                onClick={() => toggleExpand(tx.id)}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-2 h-2 rounded-full ${tx.status === 'success' ? 'bg-green-500' : tx.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                                    <span className={`text-xs font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                                                        {tx.timestamp.replace('T', ' ').split('.')[0]}
                                                    </span>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${theme === 'dark' ? 'text-slate-200 bg-slate-700/50 border-slate-600/50' : 'text-gray-900 bg-gray-100 border-gray-300'}`}>
                                                        {tx.keyInfo.split(':')[0]} <span className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'} font-normal`}>{tx.keyInfo.split(':')[1]}</span>
                                                    </span>
                                                </div>
                                                <div className={`flex items-center gap-4 text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                                                    {tx.duration !== undefined && (
                                                        <span className={`font-mono ${tx.duration > 1000 ? (theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700') : (theme === 'dark' ? 'text-green-400' : 'text-green-700')}`}>
                                                            {tx.duration}ms
                                                        </span>
                                                    )}
                                                    <span>
                                                        {isExpanded ? '收合詳情' : '查看詳情'}
                                                    </span>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className={`p-3 border-t grid grid-cols-1 md:grid-cols-2 gap-4 ${theme === 'dark' ? 'border-slate-700/50 bg-slate-900/30' : 'border-gray-200 bg-gray-50'}`}>
                                                    {/* Request Section */}
                                                    <div className="space-y-2">
                                                        <div className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-600'}`}>Request</div>
                                                        <div className="relative group">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    navigator.clipboard.writeText(reqJSON || tx.requestLog.message);
                                                                }}
                                                                className={`absolute top-2 right-2 z-10 p-1.5 rounded-md transition-colors border backdrop-blur-sm opacity-0 group-hover:opacity-100 focus:opacity-100 ${theme === 'dark' ? 'text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border-slate-700/50' : 'text-gray-600 hover:text-gray-900 bg-white/80 hover:bg-white border-gray-300'}`}
                                                                title="複製 Request 內容"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                                                </svg>
                                                            </button>
                                                            <pre className={`text-[10px] font-mono p-2 rounded border overflow-x-auto ${theme === 'dark' ? 'text-slate-300 bg-slate-950 border-slate-800' : 'text-gray-800 bg-white border-gray-200'}`}>
                                                                {reqJSON || tx.requestLog.message}
                                                            </pre>
                                                        </div>
                                                    </div>

                                                    {/* Response Section */}
                                                    <div className="space-y-2">
                                                        <div className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-600'}`}>Response</div>
                                                        {tx.responseLog ? (
                                                            <div className="relative group">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        navigator.clipboard.writeText(resJSON || tx.responseLog.message);
                                                                    }}
                                                                    className={`absolute top-2 right-2 z-10 p-1.5 rounded-md transition-colors border backdrop-blur-sm opacity-0 group-hover:opacity-100 focus:opacity-100 ${theme === 'dark' ? 'text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border-slate-700/50' : 'text-gray-600 hover:text-gray-900 bg-white/80 hover:bg-white border-gray-300'}`}
                                                                    title="複製 Response 內容"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                                                    </svg>
                                                                </button>
                                                                <pre className={`text-[10px] font-mono p-2 rounded border overflow-x-auto ${tx.status === 'error' ? (theme === 'dark' ? 'text-red-300 border-red-900/30 bg-slate-950' : 'text-red-700 border-red-300 bg-white') : (theme === 'dark' ? 'text-green-300 bg-slate-950 border-slate-800' : 'text-green-700 bg-white border-gray-200')}`}>
                                                                    {resJSON || tx.responseLog.message}
                                                                </pre>
                                                            </div>
                                                        ) : (
                                                            <div className={`text-xs italic p-2 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-600'}`}>等待回應中...</div>
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
                <div className={`flex flex-col h-[600px] lg:h-full ${themeClasses.bg} rounded-2xl border ${themeClasses.border} ${themeClasses.shadow} overflow-hidden lg:col-span-1`}>
                    <EditorHeader
                        title="日誌輸入"
                        secondaryLabel="清除"
                        secondaryAction={() => setLogInput('')}
                        theme={theme}
                    />
                    <div className="relative flex-grow overflow-hidden">
                        <textarea
                            className={`w-full h-full ${themeClasses.card} p-6 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 leading-relaxed`}
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
