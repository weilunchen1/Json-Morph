
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
};

export default EditorHeader;
