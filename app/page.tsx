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
  const [isAddingcaptions, setIsAddingCaptions] = useState<boolean>(false);
  const [audio, setAudio] = useState<string | null>(null)
  const [brollKeywords, setBrollKeywords] = useState<string>('');
  const [selectedMusic, setSelectedMusic] = useState<File | null>(null);
  const [musicVolume, setMusicVolume] = useState<number>(0.5);
  const [currentRun, setCurrentRun] = useState<'gif' | 'audio' | 'silence' | 'subtitles' | 'broll' | 'music'>('gif');
  const [lastRun, setLastRun] = useState<'gif' | 'audio' | 'silence' | 'subtitles' | 'broll' | 'music'>('gif');
  const [progress, setProgress] = useState<number>(0);
  const [vttSubtitles, setVttSubtitles] = useState<string>('');
  // const [totalFrames, setTotalFrames] = useState<number>(0);
  ;

  const videoRef = useRef<HTMLVideoElement>(null)

  // Create a memoized video URL that only changes when the video file changes
  const videoUrl = useMemo(() => {
    if (!video) return null;

    setOutput(null);
    setSubtitles('');
    setVttSubtitles('')
    setAudio(null)

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

  const handleProgress = (progress: { progress: number }) => {
    setProgress(Math.max(0, Math.min(Math.round(progress.progress * 100), 100)));
  };

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
    setProgress(0);
    setCurrentRun('gif');

    try {

      await ffmpeg.writeFile('input.mp4', await fetchFile(video));

      // Set up progress handler
      ffmpeg.on('progress', handleProgress);

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
      ffmpeg.off('progress', handleProgress);
      setProgress(0);
    }
  };

  const extractAudio = async (startTime = 0, duration = 120) => {
    if (!ffmpeg || !video) return null;

    try {
      await ffmpeg.writeFile('input.mp4', await fetchFile(video));
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-ss', startTime.toString(),  // Start time in seconds
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        '-t', duration.toString(),    // Duration in seconds
        'output.wav'
      ]);

      const data = await ffmpeg.readFile('output.wav');
      const url = URL.createObjectURL(new Blob([data], { type: 'audio/wav' }));
      setAudio(url);
      return data;
    } catch (error) {
      console.error('Error extracting audio:', error);
      return null;
    } finally {
    }
  };

  const generateBase64Audio = async (startTime = 0, duration = 120) => {
    if (!ffmpeg || !video) return null;

    try {
      const audioData = await extractAudio(startTime, duration);

      // Convert Uint8Array to Base64
      if (audioData instanceof Uint8Array) {
        let binary = '';
        for (let i = 0; i < audioData.length; i++) {
          binary += String.fromCharCode(audioData[i]);
        }
        return btoa(binary);
      }

      console.log('audioData is not a Uint8Array', audioData);
      return null;
    } catch (error) {
      console.error('Error generating base64 audio:', error);
      return null;
    }
  };

  const generateSubtitles = async () => {
    if (!ffmpeg || !video) return;
    setIsGeneratingSubtitles(true);
    setSubtitles('');
    setVttSubtitles('WEBVTT\n\n'); // Initialize with VTT header
    setProgress(0);
    let vttContent = 'WEBVTT\n\n';
    try {
      // Get video duration
      if (!videoDuration) {
        const videoElement = document.createElement('video');
        videoElement.src = URL.createObjectURL(video);
        await new Promise(resolve => {
          videoElement.onloadedmetadata = resolve;
        });
        setVideoDuration(videoElement.duration);
        URL.revokeObjectURL(videoElement.src);
      }

      // Calculate number of chunks needed
      const chunkDuration = 120; // 2 minutes in seconds
      const totalChunks = Math.ceil(videoDuration / chunkDuration);

      // Create an array of chunk processing promises
      const chunkPromises = Array.from({ length: totalChunks }, async (_, i) => {
        const startTime = i * chunkDuration;
        const duration = Math.min(chunkDuration, videoDuration - startTime);

        try {
          // Extract audio for this chunk
          const base64Audio = await generateBase64Audio(startTime, duration);
          if (!base64Audio) {
            console.error(`Failed to extract audio for chunk ${i + 1}/${totalChunks}`);
            return null;
          }

          // Send to API
          console.log(`Processing chunk ${i + 1}/${totalChunks} (${startTime}s to ${startTime + duration}s)`);
          const response = await fetch(
            `/api/generate-srt`,
            {
              method: 'POST',
              body: JSON.stringify({ audio: base64Audio }),
            }
          );

          if (!response.ok) {
            throw new Error(`HTTP error: ${response.statusText}`);
          }

          const data = await response.json();

          // Return chunk processing result
          return {
            index: i,
            startTime,
            duration,
            data
          };
        } catch (error) {
          console.error(`Error processing chunk ${i + 1}/${totalChunks}:`, error);
          return null;
        }
      });

      // Process all chunks concurrently
      const processedChunks = await Promise.all(chunkPromises);

      // Create a Set to track unique transcription texts
      const uniqueTranscriptions = new Set();

      // Sort chunks by their original index to maintain order
      const validChunks = processedChunks
        .filter(chunk => chunk !== null && chunk.data?.success && chunk.data?.result)
        .sort((a, b) => {
          // Safely handle potential undefined indices
          const indexA = a?.index ?? -1;
          const indexB = b?.index ?? -1;
          return indexA - indexB;
        });

      // Combine transcriptions and VTT
      let allTranscriptions = '';
      let combinedVttContent = 'WEBVTT\n\n';

      validChunks.forEach(chunk => {
        // Safely check and add unique text
        if (chunk?.data?.result?.text) {
          const chunkText = chunk.data.result.text.trim();

          // Only add if not already present
          if (!uniqueTranscriptions.has(chunkText)) {
            uniqueTranscriptions.add(chunkText);
            allTranscriptions += (allTranscriptions ? ' ' : '') + chunkText;
          }
        }

        // Safely combine and adjust VTT timestamps
        if (chunk?.data?.result?.vtt) {
          const adjustedVtt = adjustVttTimestamps(chunk.data.result.vtt, chunk?.startTime ?? 0);
          combinedVttContent += adjustedVtt;
        }

        // Safely update progress
        setProgress(Math.round(((chunk?.index ?? 0 + 1) / validChunks.length) * 100));
      });

      // Final updates
      setSubtitles(allTranscriptions);
      setVttSubtitles(combinedVttContent);
      vttContent = combinedVttContent;

    } catch (error) {
      console.error('Error generating subtitles:', error);
      // Optionally add error handling UI here
    } finally {
      setIsGeneratingSubtitles(false);  // End loading
      setProgress(0);  // Ensure progress shows complete
      return vttContent;
    }
  };

  const enhanceAudio = async () => {

    if (!ffmpeg || !video) return;

    setIsConverting(true);
    setOutput(null);
    setProgress(0);
    setCurrentRun('audio');

    try {
      await ffmpeg.writeFile('input.mp4', await fetchFile(video));

      // Set up progress handler
      ffmpeg.on('progress', handleProgress);

      // Enhanced audio processing with better parameters
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-af',
        'highpass=f=200,lowpass=f=3000,' +
        'afftdn=nf=-20,' +
        'compand=.3|.3:1|1:-90/-60|-60/-40|-40/-30|-20/-20:6:0:-90:0.2,' +
        'volume=2,' +
        'equalizer=f=1000:width_type=o:width=2:g=3,' +
        'loudnorm=I=-16:LRA=11:TP=-1.5',
        '-c:v', 'copy',
        'output.mp4'
      ]);

      const data = await ffmpeg.readFile('output.mp4');
      const url = URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
      setOutput(url);
      setLastRun('audio');
    } catch (error) {
      console.error('Error enhancing audio:', error);
    } finally {
      setIsConverting(false);
      ffmpeg.off('progress', handleProgress); // Clean up event listener
      setProgress(0);
    }
  };

  const removeSilence = async () => {

    if (!ffmpeg || !video) return;

    setIsConverting(true);
    setOutput(null);
    setProgress(0);
    setCurrentRun('silence');

    try {
      await ffmpeg.writeFile('input.mp4', await fetchFile(video));

      // Set up progress handler
      ffmpeg.on('progress', handleProgress);

      const silenceRemoveFilter = `silenceremove=start_periods=1:start_duration=${minimumSilence}:start_threshold=${silenceThreshold}dB:stop_periods=1:stop_duration=${minimumSilence}:stop_threshold=${silenceThreshold}dB`;

      // Enhanced audio processing with better parameters
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-af',
        silenceRemoveFilter,
        'output.mp4'
      ]);

      const data = await ffmpeg.readFile('output.mp4');
      const url = URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
      setOutput(url);
      setLastRun('silence');
    } catch (error) {
      console.error('Error enhancing audio:', error);
    } finally {
      setIsConverting(false);
      ffmpeg.off('progress', handleProgress); // Clean up event listener
      setProgress(0);
    }
  }

  const addCaptions = async () => {

    if (!ffmpeg || !video) return;

    setIsConverting(true);
    setOutput(null);
    setProgress(0);
    setCurrentRun('subtitles');

    try {

      await ffmpeg.writeFile('input.mp4', await fetchFile(video));

      if (vttSubtitles === '') {
        const generatedSubtitles = await generateSubtitles()
        await burnSubtitlesToVideo(generatedSubtitles)
      }

      await burnSubtitlesToVideo(vttSubtitles)

    } catch (error) {
      console.error('Error enhancing audio:', error);
    } finally {
      setIsConverting(false);
      setProgress(0);
    }
  }

  // Helper function to adjust VTT timestamps
  const adjustVttTimestamps = (vttData: string, offsetSeconds: number): string => {
    if (!vttData) return '';

    // Skip the WEBVTT header line and empty line after it
    const lines = vttData.split('\n');
    let inHeader = true;
    let result = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip the WEBVTT header and the blank line after it
      if (inHeader) {
        if (line === 'WEBVTT' || line === '') {
          continue;
        } else {
          inHeader = false;
        }
      }

      // Check if this line contains timestamps
      if (line.includes('-->')) {
        // Extract timestamps
        const timestamps = line.split('-->').map(t => t.trim());
        if (timestamps.length === 2) {
          // Parse and adjust timestamps
          const startTime = parseVttTimestamp(timestamps[0]) + offsetSeconds;
          const endTime = parseVttTimestamp(timestamps[1]) + offsetSeconds;

          // Format adjusted timestamps
          result += `${formatVttTimestamp(startTime)} --> ${formatVttTimestamp(endTime)}\n`;
        } else {
          // If we can't parse it, keep the original line
          result += line + '\n';
        }
      } else {
        // For non-timestamp lines, keep them as is
        result += line + '\n';
      }
    }

    return result;
  };

  // Helper function to parse VTT timestamp to seconds
  const parseVttTimestamp = (timestamp: string): number => {
    // Handle both HH:MM:SS.mmm and MM:SS.mmm formats
    const parts = timestamp.split(':');
    let hours = 0, minutes = 0, seconds = 0;

    if (parts.length === 3) {
      // HH:MM:SS.mmm format
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
      seconds = parseFloat(parts[2]);
    } else if (parts.length === 2) {
      // MM:SS.mmm format
      minutes = parseInt(parts[0], 10);
      seconds = parseFloat(parts[1]);
    }

    return hours * 3600 + minutes * 60 + seconds;
  };

  // Helper function to format seconds to VTT timestamp
  const formatVttTimestamp = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // Format with leading zeros and 3 decimal places for milliseconds
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toFixed(3).padStart(6, '0');

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  };

  // Update the burnSubtitlesToVideo function to include a progress bar
  const burnSubtitlesToVideo = async (vttSubtitles: string | undefined | null) => {
    if (!ffmpeg || !video || !vttSubtitles) return;

    setIsAddingCaptions(true);
    setOutput(null);
    setProgress(0);

    try {
      // Write the input video file
      await ffmpeg.writeFile('input.mp4', await fetchFile(video));

      // Write the ASS subtitle file
      const assContent = convertVttToAss(vttSubtitles);
      console.log({ assContent });
      await ffmpeg.writeFile('subtitles.ass', assContent);
      // await ffmpeg.writeFile('subtitles.ass', convertVttToAss(vttSubtitles));

      // Set up progress handler
      ffmpeg.on('progress', handleProgress);

      // Burn subtitles into the video
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-vf', 'ass=filename=subtitles.ass',
        '-c:a', 'copy',
        'output.mp4'
      ]);

      const data = await ffmpeg.readFile('output.mp4');
      const url = URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
      setOutput(url);
      setLastRun('subtitles');
    } catch (error) {
      console.error('Error adding subtitles to video:', error);
    } finally {
      ffmpeg.off('progress', handleProgress);
      setIsAddingCaptions(false);
      setProgress(0);
    }
  };

  // Helper function to convert VTT to ASS format for download
  const convertVttToAss = (vttContent: string): string => {
    // Basic ASS header with modern, bold, flashy styling
    let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
Timer: 100.0000

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
; Modern bold style with flashy colors - BIGGER FONT
Style: Default,Arial Black,54,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,20,20,30,1
; Alternative style with gradient effect - BIGGER FONT
Style: Gradient,Arial Black,60,&H0000FFFF,&H00FF00FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,20,20,30,1
; Colorful style with larger font - EVEN BIGGER
Style: Colorful,Impact,72,&H000000FF,&H0000FFFF,&H00000000,&H80000000,-1,0,0,0,120,120,0,0,1,4,3,2,20,20,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // Parse VTT content
    const lines = vttContent.split('\n');
    let currentStartTime = '';
    let currentEndTime = '';
    let currentText = '';
    let inCue = false;
    let cueCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip WEBVTT header
      if (line === 'WEBVTT' || line === '') {
        continue;
      }

      // Check for timestamp line
      if (line.includes('-->')) {
        // If we were already in a cue, save the previous one before starting a new one
        if (inCue && currentText) {
          // Rotate between the three styles for visual variety
          const style = cueCount % 3 === 0 ? 'Default' :
            cueCount % 3 === 1 ? 'Gradient' : 'Colorful';

          // Add some basic text effects for emphasis
          let formattedText = currentText;

          // For longer text, add some formatting
          if (currentText.length > 20) {
            // Add some basic formatting - bold for important words
            formattedText = formattedText.replace(/\b(important|key|main|critical|essential)\b/gi, '{\\b1}$1{\\b0}');
          }

          assContent += `Dialogue: 0,${currentStartTime},${currentEndTime},${style},,0,0,0,,${formattedText}\n`;
          cueCount++;
        }

        // Start a new cue
        inCue = true;
        const parts = line.split('-->').map(part => part.trim());
        currentStartTime = convertVttTimeToAssTime(parts[0]);
        currentEndTime = convertVttTimeToAssTime(parts[1]);
        currentText = '';
      }
      // If we're in a cue and this is not a timestamp line, it's the text
      else if (inCue) {
        if (line !== '') {
          // If we already have text, add a line break before adding more
          if (currentText) {
            currentText += '\\N';
          }
          currentText += line;
        }
      }
    }

    // Add the last cue if there is one
    if (inCue && currentText) {
      const style = cueCount % 3 === 0 ? 'Default' :
        cueCount % 3 === 1 ? 'Gradient' : 'Colorful';

      // Add some basic text effects for emphasis
      let formattedText = currentText;

      // For longer text, add some formatting
      if (currentText.length > 20) {
        // Add some basic formatting - bold for important words
        formattedText = formattedText.replace(/\b(important|key|main|critical|essential)\b/gi, '{\\b1}$1{\\b0}');
      }

      assContent += `Dialogue: 0,${currentStartTime},${currentEndTime},${style},,0,0,0,,${formattedText}\n`;
    }

    return assContent;
  };

  // Helper function to convert VTT time format to ASS time format
  const convertVttTimeToAssTime = (vttTime: string): string => {
    // VTT format: 00:00:00.000
    // ASS format: 0:00:00.00
    const parts = vttTime.split(':');
    let hours, minutes, seconds;

    if (parts.length === 3) {
      hours = parseInt(parts[0], 10);
      minutes = parts[1];
      seconds = parts[2];
    } else if (parts.length === 2) {
      hours = 0;
      minutes = parts[0];
      seconds = parts[1];
    } else {
      return '0:00:00.00'; // Default if format is unexpected
    }

    // Format seconds to have only 2 decimal places (ASS format)
    const secondsParts = seconds.split('.');
    let formattedSeconds;
    if (secondsParts.length === 2) {
      formattedSeconds = `${secondsParts[0]}.${secondsParts[1].substring(0, 2).padEnd(2, '0')}`;
    } else {
      formattedSeconds = `${secondsParts[0]}.00`;
    }

    return `${hours}:${minutes}:${formattedSeconds}`;
  };

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
                            disabled={isConverting}
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
                            disabled={isConverting}
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

                        {isConverting && currentRun === 'gif' && (
                          <div className="space-y-4">
                            <div className="flex flex-col items-center justify-center py-4 space-y-4">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                              <p className="text-slate-600">Creating GIF... {progress}%</p>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-200 rounded-full h-2.5 dark:bg-slate-100">
                              <div
                                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {activeTab === 'audio' && (
                      <div className="space-y-6">
                        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                          Enhance audio quality and reduce background noise
                        </div>

                        {isConverting && currentRun === 'audio' && (
                          <div className="space-y-4">
                            <div className="flex flex-col items-center justify-center py-4 space-y-4">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                              <p className="text-slate-600">Enhancing audio... {progress}%</p>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-200 rounded-full h-2.5 dark:bg-slate-100">
                              <div
                                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
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
                            disabled={isConverting}
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
                            disabled={isConverting}
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

                        {isConverting && currentRun === 'silence' && (
                          <div className="space-y-4">
                            <div className="flex flex-col items-center justify-center py-4 space-y-4">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                              <p className="text-slate-600">Removing silence... {progress}%</p>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-200 rounded-full h-2.5 dark:bg-slate-100">
                              <div
                                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'subtitles' && (
                      <div className="space-y-6">
                        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                          Add captions to the video
                        </div>

                        {isConverting && currentRun === 'subtitles' && (
                          <div className="space-y-4">
                            <div className="flex flex-col items-center justify-center py-4 space-y-4">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                              {isGeneratingSubtitles && (<p className="text-slate-600">Generating Subtitles... {progress}%</p>)}
                              {isAddingcaptions && (<p className="text-slate-600">Adding Subtitles To Video... {progress}%</p>)}
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-200 rounded-full h-2.5 dark:bg-slate-100">
                              <div
                                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}

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
                                text-sm font-mono text-gray-900"
                              placeholder="Subtitles will appear here..."
                            />

                            <div className="flex flex-wrap gap-2 mt-4">
                              <button
                                onClick={() => {
                                  const blob = new Blob([vttSubtitles], { type: 'text/vtt' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = 'subtitles.vtt';
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                                className="px-4 py-2 rounded-lg font-medium bg-indigo-600 
                                  text-white hover:bg-indigo-700"
                              >
                                Download VTT
                              </button>

                              <button
                                onClick={() => {
                                  const assContent = convertVttToAss(vttSubtitles);
                                  const blob = new Blob([assContent], { type: 'text/plain' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = 'subtitles.ass';
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                                className="px-4 py-2 rounded-lg font-medium bg-purple-600 
                                  text-white hover:bg-purple-700"
                              >
                                Download ASS
                              </button>

                              <button
                                onClick={() => {
                                  const blob = new Blob([subtitles], { type: 'text/plain' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = 'transcript.txt';
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                                className="px-4 py-2 rounded-lg font-medium bg-green-600 
                                  text-white hover:bg-green-700"
                              >
                                Download Text
                              </button>
                            </div>
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
                    onClick={activeTab === 'gif' ? convertToGif :
                      activeTab === 'audio' ? enhanceAudio :
                        activeTab === 'silence' ? removeSilence :
                          activeTab === 'subtitles' ? addCaptions :
                            activeTab === 'broll' ? addCaptions :
                              addCaptions}
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
                              ? 'Add Captions'
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
                      className={`px-4 py-2 rounded-lg font-medium transition-colors text-center cursor-pointer
                        ${activeTab === 'gif'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      Create GIF
                    </button>
                    <button
                      onClick={() => setActiveTab('audio')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors text-center cursor-pointer
                        ${activeTab === 'audio'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      Enhance Audio
                    </button>
                    <button
                      onClick={() => setActiveTab('silence')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors text-center cursor-pointer
                        ${activeTab === 'silence'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      Remove Silence
                    </button>
                    <button
                      onClick={() => setActiveTab('subtitles')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors text-center cursor-pointer
                        ${activeTab === 'subtitles'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      Add Captions
                    </button>
                    <button
                      onClick={() => setActiveTab('broll')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors text-center cursor-pointer
                        ${activeTab === 'broll'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      Generate B-Roll
                    </button>
                    <button
                      onClick={() => setActiveTab('music')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors text-center cursor-pointer
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
                  {isConverting ? 'Converting video...'
                    : 'Generated output:'}
                </p>

                {isConverting ? (
                  <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <p className="text-slate-600">Processing...</p>
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
                  </> : lastRun === 'audio' || lastRun === 'silence' || lastRun === 'subtitles' ?
                    <>
                      <div className="mb-6">
                        <p className="text-sm font-medium text-slate-600 mb-2">Preview:</p>
                        <video
                          controls
                          className="w-full rounded-lg border border-slate-200"
                          src={output!}
                        />
                      </div>
                      <a
                        href={output}
                        download="converted.mp4"
                        className="mt-4 inline-block w-full text-center py-2 px-4 rounded-full
                        bg-green-600 text-white font-medium hover:bg-green-700 cursor-pointer"
                      >
                        Download
                      </a>
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
