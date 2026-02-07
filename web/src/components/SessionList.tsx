'use client';

import { useEffect, useState, useCallback } from 'react';

interface SessionInfo {
  name: string;
  windows: number;
  attached: boolean;
  created: string;
  workingDir: string;
  lastActivity: string;
}

export function SessionList({
  refreshKey,
  openTabs,
  activeTab,
  onAttach,
  onDetach,
  onRefresh,
}: {
  refreshKey: number;
  openTabs: string[];
  activeTab: string | null;
  onAttach: (name: string) => void;
  onDetach: (name: string) => void;
  onRefresh: () => void;
}) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      setSessions(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [fetchSessions, refreshKey]);

  if (loading) {
    return <p className="text-muted text-sm px-2">Loading...</p>;
  }

  if (sessions.length === 0) {
    return (
      <p className="text-muted text-sm px-2">
        No sessions running.
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      {sessions.map((s) => {
        const isOpen = openTabs.includes(s.name);
        const isActive = s.name === activeTab;

        return (
          <div
            key={s.name}
            className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
              isActive
                ? 'bg-surface-hover text-primary'
                : 'text-secondary hover:bg-surface-hover hover:text-primary'
            }`}
            onClick={() => onAttach(s.name)}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOpen ? 'bg-green-400' : 'bg-muted'}`} />
                <span className="font-mono text-sm truncate">{s.name}</span>
              </div>
              <div className="text-xs text-muted ml-3 truncate">
                {s.windows}w &middot; {s.lastActivity}
              </div>
            </div>

            {isOpen && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDetach(s.name);
                }}
                className="text-xs text-muted hover:text-primary shrink-0 px-1.5 py-0.5 rounded transition-colors hover:bg-surface"
                title="Detach"
              >
                detach
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
