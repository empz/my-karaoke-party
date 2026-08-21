type QueueItem = {
  id: string;
  playedAt: Date | null;
};

/** Positions in `playlist` of the videos still waiting to be played, in queue order. */
export function getQueueIndexes(playlist: QueueItem[]) {
  const indexes: number[] = [];

  playlist.forEach((video, index) => {
    if (!video.playedAt) indexes.push(index);
  });

  return indexes;
}

/**
 * Moves an upcoming video to `toIndex` within the queue of unplayed videos,
 * leaving the already played ones where they are.
 *
 * Index 0 of that queue is the song on screen right now: it stays put, so it
 * can neither be dragged around nor pushed aside by another song. Returns the
 * playlist untouched when the move isn't possible.
 */
export function moveInQueue<T extends QueueItem>(
  playlist: T[],
  videoId: string,
  toIndex: number,
) {
  const queueIndexes = getQueueIndexes(playlist);

  const from = queueIndexes.findIndex(
    (index) => playlist[index]!.id === videoId,
  );
  const to = Math.min(Math.max(toIndex, 1), queueIndexes.length - 1);

  if (from < 1 || to < 1 || from === to) return playlist;

  const queue = queueIndexes.map((index) => playlist[index]!);
  const [moved] = queue.splice(from, 1);
  queue.splice(to, 0, moved!);

  const reordered = [...playlist];

  queueIndexes.forEach((index, i) => {
    reordered[index] = queue[i]!;
  });

  return reordered;
}
