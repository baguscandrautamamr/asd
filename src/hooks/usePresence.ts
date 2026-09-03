import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AppUser } from '../context/AuthContext';

export interface PresentUser {
  userId: string;
  name: string;
  email: string;
  /** Hue derived from the user id, so each person keeps the same avatar colour. */
  hue: number;
  onlineAt: number;
  isSelf: boolean;
}

function hueFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 360;
  return hash;
}

/**
 * Live roster of everyone with the app open, via Supabase Realtime Presence.
 *
 * Presence state lives in the realtime server rather than a table: each client
 * tracks its own payload and receives the merged roster on every join/leave.
 */
export function usePresence(user: AppUser | null): PresentUser[] {
  const [roster, setRoster] = useState<PresentUser[]>([]);

  const self = useMemo<PresentUser | null>(() => {
    if (!user) return null;
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      hue: hueFromId(user.id),
      onlineAt: Date.now(),
      isSelf: true,
    };
  }, [user]);

  useEffect(() => {
    if (!supabase || !user) {
      setRoster(self ? [self] : []);
      return;
    }

    const channel = supabase.channel('asd-presence', {
      config: { presence: { key: user.id } },
    });

    const readState = () => {
      const state = channel.presenceState<{
        userId: string;
        name: string;
        email: string;
        onlineAt: number;
      }>();

      const people: PresentUser[] = [];
      for (const entries of Object.values(state)) {
        // Someone with two tabs open should appear once; keep the first join.
        const first = entries[0];
        if (!first) continue;
        people.push({
          userId: first.userId,
          name: first.name,
          email: first.email,
          hue: hueFromId(first.userId),
          onlineAt: first.onlineAt,
          isSelf: first.userId === user.id,
        });
      }
      people.sort((a, b) => a.onlineAt - b.onlineAt);
      setRoster(people);
    };

    channel
      .on('presence', { event: 'sync' }, readState)
      .on('presence', { event: 'join' }, readState)
      .on('presence', { event: 'leave' }, readState)
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        await channel.track({
          userId: user.id,
          name: user.name,
          email: user.email,
          onlineAt: Date.now(),
        });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, self]);

  return roster;
}
