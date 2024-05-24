"use client";

import { type Party } from "@prisma/client";
import { type Message, type KaraokeParty } from "party";
import usePartySocket from "partysocket/react";
import { useEffect, useState } from "react";
import { env } from "~/env";
import { readLocalStorageValue, useLocalStorage } from "@mantine/hooks";
import { SongSearch } from "~/components/song-search";
import { ListMusic } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/ui/accordion";
import { decode } from "html-entities";
import { useRouter } from "next/navigation";

export function PartyScene({
  party,
  initialPlaylist,
}: {
  party: Party;
  initialPlaylist?: KaraokeParty;
}) {
  const [name] = useLocalStorage<string>({ key: "name" });
  const router = useRouter();

  const [playlist, setPlaylist] = useState<KaraokeParty["playlist"]>(
    initialPlaylist?.playlist ?? [],
  );

  useEffect(() => {
    const value = readLocalStorageValue({ key: "name" });

    if (!value) {
      router.push(`/join/${party.hash}`);
    }
  }, [router, party.hash, name]);

  const socket = usePartySocket({
    host: env.NEXT_PUBLIC_PARTYKIT_URL,
    room: party.hash!,
    // onOpen(_event) {
    //   if (name) {
    //     socket.send(
    //       JSON.stringify({
    //         type: "join",
    //         name,
    //       }),
    //     );
    //   }
    // },
    onMessage(event) {
      // TODO: Improve type safety

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const playlist = JSON.parse(event.data) as KaraokeParty["playlist"];
      if (playlist) {
        setPlaylist(playlist);
      }
    },
  });

  const addSong = async (videoId: string, title: string, coverUrl: string) => {
    socket.send(
      JSON.stringify({
        type: "add-video",
        id: videoId,
        title,
        singerName: name,
        coverUrl,
      } satisfies Message),
    );
  };

  const nextVideos = playlist.filter((video) => !video.playedAt);
  const nextVideo = nextVideos[0] ?? null;

  return (
    <>
      <div className="container mx-auto p-6 pb-16 text-center">
        <div>
          <h1 className="text-outline scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-4xl">
            {party.name}
          </h1>
        </div>

        <div className="mt-5">
          <SongSearch onVideoAdded={addSong} playlist={playlist} />
        </div>
      </div>

      <div className="fixed bottom-0 z-50 flex w-full items-center bg-primary p-2 text-primary-foreground text-white">
        <Accordion type="single" collapsible className="max-h-screen w-full">
          <AccordionItem value="item-1" className="border-0">
            <AccordionTrigger disabled={nextVideos.length < 2}>
              <div className="flex flex-row">
                <ListMusic className="mr-3" />
                {nextVideo ? nextVideo.title : "Playlist is empty"}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul role="list" className="divide-y divide-accent-foreground">
                {nextVideos.slice(1).map((video) => (
                  <li key={video.id} className="p-2 first:pt-0 last:pb-0">
                    {decode(video.title)}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </>
  );
}
