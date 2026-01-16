
import React, { useState, useCallback, useRef } from 'react';
import { nullifyTransform, smartTransform } from './services/transformer.ts';
import EditorHeader from './components/EditorHeader.tsx';
import { JSONState } from './types.ts';

const App: React.FC = () => {
  const [state, setState] = useState<JSONState>({
    input: '',
    output: '',
    error: null,
    fileName: null
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const triggerTransform = (type: 'nullify' | 'smart') => {
    try {
      const parsed = JSON.parse(state.input);
      const transformed = type === 'nullify' ? nullifyTransform(parsed) : smartTransform(parsed);
      setState(prev => ({
        ...prev,
        output: JSON.stringify(transformed, null, 2),
        error: null
      }));
    } catch (err) {
      setState(prev => ({ ...prev, error: "Invalid JSON input. Please check your syntax." }));
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
    <div className="min-h-screen flex flex-col p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <span className="bg-indigo-600 p-2 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z"/><path d="M10 21.9V14L2.1 9.1"/><path d="m10 14 11.9-6.9"/><path d="M14 19.8v-8.1"/><path d="M18 17.5V9.4"/></svg>
          </span>
          JSON Morph
        </h1>
        <p className="text-slate-400">Professional JSON data structure transformation and sanitization tool.</p>
      </header>

      <div className="flex flex-wrap gap-4 mb-6">
        <button
          onClick={() => triggerTransform('nullify')}
          disabled={!state.input}
          className="flex-1 min-w-[200px] flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-xl border border-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          Transform to Null
        </button>
        <button
          onClick={() => triggerTransform('smart')}
          disabled={!state.input}
          className="flex-1 min-w-[200px] flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg shadow-indigo-500/20"
        >
          Smart Transform
        </button>
        <button
          onClick={clearAll}
          className="bg-slate-800 hover:bg-red-900/30 hover:text-red-400 text-slate-400 font-semibold py-3 px-6 rounded-xl border border-slate-700 transition-all flex items-center gap-2"
        >
          Clear
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow overflow-hidden">
        <div className="flex flex-col h-[500px] lg:h-full">
          <EditorHeader 
            title="Input JSON" 
            actionLabel="Upload File"
            onAction={() => fileInputRef.current?.click()}
            secondaryLabel="Paste Sample"
            secondaryAction={() => setState(prev => ({...prev, input: '{\n  "id": 12345,\n  "name": "Jane Doe",\n  "active": true,\n  "createdAt": "2023-10-27T10:00:00Z",\n  "metadata": {\n    "source": "web",\n    "tags": ["dev", "beta"]\n  }\n}'}))}
          />
          <div className="relative flex-grow">
            <textarea
              className="w-full h-full bg-slate-900 text-indigo-300 p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 border-x border-b border-slate-700 rounded-b-lg"
              placeholder="Paste your JSON here..."
              value={state.input}
              onChange={handleInputChange}
            />
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileUpload} />
          </div>
        </div>

        <div className="flex flex-col h-[500px] lg:h-full">
          <EditorHeader 
            title="Result Output" 
            actionLabel="Download JSON"
            onAction={downloadOutput}
            disabled={!state.output}
            secondaryLabel="Copy"
            secondaryAction={() => copyToClipboard(state.output)}
          />
          <div className="relative flex-grow">
            {state.error ? (
              <div className="w-full h-full bg-red-900/10 border border-red-500/50 p-4 text-red-400 font-medium rounded-b-lg flex items-center justify-center">
                {state.error}
              </div>
            ) : (
              <textarea
                className="w-full h-full bg-slate-900/50 text-emerald-400 p-4 font-mono text-sm resize-none focus:outline-none border-x border-b border-slate-700 rounded-b-lg"
                readOnly
                placeholder="Result..."
                value={state.output}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
