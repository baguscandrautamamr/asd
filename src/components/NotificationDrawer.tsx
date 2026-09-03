import React from 'react';
import { ActivityLog } from '../types';
import { Clock, Info, Radio, Users, X } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import type { PresentUser } from '../hooks/usePresence';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activities: ActivityLog[];
  /** Live roster from Supabase Realtime Presence. */
  people: PresentUser[];
  liveEnabled: boolean;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  activities,
  people,
  liveEnabled,
}) => {
  const { t, locale } = useI18n();

  if (!isOpen) return null;

  const time = (value: number) =>
    new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface h-full shadow-2xl flex flex-col border-l border-line"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-4 bg-shell border-b-[3px] border-brand-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
              <Radio className={`w-4 h-4 text-white ${liveEnabled ? 'animate-pulse' : ''}`} />
            </span>
            <div>
              <h3 className="font-bold text-sm text-white">{t('presence.title')}</h3>
              <div className="flex items-center gap-1.5 text-2xs text-brand-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-2" />
                <span>{t('presence.online', { n: people.length })}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-surface-2 border-b border-line">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-ink-2 uppercase flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-brand" />
              {t('presence.title')}
            </span>
            <span className="text-2xs font-semibold text-brand-ink bg-brand-wash px-2 py-0.5 rounded-full">
              {t('presence.online', { n: people.length })}
            </span>
          </div>

          {!liveEnabled && (
            <p className="flex items-start gap-1.5 text-2xs text-ink-3 mb-2">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              {t('presence.localOnly')}
            </p>
          )}

          <div className="space-y-1.5">
            {people.map((person) => (
              <div
                key={person.userId}
                className="flex items-center justify-between gap-2 bg-surface p-2 rounded-lg border border-line"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `hsl(${person.hue} 45% 38%)` }}
                  >
                    {person.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-ink block leading-tight truncate">
                      {person.name}
                      {person.isSelf && (
                        <span className="text-ink-3 font-medium"> · {t('presence.you')}</span>
                      )}
                    </span>
                    <span className="text-2xs text-ink-3 truncate block">{person.email}</span>
                  </div>
                </div>

                <span className="flex items-center gap-1 text-2xs font-semibold text-ok bg-ok-wash px-2 py-0.5 rounded shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                  {t('presence.since', { time: time(person.onlineAt) })}
                </span>
              </div>
            ))}

            {people.length === 0 && <p className="text-xs text-ink-3">{t('presence.empty')}</p>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-2 uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-brand" />
              {t('drawer.recent')}
            </span>
            <span className="text-2xs text-ink-3">
              {t('drawer.events', { n: activities.length })}
            </span>
          </div>

          {activities.length === 0 ? (
            <p className="text-xs text-ink-3">{t('drawer.empty')}</p>
          ) : (
            <div className="relative border-l-2 border-line ml-3 space-y-3 py-1">
              {activities.map((activity) => (
                <div key={activity.id} className="relative pl-5">
                  <span className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-brand ring-4 ring-surface" />

                  <div className="bg-surface-2 p-2.5 rounded-lg border border-line text-xs">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="font-bold text-ink truncate">{activity.userName}</span>
                      <span className="text-2xs text-ink-3 shrink-0">
                        {time(activity.timestamp)}
                      </span>
                    </div>
                    <span className="font-semibold text-brand-ink block text-2xs mb-0.5">
                      {activity.actionKey ? t(activity.actionKey) : activity.action}
                    </span>
                    <p className="text-ink-2 text-2xs leading-relaxed">
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
