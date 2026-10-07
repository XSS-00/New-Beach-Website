import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const DISMISS_DAYS = 7 * 24 * 60 * 60 * 1000;

export function InstallBanner() {
  const { t } = useLanguage();
  const [promptEvent, setPromptEvent] = useState(null);

  useEffect(() => {
    const dismissedAt = Number(localStorage.getItem('installDismissedAt') || 0);
    if (Date.now() - dismissedAt < DISMISS_DAYS) return undefined;

    const handlePrompt = (event) => {
      event.preventDefault();
      setPromptEvent(event);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  if (!promptEvent) return null;

  const dismiss = () => {
    localStorage.setItem('installDismissedAt', String(Date.now()));
    setPromptEvent(null);
  };

  const install = async () => {
    await promptEvent.prompt();
    dismiss();
  };

  return (
    <div className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-4 shadow-glow sm:hidden">
      <div className="flex items-center gap-3">
        <img src="/boat-icon.png" alt="" className="h-12 w-12 rounded-2xl object-cover" />
        <p className="flex-1 text-sm font-extrabold text-ink">{t('install.text')}</p>
        <button onClick={dismiss} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600">
          <X size={17} />
        </button>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={dismiss} className="rounded-full px-4 py-2 text-sm font-bold text-muted">
          {t('install.later')}
        </button>
        <button onClick={install} className="inline-flex items-center gap-2 rounded-full bg-tealbrand px-4 py-2 text-sm font-extrabold text-white">
          <Download size={16} /> {t('install.add')}
        </button>
      </div>
    </div>
  );
}
