import React, { useState, useRef, useEffect } from 'react';
import { nullifyTransform, smartTransform, cleanJsonString } from '../services/transformer.ts';
import EditorHeader from '../components/EditorHeader.tsx';
import { JSONState } from '../types.ts';

interface JsonToolProps {
    theme: 'dark' | 'light';
}

const JsonTool: React.FC<JsonToolProps> = ({ theme }) => {
    const [state, setState] = useState<JSONState>({
        input: '',
        output: '',
        error: null,
        fileName: null
    });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const outputContainerRef = useRef<HTMLPreElement>(null);

    // 搜尋相關狀態
    const [searchQuery, setSearchQuery] = useState('');
    const [useRegex, setUseRegex] = useState(false);
    const [matches, setMatches] = useState<{start: number, end: number}[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

    // 處理搜尋與 Regex 匹配
    useEffect(() => {
        if (!searchQuery || !state.output) {
            setMatches([]);
            setCurrentMatchIndex(-1);
            return;
        }

        try {
            const regexStr = useRegex 
                ? searchQuery 
                : searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // 使用 gi 確保全域且不分大小寫搜索
            const regex = new RegExp(regexStr, 'gi');
            
            const text = state.output;
            const newMatches: {start: number, end: number}[] = [];
            let match;
            
            // 避免空字串導致的無限迴圈
            if (regexStr.length === 0) {
                return;
            }

            while ((match = regex.exec(text)) !== null) {
                newMatches.push({ start: match.index, end: regex.lastIndex });
                if (match.index === regex.lastIndex) {
                    regex.lastIndex++;
                }
            }
            
            setMatches(newMatches);
            setCurrentMatchIndex(newMatches.length > 0 ? 0 : -1);
        } catch (e) {
            // Regex 語法錯誤時默默忽略或清空結果
            setMatches([]);
            setCurrentMatchIndex(-1);
        }
    }, [searchQuery, useRegex, state.output]);

    // 捲動到當前選中的標記
    useEffect(() => {
        if (currentMatchIndex >= 0 && outputContainerRef.current) {
            const marks = outputContainerRef.current.querySelectorAll('mark');
            const activeMark = marks[currentMatchIndex];
            if (activeMark) {
                activeMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentMatchIndex]);

    const handleNextMatch = () => {
        if (matches.length > 0) {
            setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
        }
    };

    const handlePrevMatch = () => {
        if (matches.length > 0) {
            setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
        }
    };

    // 渲染高亮的 JSON 結果
    const renderHighlightedText = () => {
        if (!state.output) return null;
        if (matches.length === 0) return state.output;

        const parts: React.ReactNode[] = [];
        let lastIndex = 0;

        matches.forEach((match, index) => {
            if (match.start > lastIndex) {
                parts.push(state.output.substring(lastIndex, match.start));
            }
            const isCurrent = index === currentMatchIndex;
            parts.push(
                <mark
                    key={index}
                    data-match-index={index}
                    className={`${isCurrent ? 'bg-orange-500 text-white shadow-sm' : 'bg-yellow-300/80 text-yellow-900'} rounded-sm px-0.5 transition-colors`}
                >
                    {state.output.substring(match.start, match.end)}
                </mark>
            );
            lastIndex = match.end;
        });

        if (lastIndex < state.output.length) {
            parts.push(state.output.substring(lastIndex));
        }

        return parts;
    };
    const isDark = theme === 'dark';
    const themeClasses = {
        panel: isDark ? 'bg-slate-900/50 border-slate-700/50 pro-shadow' : 'bg-white border-gray-200 shadow-lg',
        textareaInput: isDark ? 'bg-slate-900 text-cyan-300' : 'bg-white text-gray-900',
        textareaOutput: isDark ? 'bg-slate-900 text-emerald-300' : 'bg-white text-emerald-700',
        buttonNeutral: isDark ? 'from-slate-800 to-slate-900 border-slate-700 text-white' : 'from-gray-200 to-gray-300 border-gray-300 text-gray-900',
        buttonPrimary: isDark ? 'from-indigo-600 to-purple-600 text-white' : 'from-indigo-200 to-purple-200 text-gray-900',
        buttonCyan: isDark ? 'from-cyan-600 to-cyan-700 text-white' : 'from-cyan-200 to-cyan-300 text-gray-900',
        buttonBlue: isDark ? 'from-blue-600 to-blue-700 text-white' : 'from-blue-200 to-blue-300 text-gray-900',
        buttonGreen: isDark ? 'from-emerald-600 to-emerald-700 text-white' : 'from-emerald-200 to-emerald-300 text-gray-900',
        clearButton: isDark ? 'bg-slate-800/50 hover:bg-red-900/30 text-slate-300 hover:text-red-400 border-slate-700 hover:border-red-500/50' : 'bg-gray-100 hover:bg-red-50 text-gray-800 hover:text-red-700 border-gray-300 hover:border-red-300'
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setState(prev => ({ ...prev, input: e.target.value, error: null }));
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setState(prev => ({
                ...prev,
                input: content,
                fileName: file.name,
                error: null
            }));
        };
        reader.readAsText(file);
    };

    const triggerTransform = (type: 'nullify' | 'smart' | 'compact' | 'format' | 'clean_format') => {
        try {
            let inputStr = state.input;

            // 如果是清理并格式化，先清理特殊字符
            if (type === 'clean_format') {
                inputStr = cleanJsonString(inputStr);
            }

            const parsed = JSON.parse(inputStr);
            let output = '';

            if (type === 'nullify') {
                const transformed = nullifyTransform(parsed);
                output = JSON.stringify(transformed, null, 2);
            } else if (type === 'smart') {
                const transformed = smartTransform(parsed);
                output = JSON.stringify(transformed, null, 2);
            } else if (type === 'compact') {
                output = JSON.stringify(parsed);
            } else if (type === 'format') {
                output = JSON.stringify(parsed, null, 2);
            } else if (type === 'clean_format') {
                output = JSON.stringify(parsed, null, 2);
            }

            setState(prev => ({
                ...prev,
                output,
                error: null
            }));
        } catch (err) {
            setState(prev => ({ ...prev, error: "無效的 JSON 格式，請檢查您的語法。" }));
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const downloadOutput = () => {
        if (!state.output) return;
        const blob = new Blob([state.output], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = state.fileName ? `transformed_${state.fileName}` : 'transformed.json';
        link.click();
        URL.revokeObjectURL(url);
    };

    const clearAll = () => {
        setState({
            input: '',
            output: '',
            error: null,
            fileName: null
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <>
            {/* 操作按鈕區域 - 專業工具風格 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                <button
                    onClick={() => triggerTransform('nullify')}
                    disabled={!state.input}
                    className={`group relative overflow-hidden bg-gradient-to-br ${themeClasses.buttonNeutral} ${isDark ? 'hover:from-slate-700 hover:to-slate-800' : 'hover:from-gray-300 hover:to-gray-400'} font-semibold py-2 px-3 rounded-lg border transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed pro-shadow hover:pro-shadow-lg text-xs`}
                >
                    <div className="relative z-10 flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>轉換為空值</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </button>

                <button
                    onClick={() => triggerTransform('smart')}
                    disabled={!state.input}
                    className={`group relative overflow-hidden bg-gradient-to-br ${themeClasses.buttonPrimary} ${isDark ? 'hover:from-indigo-500 hover:to-purple-500' : 'hover:from-indigo-300 hover:to-purple-300'} font-semibold py-2 px-3 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed pro-shadow-lg hover:scale-[1.02] text-xs`}
                >
                    <div className="relative z-10 flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>智慧轉換</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </button>

                <button
                    onClick={() => triggerTransform('clean_format')}
                    disabled={!state.input}
                    className={`group relative overflow-hidden bg-gradient-to-br ${themeClasses.buttonCyan} ${isDark ? 'hover:from-cyan-500 hover:to-cyan-600' : 'hover:from-cyan-300 hover:to-cyan-400'} font-semibold py-2 px-3 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed pro-shadow-lg hover:scale-[1.02] text-xs`}
                >
                    <div className="relative z-10 flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>清理並格式化</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </button>

                <button
                    onClick={() => triggerTransform('format')}
                    disabled={!state.input}
                    className={`group relative overflow-hidden bg-gradient-to-br ${themeClasses.buttonBlue} ${isDark ? 'hover:from-blue-500 hover:to-blue-600' : 'hover:from-blue-300 hover:to-blue-400'} font-semibold py-2 px-3 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed pro-shadow-lg hover:scale-[1.02] text-xs`}
                >
                    <div className="relative z-10 flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                        <span>格式化美化</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </button>

                <button
                    onClick={() => triggerTransform('compact')}
                    disabled={!state.input}
                    className={`group relative overflow-hidden bg-gradient-to-br ${themeClasses.buttonGreen} ${isDark ? 'hover:from-emerald-500 hover:to-emerald-600' : 'hover:from-emerald-300 hover:to-emerald-400'} font-semibold py-2 px-3 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed pro-shadow-lg hover:scale-[1.02] text-xs`}
                >
                    <div className="relative z-10 flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                        <span>壓縮極簡</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </button>
            </div>

            {/* 清除按鈕 */}
            <div className="mb-3">
                <button
                    onClick={clearAll}
                    className={`group relative overflow-hidden ${themeClasses.clearButton} font-semibold py-1.5 px-3 rounded-lg border transition-all duration-300 pro-shadow w-full md:w-auto text-xs`}
                >
                    <div className="flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>清除全部</span>
                    </div>
                </button>
            </div>

            {/* 編輯器區域 - 專業雙欄布局 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow overflow-hidden">
                {/* 輸入編輯器 */}
                <div className={`flex flex-col h-[600px] lg:h-full ${themeClasses.panel} rounded-2xl border overflow-hidden`}>
                    <EditorHeader
                        title="輸入 JSON"
                        actionLabel="上傳檔案"
                        onAction={() => fileInputRef.current?.click()}
                        theme={theme}
                        secondaryLabel="載入範例"
                        secondaryAction={() => setState(prev => ({ ...prev, input: '{\n  "id": 12345,\n  "name": "Jane Doe",\n  "email": "jane@example.com",\n  "active": true,\n  "createdAt": "2023-10-27T10:00:00Z",\n  "metadata": {\n    "source": "web",\n    "tags": ["dev", "beta"],\n    "preferences": {\n      "theme": "dark",\n      "notifications": true\n    }\n  }\n}' }))}
                    />
                    <div className="relative flex-grow overflow-hidden">
                        <textarea
                            className={`w-full h-full ${themeClasses.textareaInput} p-6 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 leading-relaxed`}
                            placeholder="📝 在此貼上或輸入您的 JSON 資料..."
                            value={state.input}
                            onChange={handleInputChange}
                            spellCheck={false}
                        />
                        <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileUpload} />
                        {state.fileName && (
                            <div className="absolute top-2 right-2 bg-indigo-600/90 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-lg flex items-center gap-2 pro-shadow">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                {state.fileName}
                            </div>
                        )}
                    </div>
                </div>

                {/* 輸出編輯器 */}
                <div className={`flex flex-col h-[600px] lg:h-full ${themeClasses.panel} rounded-2xl border overflow-hidden`}>
                    <EditorHeader
                        title="轉換結果"
                        actionLabel="下載"
                        onAction={downloadOutput}
                        disabled={!state.output}
                        theme={theme}
                        secondaryLabel="複製"
                        secondaryAction={() => copyToClipboard(state.output)}
                    />
                    <div className="relative flex-grow overflow-hidden">
                        {state.error ? (
                            <div className="w-full h-full bg-gradient-to-br from-red-900/20 to-red-800/10 border-2 border-red-500/30 p-6 flex items-center justify-center">
                                <div className="text-center">
                                    <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-red-400 font-medium text-lg mb-2">轉換錯誤</p>
                                    <p className="text-red-300/80 text-sm">{state.error}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col w-full h-full">
                                {/* 搜尋區塊 */}
                                {state.output && (
                                    <div className={`flex items-center gap-3 p-3 border-b border-t ${isDark ? 'bg-slate-800/80 border-slate-700/50' : 'bg-gray-50 border-gray-200'} shrink-0`}>
                                        <div className="relative flex-grow max-w-sm">
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder={useRegex ? "輸入 Regular Expression..." : "搜尋文字..."}
                                                className={`w-full pl-9 pr-3 py-1.5 text-sm rounded border ${isDark ? 'bg-slate-900 border-slate-600 focus:border-indigo-500 text-slate-200 placeholder-slate-500' : 'bg-white border-gray-300 focus:border-indigo-500'} focus:ring-1 focus:ring-indigo-500 outline-none`}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        e.shiftKey ? handlePrevMatch() : handleNextMatch();
                                                    }
                                                }}
                                                spellCheck={false}
                                            />
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                            </div>
                                        </div>
                                        
                                        <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                                            <input 
                                                type="checkbox" 
                                                checked={useRegex} 
                                                onChange={(e) => setUseRegex(e.target.checked)}
                                                className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                            />
                                            <span className={isDark ? 'text-slate-300' : 'text-gray-600'}>Regex</span>
                                        </label>

                                        <div className="flex items-center gap-1 ml-auto">
                                            <span className={`text-xs mr-2 whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                                                {searchQuery && matches.length > 0 ? `${currentMatchIndex + 1} / ${matches.length}` : (searchQuery ? '無結果' : '')}
                                            </span>
                                            <button 
                                                onClick={handlePrevMatch}
                                                disabled={matches.length === 0}
                                                className={`p-1 rounded ${isDark ? 'hover:bg-slate-700 text-slate-300 disabled:opacity-30' : 'hover:bg-gray-200 text-gray-600 disabled:opacity-30'} transition-colors`}
                                                title="上一個 (Shift+Enter)"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                </svg>
                                            </button>
                                            <button 
                                                onClick={handleNextMatch}
                                                disabled={matches.length === 0}
                                                className={`p-1 rounded ${isDark ? 'hover:bg-slate-700 text-slate-300 disabled:opacity-30' : 'hover:bg-gray-200 text-gray-600 disabled:opacity-30'} transition-colors`}
                                                title="下一個 (Enter)"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                <pre
                                    ref={outputContainerRef}
                                    className={`w-full flex-grow ${themeClasses.textareaOutput} p-6 font-mono text-sm overflow-auto leading-relaxed whitespace-pre m-0 outline-none`}
                                    style={{ tabSize: 2 }}
                                >
                                    {state.output ? renderHighlightedText() : <span className="opacity-50">✨ 轉換結果將顯示在此處...</span>}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default JsonTool;
