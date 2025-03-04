'use client'

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import Image from 'next/image';
import { useEffect, useState, useRef, useMemo } from 'react';
import { Video } from 'lucide-react';

// Add this style function at the component level to calculate the slider percentage
const getSliderBackground = (value: number, min: number, max: number) => {
  const percentage = ((value - min) / (max - min)) * 100;
  return `linear-gradient(to right, rgb(79, 70, 229) ${percentage}%, rgb(226, 232, 240) ${percentage}%)`;
};

// Add this after the getSliderBackground function
const formatTime = (seconds: number) => {
  if (seconds < 1) return `${seconds.toFixed(1)} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds.toFixed(1)} sec`;
  }

  return `${minutes} min ${remainingSeconds.toFixed(1)} sec`;
};

export default function Home() {
  const [ffmpeg, setFFmpeg] = useState<FFmpeg | null>(null)
  const [video, setVideo] = useState<File | null | undefined>(null)
  const [output, setOutput] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState<number>(0)
  const [startTime, setStartTime] = useState<number>(0)
  const [gifDuration, setGifDuration] = useState<number>(2.5)
  const [isConverting, setIsConverting] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'gif' | 'audio' | 'silence' | 'subtitles' | 'broll' | 'music'>('gif');
  const [silenceThreshold, setSilenceThreshold] = useState<number>(-30); // in dB
  const [minimumSilence, setMinimumSilence] = useState<number>(0.5); // in seconds
  const [subtitles, setSubtitles] = useState<string>('');
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState<boolean>(false);
  const [isExtractingAudio, setIsExtractingAudio] = useState<boolean>(false);
  const [audio, setAudio] = useState<string | null>(null)
  const [brollKeywords, setBrollKeywords] = useState<string>('');
  const [selectedMusic, setSelectedMusic] = useState<File | null>(null);
  const [musicVolume, setMusicVolume] = useState<number>(0.5);
  const [lastRun, setLastRun] = useState<'gif' | 'audio' | 'silence' | 'subtitles' | 'broll' | 'music'>('gif');
  ;

  const videoRef = useRef<HTMLVideoElement>(null)

  // Create a memoized video URL that only changes when the video file changes
  const videoUrl = useMemo(() => {
    if (!video) return null;
    return URL.createObjectURL(video);
  }, [video]);

  // Cleanup the video URL when component unmounts or video changes
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const load = async () => {
    const ffmpegInstance = new FFmpeg()
    await ffmpegInstance.load()
    setFFmpeg(ffmpegInstance)
  }

  useEffect(() => {
    load()
  }, [])

  const handleVideoLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.item(0)
    if (file) {
      setVideo(file)
      // Reset the video duration when a new video is loaded
      const videoElement = document.createElement('video')
      videoElement.src = URL.createObjectURL(file)
      videoElement.onloadedmetadata = () => {
        setVideoDuration(videoElement.duration)
        setStartTime(0) // Reset start time
        setGifDuration(Math.min(4, videoElement.duration)) // Reset duration
        URL.revokeObjectURL(videoElement.src) // Clean up the temporary URL
      }
    }
  }

  const convertToGif = async () => {
    if (!ffmpeg || !video) return;
    setIsConverting(true);  // Start loading
    setOutput(null);  // Clear previous GIF

    try {
      await ffmpeg.writeFile('input.mp4', await fetchFile(video));
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-t', gifDuration.toString(),
        '-ss', startTime.toString(),
        '-f', 'gif',
        'output.gif'
      ]);

      const data = await ffmpeg.readFile('output.gif');
      const url = URL.createObjectURL(new Blob([data], { type: 'image/gif' }));
      setOutput(url);
      setLastRun('gif');
    } catch (error) {
      console.error('Error converting video to GIF:', error);
      // Optionally add error handling UI here
    } finally {
      setIsConverting(false);  // End loading
    }
  };

  const extractAudio = async () => {
    if (!ffmpeg || !video) return;
    setIsExtractingAudio(true);  // Start loading
    setAudio(null);  // Clear previous audio

    try {
      await ffmpeg.writeFile('input.mp4', await fetchFile(video));
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        'output.wav'
      ]);

      const data = await ffmpeg.readFile('output.wav');
      const url = URL.createObjectURL(new Blob([data], { type: 'audio/wav' }));
      setAudio(url);
    } catch (error) {
      console.error('Error extracting audio:', error);
      // Optionally add error handling UI here
    } finally {
      setIsExtractingAudio(false);  // End loading
    }
  };

  const enhanceAudio = async () => {
    if (!ffmpeg || !video) return;
    setIsConverting(true);  // Use the correct loading state
    setOutput(null);  // Clear previous output

    try {
      await ffmpeg.writeFile('input.mp4', await fetchFile(video));
      // Enhanced audio processing with better parameters
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-af',
        'highpass=f=200,lowpass=f=3000,' + // Filter out unwanted frequencies
        'afftdn=nf=-20,' +                 // Noise reduction
        'compand=.3|.3:1|1:-90/-60|-60/-40|-40/-30|-20/-20:6:0:-90:0.2,' + // Dynamic range compression
        'volume=2,' +                       // Increase volume
        'equalizer=f=1000:width_type=o:width=2:g=3,' + // Boost speech frequencies
        'loudnorm=I=-16:LRA=11:TP=-1.5',   // Normalize loudness
        '-c:v', 'copy',                     // Copy video stream without re-encoding
        'output.mp4'
      ]);

      const data = await ffmpeg.readFile('output.mp4');
      const url = URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
      setOutput(url);
      setLastRun('audio');
    } catch (error) {
      console.error('Error enhancing audio:', error);
    } finally {
      setIsConverting(false);  // End loading state
    }
  };

  const removeSilence = async () => {
    if (!ffmpeg || !video) return;
  }

  const generateCaptions = async () => {
    if (!ffmpeg || !video) return;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-8">
      <main className="max-w-2xl mx-auto flex flex-col gap-8 items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <Video className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-center text-slate-800">
              Video Wizard
            </h1>
          </div>
          <p className="text-slate-600 text-center max-w-lg">
            Transform your videos with AI-powered tools. Convert to GIF, enhance audio, generate subtitles, and more.
          </p>
        </div>

        {ffmpeg ? (
          <div className="w-full space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              {/* Video Preview */}
              {video && videoUrl && (
                <div className="mb-6">
                  <p className="text-sm font-medium text-slate-600 mb-2">Preview:</p>
                  <video
                    ref={videoRef}
                    controls
                    className="w-full rounded-lg border border-slate-200"
                    src={videoUrl}
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
                    onChange={handleVideoLoad}
                    className="mt-1 block w-full text-sm text-slate-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-indigo-50 file:text-indigo-600
                      hover:file:bg-indigo-100
                      cursor-pointer"
                  />
                </label>

                {video && (
                  <div className="grid grid-cols-1 gap-6">
                    {activeTab === 'gif' && (
                      <>
                        {/* Start Time Slider */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-slate-600">
                              Start Time
                            </label>
                            <span className="text-sm text-slate-500">
                              {formatTime(startTime)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max={Math.max(0, videoDuration - 4)}
                            step="0.1"
                            value={startTime}
                            onChange={(e) => {
                              const newStartTime = Number(e.target.value);
                              setStartTime(newStartTime);
                              if (newStartTime + gifDuration > videoDuration) {
                                setGifDuration(videoDuration - newStartTime);
                              }
                            }}
                            style={{
                              background: getSliderBackground(startTime, 0, Math.max(0, videoDuration - 4))
                            }}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer
                              [&::-webkit-slider-thumb]:appearance-none
                              [&::-webkit-slider-thumb]:h-4
                              [&::-webkit-slider-thumb]:w-4
                              [&::-webkit-slider-thumb]:rounded-full
                              [&::-webkit-slider-thumb]:bg-white
                              [&::-webkit-slider-thumb]:border-2
                              [&::-webkit-slider-thumb]:border-indigo-600
                              [&::-webkit-slider-thumb]:cursor-pointer
                              [&::-webkit-slider-thumb]:shadow-md
                              [&::-moz-range-thumb]:appearance-none
                              [&::-moz-range-thumb]:h-4
                              [&::-moz-range-thumb]:w-4
                              [&::-moz-range-thumb]:rounded-full
                              [&::-moz-range-thumb]:bg-white
                              [&::-moz-range-thumb]:border-2
                              [&::-moz-range-thumb]:border-indigo-600
                              [&::-moz-range-thumb]:cursor-pointer
                              [&::-moz-range-thumb]:shadow-md"
                          />
                          <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>{formatTime(0)}</span>
                            <span>{formatTime(Math.max(0, videoDuration - 4))}</span>
                          </div>
                        </div>

                        {/* Duration Slider */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-slate-600">
                              Duration
                            </label>
                            <span className="text-sm text-slate-500">
                              {gifDuration < 1 ? `${gifDuration.toFixed(1)}s` : `${gifDuration.toFixed(1)}s`}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.1"
                            max={Math.min(4, videoDuration - startTime)}
                            step="0.1"
                            value={gifDuration}
                            onChange={(e) => setGifDuration(Number(e.target.value))}
                            style={{
                              background: getSliderBackground(gifDuration, 0.1, Math.min(4, videoDuration - startTime))
                            }}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer
                              [&::-webkit-slider-thumb]:appearance-none
                              [&::-webkit-slider-thumb]:h-4
                              [&::-webkit-slider-thumb]:w-4
                              [&::-webkit-slider-thumb]:rounded-full
                              [&::-webkit-slider-thumb]:bg-white
                              [&::-webkit-slider-thumb]:border-2
                              [&::-webkit-slider-thumb]:border-indigo-600
                              [&::-webkit-slider-thumb]:cursor-pointer
                              [&::-webkit-slider-thumb]:shadow-md
                              [&::-moz-range-thumb]:appearance-none
                              [&::-moz-range-thumb]:h-4
                              [&::-moz-range-thumb]:w-4
                              [&::-moz-range-thumb]:rounded-full
                              [&::-moz-range-thumb]:bg-white
                              [&::-moz-range-thumb]:border-2
                              [&::-moz-range-thumb]:border-indigo-600
                              [&::-moz-range-thumb]:cursor-pointer
                              [&::-moz-range-thumb]:shadow-md"
                          />
                          <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>0.1s</span>
                            <span>{Math.min(4, videoDuration - startTime).toFixed(1)}s</span>
                          </div>
                        </div>

                        {/* Preview Time Indicator */}
                        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                          GIF will be created from {formatTime(startTime)} to {formatTime(startTime + gifDuration)}
                          {videoDuration ? ` (Video length: ${formatTime(videoDuration)})` : ''}
                        </div>
                      </>
                    )}

                    {activeTab === 'audio' && (
                      <div className="space-y-6">
                        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                          Enhance audio quality and reduce background noise
                        </div>

                        {isExtractingAudio && (
                          <div className="flex flex-col items-center justify-center py-8 space-y-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            <p className="text-slate-600">Enhancing audio...</p>
                          </div>
                        )}

                        {audio && !isExtractingAudio && (
                          <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">
                              Enhanced Audio
                            </label>
                            <audio controls className="w-full">
                              <source src={audio} type="audio/wav" />
                              Your browser does not support the audio element.
                            </audio>
                            <a
                              href={audio}
                              download="enhanced-audio.wav"
                              className="mt-4 inline-block w-full text-center py-2 px-4 rounded-full
                                bg-green-600 text-white font-medium hover:bg-green-700"
                            >
                              Download Enhanced Audio
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'silence' && (
                      <div className="space-y-6">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-slate-600">
                              Silence Threshold (dB)
                            </label>
                            <span className="text-sm text-slate-500">
                              {silenceThreshold} dB
                            </span>
                          </div>
                          <input
                            type="range"
                            min="-60"
                            max="-20"
                            step="1"
                            value={silenceThreshold}
                            onChange={(e) => setSilenceThreshold(Number(e.target.value))}
                            style={{
                              background: getSliderBackground(silenceThreshold + 60, 0, 40)
                            }}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer
                              [&::-webkit-slider-thumb]:appearance-none
                              [&::-webkit-slider-thumb]:h-4
                              [&::-webkit-slider-thumb]:w-4
                              [&::-webkit-slider-thumb]:rounded-full
                              [&::-webkit-slider-thumb]:bg-white
                              [&::-webkit-slider-thumb]:border-2
                              [&::-webkit-slider-thumb]:border-indigo-600
                              [&::-webkit-slider-thumb]:cursor-pointer
                              [&::-webkit-slider-thumb]:shadow-md"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-slate-600">
                              Minimum Silence Duration
                            </label>
                            <span className="text-sm text-slate-500">
                              {minimumSilence} sec
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.1"
                            max="2"
                            step="0.1"
                            value={minimumSilence}
                            onChange={(e) => setMinimumSilence(Number(e.target.value))}
                            style={{
                              background: getSliderBackground(minimumSilence, 0.1, 2)
                            }}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer
                              [&::-webkit-slider-thumb]:appearance-none
                              [&::-webkit-slider-thumb]:h-4
                              [&::-webkit-slider-thumb]:w-4
                              [&::-webkit-slider-thumb]:rounded-full
                              [&::-webkit-slider-thumb]:bg-white
                              [&::-webkit-slider-thumb]:border-2
                              [&::-webkit-slider-thumb]:border-indigo-600
                              [&::-webkit-slider-thumb]:cursor-pointer
                              [&::-webkit-slider-thumb]:shadow-md"
                          />
                        </div>

                        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                          Silence detection: {silenceThreshold}dB threshold, minimum {minimumSilence}s duration
                        </div>
                      </div>
                    )}

                    {activeTab === 'subtitles' && (
                      <div className="space-y-6">
                        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                          Generate captions from video audio
                        </div>

                        {subtitles && (
                          <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">
                              Generated captions
                            </label>
                            <textarea
                              value={subtitles}
                              onChange={(e) => setSubtitles(e.target.value)}
                              className="w-full h-64 p-3 rounded-lg border border-slate-200 
                                focus:outline-none focus:ring-2 focus:ring-indigo-500
                                text-sm font-mono"
                              placeholder="Subtitles will appear here..."
                            />
                            <div className="flex justify-end mt-2">
                              <button
                                onClick={() => {
                                  const blob = new Blob([subtitles], { type: 'text/plain' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = 'subtitles.srt';
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                                className="px-4 py-2 rounded-lg font-medium bg-green-600 
                                  text-white hover:bg-green-700"
                              >
                                Download Subtitles
                              </button>
                            </div>
                          </div>
                        )}

                        {isGeneratingSubtitles && (
                          <div className="flex flex-col items-center justify-center py-8 space-y-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            <p className="text-slate-600">Generating subtitles...</p>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'broll' && (
                      <div className="space-y-6">
                        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                          Generate relevant B-roll footage based on keywords
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-600 mb-2">
                            B-Roll Keywords
                          </label>
                          <textarea
                            value={brollKeywords}
                            onChange={(e) => setBrollKeywords(e.target.value)}
                            placeholder="Enter keywords for B-roll footage (e.g., nature, city, technology)"
                            className="w-full h-24 p-3 rounded-lg border border-slate-200 
                              focus:outline-none focus:ring-2 focus:ring-indigo-500
                              text-sm"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-slate-600 mb-2">Suggested Keywords</h3>
                            <div className="flex flex-wrap gap-2">
                              {['nature', 'technology', 'business', 'lifestyle', 'urban'].map((keyword) => (
                                <button
                                  key={keyword}
                                  onClick={() => setBrollKeywords(prev => prev ? `${prev}, ${keyword}` : keyword)}
                                  className="px-3 py-1 text-xs rounded-full bg-white border border-slate-200
                                    hover:border-indigo-500 text-slate-600"
                                >
                                  {keyword}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="bg-slate-50 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-slate-600 mb-2">Style</h3>
                            <div className="flex flex-wrap gap-2">
                              {['Cinematic', 'Documentary', 'Modern', 'Vintage'].map((style) => (
                                <button
                                  key={style}
                                  className="px-3 py-1 text-xs rounded-full bg-white border border-slate-200
                                    hover:border-indigo-500 text-slate-600"
                                >
                                  {style}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'music' && (
                      <div className="space-y-6">
                        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                          Add background music to your video
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-600 mb-2">
                            Upload Music File
                          </label>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={(e) => setSelectedMusic(e.target.files?.[0] || null)}
                            className="w-full text-sm text-slate-500
                              file:mr-4 file:py-2 file:px-4
                              file:rounded-full file:border-0
                              file:text-sm file:font-semibold
                              file:bg-indigo-50 file:text-indigo-600
                              hover:file:bg-indigo-100
                              cursor-pointer"
                          />
                        </div>

                        {selectedMusic && (
                          <>
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-slate-600">
                                  Music Volume
                                </label>
                                <span className="text-sm text-slate-500">
                                  {Math.round(musicVolume * 100)}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={musicVolume}
                                onChange={(e) => setMusicVolume(Number(e.target.value))}
                                style={{
                                  background: getSliderBackground(musicVolume, 0, 1)
                                }}
                                className="w-full h-2 rounded-lg appearance-none cursor-pointer
                                  [&::-webkit-slider-thumb]:appearance-none
                                  [&::-webkit-slider-thumb]:h-4
                                  [&::-webkit-slider-thumb]:w-4
                                  [&::-webkit-slider-thumb]:rounded-full
                                  [&::-webkit-slider-thumb]:bg-white
                                  [&::-webkit-slider-thumb]:border-2
                                  [&::-webkit-slider-thumb]:border-indigo-600
                                  [&::-webkit-slider-thumb]:cursor-pointer
                                  [&::-webkit-slider-thumb]:shadow-md"
                              />
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg">
                              <h3 className="text-sm font-medium text-slate-600 mb-2">Preview</h3>
                              <audio controls className="w-full">
                                <source src={URL.createObjectURL(selectedMusic)} type="audio/*" />
                                Your browser does not support the audio element.
                              </audio>
                            </div>
                          </>
                        )}

                        {!selectedMusic && (
                          <div className="bg-slate-50 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-slate-600 mb-2">Sample Tracks</h3>
                            <div className="space-y-2">
                              {['Upbeat', 'Ambient', 'Cinematic', 'Corporate'].map((genre) => (
                                <button
                                  key={genre}
                                  className="w-full px-4 py-2 text-left text-sm rounded-lg bg-white 
                                    border border-slate-200 hover:border-indigo-500 text-slate-600"
                                >
                                  {genre} Music
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Convert Button */}
                {video && (
                  <button
                    onClick={activeTab === 'gif' ? convertToGif : activeTab === 'audio' ? enhanceAudio : activeTab === 'silence' ? removeSilence : activeTab === 'subtitles' ? generateCaptions : activeTab === 'broll' ? generateCaptions : generateCaptions}
                    disabled={!video || isConverting || isGeneratingSubtitles}
                    className={`w-full py-2 px-4 rounded-full cursor-pointer font-medium
                      ${!video || isConverting || isGeneratingSubtitles
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'}`}
                  >
                    {isConverting || isGeneratingSubtitles
                      ? 'Processing...'
                      : activeTab === 'gif'
                        ? 'Convert to GIF'
                        : activeTab === 'audio'
                          ? 'Enhance Audio'
                          : activeTab === 'silence'
                            ? 'Remove Silence'
                            : activeTab === 'subtitles'
                              ? 'Generate Subtitles'
                              : activeTab === 'broll'
                                ? 'Generate B-Roll'
                                : 'Add Background Music'}
                  </button>
                )}

                {/* Replace the horizontal scrolling tab container with a wrapped grid layout */}
                {video && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
                    <button
                      onClick={() => setActiveTab('gif')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors text-center
                        ${activeTab === 'gif'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      Convert to GIF
                    </button>
                    <button
                      onClick={() => setActiveTab('audio')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors text-center
                        ${activeTab === 'audio'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      Enhance Audio
                    </button>
                    <button
                      onClick={() => setActiveTab('silence')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors text-center
                        ${activeTab === 'silence'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      Remove Silence
                    </button>
                    <button
                      onClick={() => setActiveTab('subtitles')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors text-center
                        ${activeTab === 'subtitles'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      Generate Subtitles
                    </button>
                    <button
                      onClick={() => setActiveTab('broll')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors text-center
                        ${activeTab === 'broll'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      Generate B-Roll
                    </button>
                    <button
                      onClick={() => setActiveTab('music')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors text-center
                        ${activeTab === 'music'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      Add Background Music
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Output */}
            {(output || isConverting) && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <p className="text-sm font-medium text-slate-600 mb-2">
                  {isConverting ? 'Converting video...' : 'Generated output:'}
                </p>

                {isConverting ? (
                  <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <p className="text-slate-600">Processing your GIF...</p>
                  </div>
                ) : (output && (lastRun === 'gif' ?
                  <>
                    <Image
                      src={output!}
                      alt="Generated GIF"
                      width={640}
                      height={480}
                      className="w-full rounded-lg"
                      unoptimized // Since we're using a Blob URL
                    />
                    <a
                      href={output}
                      download="converted.gif"
                      className="mt-4 inline-block w-full text-center py-2 px-4 rounded-full
                        bg-green-600 text-white font-medium hover:bg-green-700 cursor-pointer"
                    >
                      Download
                    </a>
                  </> : lastRun === 'audio' ?
                    <>
                      <div className="mb-6">
                        <p className="text-sm font-medium text-slate-600 mb-2">Preview:</p>
                        <video
                          controls
                          className="w-full rounded-lg border border-slate-200"
                          src={output!}
                        />
                      </div>
                    </> : null
                ))}
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
