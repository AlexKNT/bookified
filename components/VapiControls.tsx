'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Mic, MicOff, X } from 'lucide-react';
import Vapi from '@vapi-ai/web';

import Transcript from './Transcript';
import { cn } from '@/lib/utils';
import { ASSISTANT_ID, DEFAULT_VOICE, voiceOptions } from '@/lib/constants';
import { checkSessionLimit, endVoiceSession, startVoiceSession } from '@/lib/actions/session.actions';
import type { Messages } from '@/types';

interface VapiControlsProps {
    book: {
        _id: string;
        title: string;
        author: string;
        slug: string;
        coverURL: string;
        persona?: string;
    };
}

type CallStatus = 'idle' | 'connecting' | 'starting' | 'listening' | 'thinking' | 'speaking';

const STATUS_LABEL: Record<CallStatus, string> = {
    idle: 'Ready',
    connecting: 'Connecting',
    starting: 'Starting',
    listening: 'Listening',
    thinking: 'Thinking',
    speaking: 'Speaking',
};

const STATUS_DOT: Record<CallStatus, string> = {
    idle: 'vapi-status-dot vapi-status-dot-ready',
    connecting: 'vapi-status-dot vapi-status-dot-connecting',
    starting: 'vapi-status-dot vapi-status-dot-starting',
    listening: 'vapi-status-dot vapi-status-dot-listening',
    thinking: 'vapi-status-dot vapi-status-dot-thinking',
    speaking: 'vapi-status-dot vapi-status-dot-speaking',
};

const formatClock = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

type TranscriptMessage = {
    type?: string;
    role?: string;
    transcript?: string;
    transcriptType?: string;
};

const VapiControls = ({ book }: VapiControlsProps) => {
    const [status, setStatus] = useState<CallStatus>('idle');
    const [messages, setMessages] = useState<Messages[]>([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [currentUserMessage, setCurrentUserMessage] = useState('');
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [maxDurationMinutes, setMaxDurationMinutes] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dismissedWarning, setDismissedWarning] = useState(false);
    const [hasUsageLeft, setHasUsageLeft] = useState(true);
    const [sessionUsage, setSessionUsage] = useState<{ currentCount: number; limit: number } | null>(null);

    const vapiRef = useRef<Vapi | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const startedAtRef = useRef<number | null>(null);
    const stopCallRef = useRef<(options?: { silent?: boolean }) => Promise<void>>(async () => {});

    const voiceKey = (book.persona || DEFAULT_VOICE) as keyof typeof voiceOptions;
    const voiceId = voiceOptions[voiceKey]?.id ?? voiceOptions[DEFAULT_VOICE].id;

    const endActiveSession = useCallback(async () => {
        const sessionId = sessionIdRef.current;
        const startedAt = startedAtRef.current;

        sessionIdRef.current = null;
        startedAtRef.current = null;

        if (sessionId && startedAt) {
            const duration = Math.round((Date.now() - startedAt) / 1000);
            await endVoiceSession(sessionId, duration);
        }
    }, []);

    const stopCall = useCallback(
        async ({ silent = false }: { silent?: boolean } = {}) => {
            try {
                await vapiRef.current?.stop();
            } catch (stopError) {
                if (!silent) console.error('Failed to stop the Vapi call:', stopError);
            }

            await endActiveSession();

            setStatus('idle');
            setCurrentMessage('');
            setCurrentUserMessage('');
        },
        [endActiveSession],
    );

    stopCallRef.current = stopCall;

    // Create the SDK client on mount and tear the call down on unmount.
    useEffect(() => {
        const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;

        if (!publicKey) {
            setError('Missing NEXT_PUBLIC_VAPI_PUBLIC_KEY. Add it to .env.local and restart the dev server.');
            return;
        }

        const vapi = new Vapi(publicKey);
        vapiRef.current = vapi;

        vapi.on('call-start', () => setStatus('listening'));

        vapi.on('call-end', () => {
            setStatus('idle');
            setCurrentMessage('');
            setCurrentUserMessage('');
            void endActiveSession();
        });

        vapi.on('speech-start', () => setStatus('speaking'));
        vapi.on('speech-end', () => setStatus('listening'));

        vapi.on('message', (message: unknown) => {
            const payload = message as TranscriptMessage;

            if (payload?.type !== 'transcript' || !payload.transcript) return;

            const isUser = payload.role === 'user';
            const isPartial = payload.transcriptType === 'partial';

            if (isPartial) {
                if (isUser) {
                    setCurrentUserMessage(payload.transcript);
                } else {
                    setStatus('speaking');
                    setCurrentMessage(payload.transcript);
                }
                return;
            }

            setMessages((previous) => [
                ...previous,
                { role: isUser ? 'user' : 'assistant', content: payload.transcript as string },
            ]);

            if (isUser) {
                setCurrentUserMessage('');
                setStatus('thinking');
            } else {
                setCurrentMessage('');
                setStatus('listening');
            }
        });

        vapi.on('error', (vapiError: unknown) => {
            console.error('Vapi error:', vapiError);
            setError('The voice assistant hit an error. Please try again.');
            void stopCallRef.current({ silent: true });
        });

        return () => {
            void stopCallRef.current({ silent: true });
            vapi.removeAllListeners();
            vapiRef.current = null;
        };
    }, [endActiveSession]);

    // Session timer, capped by the plan's max duration per session.
    useEffect(() => {
        if (status === 'idle') return;

        const interval = setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
        return () => clearInterval(interval);
    }, [status]);

    useEffect(() => {
        if (maxDurationMinutes === null || status === 'idle') return;

        if (elapsedSeconds >= maxDurationMinutes * 60) {
            void stopCallRef.current({ silent: true });
        }
    }, [elapsedSeconds, maxDurationMinutes, status]);

    // Check the plan limit up front so the UI can warn before a call starts.
    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const limitCheck = await checkSessionLimit();

            if (cancelled) return;

            setHasUsageLeft(limitCheck.allowed);
            setMaxDurationMinutes(limitCheck.maxDurationMinutes || null);
            setSessionUsage({ currentCount: limitCheck.currentCount, limit: limitCheck.limit });
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const startCall = async () => {
        if (status !== 'idle') {
            await stopCall();
            return;
        }

        setError(null);
        setElapsedSeconds(0);
        setStatus('connecting');

        try {
            if (!ASSISTANT_ID) {
                throw new Error('Missing NEXT_PUBLIC_ASSISTANT_ID. Add it to .env.local and restart the dev server.');
            }

            const limitCheck = await checkSessionLimit();

            setHasUsageLeft(limitCheck.allowed);
            setSessionUsage({ currentCount: limitCheck.currentCount, limit: limitCheck.limit });
            setMaxDurationMinutes(limitCheck.maxDurationMinutes || null);

            if (!limitCheck.allowed) {
                setError(limitCheck.error ?? 'You have reached your conversation limit for this month.');
                setStatus('idle');
                return;
            }

            const session = await startVoiceSession(book._id);

            if (!session.success || !session.sessionId) {
                setError(session.error ?? 'Could not start the conversation.');
                setStatus('idle');
                return;
            }

            sessionIdRef.current = session.sessionId;
            startedAtRef.current = Date.now();

            setStatus('starting');

            await vapiRef.current?.start(ASSISTANT_ID, {
                firstMessage: `Hi! I'm your reading companion for "${book.title}" by ${book.author}. What would you like to explore?`,
                variableValues: {
                    bookTitle: book.title,
                    bookAuthor: book.author,
                    bookSlug: book.slug,
                    voice: voiceKey,
                },
                voice: {
                    provider: '11labs',
                    voiceId,
                },
            });
        } catch (startError) {
            console.error('Failed to start the call:', startError);

            await endActiveSession();
            setError(startError instanceof Error ? startError.message : 'Failed to start the conversation.');
            setStatus('idle');
        }
    };

    const isActive = status !== 'idle';
    const limitReached = !hasUsageLeft || (sessionUsage !== null && sessionUsage.currentCount >= sessionUsage.limit);

    return (
        <div className="vapi-main-container">
            {error && (
                <div className="error-banner" role="alert">
                    <div className="error-banner-content">
                        <p className="flex items-center gap-2 text-sm font-medium text-red-600">
                            <AlertCircle className="error-banner-icon" />
                            {error}
                        </p>
                        <button
                            type="button"
                            aria-label="Dismiss error"
                            className="error-banner-dismiss"
                            onClick={() => setError(null)}
                        >
                            <X className="size-5" />
                        </button>
                    </div>
                    <a className="error-banner-link" href="/subscriptions">
                        View plans
                    </a>
                </div>
            )}

            {!error && limitReached && !dismissedWarning && sessionUsage && (
                <div className="warning-banner">
                    <div className="warning-banner-content">
                        <AlertCircle className="warning-banner-icon" />
                        <p className="warning-banner-text">
                            You have used {sessionUsage.currentCount} of {sessionUsage.limit} conversations this
                            month.
                        </p>
                        <button
                            type="button"
                            aria-label="Dismiss warning"
                            className="ml-auto text-[#212a3b] hover:opacity-70"
                            onClick={() => setDismissedWarning(true)}
                        >
                            <X className="size-5" />
                        </button>
                    </div>
                </div>
            )}

            <div className="vapi-header-card w-full">
                <div className="vapi-cover-wrapper">
                    <Image
                        src={book.coverURL}
                        alt={book.title}
                        width={162}
                        height={240}
                        className="vapi-cover-image"
                    />

                    <div className="vapi-mic-wrapper">
                        {isActive && <span className="vapi-pulse-ring" />}
                        <button
                            type="button"
                            onClick={startCall}
                            aria-label={isActive ? 'End the conversation' : 'Start the conversation'}
                            className={cn(
                                'vapi-mic-btn',
                                isActive ? 'vapi-mic-btn-active' : 'vapi-mic-btn-inactive',
                            )}
                        >
                            {isActive ? (
                                <MicOff className="size-5 text-white" />
                            ) : (
                                <Mic className="size-5 text-[#212a3b]" />
                            )}
                        </button>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-4 sm:items-start">
                    <div className="vapi-badge-ai">
                        <span className="vapi-badge-ai-text">AI Voice Assistant</span>
                    </div>

                    <div className="text-center sm:text-left">
                        <h2 className="page-title !text-2xl">{book.title}</h2>
                        <p className="page-description !text-base">{book.author}</p>
                    </div>

                    <div className="vapi-status-indicator">
                        <span className={STATUS_DOT[status]} />
                        <span className="vapi-status-text">{STATUS_LABEL[status]}</span>
                    </div>

                    <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
                        <div className="vapi-stat-box-sm">
                            <p className="vapi-stat-label !text-base !mb-1">Elapsed</p>
                            <p className="vapi-stat-value-lg !text-xl">{formatClock(elapsedSeconds)}</p>
                        </div>

                        {maxDurationMinutes !== null && (
                            <div className="vapi-stat-box-sm">
                                <p className="vapi-stat-label !text-base !mb-1">Session limit</p>
                                <p className="vapi-stat-value-lg !text-xl">{maxDurationMinutes} min</p>
                            </div>
                        )}

                        {sessionUsage && (
                            <div className="vapi-stat-box-sm">
                                <p className="vapi-stat-label !text-base !mb-1">Conversations</p>
                                <p className="vapi-stat-value-lg !text-xl">
                                    {sessionUsage.currentCount}/{sessionUsage.limit}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="vapi-transcript-wrapper w-full mt-6">
                <Transcript
                    messages={messages}
                    currentMessage={currentMessage}
                    currentUserMessage={currentUserMessage}
                />
            </div>
        </div>
    );
};

export default VapiControls;
