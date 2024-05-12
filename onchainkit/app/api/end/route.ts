import { FrameRequest, getFrameMessage, getFrameHtmlResponse } from '@coinbase/onchainkit/frame';
import { NextRequest, NextResponse } from 'next/server';
import { NEXT_PUBLIC_URL, State } from '../../config';
import {
  getTransactionStatus,
} from './../../decentUtils';
import { base } from 'viem/chains';


let chain = base;
async function getResponse(req: NextRequest): Promise<NextResponse> {
  const body: FrameRequest = await req.json();
  const { isValid, message } = await getFrameMessage(body, { neynarApiKey: process.env.NEYNAR_API_KEY!! });

  if (!isValid) {
    return new NextResponse('Message not valid', { status: 500 });
  }

 const transactionId = message.transaction?.hash;

  let state: State;
  console.log('current transactionId', transactionId);
  if( transactionId ) {
    state = {
      srcChain: chain.id,
      txHash: transactionId,
    }
  } else {
    state = JSON.parse(message.state.serialized) as State;
  }

  console.log('Source Chain TX Hash:', transactionId, 'State: ', state)

  const { status, transactionHash } = await getTransactionStatus(state.srcChain, state.txHash!!);

  if (status === 'Executed') {
    console.log('Transaction has been executed successfully.');

    try {
      // do your custom logic on successful transaction here

      return new NextResponse(
        getFrameHtmlResponse({
          state: state,
          buttons: [
            {
              label: "Success, go to Decent!",
              action: "link",
              target: "https://decent.xyz"
            }
          ],
          image: {
            aspectRatio: '1:1',
            src: "https://dtech.vision/frame.png",
          }
        })
      );

    } catch (err) {
      console.error('Error in our custom logic:', err);
    }
  } else if (status === 'Failed') {
    console.log('Transaction has failed.');

    // return a new frame where image shows failed
    return new NextResponse(
      getFrameHtmlResponse({
        state: state,
        buttons: [
          {
            label: "Transaction failed, try again!",
            postUrl: `{${NEXT_PUBLIC_URL}/}`,
          }
        ],
        image: {
          aspectRatio: '1:1',
          src: `https://dtech.vision/frame.png`,
        },
      })
    );
  }

  return new NextResponse(
    getFrameHtmlResponse({
      state: state,
      buttons: [
        {
          label: `Processing... Check Status`,
        },
      ],
      image: {
        aspectRatio: '1:1',
        src: `https://dtech.vision/frame.png`,
      },
    }),
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  return getResponse(req);
}

export const dynamic = 'force-dynamic';
