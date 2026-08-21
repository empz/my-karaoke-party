# My Karaoke Party

![image](https://github.com/user-attachments/assets/45a1f009-d93a-487f-ada7-2b79b60dc416)

YouTube-based karaoke party web app with remote searching and queuing from QR code.

- Host a party.
- Join existing party via link or QR.
- Search karaoke videos on YouTube and add them to the queue.
- Queue is sorted by "fairness" to avoid mic hogs.
- The host can reorder the queue by hand (drag a song or use the arrows), which pauses the fair sorting until it is switched back on.

## Stack

Based on T3 App (https://create.t3.gg/)

- Next.js 14
- Postgres
- Prisma
- Tailwind
- PartyKit

## Development

1. Run `pnpm install` to install dependencies.
1. Copy .env.example to .env and fill in the values.
1. Run `pnpm db:push` to create the database.
1. Run `pnpm dev:pk` to start the PartyKit development server.
1. Run `pnpm dev` to start the development server.

## Contribution

I don't have time to work on this at the moment but I'll happy take in PRs and deploy changes to the live site at https://www.mykaraoke.party.
