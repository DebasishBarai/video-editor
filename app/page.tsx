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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-8">
      <main className="max-w-2xl mx-auto flex flex-col gap-8 items-center">
        {ffmpeg ? (
          <div className="w-full space-y-6">
            <h1 className="text-3xl font-bold text-center text-slate-800">
              Video to GIF Converter
            </h1>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              {/* Video Preview */}
              {video && (
                <div className="mb-6">
                  <p className="text-sm font-medium text-slate-600 mb-2">Preview:</p>
                  <video 
                    controls 
                    className="w-full rounded-lg border border-slate-200"
                    src={URL.createObjectURL(video)} 
                  />
                </div>
              )}

              {/* File Input */}
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-600">Select video file:</span>
                  <input 
                    type="file" 
                    accept="video/*"
                    onChange={(e) => setVideo(e.target.files?.item(0))}
                    className="mt-1 block w-full text-sm text-slate-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-indigo-50 file:text-indigo-600
                      hover:file:bg-indigo-100
                      cursor-pointer"
                  />
                </label>

                {/* Convert Button */}
                <button 
                  onClick={convertToGif}
                  disabled={!video}
                  className={`w-full py-2 px-4 rounded-full font-medium
                    ${video 
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                  Convert to GIF
                </button>
              </div>
            </div>

            {/* GIF Output */}
            {gif && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <p className="text-sm font-medium text-slate-600 mb-2">Generated GIF:</p>
                <img src={gif} alt="Generated GIF" className="w-full rounded-lg" />
                <a 
                  href={gif} 
                  download="converted.gif"
                  className="mt-4 inline-block w-full text-center py-2 px-4 rounded-full
                    bg-green-600 text-white font-medium hover:bg-green-700"
                >
                  Download GIF
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-slate-600">Loading FFmpeg...</span>
          </div>
        )}
      </main>
    </div>
  );
}
