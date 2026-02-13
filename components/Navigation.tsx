import React from 'react';
import { NavLink } from 'react-router-dom';

interface NavigationProps {
    theme: 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
}

const Navigation: React.FC<NavigationProps> = ({ theme, setTheme }) => {
    const isDark = theme === 'dark';

    return (
        <header className={`mb-4 ${isDark ? 'bg-gradient-to-r from-slate-800/50 to-slate-900/50' : 'bg-gradient-to-r from-gray-100 to-gray-200'} backdrop-blur-sm rounded-xl ${isDark ? 'pro-shadow' : 'shadow-lg'} border ${isDark ? 'border-slate-700/50' : 'border-gray-300'} overflow-hidden`}>
            {/* Logo 和標題區域 */}
            <div className={`flex items-center justify-between gap-2 p-3 border-b ${isDark ? 'border-slate-700/50' : 'border-gray-300'}`}>
                <div className="flex items-center gap-2">
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
                        <h1 className={`text-lg md:text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} tracking-tight`}>
                            Dev Tools
                        </h1>
                        <p className={`${isDark ? 'text-slate-400' : 'text-gray-600'} text-[10px] mt-0.5`}>
                            91.IS 工具平台
                        </p>
                    </div>
                </div>

                {/* 主題切換按鈕 */}
                <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="group relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold py-2 px-3 rounded-lg transition-all duration-300 pro-shadow-lg hover:scale-105 text-xs"
                    title={theme === 'dark' ? '切換至淺色模式' : '切換至深色模式'}
                >
                    <div className="relative z-10 flex items-center justify-center gap-1.5">
                        {theme === 'dark' ? (
                            <>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                                </svg>
                                <span className="hidden sm:inline">淺色</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                </svg>
                                <span className="hidden sm:inline">深色</span>
                            </>
                        )}
                    </div>
                </button>
            </div>

            {/* 導航選單 */}
            <nav className="px-3 py-1.5 flex gap-1.5">
                <NavLink
                    to="/jsonTool"
                    className={({ isActive }) =>
                        `group relative px-3 py-1.5 rounded-lg font-semibold text-xs transition-all duration-300 ${isActive
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white pro-shadow-lg'
                            : `${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'}`
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
                            : `${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'}`
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
