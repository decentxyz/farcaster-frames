/** @jsxImportSource frog/jsx */
import { Button, Frog, TextInput } from 'frog'
import { devtools } from 'frog/dev'
import { neynar } from 'frog/hubs'
import { handle } from 'frog/next'
import { serveStatic } from 'frog/serve-static'

import { parseAbi } from 'viem';
import { base } from 'viem/chains';

import {
  ActionType,
  ChainId,
  BoxActionRequest,
  EvmAddress,
} from '@decent.xyz/box-common';

import {
  baseClient,
  polygonClient,
  erc20Abi,
  decentRequestOptions,
  getUserBalance,
  getTokenWithMaxBalance,
  getTransactionData,
  getTransactionStatus
} from './decentUtils';

let chain = base;
let zeroAddress = '0x0000000000000000000000000000000000000000';

type State = {
  txHash: string | undefined,
  srcChain: number,
}

const app = new Frog<{ State: State }>({
  assetsPath: '/',
  basePath: '/api',
  // Supply a Hub to enable frame verification.
  hub: neynar({ apiKey: process.env.NEYNAR_API_KEY!! }),
  initialState: {
    txHash: undefined,
    srcChain: -1,
  },
})

// Uncomment to use Edge Runtime
// export const runtime = 'edge'

app.frame('/', async (c) => {
  return c.res({
    image: `${process.env.FRAME_URL || 'http://localhost:3000/'}courtyardVendingmachine.gif`,
    imageAspectRatio: '1:1',
    intents: [
      // action is the post_url override apparently according to Frames.Transaction documentation https://frog.fm/intents/button-transaction#action-optional
      <Button.Transaction target="/tx" action="/tx-success">Mint Now</Button.Transaction>,
      <Button.Transaction target="/approve" action="/">Approve</Button.Transaction>,
    ],
  })
})

app.transaction('/tx', async (c) => {
  const account = c.address; // uses wallet connected to displayed Frame

  const tokens = await getUserBalance(chain.id, account);
  const sourceToken = await getTokenWithMaxBalance(chain.id, tokens, true, 25);

  // build decent.xyz transaction here and use the address it is sent to as the to address for the approve call
  // use the txConfig from the decent.xyx developer console

  const txConfig: BoxActionRequest = {
    sender: account!,
    srcChainId: chain?.id as ChainId,
    dstChainId: ChainId.POLYGON, // change to your destination chain
    srcToken: sourceToken,
    dstToken: '', // set your destination token (gas token -> zero address)
    slippage: 1, 
    actionType: ActionType.EvmFunction,
    actionConfig: {
      contractAddress: "", // the contract you want to interact with on the destination chain
      chainId: ChainId.POLYGON, // the destination chain
      signature: "function mintTokens(uint256 requestedQuantity, address recipient)", // signature of function to be executed
      args: [1n, account!], // arguments to be passed to the function
      cost: {
        isNative: false, // whether or not to send gasToken or not to the destinaton contract
        amount: 25000000n, // amount to send (watch out for the decimals and formatting of the token)
        tokenAddress: "", // the payment token's smart contract
      },
    }
  }

  const { tx, tokenPayment } = await getTransactionData(txConfig);

  // check for allowance if non native.
  if (sourceToken !== zeroAddress) {
    const allowance = await baseClient.readContract({
      address: sourceToken as EvmAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [
        account as EvmAddress,
        tx.to as EvmAddress,
      ]
    });

    if (allowance < tokenPayment.amount) {
      // requires approval
      return c.error({ message: 'Requires approval' });
    }
  }

  return c.res({
    chainId: `eip155:${base.id}`,
    method: "eth_sendTransaction",
    params: {
      to: tx.to,
      data: tx.data,
      value: tx.value.toString(),
    },
  },)
})

app.transaction('/approve', async (c) => {
  const account = c.address; // uses wallet connected to displayed Frame

  // get the sourceToken. The token the user has the maximum balance in (or the native gas token if that has enough balance)
  const tokens = await getUserBalance(chain.id, account);
  const sourceToken = await getTokenWithMaxBalance(chain.id, tokens);

  // build decent.xyz transaction here and use the address it is sent to as the to address for the approve call
  // use the txConfig from the decent.xyx developer console

  const txConfig: BoxActionRequest = {
    sender: account!,
    srcChainId: chain?.id as ChainId,
    dstChainId: ChainId.POLYGON, // change to your destination chain
    srcToken: sourceToken,
    dstToken: '', // set your destination token (gas token -> zero address)
    slippage: 1, 
    actionType: ActionType.EvmFunction,
    actionConfig: {
      contractAddress: "", // the contract you want to interact with on the destination chain
      chainId: ChainId.POLYGON, // the destination chain
      signature: "function mintTokens(uint256 requestedQuantity, address recipient)", // signature of function to be executed
      args: [1n, account!], // arguments to be passed to the function
      cost: {
        isNative: false, // whether or not to send gasToken or not to the destinaton contract
        amount: 25000000n, // amount to send (watch out for the decimals and formatting of the token)
        tokenAddress: "", // the payment token's smart contract
      },
    }
  }


  const { tx, tokenPayment } = await getTransactionData(txConfig);

  // check for allowance if non native.

  if (sourceToken == zeroAddress) {
    return c.error({ message: 'You can mint right away. Press Mint Now!' });
  }

  const allowance = await baseClient.readContract({
    address: sourceToken as EvmAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [
      account as EvmAddress,
      tx.to as EvmAddress,
    ]
  });

  if (allowance >= tokenPayment.amount) {
    return c.error({ message: 'You can mint right away. Press Mint Now!' });
  }

  // requires approval
  return c.contract({
    abi: erc20Abi,
    chainId: `eip155:${chain.id}`,
    functionName: 'approve',
    to: sourceToken as EvmAddress,
    args: [
      tx.to,
      tokenPayment.amount
    ]
  })
});

app.frame('/tx-success', async (c) => {
  let { transactionId, deriveState } = c;

  let state: State;
  console.log('current transactionId', transactionId);
  state = deriveState(previousState => {
    previousState.txHash = transactionId;
    previousState.srcChain = chain.id;
  })

  console.log('Source Chain TX Hash:', transactionId, 'State: ', state)

  const { status, transactionHash } = await getTransactionStatus(state.srcChain, state.txHash!!);

  if (status === 'Executed') {
    console.log('Transaction has been executed successfully.');

    try {
        // do your custom logic on successful transaction here

        return c.res({
        image: "https://dtech.vision/frame.png",
        imageAspectRatio: '1:1',
        intents: [
          <Button.Link href={`https://decent.xyz`}> Success, Go to Decent.xyz</Button.Link>,
        ],
      })

    } catch (err) {
      console.error('Error in our custom logic:', err);
    }
  } else if (status === 'Failed') {
    console.log('Transaction has failed.');

    // return a new frame where image shows failed
    return c.res({
      image: <div style={{ fontSize: 12 }}>Transaction failed, try again!</div>,
      imageAspectRatio: '1:1',
      intents: [
        // action is the post_url override apparently according to Frames.Transaction documentation https://frog.fm/intents/button-transaction#action-optional
        <Button.Transaction target="/tx" action="/tx-success">Mint Now</Button.Transaction>,
      ],
    })
  }

  return c.res({
    image: "https://dtech.vision/frame.png", // replace with your nice waiting screen image
    imageAspectRatio: '1:1',
    intents: [
      <Button action='/end'>Processing... Check Status</Button>,
    ],
  })
})

app.frame('/end', async (c) => {
  let { previousState } = c;

  console.log('State: ', previousState)

  const { status, transactionHash } = await getTransactionStatus(previousState.srcChain, previousState.txHash!!);

  if (status === 'Executed') {
    console.log('Transaction has been executed successfully.');

    try {
        // do your custom logic on successful transaction here

        return c.res({
        image: "https://dtech.vision/frame.png",
        imageAspectRatio: '1:1',
        intents: [
          <Button.Link href={`https://decent.xyz`}> Success, Go to Decent.xyz</Button.Link>,
        ],
      })

    } catch (err) {
      console.error('Error in our custom logic:', err);
    }
  } else if (status === 'Failed') {
    console.log('Transaction has failed.');

    // return a new frame where image shows failed
    return c.res({
      image: <div style={{ fontSize: 12 }}>Transaction failed, try again!</div>,
      imageAspectRatio: '1:1',
      intents: [
        // action is the post_url override apparently according to Frames.Transaction documentation https://frog.fm/intents/button-transaction#action-optional
        <Button.Transaction target="/tx" action="/tx-success">Mint Now</Button.Transaction>,
      ],
    })
  }

  return c.res({
    image: "https://dtech.vision/frame.png", // replace with your nice waiting screen image
    imageAspectRatio: '1:1',
    intents: [
      <Button action='/end'>Processing... Check Status</Button>,
    ],
  })
})

devtools(app, { serveStatic })

export const GET = handle(app)
export const POST = handle(app)
