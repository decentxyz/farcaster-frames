import { createPublicClient, http } from 'viem'
import { base, polygon } from 'viem/chains'
import { parseAbi } from 'viem';
import { BoxActionRequest, bigintDeserializer, bigintSerializer } from '@decent.xyz/box-common';

/****************************
 * 
 *  Constants
 * 
 ****************************/

const zeroAddress = '0x0000000000000000000000000000000000000000';
const debug = true; // enable (true) or disable (false) debug logging

/****************************
 * 
 *  Decent Helper Functions
 * 
 ****************************/

export const decentRequestOptions = {
    method: 'GET',
    headers: { 'x-api-key': process.env.DECENT_API_KEY!! },
};

export async function getUserBalance(chainId: number, account: string) {
    return await fetch(
        `https://box-v2.api.decent.xyz/api/getTokens?address=${account}&chainId=${chainId}`,
        decentRequestOptions,
    ).then((res) => res.json());
}

export async function getTokenWithMaxBalance(chainId: number, tokens: [token], useNative?: boolean, usdAmount: number | undefined = undefined) {
    let maxBalance = 0; // tracker of current max token balance in USD
    let sourceToken = zeroAddress; // sourceToken to be used for payment
    let native = false; // whether or not native balance is enough

    await Promise.all(tokens.map(async (token: token) => {
        if (['USDC', 'ETH', 'DEGEN'].includes(token.symbol)) {
            const tokenQuery = new URLSearchParams({
                chainId: chainId.toString(),
                tokenAddress: token.address,
            });
            const response = await fetch(`https://api.decentscan.xyz/getTokenPrice?${tokenQuery}`, decentRequestOptions);
            const data = await response.json();
            if (debug) { console.log(token.name, 'data = ', data); }
            const balance = token.balanceFloat * data.usdPrice;
            if (debug) { console.log('balance = ', token.balanceFloat, '*', data.usdPrice, 'which js says is:', balance) };

            if (useNative && usdAmount) {
                if (token.symbol === 'ETH' && balance > usdAmount) { native = true; if (debug) console.log('Using native gas token.') }
            }

            if (balance > maxBalance) {
                console.log(maxBalance, 'is less than', balance, 'so setting sourceToken to', token.address)
                sourceToken = token.address;
                maxBalance = balance;
            }
        }
    }));
    if (useNative && native) {
        sourceToken = zeroAddress;
    }
    if (debug) { console.log('Source Token:', sourceToken); }
    return sourceToken;
}

export async function getTransactionData(txConfig: BoxActionRequest) {
    const url = new URL('https://box-v2.api.decent.xyz/api/getBoxAction');
    url.searchParams.set('arguments', JSON.stringify(txConfig, bigintSerializer));

    const response = await fetch(url.toString(), decentRequestOptions);
    if (debug) { console.log('decent response', response) };
    const textResponse = await response.text();
    const { tx, tokenPayment } = await JSON.parse(textResponse, bigintDeserializer);

    if (debug) { console.log({ tx, tokenPayment }); }
    return { tx, tokenPayment };
}

export async function getTransactionStatus(chainId: number, txHash: string) {
    const queryParams = new URLSearchParams({
        chainId: (chainId).toString(),
        txHash: txHash,
    });

    try {
        const response = await fetch(`https://api.decentscan.xyz/getStatus?${queryParams}`, decentRequestOptions);
        const data = await response.json();

        if (debug) { console.log('Transaction status:', data.status, ' Destionation chain TX hash: ', data.transaction.dstTx.fast.transactionHash) };

        return { status: data.status, transactionHash: data.transaction?.dstTx?.fast?.transactionHash };
    } catch (error) {
        console.error('Error fetching transaction status:', error);
        return { status: null, transactionHash: null };
    }
}

/****************************
 * 
 *  Types
 * 
 ****************************/

export type token = {
    name: string,
    symbol: string,
    decimals: number,
    address: string,
    isNative: boolean,
    logo: string,
    chainId: number,
    balanceFloat: number,
    balance: string
}

/****************************
 * 
 *  Viem Clients
 * 
 ****************************/

export const baseClient = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL || undefined)
})

export const polygonClient = createPublicClient({
    chain: polygon,
    transport: http(process.env.POLYGON_RPC_URL || undefined)
})

/****************************
 * 
 *  ABI
 * 
 ****************************/

export const erc20Abi = parseAbi([
    // ERC20 ABI functions
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address, uint256) returns (bool)',
    'function allowance(address, address) view returns (uint256)',
    'function approve(address, uint256) returns (bool)',
    'function transferFrom(address, address, uint256) returns (bool)',
    // ERC20 Events
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)'
])