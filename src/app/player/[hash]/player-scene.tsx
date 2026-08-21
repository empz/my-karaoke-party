/* eslint-disable */
"use client";

import {
  readLocalStorageValue,
  useFullscreen,
  useHotkeys,
} from "@mantine/hooks";
import type { Party } from "@prisma/client";
import { decode } from "html-entities";
import {
  ChevronLeft,
  ChevronRight,
  ListPlus,
  Maximize,
  Minimize,
  MoveDown,
  Shuffle,
  SkipForward,
  X,
} from "lucide-react";
import Image from "next/image";
import type { Message, KaraokeParty } from "party";
import usePartySocket from "partysocket/react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import useSound from "use-sound";
import { EmptyPlayer } from "~/components/empty-player";
import { Player } from "~/components/player";
import { SongSearch } from "~/components/song-search";
import { Button } from "~/components/ui/ui/button";
import { env } from "~/env";
import { cn } from "~/lib/utils";
import { moveInQueue } from "~/utils/playlist";
import { getUrl } from "~/utils/url";

type Props = {
  party: Party;
  initialPlaylist: KaraokeParty;
};

export default function PlayerScene({ party, initialPlaylist }: Props) {
  const [playlist, setPlaylist] = useState<KaraokeParty["playlist"]>(
    initialPlaylist.playlist ?? [],
  );

  const [fairQueue, setFairQueue] = useState(
    initialPlaylist.settings?.orderByFairness ?? true,
  );

  // Ids of the song being dragged and of the slot it is hovering over, so the
  // strip can show where it would land.
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [playHorn] = useSound("/sounds/buzzer.mp3");
  const lastHornTimeRef = useRef<number>(0);
  const togglePlayPauseRef = useRef<(() => void) | null>(null);

  // Throttled horn function
  const playThrottledHorn = () => {
    const now = Date.now();
    const timeSinceLastHorn = now - lastHornTimeRef.current;

    if (timeSinceLastHorn >= 5000) {
      // 5 seconds in milliseconds
      toast.success("Someone sent a horn!");
      playHorn();
      lastHornTimeRef.current = now;
    } else {
      console.log(
        `Horn throttled. Try again in ${Math.ceil((5000 - timeSinceLastHorn) / 1000)} seconds.`,
      );
    }
  };

  const socket = usePartySocket({
    host: env.NEXT_PUBLIC_PARTYKIT_URL,
    room: party.hash ?? "",
    onMessage(event) {
      // TODO: Improve type safety
      const eventData = JSON.parse(event.data);
      console.log(eventData);

      if (eventData.type === "horn") {
        playThrottledHorn();
      }

      if (eventData.type === "settings") {
        setFairQueue(Boolean(eventData.settings?.orderByFairness));
      }

      if (Array.isArray(eventData)) {
        setPlaylist(eventData as KaraokeParty["playlist"]);
      }
    },
  });

  const { ref, toggle, fullscreen } = useFullscreen();

  const currentVideo = playlist.find((video) => !video.playedAt);
  const nextVideos = playlist.filter((video) => !video.playedAt);

  const addSong = (videoId: string, title: string, coverUrl: string) => {
    const singerName = readLocalStorageValue({
      key: "name",
      defaultValue: "Host",
    });

    socket.send(
      JSON.stringify({
        type: "add-video",
        id: videoId,
        title,
        singerName,
        coverUrl,
      } satisfies Message),
    );
  };

  const removeSong = (videoId: string) => {
    socket.send(
      JSON.stringify({
        type: "remove-video",
        id: videoId,
      } satisfies Message),
    );
  };

  const markAsPlayed = () => {
    if (currentVideo) {
      // setShowOpenInYouTubeButton(false);

      socket.send(
        JSON.stringify({
          type: "mark-as-played",
          id: currentVideo.id,
        } satisfies Message),
      );
    }
  };

  const postponeSong = () => {
    if (currentVideo) {
      socket.send(
        JSON.stringify({
          type: "postpone-video",
          id: currentVideo.id,
        } satisfies Message),
      );
    }
  };

  /** Moves an upcoming song to `toIndex` in the queue (0 is the song playing now). */
  const moveSong = (videoId: string, toIndex: number) => {
    const reordered = moveInQueue(playlist, videoId, toIndex);

    if (reordered === playlist) return;

    // Show the new order right away; the server broadcast confirms it.
    setPlaylist(reordered);

    socket.send(
      JSON.stringify({
        type: "move-video",
        id: videoId,
        toIndex,
      } satisfies Message),
    );

    if (fairQueue) {
      // The server turns fair ordering off so the next added song doesn't
      // undo this move. Say so, instead of letting it change silently.
      setFairQueue(false);
      toast.info("Fair queue paused - the playlist is now sorted manually.");
    }
  };

  const toggleFairQueue = () => {
    const enabled = !fairQueue;

    setFairQueue(enabled);

    socket.send(
      JSON.stringify({
        type: "set-fair-queue",
        enabled,
      } satisfies Message),
    );

    toast.info(
      enabled
        ? "Fair queue on - songs are spread out between singers again."
        : "Fair queue off - songs stay in the order you set.",
    );
  };

  // Add keyboard shortcuts
  // f - fullscreen toggle, space - play/pause, right arrow - skip video
  useHotkeys([
    ["f", toggle],
    ["Space", () => togglePlayPauseRef.current?.()],
    [
      "ArrowRight",
      () => {
        if (currentVideo) {
          markAsPlayed();
        }
      },
    ],
  ]);

  const joinPartyUrl = getUrl(`/join/${party.hash}`);

  return (
    <div className="flex h-screen w-full flex-row flex-nowrap">
      <div className="grow-0 basis-1/3 overflow-y-auto border-r border-slate-500 px-4">
        <div className="py-4 text-center">
          <h1 className="text-outline scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-4xl">
            {party.name}
          </h1>
        </div>
        <SongSearch
          key={party.hash}
          playlist={playlist}
          onVideoAdded={addSong}
        />
      </div>
      <div className="grow-0 basis-2/3 overflow-auto">
        <div className="flex h-full flex-col">
          <div className="relative h-5/6" ref={ref}>
            <Button
              onClick={toggle}
              variant="ghost"
              size="icon"
              className="absolute bottom-0 right-3 z-10"
            >
              {fullscreen ? <Minimize /> : <Maximize />}
            </Button>
            {currentVideo ? (
              <Player
                key={currentVideo.id}
                video={currentVideo}
                joinPartyUrl={joinPartyUrl}
                isFullscreen={fullscreen}
                onPlayerEnd={() => {
                  markAsPlayed();
                }}
                onTogglePlayPauseRef={togglePlayPauseRef}
              />
            ) : (
              <EmptyPlayer
                joinPartyUrl={joinPartyUrl}
                className={fullscreen ? "bg-gradient" : ""}
              />
            )}
          </div>
          <div className="flex h-1/6 min-h-[150px] flex-row space-x-3 border-t border-slate-500 p-4">
            <div className="flex shrink-0 flex-col items-center justify-center">
              <Button
                variant="ghost"
                size="icon"
                title={
                  fairQueue
                    ? "Fair queue on - click to sort the playlist manually"
                    : "Manual order - click to spread songs between singers again"
                }
                onClick={toggleFairQueue}
              >
                <Shuffle
                  className={fairQueue ? "text-emerald-400" : "text-slate-400"}
                />
              </Button>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">
                {fairQueue ? "Fair" : "Manual"}
              </span>
            </div>
            {nextVideos.length > 0 ? (
              <>
                <div className="no-scrollbar flex h-full grow flex-row space-x-2 overflow-x-scroll">
                  {nextVideos.map((v, i) => {
                    // The first one is on screen right now: it stays put.
                    const isPlaying = i === 0;
                    const isDragging = draggedId === v.id;

                    return (
                      <div
                        key={v.id}
                        title={decode(v.title)}
                        draggable={!isPlaying}
                        onDragStart={(e) => {
                          // Firefox only starts a drag once some data is set.
                          e.dataTransfer.setData("text/plain", v.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggedId(v.id);
                        }}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setDragOverIndex(null);
                        }}
                        onDragOver={(e) => {
                          if (!draggedId || isPlaying) return;

                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverIndex(i);
                        }}
                        onDragLeave={() => {
                          setDragOverIndex((current) =>
                            current === i ? null : current,
                          );
                        }}
                        onDrop={(e) => {
                          e.preventDefault();

                          if (draggedId && !isPlaying) {
                            moveSong(draggedId, i);
                          }

                          setDraggedId(null);
                          setDragOverIndex(null);
                        }}
                        className={cn(
                          "relative flex aspect-[4/3] h-full items-center justify-center rounded-lg bg-slate-200 p-3 text-center text-primary-foreground animate-in slide-in-from-bottom first:border-2 first:border-amber-500",
                          !isPlaying && "cursor-grab active:cursor-grabbing",
                          isDragging && "opacity-40",
                          dragOverIndex === i &&
                            !isDragging &&
                            "ring-2 ring-amber-400",
                        )}
                      >
                        <Image
                          src={v.coverUrl}
                          fill={true}
                          className="pointer-events-none rounded-lg hover:opacity-50"
                          alt="Cover"
                        />

                        <Button
                          variant="link"
                          size="icon"
                          className="absolute right-0 top-0 z-10 hover:bg-gray-400"
                          onClick={() => {
                            removeSong(v.id);
                          }}
                        >
                          <X color="red" />
                        </Button>

                        {isPlaying && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute bottom-0 right-0 z-10 rounded text-yellow-300 hover:bg-gray-400"
                            onClick={() => {
                              markAsPlayed();
                            }}
                          >
                            <SkipForward />
                          </Button>
                        )}

                        {isPlaying && nextVideos.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute bottom-0 left-0 z-10 rounded text-yellow-300 hover:bg-gray-400"
                            title="Postpone (move back one spot)"
                            onClick={() => {
                              postponeSong();
                            }}
                          >
                            <MoveDown />
                          </Button>
                        )}

                        {!isPlaying && i > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute bottom-0 left-0 z-10 rounded text-yellow-300 hover:bg-gray-400"
                            title="Move up one spot"
                            onClick={() => {
                              moveSong(v.id, i - 1);
                            }}
                          >
                            <ChevronLeft />
                          </Button>
                        )}

                        {!isPlaying && i < nextVideos.length - 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute bottom-0 right-0 z-10 rounded text-yellow-300 hover:bg-gray-400"
                            title="Move back one spot"
                            onClick={() => {
                              moveSong(v.id, i + 1);
                            }}
                          >
                            <ChevronRight />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex aspect-[4/3] h-full items-center justify-center rounded-lg border-2 border-dashed border-slate-500 bg-slate-200 p-3 text-center text-slate-500">
                <ListPlus
                  size={32}
                  strokeWidth={1.5}
                  className="animate-bounce"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
