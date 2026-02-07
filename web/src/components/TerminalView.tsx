'use client';

import { useEffect, useRef, useCallback } from 'react';
import { XTERM_THEMES, type Theme } from '@/lib/theme';
import '@xterm/xterm/css/xterm.css';

// Mobile key shortcuts
const MOBILE_KEYS = [
  { label: 'Esc', key: '\x1b' },
  { label: 'Tab', key: '\t' },
  { label: 'Ctrl', modifier: true },
  { label: '\u2191', key: '\x1b[A' },
  { label: '\u2193', key: '\x1b[B' },
  { label: '\u2190', key: '\x1b[D' },
  { label: '\u2192', key: '\x1b[C' },
  { label: 'Ctrl+C', key: '\x03' },
  { label: 'Ctrl+D', key: '\x04' },
  { label: 'Ctrl+Z', key: '\x1a' },
];

export function TerminalView({
  session,
  visible,
  theme,
  onDisconnect,
}: {
  session: string;
  visible: boolean;
  theme: Theme;
  onDisconnect: () => void;
}) {
  const termRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<import('@xterm/xterm').Terminal | null>(null);
  const fitAddonRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null);
  const ctrlRef = useRef(false);

  const sendKey = useCallback((key: string) => {
    wsRef.current?.send(key);
  }, []);

  // Update xterm theme when theme prop changes
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = XTERM_THEMES[theme];
    }
  }, [theme]);

  // Re-fit when becoming visible
  useEffect(() => {
    if (visible && fitAddonRef.current) {
      // Small delay to let display:none clear before measuring
      requestAnimationFrame(() => fitAddonRef.current?.fit());
    }
  }, [visible]);

  useEffect(() => {
    let disposed = false;

    async function init() {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      const { WebLinksAddon } = await import('@xterm/addon-web-links');

      if (disposed || !termRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
        theme: XTERM_THEMES[theme],
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());
      term.open(termRef.current);
      fitAddon.fit();
      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // WebSocket connection
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(
        `${proto}//${location.host}/api/terminal?session=${encodeURIComponent(session)}`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      };

      ws.onmessage = (e) => {
        term.write(e.data);
      };

      ws.onclose = () => {
        term.write('\r\n\x1b[33m[disconnected]\x1b[0m\r\n');
      };

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      const onResize = () => {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      };

      term.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      });

      window.addEventListener('resize', onResize);
      term.focus();

      return () => {
        window.removeEventListener('resize', onResize);
        ws.close();
        term.dispose();
      };
    }

    const cleanup = init();

    return () => {
      disposed = true;
      cleanup.then((fn) => fn?.());
    };
    // theme intentionally excluded — handled by separate effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  function handleMobileKey(label: string, key?: string, modifier?: boolean) {
    if (modifier) {
      ctrlRef.current = !ctrlRef.current;
      return;
    }

    if (key) {
      if (ctrlRef.current && key.length === 1) {
        const code = key.toUpperCase().charCodeAt(0) - 64;
        if (code > 0 && code < 32) {
          sendKey(String.fromCharCode(code));
        }
        ctrlRef.current = false;
      } else {
        sendKey(key);
      }
    }

    xtermRef.current?.focus();
  }

  return (
    <div
      className="h-dvh flex flex-col"
      style={{
        display: visible ? 'flex' : 'none',
        backgroundColor: XTERM_THEMES[theme].background,
      }}
    >
      {/* Terminal */}
      <div ref={termRef} className="flex-1 overflow-hidden" />

      {/* Mobile key toolbar */}
      <div className="flex gap-1 px-2 py-1.5 bg-surface border-t border-border overflow-x-auto shrink-0 md:hidden">
        {MOBILE_KEYS.map(({ label, key, modifier }) => (
          <button
            key={label}
            onClick={() => handleMobileKey(label, key, modifier)}
            className={`px-2.5 py-1.5 rounded text-xs font-mono shrink-0 transition-colors ${
              modifier && ctrlRef.current
                ? 'bg-blue-700 text-white'
                : 'bg-input-bg hover:bg-surface-hover text-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
