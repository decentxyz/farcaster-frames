import { frames } from "./../frames";
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
} from './../decentUtils';
import { NextResponse } from "next/server";

const chain = base;
const zeroAddress = '0x0000000000000000000000000000000000000000';
 
export const POST = frames(async (ctx) => {
  if (!ctx.message) {
    throw new Error("No message");
  }
 
  const account = ctx.message.connectedAddress!;
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
});