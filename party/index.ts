import type { Video } from "@prisma/client";
import type * as Party from "partykit/server";
import { z } from "zod";
import { orderByFairness } from "~/utils/array";

const EXPIRY_PERIOD_MILLISECONDS = 30 * 24 * 60 * 60 * 1000; // 30 days

const AddVideo = z.object({
	type: z.literal("add-video"),
	id: z.string(),
	title: z.string(),
	artist: z.string().optional(),
	song: z.string().optional(),
	coverUrl: z.string(),
	duration: z.string().optional(),
	singerName: z.string(),
});

const MarkAsPlayed = z.object({
	type: z.literal("mark-as-played"),
	id: z.string(),
});

const RemoveVideo = z.object({
	type: z.literal("remove-video"),
	id: z.string(),
});

const PostponeVideo = z.object({
	type: z.literal("postpone-video"),
	id: z.string(),
});

const Horn = z.object({
	type: z.literal("horn"),
});

const Message = z.union([
	AddVideo,
	RemoveVideo,
	MarkAsPlayed,
	PostponeVideo,
	Horn,
]);

type KaraokePartySettings = {
	orderByFairness: boolean;
};

export type Message = z.infer<typeof Message>;

export type VideoInPlaylist = Omit<Video, "duration"> & {
	singerName: string;
	playedAt: Date | null;
	postponedAt?: Date | null;
	duration: string | undefined;
};

export type KaraokeParty = {
	playlist: VideoInPlaylist[];
	settings: KaraokePartySettings;
};

export default class Server implements Party.Server {
	karaokeParty: KaraokeParty | undefined;

	constructor(readonly room: Party.Room) {}

	async onStart() {
		this.karaokeParty =
			await this.room.storage.get<KaraokeParty>("karaokeParty");
	}

	async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
		// A websocket just connected!
		console.log(
			`Connected:
      id: ${conn.id}
      room: ${this.room.id}
      url: ${new URL(ctx.request.url).pathname}`,
		);

		await this.room.storage.setAlarm(Date.now() + EXPIRY_PERIOD_MILLISECONDS);
	}

	async onClose(connection: Party.Connection) {
		// A websocket just disconnected!
		console.log(`Disconnected: ${connection.id}`);
	}

	async onMessage(message: string, _sender: Party.Connection) {
		if (!this.karaokeParty) return;

		console.log("Received message:", message);

		const result = Message.safeParse(JSON.parse(message));

		if (!result.success) {
			console.error("Invalid message!", result.error);
			return;
		}

		const data = result.data;

		await this.room.storage.setAlarm(Date.now() + EXPIRY_PERIOD_MILLISECONDS);

		switch (data.type) {
			case "add-video": {
				if (
					!this.karaokeParty.playlist.find(
						(video) => video.id === data.id && !video.playedAt,
					)
				) {
					this.karaokeParty.playlist.push({
						id: data.id,
						title: data.title,
						artist: "Some artist",
						song: "Song name",
						createdAt: new Date(),
						singerName: data.singerName,
						coverUrl: data.coverUrl,
						playedAt: null,
						postponedAt: null,
						duration: data.duration ?? undefined,
					});

					if (this.karaokeParty.settings.orderByFairness) {
						this.reorderPlaylistByFairness();
					}

					await this.savekaraokeParty();
					this.room.broadcast(JSON.stringify(this.karaokeParty.playlist));
				}

				break;
			}

			case "remove-video": {
				const index = this.karaokeParty.playlist.findIndex(
					(video) => video.id === data.id,
				);

				if (index !== -1) {
					this.karaokeParty.playlist.splice(index, 1);
					await this.savekaraokeParty();
					this.room.broadcast(JSON.stringify(this.karaokeParty.playlist));
				}

				break;
			}

			case "postpone-video": {
				const playlist = this.karaokeParty.playlist;
				const index = playlist.findIndex(
					(video) => video.id === data.id && !video.playedAt,
				);

				if (index !== -1) {
					// Prefer a song whose singer hasn't already asked to wait this
					// turn, so two postponed songs don't alternate while a ready
					// singer sits behind them.
					const nextReadyIndex = playlist.findIndex(
						(video, i) => i > index && !video.playedAt && !video.postponedAt,
					);
					const nextIndex =
						nextReadyIndex !== -1
							? nextReadyIndex
							: playlist.findIndex((video, i) => i > index && !video.playedAt);

					if (nextIndex !== -1) {
						const postponed = playlist[index]!;
						postponed.postponedAt = new Date();

						[playlist[index], playlist[nextIndex]] = [
							playlist[nextIndex]!,
							postponed,
						];

						await this.savekaraokeParty();
						this.room.broadcast(JSON.stringify(playlist));
					}
				}

				break;
			}

			case "mark-as-played": {
				const video = this.karaokeParty.playlist.find(
					(video) => video.id === data.id && !video.playedAt,
				);

				if (video) {
					video.playedAt = new Date();

					// A song finished: everyone who postponed gets a fresh turn.
					for (const v of this.karaokeParty.playlist) {
						if (!v.playedAt) {
							v.postponedAt = null;
						}
					}

					await this.savekaraokeParty();
					this.room.broadcast(JSON.stringify(this.karaokeParty.playlist));
				}

				break;
			}

			case "horn": {
				// Just broadcast the horn event to all clients
				this.room.broadcast(JSON.stringify({ type: "horn" }));
				break;
			}

			default: {
				console.error("Unknown message type", data);
			}
		}
	}

	async onRequest(req: Party.Request) {
		if (req.method === "POST" && !this.karaokeParty) {
			console.log("Creating new karaoke party");

			this.karaokeParty = {
				playlist: [],
				settings: {
					orderByFairness: true,
				},
			};

			await this.savekaraokeParty();
		}

		if (this.karaokeParty) {
			return new Response(JSON.stringify(this.karaokeParty), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		return new Response("Party not found =(", { status: 404 });
	}

	async savekaraokeParty() {
		if (this.karaokeParty) {
			await this.room.storage.put<KaraokeParty>(
				"karaokeParty",
				this.karaokeParty,
			);
		}
	}

	async onAlarm() {
		await this.room.storage.deleteAll();
	}

	reorderPlaylistByFairness() {
		if (!this.karaokeParty || this.karaokeParty.playlist.length === 0) return;

		const ordered = orderByFairness(
			this.karaokeParty.playlist,
			(video) => video.singerName,
			(a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
		);

		const playedVideos = this.karaokeParty.playlist.filter(
			(video) => video.playedAt,
		);
		const currentVideo = this.karaokeParty.playlist.find((v) => !v.playedAt);
		const nextVideos = ordered.filter(
			(video) => !video.playedAt && video !== currentVideo,
		);

		const newPlaylist = [...playedVideos];

		if (currentVideo) {
			newPlaylist.push(currentVideo);
		}

		newPlaylist.push(...nextVideos);

		this.karaokeParty.playlist = newPlaylist;
	}
}

Server satisfies Party.Worker;
