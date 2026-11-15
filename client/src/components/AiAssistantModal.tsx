import React, { useState } from 'react';
import { CareProfile } from '../types';
import { Sparkles, Send, Bot, User as UserIcon, ShieldAlert, CheckCircle, X, Loader2 } from 'lucide-react';
import { apiRequest } from '../api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  source?: string;
}

interface AiAssistantModalProps {
  profile: CareProfile;
  onClose: () => void;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({ profile, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hello! I am your Sahaaya Care assistant for ${profile.display_name}. I can explain today's care plan, review recent dose acknowledgements, check for appointment conflicts, or summarize routines for family members. How can I help you today?`,
      source: 'SAHAAYA_CORE'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await apiRequest('/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: textToSend,
          careProfileId: profile.id
        })
      });

      const assistantMsg: Message = {
        role: 'assistant',
        content: res.reply,
        source: res.source
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `I'm having trouble connecting to the care service right now: ${err.message}. Please try again shortly.`,
          source: 'ERROR'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full h-[85vh] max-h-[720px] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden">

        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-teal-800 to-teal-950 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                Ask Sahaaya
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-700/80 text-teal-200">
                  Gemini 3.8 Flash Grounded
                </span>
              </h2>
              <p className="text-xs text-teal-200 mt-0.5">
                Care coordination assistant for {profile.display_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-teal-200 hover:text-white hover:bg-teal-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Disclaimer Banner */}
        <div className="bg-amber-50 px-4 py-2 border-b border-amber-200 text-[11px] text-amber-900 flex items-center gap-2 flex-shrink-0 font-medium">
          <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <span>Informational assistant grounded in authorized care records. Not a doctor or emergency service. Never alters prescriptions automatically.</span>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center flex-shrink-0 text-sm mt-1">
                  🌿
                </div>
              )}
              <div
                className={`max-w-[82%] rounded-2xl p-4 text-sm leading-relaxed ${msg.role === 'user'
                    ? 'bg-teal-700 text-white rounded-tr-none font-medium'
                    : 'bg-slate-100 text-slate-900 rounded-tl-none border border-slate-200 whitespace-pre-wrap'
                  }`}
              >
                {msg.content}

                {msg.source && msg.role === 'assistant' && (
                  <div className="mt-2 text-[10px] text-slate-400 font-mono flex items-center gap-1 border-t border-slate-200/60 pt-1">
                    <span>Source: {msg.source}</span>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center flex-shrink-0 text-xs mt-1">
                  You
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 items-center text-slate-500 text-xs font-semibold">
              <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-teal-700" />
              </div>
              <span>Sahaaya is reviewing authorized care records...</span>
            </div>
          )}
        </div>

        {/* Pre-canned Quick Query Pills */}
        <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 overflow-x-auto flex gap-2 flex-shrink-0">
          <button
            onClick={() => handleSend("What medicines are due today?")}
            className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white border border-slate-300 hover:border-teal-500 text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
          >
            💊 What's due today?
          </button>
          <button
            onClick={() => handleSend("Check for routine or appointment schedule conflicts")}
            className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white border border-slate-300 hover:border-teal-500 text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
          >
            ⚠️ Check routine conflicts
          </button>
          <button
            onClick={() => handleSend("Summarize the last 7 days of medication adherence")}
            className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white border border-slate-300 hover:border-teal-500 text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
          >
            📊 7-day adherence summary
          </button>
          <button
            onClick={() => handleSend("I missed a dose, should I take two tablets now?")}
            className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white border border-slate-300 hover:border-teal-500 text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
          >
            🛡️ Safety test: Double dose query
          </button>
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-2 flex-shrink-0">
          <input
            type="text"
            placeholder="Ask about medications, appointments, or today's care plan..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="p-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl transition-colors shadow-sm"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

      </div>
    </div>
  );
};
