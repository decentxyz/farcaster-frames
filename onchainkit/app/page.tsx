import { getFrameMetadata } from '@coinbase/onchainkit/frame';
import type { Metadata } from 'next';
import { NEXT_PUBLIC_URL } from './config';

const frameMetadata = getFrameMetadata({
  buttons: [
    {
      action: 'tx',
      label: 'Execute',
      target: `${NEXT_PUBLIC_URL}api/tx`,
      postUrl: `${NEXT_PUBLIC_URL}api/tx-success`,
    },
    {
      action: 'tx',
      label: 'Approve',
      target: `${NEXT_PUBLIC_URL}api/approve`,
      postUrl: `${NEXT_PUBLIC_URL}`,
    },
  ],
  image: {
    src: `${NEXT_PUBLIC_URL}park-3.png`,
    aspectRatio: '1:1',
  },
});

export const metadata: Metadata = {
  title: 'decent.xyz',
  description: 'Build without being tied to chains',
  openGraph: {
    title: 'decent.xyz',
    description: 'Build without being tied to chains',
    images: [`${NEXT_PUBLIC_URL}/park-1.png`],
  },
  other: {
    ...frameMetadata,
  },
};

export default function Page() {
  return (
    <>
      <h1>go to decent.xyz</h1>
      <script>
        window.location.href = 'https://decent.xyz';
      </script>
    </>
  );
}
