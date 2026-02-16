import React, { useState, useRef } from 'react';
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

        // 檔案大小限制：10MB
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            setState(prev => ({ ...prev, error: "檔案大小超過限制（最大 10MB）" }));
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // 檔案類型驗證
        const allowedTypes = ['application/json', 'text/plain', ''];
        if (!allowedTypes.includes(file.type) && !file.name.endsWith('.json')) {
            setState(prev => ({ ...prev, error: "僅支援 JSON 檔案格式" }));
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

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
        reader.onerror = () => {
            setState(prev => ({ ...prev, error: "檔案讀取失敗" }));
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
                            <textarea
                                className={`w-full h-full ${themeClasses.textareaOutput} p-6 font-mono text-sm resize-none focus:outline-none leading-relaxed`}
                                readOnly
                                placeholder="✨ 轉換結果將顯示在此處..."
                                value={state.output}
                                spellCheck={false}
                            />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default JsonTool;
