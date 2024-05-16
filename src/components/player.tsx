/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
"use client";

import { useRef, useState } from "react";
import usePartySocket from "partysocket/react";
import { useIdle } from "@mantine/hooks";
import { useRouter } from "next/navigation";
import YouTube, { type YouTubeProps, type YouTubePlayer } from "react-youtube";
import { api } from "~/trpc/react";
import { ForwardIcon } from "@heroicons/react/24/solid";
import { QrCode } from "./qr-code";
import { env } from "~/env";
import { Party } from "@prisma/client";
import { KaraokeParty } from "party";
import { AddSongForm } from "./add-song-form";

export function Player({
  party,
  initialPlaylist,
}: {
  party: Party;
  initialPlaylist?: KaraokeParty;
}) {
  const playerRef = useRef<YouTubePlayer>(null);
  const idle = useIdle(5000);
  const router = useRouter();

  const [playlist, setPlaylist] = useState<KaraokeParty["videos"]>(
    initialPlaylist?.videos ?? [],
  );

  const socket = usePartySocket({
    host: env.NEXT_PUBLIC_PARTYKIT_URL,
    room: party.hash!,
    onMessage(event) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const message = JSON.parse(event.data) as KaraokeParty;
      if (message.videos) {
        setPlaylist(message.videos);
      }
    },
  });

  const opts: YouTubeProps["opts"] = {
    playerVars: {
      // https://developers.google.com/youtube/player_parameters
      start: 0,
      autoplay: 0,
      rel: 0,
      controls: 0,
    },
  };

  const currentVideo = playlist.find((video) => !video.playedAt);

  // const markVideoAsPlayed = api.party.markVideoAsPlayed.useMutation({
  //   onSuccess: () => {
  //     console.log("Marked video as played");
  //     router.refresh();
  //   },
  // });

  const onPlayerReady: YouTubeProps["onReady"] = (event) => {
    console.log("handleReady");
    // access to player in all event handlers via event.target
    playerRef.current = event.target;
  };

  const onPlayerPlay: YouTubeProps["onPlay"] = (event) => {
    console.log("handlePlay");

    // TODO: Mark video as played
  };

  const onPlayerPause: YouTubeProps["onPause"] = (event) => {
    console.log("handlePause");

    // TODO: Mark video as played
  };

  const onPlayerEnd: YouTubeProps["onEnd"] = (event) => {
    console.log("handleEnd");

    // TODO: Mark video as played
    //markVideoAsPlayed.mutate({ partyId: party.id, videoId });

    if (currentVideo) {
      socket.send(
        JSON.stringify({ type: "mark-as-played", id: currentVideo.id }),
      );
    }
  };

  const skipToEnd = () => {
    if (playerRef.current) {
      const duration = playerRef.current.getDuration();
      playerRef.current.seekTo(duration - 1, true);
      playerRef.current.playVideo();
    }
  };

  const addSong = async (videoId: string) => {
    socket.send(JSON.stringify({ type: "add-video", id: videoId }));
  };

  const joinPartyUrl = `https://www.karaokeparty.com/join/${party.hash}`;

  if (!currentVideo) {
    return (
      <div className="hero bg-base-200 min-h-screen">
        <div className="hero-content text-center">
          <div className="max-w-xl">
            <h1 className="text-5xl font-bold">Playlist is empty 😞</h1>
            <h2 className="py-6 text-2xl">
              Add more songs and keep the Karaoke Party going!
            </h2>
            <AddSongForm addFn={addSong} />

            <QrCode url={`https://www.karaokeparty.com/join/${party.hash}`} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <YouTube
        loading="eager"
        iframeClassName="p2 fixed bottom-0 right-0 h-auto min-h-full w-auto min-w-full -z-10"
        videoId={currentVideo.id}
        opts={opts}
        onPlay={onPlayerPlay}
        onReady={onPlayerReady}
        onEnd={onPlayerEnd}
        onPause={onPlayerPause}
      />
      <QrCode url={joinPartyUrl} />

      <button
        className="btn btn-secondary fixed bottom-1 right-1 h-24"
        onClick={skipToEnd}
      >
        <ForwardIcon className="h-24 w-24" />
      </button>
    </>
  );
}
