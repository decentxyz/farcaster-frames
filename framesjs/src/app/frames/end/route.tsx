/* eslint-disable react/jsx-key */
import { base } from 'viem/chains';
import { Button } from "frames.js/next";
import { State, frames } from "./../frames";
import React from "react";
import { getTransactionStatus } from './../decentUtils';

let chain = base;

export const POST = frames(async (ctx) => {
  if (!ctx.message) {
    throw new Error("No message");
  }

  const transactionId = ctx.message.transactionId!;

  let state: State;
  console.log('current transactionId', transactionId);
  if (transactionId) {
    state = {
      srcChain: chain.id,
      txHash: transactionId,
    }
  } else {
    state = ctx.state
  }

  console.log('Source Chain TX Hash:', transactionId, 'State: ', state)

  const { status, transactionHash } = await getTransactionStatus(state.srcChain, state.txHash!!);

  if (status === 'Executed') {
    console.log('Transaction has been executed successfully.');

    try {
      // do your custom logic on successful transaction here

      return {
        state: state,
        buttons: [
          <Button action="link" target="https://decent.xyz">Success, go to Decent!</Button>,
        ],
        image: "https://dtech.vision/frame.png",
        imageOptions: {
          aspectRatio: '1:1',
        },
      };
    } catch (err) {
      console.error('Error in our custom logic:', err);
    }
  } else if (status === 'Failed') {
    console.log('Transaction has failed.');

    // return a new frame where image shows failed
    return {
      state: state,
      buttons: [
        <Button action="post" target="/">Transaction failed, try again!</Button>
      ],
      image: "https://dtech.vision/frame.png",
      imageOptions: {
        aspectRatio: '1:1',
      },
    };
  }

  return {
    state: state,
    buttons: [
      <Button action="post" target='/end'>Processing... Check Status</Button>,
    ],
    image: "https://dtech.vision/frame.png",
    imageOptions: {
      aspectRatio: '1:1',
    },
  };
}); 