'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { socket } from '../../lib/socket';
import { playMessage } from '../../lib/sound';

interface Message {
  messageId: string;
  originalText: string;
  originalLang: string;
  translatedText?: string;
  translatedLang?: string;
  createdAt: string;
  isMine: boolean;
}

function timeOf(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function ChatInner() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [nickname, setNickname] = useState('STRANGER');
  const [myLang, setMyLang] = useState('ru');
  const [partnerLang, setPartnerLang] = useState('en');
  const [isPartnerOnline, setIsPartnerOnline] = useState(true);
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const container = useRef(null);
  const typingHide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTyping = useRef(0);
  const router = useRouter();
  const searchParams = useSearchParams();

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.chat-header', { y: -30, opacity: 0, duration: 0.5 })
      .from('.chat-input-bar', { y: 30, opacity: 0, duration: 0.5 }, '-=0.3');
  }, { scope: container });

  useGSAP(() => {
    const last = messages[messages.length - 1];
    if (last) {
      gsap.from(`[data-msg="${last.messageId}"]`, {
        y: 14,
        opacity: 0,
        scale: 0.97,
        duration: 0.3,
        ease: 'power2.out',
      });
    }
  }, { dependencies: [messages], scope: container });

  useEffect(() => {
    const n = searchParams.get('nickname');
    if (n) setNickname(decodeURIComponent(n).toUpperCase());
    setMyLang(searchParams.get('mlang') || 'ru');
    setPartnerLang(searchParams.get('plang') || 'en');

    socket.on('chat:message', (m: Message) => {
      setMessages((p) => [...p, { ...m, isMine: false }]);
      playMessage();
    });
    socket.on('chat:message:sent', (m: Message) => setMessages((p) => [...p, { ...m, isMine: true }]));
    socket.on('partner_left', () => setIsPartnerOnline(false));
    socket.on('chat:typing', () => {
      setTyping(true);
      if (typingHide.current) clearTimeout(typingHide.current);
      typingHide.current = setTimeout(() => setTyping(false), 1500);
    });

    return () => {
      socket.off('chat:message');
      socket.off('chat:message:sent');
      socket.off('partner_left');
      socket.off('chat:typing');
    };
  }, [searchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const handleInput = (v: string) => {
    setInput(v);
    const now = Date.now();
    if (now - lastTyping.current > 600) {
      lastTyping.current = now;
      socket.emit('chat:typing');
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    socket.emit('chat:message', { text: input });
    setInput('');
  };

  const handleNext = () => {
    socket.emit('next_partner');
    router.push('/');
  };

  const handleLeave = () => {
    socket.emit('leave_room');
    router.push('/');
  };

  return (
    <main ref={container} className="flex flex-col bg-[#0a0a0a] text-[#ededea]" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      {/* HEADER */}
      <header className="chat-header flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#7c7c76] mb-1">
            room · {myLang.toUpperCase()} → {partnerLang.toUpperCase()} · автоперевод
          </div>
          <div className="font-display uppercase font-bold text-lg flex items-center gap-3">
            {nickname}
            <span className={`w-2 h-2 rounded-full ${isPartnerOnline ? 'bg-[#d9ff43]' : 'bg-red-500'}`} />
          </div>
        </div>
        <div className="flex gap-2 text-[11px] uppercase tracking-[0.2em]">
          <button
            onClick={handleNext}
            className="px-4 py-2 border border-white/15 hover:bg-white/10 transition-colors"
          >
            Дальше →
          </button>
          <button
            onClick={handleLeave}
            className="px-4 py-2 border border-white/15 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Выйти ✕
          </button>
        </div>
      </header>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 max-w-4xl w-full mx-auto">
        {messages.length === 0 && !typing && (
          <div className="text-center text-[#5c5c56] mt-24 space-y-3">
            <p className="font-display uppercase font-bold text-xl text-[#7c7c76]">[ Тишина ]</p>
            <p className="text-[12px] uppercase tracking-[0.25em]">Скажи привет — переводим автоматически</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.messageId} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
            <div
              data-msg={msg.messageId}
              className={`max-w-[80%] px-4 py-3 ${
                msg.isMine ? 'bg-[#ededea] text-[#0a0a0a]' : 'border border-white/15'
              }`}
            >
              {msg.isMine ? (
                <>
                  <p className="leading-relaxed">{msg.originalText}</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] opacity-60 mt-2">
                    you · {msg.originalLang} · {timeOf(msg.createdAt)}
                  </p>
                </>
              ) : (
                <>
                  <p className="leading-relaxed">{msg.translatedText}</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#7c7c76] mt-2 border-t border-white/10 pt-2">
                    {msg.originalLang} → {msg.translatedLang} · {timeOf(msg.createdAt)}
                  </p>
                  <p className="text-[11px] italic text-[#5c5c56] mt-1">{msg.originalText}</p>
                </>
              )}
            </div>
          </div>
        ))}

        {typing && isPartnerOnline && (
          <div className="flex justify-start">
            <div className="border border-white/15 px-4 py-3 flex gap-1.5 items-center">
              <span className="w-1.5 h-1.5 bg-[#7c7c76] rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-[#7c7c76] rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-[#7c7c76] rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <footer className="chat-input-bar border-t border-white/10 p-4">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Напиши сообщение..."
            disabled={!isPartnerOnline}
            className="flex-1 bg-transparent border border-white/15 px-4 py-3 placeholder:text-[#5c5c56] focus:outline-none focus:border-[#d9ff43] transition-colors disabled:opacity-40"
          />
          <button
            onClick={handleSend}
            disabled={!isPartnerOnline || !input.trim()}
            className="px-6 border border-[#d9ff43] text-[#d9ff43] hover:bg-[#d9ff43] hover:text-[#0a0a0a] transition-colors uppercase text-[12px] tracking-[0.2em] font-bold disabled:opacity-40"
          >
            Send →
          </button>
        </div>
      </footer>
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<main className="h-screen bg-[#0a0a0a]" />}>
      <ChatInner />
    </Suspense>
  );
}