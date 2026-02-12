
import React from 'react';

interface EditorHeaderProps {
  title: string;
  onAction?: () => void;
  actionLabel?: string;
  secondaryAction?: () => void;
  secondaryLabel?: string;
  disabled?: boolean;
}

const EditorHeader: React.FC<EditorHeaderProps> = ({
  title,
  onAction,
  actionLabel,
  secondaryAction,
  secondaryLabel,
  disabled
}) => {
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
        <span className="text-sm font-bold text-slate-200 uppercase tracking-wider">{title}</span>
      </div>
      <div className="flex gap-2">
        {secondaryAction && (
          <button
            onClick={secondaryAction}
            disabled={disabled}
            className="group flex items-center gap-2 text-xs px-3 py-2 bg-slate-700/50 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-600/50 hover:border-slate-500"
          >
            <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="font-medium">{secondaryLabel}</span>
          </button>
        )}
        {onAction && (
          <button
            onClick={onAction}
            disabled={disabled}
            className="group flex items-center gap-2 text-xs px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            <span className="font-medium">{actionLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default EditorHeader;
