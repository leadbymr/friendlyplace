'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { socket } from '../lib/socket';
import { playMatch } from '../lib/sound';

gsap.registerPlugin(ScrollTrigger);

const LANGUAGES = [
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
  { code: 'de', label: 'DE' },
  { code: 'pt', label: 'PT' },
];

const TITLE_LINE = 'ГОВОРИ С МИРОМ';
const KICKER = '[ АНОНИМНЫЕ ЗНАКОМСТВА — ПО ВСЕМУ МИРУ ]';
const SCRAMBLE_CHARS = '!<>-_\\/[]{}—=+*^?#';

const COUNTRIES = ['BRAZIL', 'JAPAN', 'SPAIN', 'TURKEY', 'KOREA', 'FRANCE', 'MEXICO', 'ITALY', 'INDIA', 'ARGENTINA'];

const STEPS = [
  { num: '(01)', title: 'НАЖМИ КНОПКУ', text: 'Ты попадаешь в очередь. Без регистрации, без имени, без следов.' },
  { num: '(02)', title: 'ПОЙМАЙ ПАРУ', text: 'Сервер соединяет тебя со случайным человеком где-то на планете.' },
  { num: '(03)', title: 'ГОВОРИ', text: 'Пиши на своём языке — собеседник получит перевод мгновенно.' },
];

const MANIFESTO_TEXT =
  'FriendlyPlace — это поток случайных встреч. Без имён, без профилей, без лайков. Только ты, случайный человек где-то на планете и перевод, который стирает границы.';

const FEATURES = [
  { num: '(01)', title: 'АВТОПЕРЕВОД', text: '100+ языков в реальном времени' },
  { num: '(02)', title: 'АНОНИМНОСТЬ', text: 'без имени, почты и регистрации' },
  { num: '(03)', title: 'МГНОВЕННО', text: 'соединение за секунды, без ожидания' },
  { num: '(04)', title: 'БЕЗОПАСНОСТЬ', text: 'фильтры, жалобы и блокировки' },
  { num: '(05)', title: 'ОДИН КЛИК', text: 'кнопка — и ты уже с кем-то говоришь' },
  { num: '(06)', title: 'ВСЯ ПЛАНЕТА', text: '195 стран в очереди поиска' },
];

const STATS = [
  { value: 100, suffix: '+', label: 'языков перевода' },
  { value: 195, suffix: '', label: 'стран в очереди' },
  { value: 1, suffix: '', label: 'кнопка старта' },
  { value: 0, suffix: '', label: 'регистрации' },
];

const ROADMAP = [
  { v: 'v1.0', title: 'АНОНИМНЫЙ ЧАТ + АВТОПЕРЕВОД', text: 'Случайные пары по всему миру, перевод на лету, полный аноним.', status: 'ГОТОВО', kind: 'done' },
  { v: 'v1.1', title: 'СКВОЗНОЕ ШИФРОВАНИЕ', text: 'Ключи только на устройствах. Даже мы не читаем переписку.', status: 'СКОРО', kind: 'soon' },
  { v: 'v2.0', title: 'ИНТЕРЕСЫ + ЯЗЫКОВОЙ ОБМЕН', text: 'Пары по темам и режим «ты учишь мой язык — я твой».', status: 'В ПЛАНАХ', kind: 'plan' },
  { v: 'v3.0', title: 'МОБИЛЬНОЕ ПРИЛОЖЕНИЕ + ГОЛОС', text: 'Голосовой перевод в реальном времени в приложении.', status: 'В ПЛАНАХ', kind: 'plan' },
];

/* ────────────────────────────────────────────
   ГЛОБУС — 60 FPS
──────────────────────────────────────────── */
function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useGSAP(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const points: { x: number; y: number; z: number }[] = [];
    const LAT = 14;
    const LON = 28;
    for (let i = 0; i <= LAT; i++) {
      const theta = (i / LAT) * Math.PI;
      for (let j = 0; j < LON; j++) {
        const phi = (j / LON) * Math.PI * 2;
        points.push({
          x: Math.sin(theta) * Math.cos(phi),
          y: Math.cos(theta),
          z: Math.sin(theta) * Math.sin(phi),
        });
      }
    }

    const state = { rot: 0 };
    const tilt = -0.35;

    gsap.to(state, {
      rot: Math.PI * 6,
      ease: 'none',
      scrollTrigger: {
        start: 0,
        end: () => ScrollTrigger.maxScroll(window),
        scrub: 1.2,
        invalidateOnRefresh: true,
      },
    });

    let idle = 0;

    const render = () => {
      if (document.hidden) return;
      const op = parseFloat(canvas.style.opacity || '0.5');
      if (op < 0.02) return;

      idle += 0.0012;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const R = Math.min(width, height) * 0.42;
      const cx = width / 2;
      const cy = height / 2;
      const rot = state.rot + idle;

      for (const p of points) {
        const x1 = p.x * Math.cos(rot) + p.z * Math.sin(rot);
        const z1 = -p.x * Math.sin(rot) + p.z * Math.cos(rot);
        const y2 = p.y * Math.cos(tilt) - z1 * Math.sin(tilt);
        const z2 = p.y * Math.sin(tilt) + z1 * Math.cos(tilt);

        const perspective = 1.6 / (1.6 + z2 * 0.6);
        const sx = cx + x1 * R * perspective;
        const sy = cy + y2 * R * perspective;

        const depth = (z2 + 1) / 2;
        ctx.beginPath();
        ctx.fillStyle = `rgba(124,124,118,${0.06 + depth * 0.4})`;
        ctx.arc(sx, sy, 0.8 + depth * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    gsap.ticker.add(render);

    return () => {
      gsap.ticker.remove(render);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas ref={canvasRef} aria-hidden className="globe-canvas fixed inset-0 z-0 pointer-events-none opacity-50" />
  );
}

/* ────────────────────────────────────────────
   ГЛАВНАЯ
──────────────────────────────────────────── */
export default function Home() {
  const [language, setLanguage] = useState('ru');
  const [searching, setSearching] = useState(false);
  const [countryIdx, setCountryIdx] = useState(0);
  const router = useRouter();
  const container = useRef(null);
  const ctaRef = useRef<HTMLButtonElement>(null);

  useGSAP(() => {
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener('load', refresh);
    if (document.fonts?.ready) document.fonts.ready.then(refresh).catch(() => {});
    return () => window.removeEventListener('load', refresh);
  }, []);

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.topbar', { y: -20, opacity: 0, duration: 0.5 })
      .from('.hero-kicker', { opacity: 0, duration: 0.3 }, '-=0.2')
      .from('.char', { y: 50, opacity: 0, stagger: 0.03, duration: 0.7 }, '-=0.1')
      .from('.hero-accent', { opacity: 0, x: -30, duration: 0.6 }, '-=0.4')
      .from('.cta-wrap', { opacity: 0, y: 25, duration: 0.6 }, '-=0.4')
      .from('.hero-lines', { opacity: 0, y: 15, duration: 0.5 }, '-=0.4')
      .from('.marquee', { opacity: 0, duration: 0.6 }, '-=0.4')
      .from('.step-cell', { y: 30, opacity: 0, stagger: 0.12, duration: 0.6 }, '-=0.4');
  }, { scope: container });

  useGSAP(() => {
    gsap.to('.hero', {
      opacity: 0.25,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.5 },
    });
  }, { scope: container });

  useGSAP(() => {
    gsap.to('.globe-canvas', {
      opacity: 0,
      ease: 'none',
      scrollTrigger: { trigger: '.manifesto', start: 'top 90%', end: 'top 30%', scrub: true },
    });
  }, { scope: container });

  useGSAP(() => {
    const el = (container.current as HTMLElement | null)?.querySelector('.hero-kicker');
    if (!el) return;
    const obj = { p: 0 };
    gsap.to(obj, {
      p: 1,
      duration: 1.4,
      delay: 0.4,
      ease: 'none',
      onUpdate: () => {
        const revealed = Math.floor(KICKER.length * obj.p);
        let out = '';
        for (let i = 0; i < KICKER.length; i++) {
          if (i < revealed) out += KICKER[i];
          else if (KICKER[i] === ' ') out += ' ';
          else out += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        }
        el.textContent = out;
      },
      onComplete: () => {
        el.textContent = KICKER;
      },
    });
  }, { scope: container });

  useGSAP(() => {
    gsap.to('.marquee-track', { xPercent: -50, repeat: -1, duration: 22, ease: 'none' });
  }, { scope: container });

  useGSAP(() => {
    const btn = ctaRef.current;
    const wrap = btn?.parentElement;
    if (!btn || !wrap) return;
    const xTo = gsap.quickTo(btn, 'x', { duration: 0.3, ease: 'power2.out' });
    const yTo = gsap.quickTo(btn, 'y', { duration: 0.3, ease: 'power2.out' });
    const move = (e: MouseEvent) => {
      const r = btn.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.25);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.25);
    };
    const leave = () => {
      xTo(0);
      yTo(0);
    };
    wrap.addEventListener('mousemove', move);
    wrap.addEventListener('mouseleave', leave);
    return () => {
      wrap.removeEventListener('mousemove', move);
      wrap.removeEventListener('mouseleave', leave);
    };
  }, { scope: container, dependencies: [searching] });

  useGSAP(() => {
    if (searching) return;
    gsap.fromTo(
      '.cta-button',
      { boxShadow: '0 0 0px rgba(217,255,67,0)' },
      { boxShadow: '0 0 45px rgba(217,255,67,0.35)', duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' }
    );
  }, { scope: container, dependencies: [searching] });

  useGSAP(() => {
    gsap.fromTo(
      '.feature-row',
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        stagger: 0.08,
        duration: 0.6,
        ease: 'power3.out',
        immediateRender: false,
        scrollTrigger: { trigger: '.features', start: 'top 80%', toggleActions: 'play none none reverse' },
      }
    );
    gsap.fromTo(
      '.roadmap-item',
      { opacity: 0, x: -20 },
      {
        opacity: 1,
        x: 0,
        stagger: 0.1,
        duration: 0.5,
        ease: 'power3.out',
        immediateRender: false,
        scrollTrigger: { trigger: '.roadmap', start: 'top 75%', toggleActions: 'play none none reverse' },
      }
    );
  }, { scope: container });

  useGSAP(() => {
    const els = gsap.utils.toArray<HTMLElement>('.stat-value');
    els.forEach((el) => {
      const target = parseInt(el.dataset.value || '0', 10);
      const obj = { v: 0 };
      gsap.to(obj, {
        v: target,
        duration: 1.6,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        onUpdate: () => {
          el.textContent = String(Math.round(obj.v));
        },
      });
    });
  }, { scope: container });

  useGSAP(() => {
    const wrap = (container.current as HTMLElement | null)?.querySelector('.roadmap-track');
    const markers = gsap.utils.toArray<HTMLElement>('.roadmap-marker');
    gsap.fromTo(
      '.roadmap-line',
      { scaleY: 0 },
      {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: '.roadmap',
          start: 'top 70%',
          end: 'bottom 70%',
          scrub: 0.6,
          onUpdate: (self) => {
            if (!wrap) return;
            const wb = wrap.getBoundingClientRect();
            const lineBottom = wb.top + wb.height * self.progress;
            markers.forEach((m) => {
              const mb = m.getBoundingClientRect();
              const lit = mb.top + mb.height / 2 <= lineBottom + 2;
              const was = m.dataset.lit === '1';
              if (lit === was) return;
              m.dataset.lit = lit ? '1' : '0';
              gsap.to(m, {
                backgroundColor: lit ? '#d9ff43' : '#3a3a37',
                boxShadow: lit ? '0 0 12px rgba(217,255,67,0.6)' : '0 0 0px rgba(217,255,67,0)',
                scale: lit ? 1.4 : 1,
                duration: 0.45,
                ease: 'power2.out',
              });
            });
          },
        },
      }
    );
  }, { scope: container });

  useGSAP(() => {
    if (!searching) return;
    gsap.fromTo('.scan', { x: '-100%' }, { x: '400%', repeat: -1, duration: 1.3, ease: 'power1.inOut' });
  }, { dependencies: [searching], scope: container });

  useEffect(() => {
    if (!searching) return;
    const id = setInterval(() => setCountryIdx((i) => (i + 1) % COUNTRIES.length), 700);
    return () => clearInterval(id);
  }, [searching]);

  useEffect(() => {
    socket.on('searching', () => setSearching(true));
    socket.on('matched', (data: { roomId: string; partner: { nickname: string; language?: string } }) => {
      setSearching(false);
      playMatch();
      router.push(
        `/chat?room=${data.roomId}&nickname=${encodeURIComponent(data.partner.nickname)}&mlang=${language}&plang=${data.partner.language || 'en'}`
      );
    });
    socket.on('error', (err: { message: string }) => {
      setSearching(false);
      alert(err.message);
    });
    return () => {
      socket.off('searching');
      socket.off('matched');
      socket.off('error');
    };
  }, [router]);

  const handleConnect = () => {
    setSearching(true);
    if (!socket.connected) socket.connect();
    socket.emit('find_partner', { language });
  };

  const handleCtaBottom = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    handleConnect();
  };

  const marqueeText = 'ANONYMOUS · AUTOTRANSLATE · WORLDWIDE · NO REGISTRATION · '.repeat(6);

  const pillClass = (kind: string) =>
    kind === 'done'
      ? 'bg-[#d9ff43] text-[#0a0a0a] font-bold'
      : kind === 'soon'
      ? 'border border-[#d9ff43]/50 text-[#d9ff43] animate-pulse'
      : 'border border-white/10 text-[#5c5c56]';

  const dotClass = (kind: string) =>
    kind === 'done' ? 'bg-[#d9ff43]' : kind === 'soon' ? 'bg-[#d9ff43] animate-pulse' : 'bg-[#3a3a37]';

  return (
    <main ref={container} className="relative bg-[#0a0a0a] text-[#ededea] flex flex-col" style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}>
      <Globe />

      <div className="relative z-10 flex flex-col flex-1">
        {/* TOPBAR */}
        <header className="topbar flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0a0a0a]/70">
          <div className="font-display font-bold text-lg tracking-tight">FRIENDLYPLACE®</div>
          <div className="hidden sm:flex gap-8 text-[11px] tracking-[0.2em] text-[#7c7c76] uppercase">
            <span>Anonymous</span>
            <span>Autotranslate</span>
            <span>Est. 2026</span>
          </div>
        </header>

        {/* HERO */}
        <section className="hero px-6 pt-16 pb-12 max-w-6xl mx-auto w-full">
          <div className="hero-inner">
            <p className="hero-kicker text-[11px] uppercase tracking-[0.3em] text-[#7c7c76] mb-8">{KICKER}</p>

            <h1 className="font-display uppercase font-black leading-[1.02] text-4xl sm:text-6xl lg:text-7xl">
              {TITLE_LINE.split('').map((ch, i) => (
                <span key={i} className="char inline-block">
                  {ch === ' ' ? '\u00A0' : ch}
                </span>
              ))}
            </h1>

            <p className="hero-accent text-2xl sm:text-4xl text-[#d9ff43] mt-5">
              на своём языке — мы переведём
            </p>

            <div className="cta-wrap mt-10 max-w-md">
              <div className="flex flex-wrap gap-2 mb-4">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`px-4 py-2 border text-[12px] tracking-[0.2em] transition-colors ${
                      language === lang.code
                        ? 'bg-[#d9ff43] text-[#0a0a0a] border-[#d9ff43] font-bold'
                        : 'border-white/15 text-[#7c7c76] hover:border-white/40 hover:text-white'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>

              {!searching ? (
                <>
                  <button
                    ref={ctaRef}
                    onClick={handleConnect}
                    className="cta-button block w-full bg-[#d9ff43] text-[#0a0a0a] font-bold uppercase tracking-[0.2em] text-lg px-10 py-5 hover:bg-[#ededea] transition-colors"
                  >
                    [ Начать чат ] ↗
                  </button>
                  <p className="mt-3 text-[11px] uppercase tracking-[0.25em] text-[#5c5c56]">
                    Соединим со случайным собеседником где-то на планете
                  </p>
                </>
              ) : (
                <div className="border border-white/15 p-6">
                  <p className="font-display uppercase font-bold text-xl mb-6">
                    Поиск<span className="text-[#d9ff43]">...</span>
                  </p>
                  <div className="h-px bg-white/10 relative overflow-hidden">
                    <div className="scan absolute inset-y-0 left-0 w-1/3 bg-[#d9ff43]" />
                  </div>
                  <p className="mt-5 text-[12px] uppercase tracking-[0.3em] text-[#7c7c76]">
                    Where: <span className="text-[#ededea]">{COUNTRIES[countryIdx]}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="hero-lines mt-10 text-sm sm:text-base text-[#7c7c76] leading-relaxed">
              <p>
                Знакомства.<span className="text-[#d9ff43]">Перевод.</span>
              </p>
              <p>Поток.Общение.</p>
            </div>
          </div>
        </section>

        {/* MARQUEE */}
        <div className="marquee border-y border-white/10 py-3 overflow-hidden whitespace-nowrap bg-[#0a0a0a]/70">
          <div className="marquee-track inline-block text-[12px] uppercase tracking-[0.3em] text-[#7c7c76]">
            <span>{marqueeText}</span>
            <span>{marqueeText}</span>
          </div>
        </div>

        {/* STEPS */}
        <section className="max-w-6xl mx-auto w-full px-6 py-14 grid sm:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div
              key={s.num}
              className="step-cell border border-white/10 p-6 bg-[#0a0a0a]/70 hover:border-[#d9ff43]/60 hover:bg-[#d9ff43]/5 transition-colors"
            >
              <div className="text-[11px] text-[#7c7c76] mb-6">{s.num}</div>
              <div className="font-display uppercase font-bold text-lg mb-3">{s.title}</div>
              <p className="text-[13px] text-[#7c7c76] leading-relaxed">{s.text}</p>
            </div>
          ))}
        </section>

        {/* MANIFESTO */}
        <section className="manifesto border-t border-white/10 px-6 py-24 max-w-5xl mx-auto w-full">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#7c7c76] mb-8">(02) — Манифест</p>
          <p className="font-display text-2xl sm:text-4xl leading-snug uppercase">{MANIFESTO_TEXT}</p>
          <p className="text-2xl sm:text-4xl text-[#d9ff43] mt-6">Нажми кнопку — и мир ответит.</p>
        </section>

        {/* FEATURES */}
        <section className="features border-t border-white/10 px-6 py-20 max-w-6xl mx-auto w-full">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#7c7c76] mb-10">(03) — Что внутри</p>
          <div>
            {FEATURES.map((f) => (
              <div
                key={f.num}
                className="feature-row group grid grid-cols-[auto_1fr] sm:grid-cols-[80px_1fr_1fr] gap-4 items-baseline border-t border-white/10 py-5 px-2 hover:bg-white/5 hover:pl-5 transition-all"
              >
                <div className="text-[11px] text-[#7c7c76] group-hover:text-[#d9ff43] transition-colors">{f.num}</div>
                <div className="font-display uppercase font-bold text-lg">{f.title}</div>
                <div className="col-start-2 sm:col-start-3 text-[13px] text-[#7c7c76]">{f.text}</div>
              </div>
            ))}
            <div className="border-t border-white/10" />
          </div>
        </section>

        {/* ENCRYPTION — без замка, пустая заглушка */}
        <section className="encryption border-t border-white/10 px-6 py-24">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <div className="h-[320px] border border-white/10 bg-[#0d0d0c]/60 flex items-center justify-center">
                <p className="text-[12px] tracking-[0.3em] uppercase text-[#5c5c56]">/// e2e: coming soon ///</p>
              </div>
              <p className="mt-4 text-center text-[12px] tracking-[0.3em] uppercase text-[#7c7c76]">
                status: locked
              </p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#7c7c76] mb-6">(04) — Безопасность</p>
              <h2 className="font-display uppercase font-black text-3xl sm:text-5xl leading-tight">
                Сквозное <span className="text-[#d9ff43]">шифрование</span>
              </h2>
              <p className="text-xl sm:text-2xl text-[#d9ff43] mt-4">
                скоро — даже мы не сможем читать твои сообщения
              </p>
              <p className="text-[14px] text-[#7c7c76] leading-relaxed mt-6">
                Сейчас перевод происходит на сервере. В следующей версии ключи шифрования будут жить только на
                устройствах собеседников: сообщение покидает твой телефон уже зашифрованным и расшифровывается
                только у собеседника.
              </p>
              <ul className="mt-8 space-y-3 text-[12px] uppercase tracking-[0.2em]">
                <li className="flex gap-3">
                  <span className="text-[#d9ff43]">[x]</span> автоперевод и анонимность — работают
                </li>
                <li className="flex gap-3">
                  <span className="text-[#d9ff43]">[ ]</span> e2e-шифрование — в разработке
                </li>
                <li className="flex gap-3">
                  <span className="text-[#7c7c76]">[ ]</span> самоуничтожающиеся сообщения
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="border-t border-white/10 px-6 py-16">
          <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-10 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="font-display font-black text-4xl sm:text-5xl text-[#d9ff43]">
                  <span className="stat-value" data-value={s.value}>
                    0
                  </span>
                  {s.suffix}
                </div>
                <div className="mt-3 text-[11px] uppercase tracking-[0.25em] text-[#7c7c76]">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ROADMAP */}
        <section className="roadmap border-t border-white/10 px-6 py-24">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-12">
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#7c7c76]">(05) — Дорожная карта</p>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#5c5c56]">status: building...</p>
            </div>

            <div className="roadmap-track relative pl-8">
              <div className="absolute left-[3px] top-0 bottom-0 w-px bg-white/10" />
              <div className="roadmap-line absolute left-[3px] top-0 bottom-0 w-px bg-[#d9ff43] origin-top" />

              {ROADMAP.map((r) => (
                <div
                  key={r.v}
                  className="roadmap-item relative py-6 border-b border-white/10 group hover:pl-3 transition-all"
                >
                  <span className="roadmap-marker absolute -left-8 top-9 w-2 h-2 bg-[#3a3a37]" />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-baseline gap-5">
                      <span className="text-[12px] text-[#7c7c76] w-10 shrink-0">{r.v}</span>
                      <h3 className="font-display uppercase font-bold text-base sm:text-lg group-hover:text-[#d9ff43] transition-colors">
                        {r.title}
                      </h3>
                    </div>
                    <span className={`px-3 py-1 text-[10px] tracking-[0.2em] uppercase ${pillClass(r.kind)}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#7c7c76] mt-2 sm:pl-[60px]">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="bottom-cta px-6 py-24 text-center border-t border-white/10">
          <p className="text-[12px] uppercase tracking-[0.3em] text-[#7c7c76] mb-8">/// готов попробовать? ///</p>
          <button
            onClick={handleCtaBottom}
            className="bg-[#d9ff43] text-[#0a0a0a] font-bold uppercase tracking-[0.2em] text-lg px-12 py-5 hover:bg-[#ededea] transition-colors"
          >
            [ Начать чат ] ↗
          </button>
          <p className="mt-4 text-[11px] uppercase tracking-[0.25em] text-[#5c5c56]">
            одна кнопка — и ты уже не один
          </p>
        </section>

        {/* FOOTER */}
        <footer className="mt-auto border-t border-white/10 px-6 py-6 flex flex-col sm:flex-row justify-between gap-3 text-[11px] uppercase tracking-[0.2em] text-[#5c5c56] bg-[#0a0a0a]/70">
          <span>friendlyplace® — 2026</span>
          <span>made for humans, worldwide</span>
        </footer>
      </div>
    </main>
  );
}