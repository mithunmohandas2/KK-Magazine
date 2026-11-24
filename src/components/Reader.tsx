'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download, List, Mail, Menu, Moon, Share2, Sun } from 'lucide-react';
import type { Author, Magazine } from '@/lib/data';
import MagazinePage from './MagazinePage';
import ReaderPanel, { type PanelView, type Theme } from './ReaderPanel';
import { useAppInstall } from './useAppInstall';

const themeKey = 'kk-theme';
const headerActions = [
  { panel: 'share', label: 'Share', Icon: Share2 },
  { panel: 'contact', label: 'Contact us', Icon: Mail },
] as const;

export default function Reader({ magazine, authors, signedIn }: {
  magazine: Magazine;
  authors: Author[];
  signedIn: boolean;
}) {
  const { pages } = magazine;
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState('forward');
  const [panel, setPanel] = useState<PanelView | null>(null);
  const [theme, setTheme] = useState<Theme>('light');
  const stage = useRef<HTMLElement>(null);
  const { method: installMethod, promptInstall } = useAppInstall();

  useEffect(() => {
    const restoreLocation = () => {
      const pageId = new URLSearchParams(window.location.hash.slice(1)).get('page');
      setIndex(Math.max(0, pages.findIndex(page => page.id === pageId)));
      if (stage.current) stage.current.scrollTop = 0;
    };
    restoreLocation();
    window.addEventListener('hashchange', restoreLocation);
    try {
      const saved = localStorage.getItem(themeKey);
      if (saved === 'dark' || saved === 'light') setTheme(saved);
    } catch {
      // Reading works with browser storage disabled.
    }
    return () => window.removeEventListener('hashchange', restoreLocation);
  }, [pages]);

  function changeTheme(next: Theme) {
    setTheme(next);
    try {
      localStorage.setItem(themeKey, next);
    } catch {
      // The selected theme still applies to this visit.
    }
  }

  function installApp() {
    if (installMethod === 'prompt') {
      setPanel(null);
      void promptInstall();
    } else if (installMethod) {
      setPanel('install');
    }
  }

  const goTo = useCallback((next: number) => {
    const page = pages[next];
    if (!page) return;
    setDirection(next < index ? 'back' : 'forward');
    setIndex(next);
    const url = new URL(window.location.href);
    url.hash = next === 0 ? '' : new URLSearchParams({ page: page.id }).toString();
    window.history.replaceState(window.history.state, '', url);
    if (stage.current) stage.current.scrollTop = 0;
  }, [index, pages]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (panel || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, video, [contenteditable]')) return;
      const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!offset || !pages[index + offset]) return;
      event.preventDefault();
      goTo(index + offset);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, index, pages, panel]);

  const page = pages[index];
  const staffUrl = signedIn ? '/dashboard' : '/login';
  const staffLabel = signedIn ? 'Dashboard' : 'Login';
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const ThemeIcon = nextTheme === 'light' ? Sun : Moon;
  const themeLabel = `Switch to ${nextTheme} mode`;

  return <div className="reader" data-theme={theme}>
    <header className="reader-header">
      <button type="button" className="wordmark reader-brand" aria-label="Mozhi, go to cover" onClick={() => goTo(0)}>
        <span lang="ml">{magazine.title}</span>
      </button>
      <div className="reader-header-actions" role="group" aria-label="Reader actions">
        {headerActions.filter(action => action.panel !== 'share' || page).map(({ panel: target, label, Icon }) =>
          <button type="button" className="reader-header-icon" key={target} aria-label={label} title={label}
            aria-haspopup="dialog" aria-expanded={panel === target} aria-controls="reader-panel" onClick={() => setPanel(target)}>
            <Icon size={18} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="reader-header-icon" aria-label={themeLabel} title={themeLabel}
          onClick={() => changeTheme(nextTheme)}>
          <ThemeIcon size={18} aria-hidden="true" />
        </button>
        {installMethod && <button type="button" className="reader-header-icon" aria-label="Install app"
          title="Install app" onClick={installApp}>
          <Download size={18} aria-hidden="true" />
        </button>}
        <Link className="login-link" href={staffUrl}>{staffLabel}</Link>
      </div>
    </header>
    <main id="magazine-page" ref={stage} className="reader-stage" tabIndex={0} aria-label="Magazine content">
      {page && <div key={page.id} className={`reader-sheet turn-${direction}`}>
        <MagazinePage page={page} authors={authors} cover={magazine.cover} />
      </div>}
    </main>
    <footer className="reader-controls">
      <button className="reader-footer-name" type="button" onClick={() => goTo(0)} title={magazine.title}
        aria-label="Mozhi, go to cover"><span lang="ml">{magazine.title}</span></button>
      {page && <nav className="reader-pagination" aria-label="Magazine pages">
        <button className="reader-page-turn" type="button" aria-label="Previous page" aria-controls="magazine-page"
          onClick={() => goTo(index - 1)} disabled={index === 0}>
          <ChevronLeft size={20} aria-hidden="true" /><span>Previous</span>
        </button>
        <button className="reader-position" type="button" aria-label={`Contents, page ${index + 1} of ${pages.length}`}
          aria-haspopup="dialog" aria-expanded={panel === 'contents'} aria-controls="reader-panel" onClick={() => setPanel('contents')}>
          <List className="reader-contents-icon" size={17} aria-hidden="true" />
          <span aria-hidden="true">{index + 1}<span className="reader-page-separator"> / </span>{pages.length}</span>
          <progress className="reading-progress" max={pages.length} value={index + 1} aria-label="Reading progress" />
        </button>
        <button className="reader-page-turn" type="button" aria-label="Next page" aria-controls="magazine-page"
          onClick={() => goTo(index + 1)} disabled={index === pages.length - 1}>
          <span>Next</span><ChevronRight size={20} aria-hidden="true" />
        </button>
      </nav>}
      {page && <span className="sr-only" role="status">Page {index + 1} of {pages.length}</span>}
      <button className="reader-menu" type="button" aria-label="More options" aria-haspopup="dialog" aria-expanded={Boolean(panel && panel !== 'contents')}
        aria-controls="reader-panel" onClick={() => setPanel('menu')}><Menu size={24} aria-hidden="true" /></button>
    </footer>
    <ReaderPanel view={panel} onChange={setPanel} magazine={magazine} page={page} index={index}
      onSelect={next => { setPanel(null); goTo(next); }} theme={theme} onThemeChange={changeTheme}
      staffUrl={staffUrl} staffLabel={staffLabel} installMethod={installMethod} onInstall={installApp} />
  </div>;
}
