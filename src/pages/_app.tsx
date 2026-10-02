import "@/styles/globals.scss";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";

import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
