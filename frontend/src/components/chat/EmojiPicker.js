'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

// Our own short list (no library): the emoji people use most at work
const CATEGORIES = [
  { key: 'smileys', icon: '😀', label: 'Smileys', emojis: '😀 😃 😄 😁 😆 😅 😂 🤣 😊 🙂 😉 😍 🥰 😘 😋 😎 🤓 🤩 🥳 😏 😌 😴 🤔 🤨 😐 😑 🙄 😬 😮 😯 😲 😳 🥺 😢 😭 😤 😠 😡 🤯 😱 😓 🤗 🤭 🤫 😇 🙃 😷 🤒 🤧 🥱'.split(' ') },
  { key: 'hands', icon: '👍', label: 'Hands & people', emojis: '👍 👎 👌 ✌️ 🤞 🤝 👏 🙌 🙏 💪 👋 🤚 ✋ 👊 ✊ 🤙 👈 👉 👆 👇 ☝️ ✍️ 🫡 🤷 🤦 🙋 🙇 💁 🧑‍💻 👩‍💼 👨‍💼'.split(' ') },
  { key: 'work', icon: '💼', label: 'Work', emojis: '💼 📅 📆 🗓️ ⏰ ⏳ ✅ ☑️ ❌ ⚠️ 📌 📎 📝 📄 📊 📈 📉 💡 🔔 📣 📢 💻 🖥️ ⌨️ 🖨️ 📱 ☎️ 📞 📧 📨 🗂️ 📁 🔒 🔑 🛠️ ⚙️ 🚀 🎯 🏆 🥇'.split(' ') },
  { key: 'hearts', icon: '❤️', label: 'Hearts & symbols', emojis: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💯 ✨ 🔥 ⭐ 🌟 💥 💫 ❓ ❗ ➕ ➖ ✔️ 🆗 🆕 🔴 🟢 🟡 🔵'.split(' ') },
  { key: 'fun', icon: '🎉', label: 'Food & celebrations', emojis: '🎉 🎊 🎂 🎁 🎈 🥂 🍾 ☕ 🍵 🍕 🍔 🍟 🌮 🍰 🍩 🍪 🍫 🍎 🍌 🥗 🍿 🌞 🌧️ ⛄ 🌈 🌴 ✈️ 🚗 🏖️ ⚽ 🏏 🎮 🎵'.split(' ') },
];

const RECENT_KEY = 'chat_recent_emojis';
const RECENT_MAX = 16;

function readRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function saveRecent(emoji) {
  const next = [emoji, ...readRecent().filter((e) => e !== emoji)].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

// Pop-up grid of emoji above the message box; onPick(emoji) inserts it
export default function EmojiPicker({ onPick, onClose }) {
  const ref = useRef(null);
  const [recent, setRecent] = useState([]);
  const [category, setCategory] = useState('smileys');

  useEffect(() => {
    const list = readRecent();
    setRecent(list);
    if (list.length) setCategory('recent');
  }, []);

  // Close on a click outside or Escape
  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const tabs = [...(recent.length ? [{ key: 'recent', icon: '🕘', label: 'Recent', emojis: recent }] : []), ...CATEGORIES];
  const current = tabs.find((t) => t.key === category) || tabs[0];

  const pick = (emoji) => {
    setRecent(saveRecent(emoji));
    onPick(emoji);
  };

  return (
    <div ref={ref} className="absolute bottom-full left-0 z-20 mb-2 w-72 animate-scale-in rounded-xl border border-slate-200 bg-white shadow-pop sm:w-80">
      <div className="flex gap-0.5 border-b border-slate-100 px-2 pt-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            title={tab.label}
            aria-label={tab.label}
            onClick={() => setCategory(tab.key)}
            className={clsx('rounded-t-lg px-2 py-1.5 text-lg', current.key === tab.key ? 'bg-slate-100' : 'opacity-60 hover:opacity-100')}
          >
            {tab.icon}
          </button>
        ))}
      </div>
      <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{current.label}</p>
      <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto p-2">
        {current.emojis.map((emoji) => (
          <button key={emoji} type="button" onClick={() => pick(emoji)} className="rounded-md p-1 text-xl transition hover:scale-110 hover:bg-slate-100" aria-label={emoji}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
