'use client'

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

import { useEffect, useState } from 'react';


export default function Home() {

  const [ffmpeg, setFFmpeg] = useState<FFmpeg | null>(null)

  const [video, setVideo] = useState<File | null | undefined>(null)

  const [gif, setGif] = useState<string | null>(null)

  const load = async () => {
    const ffmpegInstance = new FFmpeg()
    await ffmpegInstance.load()
    setFFmpeg(ffmpegInstance)
  }

  useEffect(() => {
    load()
  }, [])

  const convertToGif = async () => {
    if (!ffmpeg || !video) return
    await ffmpeg.writeFile('input.mp4', await fetchFile(video))
    await ffmpeg.exec(['-i', 'input.mp4', '-t', '2.5', '-ss', '2', '-f', 'gif', 'output.gif'])
    const data = await ffmpeg.readFile('output.gif')
    const url = URL.createObjectURL(new Blob([data], { type: 'image/gif' }))
    setGif(url)
  }

  return (
    <div className="bg-slate-100 text-slate-900 grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        {ffmpeg ? (
          <>
            {video && <video controls src={URL.createObjectURL(video)} />}
            <input type="file" className='border border-solid border-indigo-500 p-4 m-4' onChange={(e) => setVideo(e.target.files?.item(0))} />
            <button onClick={convertToGif}>Convert to Gif</button>
            {gif && <img src={gif} alt="gif" />}
          </>
        ) : 'Loading....'}
      </main>
    </div>
  );
}
