import { NextRequest, NextResponse } from 'next/server';
import { FrameRequest, getFrameMessage } from '@coinbase/onchainkit';

import { encodeFunctionData } from 'viem';
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
} from '../../decentUtils';

const chain = base;
const zeroAddress = '0x0000000000000000000000000000000000000000';

export async function POST(
  req: NextRequest
): Promise<NextResponse> {
  const body: FrameRequest = await req.json();
  const { isValid, message } = await getFrameMessage(body, { neynarApiKey: process.env.NEYNAR_API_KEY!! });

  if (!isValid) {
    return new NextResponse('Message not valid', { status: 500 });
  }

  const account = message.address!;

  // get the sourceToken. The token the user has the maximum balance in (or the native gas token if that has enough balance)
  const tokens = await getUserBalance(chain.id, account);
  const sourceToken = await getTokenWithMaxBalance(chain.id, tokens);

  // build decent.xyz transaction here and use the address it is sent to as the to address for the approve call

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
        amount: 25000000n,
        tokenAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      },
    }
  }

  const { tx, tokenPayment } = await getTransactionData(txConfig);

  // check for allowance if non native.

  if (sourceToken == zeroAddress) {
    return NextResponse.json({ message: 'You can mint right away. Press Execute!'}, {status: 400});
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
    return NextResponse.json({ message: 'You can mint right away. Press Execute!'}, {status: 400});
  }

  const calldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [
      tx.to,
      tokenPayment.amount
    ]
  });

  // requires approval
  return NextResponse.json({
    method: "eth_sendTransaction",
    chainId: `eip155:${chain.id}`,
    params: {
        abi: erc20Abi,
        to: sourceToken as EvmAddress,
        data: calldata,
    }
  })
};