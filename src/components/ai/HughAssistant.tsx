import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Trash2, Palette, Loader2, ChevronDown, Sparkles } from 'lucide-react';
import { useHugh, HughMessage } from '../../contexts/HughContext';
import { supabase } from '../../utils/supabase';

// ── Markdown-lite renderer (bold, bullets, line breaks) ──────────────────────
function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Bullet list item
    if (/^[-*•]\s/.test(line)) {
      const bulletLines: string[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) {
        bulletLines.push(lines[i].replace(/^[-*•]\s/, ''));
        i++;
      }
      elements.push(
        <ul key={i} className="list-disc list-inside space-y-0.5 my-1 pl-1">
          {bulletLines.map((bl, bi) => (
            <li key={bi} className="text-sm">{renderInline(bl)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const numLines: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        numLines.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={i} className="list-decimal list-inside space-y-0.5 my-1 pl-1">
          {numLines.map((nl, ni) => (
            <li key={ni} className="text-sm">{renderInline(nl)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Heading
    if (/^#{1,3}\s/.test(line)) {
      const content = line.replace(/^#{1,3}\s/, '');
      elements.push(
        <p key={i} className="text-sm font-semibold text-gray-900 dark:text-white mt-2 mb-0.5">
          {renderInline(content)}
        </p>
      );
      i++;
      continue;
    }

    // Empty line → spacing
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-1" />);
      i++;
      continue;
    }

    // Normal paragraph
    elements.push(
      <p key={i} className="text-sm leading-relaxed">{renderInline(line)}</p>
    );
    i++;
  }

  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\*\*[^*]+\*\*$/.test(part) ? (
          <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

// ── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: HughMessage }) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mr-2 mt-0.5 shadow">
          <Palette className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-white dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-[#2D3B4E] rounded-bl-sm'
        }`}
      >
        {msg.isLoading ? (
          <div className="flex items-center space-x-1.5 py-0.5">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
          </div>
        ) : isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="prose-sm dark:prose-invert max-w-none">
            {renderMarkdown(msg.content)}
          </div>
        )}
        <p className={`text-[10px] mt-1 ${isUser ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>
          {msg.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

// ── Suggested prompts ────────────────────────────────────────────────────────
const SUGGESTED_PROMPTS = [
  'What jobs are currently in Work Order phase?',
  'Which subcontractors have the most active jobs?',
  'List properties with jobs scheduled this week',
  'Recommend a subcontractor for a new painting job',
  'Show me jobs that haven\'t moved phases recently',
  'What are all the active properties?',
];

// ── Main component ───────────────────────────────────────────────────────────
export function HughAssistant() {
  const { isOpen, closeHugh, messages, addMessage, updateMessage, clearMessages, isLoading, setIsLoading } = useHugh();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Click-outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Only close if click is not on the topbar trigger button
        const trigger = document.getElementById('hugh-trigger-btn');
        if (trigger && trigger.contains(e.target as Node)) return;
        closeHugh();
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, closeHugh]);

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;

    setInput('');
    addMessage('user', content);

    // Build history for context (last 10 messages)
    const history = messages.slice(-10).map(m => ({
      role: m.role,
      content: m.content,
    }));

    const loadingId = addMessage('assistant', '');
    updateMessage(loadingId, '', true);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('hugh-ai', {
        body: { message: content, history },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      updateMessage(loadingId, data.reply || 'Sorry, I could not generate a response.', false);
    } catch (err) {
      updateMessage(
        loadingId,
        `⚠️ ${err instanceof Error ? err.message : 'Something went wrong. Please try again.'}`,
        false
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, addMessage, updateMessage, setIsLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  const showSuggestions = messages.length === 0;

  return (
    <div
      ref={panelRef}
      className="fixed top-[72px] left-1/2 -translate-x-1/2 w-[560px] max-w-[calc(100vw-1rem)] bg-gray-50 dark:bg-[#0F172A] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#1E293B] flex flex-col z-[9999] overflow-hidden"
      style={{ maxHeight: 'calc(100vh - 90px)', height: '620px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-500 flex-shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Palette className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-none">Hugh</h3>
            <p className="text-[10px] text-purple-100 leading-none mt-0.5">AI Assistant • JG Painting Pros</p>
          </div>
          <div className="flex items-center space-x-1 bg-white/20 rounded-full px-2 py-0.5">
            <Sparkles className="w-2.5 h-2.5 text-white" />
            <span className="text-[10px] text-white font-medium">Gemini</span>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              title="Clear conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={closeHugh}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            title="Close"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        {showSuggestions ? (
          <div className="h-full flex flex-col justify-center">
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Palette className="w-6 h-6 text-white" />
              </div>
              <h4 className="text-base font-semibold text-gray-900 dark:text-white">Hi, I'm Hugh!</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[280px] mx-auto">
                Ask me anything about jobs, properties, subcontractors, phases, schedules — I have live access to your data.
              </p>
            </div>
            <div className="space-y-2">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt)}
                  className="w-full text-left text-xs px-3 py-2.5 rounded-xl bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#2D3B4E] text-gray-700 dark:text-gray-300 hover:border-purple-400 dark:hover:border-purple-500 hover:text-purple-700 dark:hover:text-purple-300 transition-all shadow-sm"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-[#1E293B] bg-white dark:bg-[#0F172A] px-3 py-3">
        <div className="flex items-end space-x-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Hugh anything…"
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-[#2D3B4E] bg-gray-50 dark:bg-[#1E293B] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 transition-all disabled:opacity-50 max-h-28 overflow-y-auto"
            style={{ lineHeight: '1.4' }}
            onInput={e => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = `${Math.min(t.scrollHeight, 112)}px`;
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shadow-sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1.5 text-center">
          Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
