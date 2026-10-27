import React, { useState, useEffect } from 'react';
import { AppView } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: AppView) => void;
  onTriggerPreset?: (name: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onTriggerPreset
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const commands = [
    {
      id: 'view-landing',
      title: 'Go to Landing Page & Showcase',
      category: 'Workspaces',
      icon: 'explore',
      action: () => {
        onNavigate('landing');
        onClose();
      }
    },
    {
      id: 'view-dash',
      title: 'Go to Developer Workspace Dashboard',
      category: 'Workspaces',
      icon: 'monitoring',
      action: () => {
        onNavigate('developer-dashboard');
        onClose();
      }
    },
    {
      id: 'view-builder',
      title: 'Go to Visual Tool Builder & OpenAPI Spec',
      category: 'Workspaces',
      icon: 'account_tree',
      action: () => {
        onNavigate('visual-tool-builder');
        onClose();
      }
    },
    {
      id: 'view-playground',
      title: 'Go to Live Voice & Execution Playground',
      category: 'Workspaces',
      icon: 'mic',
      action: () => {
        onNavigate('live-voice-playground');
        onClose();
      }
    },
    {
      id: 'view-admin',
      title: 'Go to Super Admin Platform Engine',
      category: 'Workspaces',
      icon: 'admin_panel_settings',
      action: () => {
        onNavigate('super-admin');
        onClose();
      }
    },
    {
      id: 'view-wizard',
      title: 'Open End-User Setup Wizard (<TASWizard />)',
      category: 'Workspaces',
      icon: 'auto_awesome',
      action: () => {
        onNavigate('component-wizard');
        onClose();
      }
    },
    {
      id: 'action-test-task',
      title: 'Simulate Spoken Command: "Hey Acme, create task..."',
      category: 'Live Voice Simulator',
      icon: 'record_voice_over',
      action: () => {
        onNavigate('live-voice-playground');
        if (onTriggerPreset) onTriggerPreset('task');
        onClose();
      }
    },
    {
      id: 'action-refund',
      title: 'Simulate Spoken Command: "Authorize refund 4920..."',
      category: 'Live Voice Simulator',
      icon: 'payments',
      action: () => {
        onNavigate('live-voice-playground');
        if (onTriggerPreset) onTriggerPreset('refund');
        onClose();
      }
    }
  ];

  const filtered = commands.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-[#FFE6DC] overflow-hidden z-10 flex flex-col animate-in zoom-in-95 duration-150">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#FFE6DC]">
          <span className="material-symbols-outlined text-[20px] text-[#A53B22]">search</span>
          <input
            autoFocus
            type="text"
            placeholder="Type a workspace name, action, or command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent border-none outline-none text-[#1D1A23] placeholder:text-[#8B716B]"
          />
          <kbd className="px-2 py-0.5 rounded bg-[#F8F1FE] border border-[#DEC0B9]/40 text-[10px] font-mono text-[#57423D]">
            Esc
          </kbd>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#8B716B]">
              No commands or tools match "{query}"
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                onClick={item.action}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#F8F1FE] text-left transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#FFDAD2]/40 text-[#A53B22] flex items-center justify-center group-hover:bg-[#FF7E5F] group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#1D1A23] group-hover:text-[#A53B22] transition-colors">
                      {item.title}
                    </div>
                    <div className="text-[10px] text-[#8B716B]">{item.category}</div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[16px] text-[#DEC0B9] group-hover:text-[#A53B22] transition-colors">
                  arrow_forward
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-[#FAF9F6] border-t border-[#FFE6DC] flex items-center justify-between text-[11px] text-[#8B716B]">
          <span>Use number keys (1-8) to switch workspaces directly</span>
          <span>Press Esc to close</span>
        </div>
      </div>
    </div>
  );
};
