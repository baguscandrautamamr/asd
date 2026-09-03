import React from 'react';
import { ActivityLog, NotificationToast, TeamMember } from '../types';
import {
  Bell,
  CheckCircle,
  Clock,
  Radio,
  Users,
  X,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activities: ActivityLog[];
  notifications: NotificationToast[];
  onlineCount: number;
  onClearNotifications: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  activities,
  notifications,
  onlineCount,
  onClearNotifications,
}) => {
  if (!isOpen) return null;

  // Mock active team members collaborating on the project
  const teamMembers: TeamMember[] = [
    {
      id: 'm-1',
      name: 'Andi Saputra, ST',
      role: 'Lead Fire Protection Specialist',
      avatarColor: 'bg-indigo-600',
      status: 'online',
    },
    {
      id: 'm-2',
      name: 'Budi Hartono',
      role: 'Fire Alarm Design Tech',
      avatarColor: 'bg-emerald-600',
      status: 'online',
    },
    {
      id: 'm-3',
      name: 'User (You)',
      role: 'Lead Reviewer',
      avatarColor: 'bg-rose-600',
      status: 'online',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center">
              <Radio className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Real-Time Team Collaboration</h3>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Cloud Sync Active ({onlineCount} Connected)</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Online Team Presence */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-rose-600" />
              Active Team Engineers
            </span>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              Live Presence
            </span>
          </div>

          <div className="space-y-2">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-full ${member.avatarColor} text-white text-xs font-bold flex items-center justify-center`}
                  >
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-800 block leading-tight">
                      {member.name}
                    </span>
                    <span className="text-[10px] text-slate-500">{member.role}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Active
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Activity & Audit Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-rose-600" />
              Recent Project Activity
            </span>
            <span className="text-[11px] text-slate-500">{activities.length} events</span>
          </div>

          <div className="relative border-l-2 border-slate-200 ml-3 space-y-4 py-1">
            {activities.map((act) => (
              <div key={act.id} className="relative pl-5">
                {/* Node dot */}
                <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-white"></div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-800">{act.userName}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(act.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <span className="font-semibold text-rose-600 block text-[11px] mb-0.5">
                    {act.action}
                  </span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">{act.details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
