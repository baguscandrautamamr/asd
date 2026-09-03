import React from 'react';
import { ActivityLog, NotificationToast, TeamMember } from '../types';
import { Clock, Radio, Users, X } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import type { TranslationKey } from '../i18n/translations';

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
  onlineCount,
}) => {
  const { t, lang } = useI18n();

  if (!isOpen) return null;

  const teamMembers: (TeamMember & { roleKey: TranslationKey })[] = [
    {
      id: 'm-1',
      name: 'Andi Saputra, ST',
      role: '',
      roleKey: 'role.lead',
      avatarColor: 'bg-indigo-600',
      status: 'online',
    },
    {
      id: 'm-2',
      name: 'Budi Hartono',
      role: '',
      roleKey: 'role.tech',
      avatarColor: 'bg-emerald-600',
      status: 'online',
    },
    {
      id: 'm-3',
      name: t('user.you'),
      role: '',
      roleKey: 'role.reviewer',
      avatarColor: 'bg-brand',
      status: 'online',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface h-full shadow-2xl flex flex-col border-l border-line"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-4 bg-surface-3 border-b border-line flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
              <Radio className="w-4 h-4 text-white animate-pulse" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-ink">{t('drawer.title')}</h3>
              <div className="flex items-center gap-1.5 text-[11px] text-ok">
                <span className="w-1.5 h-1.5 rounded-full bg-ok animate-ping" />
                <span>{t('drawer.syncActive', { n: onlineCount })}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-surface-2 border-b border-line">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-ink-2 uppercase flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-brand" />
              {t('drawer.team')}
            </span>
            <span className="text-[11px] font-semibold text-ok bg-ok-wash px-2 py-0.5 rounded-full">
              {t('drawer.livePresence')}
            </span>
          </div>

          <div className="space-y-2">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-2 bg-surface p-2 rounded-xl border border-line"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-7 h-7 rounded-full ${member.avatarColor} text-white text-xs font-bold flex items-center justify-center`}
                  >
                    {member.name.charAt(0)}
                  </span>
                  <div>
                    <span className="font-bold text-xs text-ink block leading-tight">
                      {member.name}
                    </span>
                    <span className="text-[10px] text-ink-3">{t(member.roleKey)}</span>
                  </div>
                </div>

                <span className="flex items-center gap-1 text-[10px] font-semibold text-ok bg-ok-wash px-2 py-0.5 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                  {t('drawer.memberActive')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-ink-2 uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-brand" />
              {t('drawer.recent')}
            </span>
            <span className="text-[11px] text-ink-3">
              {t('drawer.events', { n: activities.length })}
            </span>
          </div>

          {activities.length === 0 ? (
            <p className="text-xs text-ink-3">{t('drawer.empty')}</p>
          ) : (
            <div className="relative border-l-2 border-line ml-3 space-y-4 py-1">
              {activities.map((activity) => (
                <div key={activity.id} className="relative pl-5">
                  <span className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-brand ring-4 ring-surface" />

                  <div className="bg-surface-2 p-2.5 rounded-xl border border-line text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-ink">{activity.userName}</span>
                      <span className="text-[10px] text-ink-3">
                        {new Date(activity.timestamp).toLocaleTimeString(
                          lang === 'id' ? 'id-ID' : 'en-US',
                          { hour: '2-digit', minute: '2-digit' }
                        )}
                      </span>
                    </div>
                    <span className="font-semibold text-brand block text-[11px] mb-0.5">
                      {activity.actionKey ? t(activity.actionKey) : activity.action}
                    </span>
                    <p className="text-ink-2 text-[11px] leading-relaxed">
                      {activity.detailsKey
                        ? t(activity.detailsKey, activity.detailsVars)
                        : activity.details}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
