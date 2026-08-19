import { useState, useRef, useEffect } from 'react';

const FloatingChat = ({
    realTimeData = {},
    waterQuality = {},
    satelliteObservation = null,
    satelliteRiver = null,
    contaminationPoints = [],
    modelPrediction = null,
    leakThreshold = 0.5
}) => {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            type: 'ai',
            text: 'Hello! I can help reduce pollution detected by your sensors and satellite. Ask me about the current contamination or how to fix it.'
        }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const conversationHistoryRef = useRef([]);
    const inputRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 250);
        }
    }, [open]);

    const getSystemPrompt = () => {
        const flow1 = realTimeData.flow1 || 0;
        const flow2 = realTimeData.flow2 || 0;
        const leak = realTimeData.leak || (flow1 > flow2 ? flow1 - flow2 : 0);
        const waterBody = satelliteRiver?.name || 'the monitored water body';

        let contaminationContext = 'No active contamination events detected.';
        if (contaminationPoints.length > 0) {
            contaminationContext = contaminationPoints.map((point, index) =>
                `${index + 1}. Location: ${point.location || 'Unknown'} | Risk: ${point.severity} | Type: ${point.contaminationType || 'N/A'} | Cause: ${point.cause || 'N/A'} | TDS: ${point.tds ?? 'N/A'} ppm | pH: ${point.ph ?? 'N/A'} | Turbidity: ${point.turbidity ?? 'N/A'} NTU | Source: ${point.source}`
            ).join('\n');
        }

        const pollutionRisk = satelliteObservation?.pollutionRisk || 'Not evaluated';
        const satelliteHealth = satelliteObservation?.healthScore ?? 'N/A';
        const satelliteDate = satelliteObservation?.imageDate ? new Date(satelliteObservation.imageDate).toLocaleDateString() : 'N/A';

        return `You are AquaSense, an expert AI assistant for a water management and pollution monitoring system.
Your role is to analyze pollution detected by IoT sensors and satellite imagery, explain the cause, and give concrete, actionable remediation steps.

CURRENT LIVE SYSTEM DATA CONTEXT:
- Water body: ${waterBody}
- Inlet Flow Rate: ${flow1.toFixed ? flow1.toFixed(2) : flow1} L/min
- Outlet Flow Rate: ${flow2.toFixed ? flow2.toFixed(2) : flow2} L/min
- Leakage Rate: ${Number(leak).toFixed(2)} L/min
- TDS (Total Dissolved Solids): ${realTimeData.tds || 'N/A'} ppm
- pH Level: ${waterQuality.ph ?? 'N/A'}
- Turbidity: ${waterQuality.turbidity ?? 'N/A'} NTU
- System Status: ${Math.abs(leak) > leakThreshold ? 'CRITICAL LEAK DETECTED' : 'Normal Operations'}

SATELLITE CONTEXT:
- Pollution risk: ${pollutionRisk}
- Health score: ${satelliteHealth}/100
- Latest pass: ${satelliteDate}

DETECTED CONTAMINATION EVENTS:
${contaminationContext}

ML PREDICTION:
${modelPrediction ? `Predicted water quality: ${modelPrediction.predicted_water_quality || 'N/A'} (${Math.round((modelPrediction.confidence || 0) * 100)}% confidence)` : 'No prediction available yet'}

When the user asks how to reduce pollution, provide:
1. A short explanation of the detected issue (based on the contamination events and satellite signal above).
2. 3-5 practical, actionable solutions (treatment, prevention, monitoring, or maintenance).
3. Reference the live data if relevant.
Be concise, professional, and helpful. If no data is available, say so and suggest how to obtain it.`;
    };

    const getEffectiveApiKey = () =>
        import.meta.env.VITE_OPENROUTER_API_KEY ||
        localStorage.getItem('openrouter-api-key') ||
        localStorage.getItem('gemini-api-key') ||
        '';

    const handleSend = async () => {
        if (!input.trim()) return;

        const effectiveApiKey = getEffectiveApiKey();
        if (!effectiveApiKey) {
            setMessages(prev => [...prev, {
                type: 'ai',
                text: "Error: No OpenRouter API Key configured. Please add VITE_OPENROUTER_API_KEY to your .env file or configure your API key in Settings."
            }]);
            return;
        }

        const userText = input;
        setMessages(prev => [...prev, { type: 'user', text: userText }]);
        setInput('');
        setIsTyping(true);

        try {
            const history = conversationHistoryRef.current.map(msg => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            }));

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${effectiveApiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": window.location.href,
                    "X-Title": "AquaSense Water Management App",
                },
                body: JSON.stringify({
                    model: "google/gemini-2.0-flash-001",
                    messages: [
                        { role: "system", content: getSystemPrompt() },
                        ...history,
                        { role: "user", content: userText }
                    ]
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error?.message || response.statusText || `Status: ${response.status}`);
            }

            const data = await response.json();
            const aiText = data.choices[0]?.message?.content || "I couldn't generate a response.";

            conversationHistoryRef.current.push({ role: 'user', content: userText });
            conversationHistoryRef.current.push({ role: 'assistant', content: aiText });

            setMessages(prev => [...prev, { type: 'ai', text: aiText }]);
        } catch (error) {
            console.error("AI Error:", error);
            setMessages(prev => [...prev, {
                type: 'ai',
                text: `I'm having trouble connecting to the AI. Error: ${error.message || 'Unknown error'}.`
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const pollutionActive = contaminationPoints.length > 0 || ['High', 'Elevated'].includes(satelliteObservation?.pollutionRisk);

    return (
        <>
            <button
                className={`floating-chat-toggle ${open ? 'open' : ''} ${pollutionActive ? 'alert' : ''}`}
                onClick={() => setOpen(prev => !prev)}
                aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
            >
                {open ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                )}
                {pollutionActive && !open && <span className="floating-chat-badge"></span>}
            </button>

            {open && (
                <div className="floating-chat-panel">
                    <div className="floating-chat-header">
                        <div>
                            <strong>AquaSense AI</strong>
                            <span className="floating-chat-subtitle">Pollution remediation assistant</span>
                        </div>
                        <span className="floating-chat-live"><span /> Live context</span>
                    </div>

                    <div className="floating-chat-messages">
                        {messages.map((message, index) => (
                            <div key={index} className={`floating-chat-message ${message.type}`}>
                                {message.text}
                            </div>
                        ))}
                        {isTyping && (
                            <div className="floating-chat-message ai">
                                <div className="pulse" style={{ display: 'flex', gap: '4px' }}>
                                    <span>●</span><span>●</span><span>●</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="floating-chat-input-row">
                        <input
                            ref={inputRef}
                            type="text"
                            className="floating-chat-input"
                            placeholder="Ask how to reduce pollution..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                        />
                        <button className="floating-chat-send" onClick={handleSend} disabled={isTyping}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default FloatingChat;