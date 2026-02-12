import React from 'react';
import { NavLink } from 'react-router-dom';

const Navigation: React.FC = () => {
    return (
        <header className="mb-4 bg-gradient-to-r from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl pro-shadow border border-slate-700/50 overflow-hidden">
            {/* Logo 和標題區域 */}
            <div className="flex items-center gap-2 p-3 border-b border-slate-700/50">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-1.5 rounded-lg pro-shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z" />
                        <path d="M10 21.9V14L2.1 9.1" />
                        <path d="m10 14 11.9-6.9" />
                        <path d="M14 19.8v-8.1" />
                        <path d="M18 17.5V9.4" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">
                        Dev Tools
                    </h1>
                    <p className="text-slate-400 text-[10px] mt-0.5">
                        91.IS 工具平台
                    </p>
                </div>
            </div>

            {/* 導航選單 */}
            <nav className="px-3 py-1.5 flex gap-1.5">
                <NavLink
                    to="/jsonTool"
                    className={({ isActive }) =>
                        `group relative px-3 py-1.5 rounded-lg font-semibold text-xs transition-all duration-300 ${isActive
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white pro-shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`
                    }
                >
                    {({ isActive }) => (
                        <>
                            <div className="flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                                <span>JSON 工具</span>
                            </div>
                            {isActive && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-400 to-purple-400"></div>
                            )}
                        </>
                    )}
                </NavLink>

                <NavLink
                    to="/logAnalyzer"
                    className={({ isActive }) =>
                        `group relative px-3 py-1.5 rounded-lg font-semibold text-xs transition-all duration-300 ${isActive
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white pro-shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`
                    }
                >
                    {({ isActive }) => (
                        <>
                            <div className="flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span>日誌分析</span>
                            </div>
                            {isActive && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-400 to-purple-400"></div>
                            )}
                        </>
                    )}
                </NavLink>
            </nav>
        </header>
    );
};

export default Navigation;
