import { farcasterHubContext } from "frames.js/middleware";
import { createFrames } from "frames.js/next";

export type State = {
  txHash: string;
  srcChain: number;
}

export const frames = createFrames<State>({
  basePath: "/frames",
  initialState: {
    txHash: '',
    srcChain: -1,
  },
  middleware: [
    farcasterHubContext({
      hubHttpUrl: "https://nemes.farcaster.xyz:2281", // you can replace this with your own or e.g. a neynar hub
    }),
  ],
});