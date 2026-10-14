"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { Person } from "@/lib/people";
import type { ProjectEvent } from "@/lib/realtime-server";

// Everyone looking at a project shares a room: who is here, where their
// pointer is over the prototype, and a nudge to refresh when something
// changes. Powered by Supabase Realtime; the server side is realtime-server.ts.

export type Peer = Person & { x: number | null; y: number | null };

type Options = {
  projectId: string;
  me: Person;
  supabaseUrl: string | null;
  supabaseKey: string | null;
  onEvent: (event: ProjectEvent) => void;
};

export function useProjectRoom({ projectId, me, supabaseUrl, supabaseKey, onEvent }: Options) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const channel = useRef<RealtimeChannel | null>(null);
  const cursors = useRef(new Map<string, { x: number | null; y: number | null }>());
  const present = useRef(new Map<string, Person>());
  const handler = useRef(onEvent);

  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return;
    const client = createClient(supabaseUrl, supabaseKey);
    const room = client.channel(`project:${projectId}`, { config: { presence: { key: me.id } } });
    channel.current = room;

    const publish = () => {
      setPeers(
        [...present.current.values()]
          .filter((p) => p.id !== me.id)
          .map((p) => ({ ...p, ...(cursors.current.get(p.id) ?? { x: null, y: null }) })),
      );
    };

    room
      .on("presence", { event: "sync" }, () => {
        present.current.clear();
        for (const [key, metas] of Object.entries(room.presenceState<Person>())) {
          const meta = metas[0];
          if (meta) present.current.set(key, { id: meta.id, name: meta.name, colour: meta.colour });
        }
        publish();
      })
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const p = payload as { id: string; x: number | null; y: number | null };
        cursors.current.set(p.id, { x: p.x, y: p.y });
        publish();
      })
      .on("broadcast", { event: "comments" }, () => handler.current("comments"))
      .on("broadcast", { event: "versions" }, () => handler.current("versions"))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") room.track(me);
      });

    return () => {
      channel.current = null;
      client.removeChannel(room);
    };
  }, [projectId, me.id, me.name, me.colour, supabaseUrl, supabaseKey, me]);

  const sendCursor = (x: number | null, y: number | null) => {
    channel.current?.send({ type: "broadcast", event: "cursor", payload: { id: me.id, x, y } });
  };

  return { peers, sendCursor };
}
