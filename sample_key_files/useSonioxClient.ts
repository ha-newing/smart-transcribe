import { useEffect, useRef, useState, useCallback } from 'react';
import { SonioxClient } from '@soniox/speech-to-text-web';
import { getSonioxApiKey } from '@/utils/getSonioxApiKey';

interface Token {
  text: string;
  start_ms?: number;
  is_final?: boolean;
  speaker?: string;
  language?: string;
}

export interface SpeakerSegment {
  speaker: number;
  text: string;
  startMs: number;
  endMs: number;
  tokens: Token[];
}

export type RecorderState =
  | 'Init'
  | 'Starting'
  | 'Recording'
  | 'Paused'
  | 'Stopping'
  | 'Stopped'
  | 'Error';

interface UseSonioxClientOptions {
  sessionId: string; // REQUIRED: sessionId needed for secure API key fetch
  enableSpeakerDiarization?: boolean;
  languageHints?: string[];
  onSegmentsUpdate?: (segments: SpeakerSegment[]) => void;
  onError?: (error: Error) => void;
}

export function useSonioxClient({
  sessionId,
  enableSpeakerDiarization = true,
  languageHints = ['en', 'vi'],
  onSegmentsUpdate,
  onError,
}: UseSonioxClientOptions) {
  const [state, setState] = useState<RecorderState>('Init');
  const [segments, setSegments] = useState<SpeakerSegment[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const clientRef = useRef<SonioxClient | null>(null);
  const allTokensRef = useRef<Token[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Initialize Soniox client - match competency project exactly
  useEffect(() => {
    if (!clientRef.current) {
      console.log('Initializing Soniox client...');
      clientRef.current = new SonioxClient({
        apiKey: () => getSonioxApiKey(sessionId),
      });
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.cancel();
        clientRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [sessionId]);

  // Process tokens into speaker segments
  const processTokensIntoSegments = useCallback((tokens: Token[]): SpeakerSegment[] => {
    const newSegments: SpeakerSegment[] = [];
    let currentSegment: SpeakerSegment | null = null;

    tokens.forEach((token) => {
      // Extract speaker from token (Soniox adds speaker field when diarization is enabled)
      const speaker = token.speaker ? parseInt(token.speaker, 10) : 0;

      // Skip tokens without speaker or text
      if (speaker === 0 || !token.text || token.text.trim() === '') {
        return;
      }

      // Create new segment if speaker changes or this is the first token
      if (!currentSegment || currentSegment.speaker !== speaker) {
        if (currentSegment) {
          newSegments.push(currentSegment);
        }
        currentSegment = {
          speaker,
          text: token.text,
          startMs: token.start_ms || 0,
          endMs: (token.start_ms || 0) + 100, // Estimate end time
          tokens: [token],
        };
      } else {
        // Append to current segment
        currentSegment.text += token.text;
        currentSegment.endMs = (token.start_ms || 0) + 100;
        currentSegment.tokens.push(token);
      }
    });

    // Push the last segment
    if (currentSegment) {
      newSegments.push(currentSegment);
    }

    return newSegments;
  }, []);

  // Start recording and transcription
  const startRecording = useCallback(async (audioDeviceId?: string) => {
    try {
      setState('Starting');
      setError(null);

      // Get microphone access with getUserMedia
      const constraints: MediaStreamConstraints = {
        audio: audioDeviceId
          ? { deviceId: { exact: audioDeviceId } }
          : {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      // Configure Soniox client
      const client = clientRef.current;
      if (!client) {
        throw new Error('Soniox client not initialized');
      }

      // Start transcription with speaker diarization
      // Pass MediaStream to Soniox client (like competency project line 301)
      await client.start({
        model: 'stt-rt-preview',
        languageHints: languageHints,
        enableSpeakerDiarization: enableSpeakerDiarization,
        enableEndpointDetection: true,
        stream: stream, // Pass the MediaStream (like competency implementation)
        onPartialResult: (result: any) => {
          console.log('[Soniox onPartialResult]', {
            totalTokens: result.tokens?.length || 0,
            finalTokens: result.tokens?.filter((t: Token) => t.is_final).length || 0,
            sampleToken: result.tokens?.[0],
          });

          // Process tokens from partial result
          const tokens = result.tokens || [];
          const finalTokens = tokens.filter((t: Token) => t.is_final);

          if (finalTokens.length > 0) {
            console.log('[Soniox] Adding final tokens:', finalTokens.length, 'Total tokens so far:', allTokensRef.current.length + finalTokens.length);
            allTokensRef.current.push(...finalTokens);
            const newSegments = processTokensIntoSegments(allTokensRef.current);
            console.log('[Soniox] Processed into segments:', newSegments.length);
            setSegments(newSegments);
            onSegmentsUpdate?.(newSegments);
          } else {
            console.log('[Soniox] No final tokens yet, waiting...');
          }
        },
        onError: (status: string, message: string) => {
          const error = new Error(`Soniox error (${status}): ${message}`);
          console.error('Soniox error:', error);
          setError(error);
          setState('Error');
          onError?.(error);
        },
        onStarted: () => {
          console.log('Soniox transcription started');
          setState('Recording');
        },
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start recording');
      console.error('Failed to start recording:', error);
      setError(error);
      setState('Error');
      onError?.(error);
    }
  }, [languageHints, enableSpeakerDiarization, processTokensIntoSegments, onSegmentsUpdate, onError]);

  // Stop recording and transcription
  const stopRecording = useCallback(async () => {
    try {
      setState('Stopping');

      const client = clientRef.current;
      if (client) {
        client.stop();
      }

      // Stop all media tracks
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      setState('Stopped');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to stop recording');
      console.error('Failed to stop recording:', error);
      setError(error);
      setState('Error');
      onError?.(error);
    }
  }, [onError]);

  // Pause recording
  const pauseRecording = useCallback(async () => {
    try {
      const client = clientRef.current;
      if (client) {
        client.stop();
      }
      setState('Paused');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to pause recording');
      console.error('Failed to pause recording:', error);
      setError(error);
      setState('Error');
      onError?.(error);
    }
  }, [onError]);

  // Resume recording
  const resumeRecording = useCallback(async () => {
    if (mediaStreamRef.current) {
      await startRecording();
    } else {
      throw new Error('No active media stream to resume');
    }
  }, [startRecording]);

  // Reset state
  const reset = useCallback(() => {
    allTokensRef.current = [];
    setSegments([]);
    setError(null);
    setState('Init');
  }, []);

  return {
    state,
    segments,
    error,
    isRecording: state === 'Recording',
    isPaused: state === 'Paused',
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    reset,
  };
}
