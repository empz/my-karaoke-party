import Image from "next/image";
import { CreateParty } from "../components/create-party";
import logo from "~/assets/my-karaoke-party-logo.png";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/ui/alert";
import { Megaphone } from "lucide-react";
import { Button } from "~/components/ui/ui/button";

export default async function Home() {
  return (
    <main className="flex h-[100dvh] flex-col items-center overflow-hidden px-4">
      <div className="w-full shrink-0 pt-2">
        <Alert
          variant={"default"}
          className="mx-auto max-w-xl bg-purple-600 duration-500 animate-in slide-in-from-top"
        >
          <Megaphone className="h-5 w-5" />
          <AlertTitle>Want to make your own karaoke?</AlertTitle>
          <AlertDescription>
            <p className="mt-4">
              Now you can with MyKaraoke Video. It takes 2 minutes!
            </p>
            <p className="mt-4">
              <a
                target="_blank"
                href="https://www.mykaraoke.video?ref=mykaraoke.party"
              >
                <Button>Try it now!</Button>
              </a>
            </p>
          </AlertDescription>
        </Alert>
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-6 py-4">
        <div className="relative min-h-0 w-full max-w-xl flex-1">
          <Image
            src={logo}
            alt="My Karaoke Party logo"
            fill
            priority={true}
            placeholder="blur"
            sizes="(max-width: 640px) 100vw, 36rem"
            className="object-contain"
          />
        </div>

        <CreateParty />

        <div className="shrink-0">
          <Link href="/terms-of-service" className="hover:underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </main>
  );
}
