import Head from "next/head";
import { FocusInstrument } from "@/components/instrument/focus-instrument";

export default function Home() {
  return (
    <>
      <Head>
        <title>Tempo — Time, well spent.</title>
        <meta
          name="description"
          content="A tactile Pomodoro timer. Turn the dial, settle into your focus, and find a slower, better rhythm with Tempo."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#eeeae1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <FocusInstrument />
    </>
  );
}
