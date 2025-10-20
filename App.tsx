// Fix(App.tsx): Add type definitions for the Web Speech API.
// This is necessary because these APIs are not part of standard TypeScript DOM typings.
// These definitions resolve errors related to 'SpeechRecognition' and its events.
interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionStatic {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
  }
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Role, LanguageOption } from './types';
import { SUPPORTED_LANGUAGES } from './constants';
import { startChatSession, sendMessageToAI } from './services/geminiService';
import MessageBubble from './components/MessageBubble';

// SpeechRecognition interfaces for cross-browser compatibility
// Fix(App.tsx): Rename SpeechRecognition constant to SpeechRecognitionAPI to avoid conflict with the SpeechRecognition interface type.
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

const App: React.FC = () => {
    const [conversation, setConversation] = useState<Message[]>([]);
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(SUPPORTED_LANGUAGES[0]);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        chatContainerRef.current?.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth'
        });
    };

    useEffect(() => {
        scrollToBottom();
    }, [conversation]);
    
    useEffect(() => {
      document.documentElement.lang = selectedLanguage.code.split('-')[0];
      document.documentElement.dir = selectedLanguage.dir;
      startChatSession(selectedLanguage.name);
      setConversation([]);
    }, [selectedLanguage]);


    const handleRecognitionResult = useCallback((event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
            .map(result => result[0])
            .map(result => result.transcript)
            .join('');
        
        if (event.results[0].isFinal && transcript.trim()) {
            const userMessage: Message = { role: Role.USER, text: transcript };
            setConversation(prev => [...prev, userMessage]);
            processAIResponse(transcript);
        }
    }, []);
    
    const setupRecognition = useCallback(() => {
        // Fix(App.tsx): Use renamed SpeechRecognitionAPI constant.
        if (!SpeechRecognitionAPI) {
            setError("Speech recognition is not supported in your browser.");
            return;
        }

        // Fix(App.tsx): Use renamed SpeechRecognitionAPI constant.
        const recognition = new SpeechRecognitionAPI();
        recognition.lang = selectedLanguage.code;
        recognition.interimResults = true;
        recognition.continuous = false;

        recognition.onresult = handleRecognitionResult;
        
        recognition.onend = () => {
            setIsRecording(false);
        };
        
        recognition.onerror = (event) => {
            setError(`Speech recognition error: ${event.error}`);
            setIsRecording(false);
        };

        recognitionRef.current = recognition;
    }, [selectedLanguage, handleRecognitionResult]);

    useEffect(() => {
        setupRecognition();
    }, [setupRecognition]);
    
    const speak = (text: string) => {
        if (!window.speechSynthesis) {
            console.warn("Speech synthesis not supported.");
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Find a voice for the selected language
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang === selectedLanguage.code);
        if (voice) {
            utterance.voice = voice;
        } else {
            // Fallback for languages like Arabic that might not have a dedicated voice code `ar-SA` but `ar-XA` etc.
             const langPrefix = selectedLanguage.code.split('-')[0];
             const fallbackVoice = voices.find(v => v.lang.startsWith(langPrefix));
             if (fallbackVoice) utterance.voice = fallbackVoice;
        }

        utterance.rate = 1;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
    };

    const processAIResponse = async (userText: string) => {
        setIsProcessing(true);
        setError(null);
        try {
            const aiText = await sendMessageToAI(userText);
            const aiMessage: Message = { role: Role.MODEL, text: aiText };
            setConversation(prev => [...prev, aiMessage]);
            speak(aiText); // Speak the full response
        } catch (e: any) {
            setError(e.message || "Failed to get response from AI.");
            const errorMessage: Message = { role: Role.MODEL, text: "Sorry, I couldn't process that. Please try again." };
            setConversation(prev => [...prev, errorMessage]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRecordClick = () => {
        if (isRecording) {
            recognitionRef.current?.stop();
            setIsRecording(false);
        } else {
            try {
                recognitionRef.current?.start();
                setIsRecording(true);
                setError(null);
            } catch (e) {
                // This can happen if start() is called too soon after another start()
                // Re-setup and try again.
                console.warn("Error starting recognition, re-initializing.", e);
                setupRecognition();
                setTimeout(() => {
                     try {
                        recognitionRef.current?.start();
                        setIsRecording(true);
                        setError(null);
                     } catch(e2) {
                        setError("Could not start microphone. Please check permissions.");
                     }
                }, 250);
            }
        }
    };

    const handleClearConversation = () => {
        setConversation([]);
        startChatSession(selectedLanguage.name); // Start a new fresh chat session
    };

    const renderRecordButtonContent = () => {
        if (isProcessing) {
            return <i className="fa-solid fa-spinner fa-spin text-2xl"></i>;
        }
        if (isRecording) {
            return <i className="fa-solid fa-square text-xl"></i>;
        }
        return <i className="fa-solid fa-microphone text-2xl"></i>;
    };

    return (
        <div className="flex flex-col h-screen bg-gradient-to-tr from-[#1a2a6c] via-[#b21f1f] to-[#fdbb2d] text-white font-sans">
            <header className="flex justify-between items-center p-4 shadow-lg bg-black bg-opacity-20 backdrop-blur-sm">
                <h1 className="text-2xl font-bold tracking-wider">Polyglot Pal</h1>
                <div className="flex items-center gap-4">
                    <select
                        value={selectedLanguage.code}
                        onChange={(e) => setSelectedLanguage(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)}
                        className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                        {SUPPORTED_LANGUAGES.map(lang => (
                            <option key={lang.code} value={lang.code}>{lang.name}</option>
                        ))}
                    </select>
                     <button
                        onClick={handleClearConversation}
                        className="px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors"
                        title="Clear Conversation"
                    >
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </header>
            
            <main ref={chatContainerRef} className="flex-1 flex flex-col p-4 overflow-y-auto">
                {conversation.length === 0 && (
                    <div className="m-auto text-center text-gray-300">
                        <h2 className="text-3xl font-light">Welcome!</h2>
                        <p className="mt-2">Select a language and press the microphone to start talking.</p>
                    </div>
                )}
                {conversation.map((msg, index) => (
                    <MessageBubble key={index} message={msg} />
                ))}
            </main>

            {error && <div className="text-center py-2 bg-red-800 bg-opacity-80 text-white">{error}</div>}

            <footer className="p-4 bg-black bg-opacity-20 backdrop-blur-sm flex items-center justify-center">
                 <button
                    onClick={handleRecordClick}
                    disabled={isProcessing}
                    className={`relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-opacity-50
                    ${isRecording ? 'bg-red-600 hover:bg-red-700 focus:ring-red-400' : 'bg-sky-600 hover:bg-sky-700 focus:ring-sky-400'}
                    ${isProcessing ? 'cursor-not-allowed bg-gray-600' : ''}`}
                    aria-label={isRecording ? "Stop Recording" : "Start Recording"}
                >
                    {isRecording && <span className="absolute animate-ping inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                    {renderRecordButtonContent()}
                </button>
            </footer>
        </div>
    );
};

export default App;