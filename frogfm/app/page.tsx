import { getFrameMetadata } from 'frog/next'
import type { Metadata } from 'next'
import Image from 'next/image'

import styles from './page.module.css'

export async function generateMetadata(): Promise<Metadata> {
  const frameTags = await getFrameMetadata(
    `${process.env.FRAME_URL || 'http://localhost:3000/'}/api`,
  )
  return {
    other: frameTags,
  }
}

export default function Home() {
  return (
    <>
      <h1>go to decent.xyz</h1>
      <script>
        window.location.href = 'https://decent.xyz';
      </script>
    </>
  )
}
