/* eslint-disable react/jsx-key */
import { Button } from "frames.js/next";
import { frames } from "./frames";
import React from "react";
 
const handleRequest = frames(async () => {
  return {
    image: `${process.env.FRAME_URL}/park-3.png`,
    imageOptions: {
      aspectRatio: '1:1',
    },
    buttons: [
      <Button action="tx" target={'/tx'} post_url={'/tx-success'}>Execute</Button>,
      <Button action="tx" target={'/tx-approve'} post_url={'/'}>Approve</Button>
    ],
  };
});
 
export const GET = handleRequest;
export const POST = handleRequest;