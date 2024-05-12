import { FrameRequest, getFrameMessage } from '@coinbase/onchainkit/frame';
import { NextRequest, NextResponse } from 'next/server';
import { base } from 'viem/chains';
import {
  ActionType,
  ChainId,
  BoxActionRequest,
  EvmAddress,
} from '@decent.xyz/box-common';

import {
  baseClient,
  erc20Abi,
  getUserBalance,
  getTokenWithMaxBalance,
  getTransactionData,
} from './../../decentUtils';

async function getResponse(req: NextRequest): Promise<NextResponse | Response> {
  const body: FrameRequest = await req.json();
  const { isValid, message } = await getFrameMessage(body, { neynarApiKey: process.env.NEYNAR_API_KEY!! });

  if (!isValid) {
    return new NextResponse('Message not valid', { status: 500 });
  }

  let account = message.address!;

  let chain = base;
  let zeroAddress = '0x0000000000000000000000000000000000000000'; 

  const tokens = await getUserBalance(chain.id, account);
  const sourceToken = await getTokenWithMaxBalance(chain.id, tokens, true, 25);

  // build decent.xyz transaction here and return it

  const txConfig: BoxActionRequest = {
    sender: account!,
    srcChainId: chain?.id as ChainId,
    dstChainId: ChainId.POLYGON,
    srcToken: sourceToken, // really want to dynamically set based on user's balances
    dstToken: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    slippage: 1,
    actionType: ActionType.EvmFunction,
    actionConfig: {
      contractAddress: "",
      chainId: ChainId.POLYGON,
      signature: "function mintTokens(uint256 requestedQuantity, address recipient)",
      args: [1n, account!],
      cost: {
        isNative: false,
        amount: 25000000n, // 25 USD in USDC which has 6 decimals
        tokenAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
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
      return NextResponse.json({ message: 'Requires approval!'}, {status: 400});
    }
  }

  return NextResponse.json({
    chainId: `eip155:${base.id}`,
    abi: [],
    method: "eth_sendTransaction",
    params: {
      abi: [],
      to: tx.to,
      data: tx.data,
      value: tx.value.toString(),
    },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  return getResponse(req);
}

export const dynamic = 'force-dynamic';
