import { useState, useRef, useEffect } from 'react';

const AIAssistant = ({ compact = false, fullView = false, realTimeData = {}, waterQuality = {}, leakThreshold = 0.5 }) => {
    const [messages, setMessages] = useState([
        {
            type: 'ai',
            text: 'Hello! I\'m your water management AI assistant. Ask me anything about your system\'s performance, water quality, or usage patterns.'
        }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const conversationHistoryRef = useRef([]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Dynamically build the system prompt based on live data
    const getSystemPrompt = () => {
        return `You are an expert AI assistant for a Water Management System. 
Your role is to help users analyze water quality, monitor usage, check system health, and provide recommendations.

CURRENT LIVE SYSTEM DATA CONTEXT:
- Inlet Flow Rate: ${realTimeData.flow1?.toFixed(2) || '0.00'} L/min
- Outlet Flow Rate: ${realTimeData.flow2?.toFixed(2) || '0.00'} L/min
- Leakage Rate: ${realTimeData.flow1 > realTimeData.flow2 ? (realTimeData.flow1 - realTimeData.flow2).toFixed(2) : '0.00'} L/min
- TDS (Total Dissolved Solids): ${realTimeData.tds || '350'} ppm
- pH Level: ${waterQuality.ph?.toFixed(1) || '0.0'}
- Turbidity: ${waterQuality.turbidity?.toFixed(1) || '0.0'} NTU
- System Status: ${Math.abs(realTimeData.leak) > leakThreshold ? 'CRITICAL LEAK DETECTED' : 'Normal Operations'}

When answering, reference this live data if relevant. Be concise, professional, and helpful.`;
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const effectiveApiKey = import.meta.env.VITE_OPENROUTER_API_KEY || localStorage.getItem('openrouter-api-key') || localStorage.getItem('gemini-api-key') || '';

        if (!effectiveApiKey) {
            setMessages(prev => [...prev, {
                type: 'ai',
                text: "Error: No OpenRouter API Key configured. Please add VITE_OPENROUTER_API_KEY to your .env file or configure your API key in Settings."
            }]);
            return;
        }

        const userText = input;
        const userMessage = { type: 'user', text: userText };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsTyping(true);

        try {
            // Prepare messages for OpenRouter/OpenAI format
            const history = conversationHistoryRef.current.map(msg => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            }));

            const requestBody = {
                model: "google/gemini-2.0-flash-001",
                messages: [
                    { role: "system", content: getSystemPrompt() },
                    ...history,
                    { role: "user", content: userText }
                ]
            };

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${effectiveApiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": window.location.href, // Optional, for including your app on openrouter.ai rankings.
                    "X-Title": "Water Management App", // Optional. Shows in rankings on openrouter.ai.
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const errorMessage = errorData?.error?.message || response.statusText || `Status: ${response.status}`;
                throw new Error(errorMessage);
            }

            const data = await response.json();
            const aiText = data.choices[0]?.message?.content || "I couldn't generate a response.";

            // Add to conversation history
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

    const suggestedQuestions = [
        'What is the current water quality?',
        'Show me usage trends',
        'Any alerts or warnings?',
        'How can I reduce consumption?'
    ];

    return (
        <div
            className="ai-chat-container"
            style={
                fullView
                    ? { height: '600px' }
                    : compact
                        ? { height: '400px' }
                        : {}
            }
        >
            <div className="chart-header" style={{ marginBottom: 'var(--space-lg)' }}>
                <h2 className="chart-title">
                    <svg
                        style={{ width: '24px', height: '24px', display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--primary-blue-light)"
                        strokeWidth="2"
                    >
                        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                        <circle cx="12" cy="11" r="3" />
                    </svg>
                    AI Assistant
                </h2>
                <p className="chart-subtitle">
                    Powered by OpenRouter
                    <span style={{
                        marginLeft: '0.5rem',
                        color: '#4ade80',
                        fontSize: '0.75rem'
                    }}>
                        ● Ready
                    </span>
                </p>
            </div>

            <div className="chat-messages">
                {messages.map((message, index) => (
                    <div key={index} className={`chat-message ${message.type}`}>
                        {message.text}
                    </div>
                ))}

                {isTyping && (
                    <div className="chat-message ai">
                        <div className="pulse" style={{ display: 'flex', gap: '4px' }}>
                            <span>●</span>
                            <span>●</span>
                            <span>●</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Suggested Questions */}
            {messages.length === 1 && !fullView && (
                <div style={{ marginBottom: 'var(--space-md)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {suggestedQuestions.slice(0, 2).map((question, index) => (
                        <button
                            key={index}
                            onClick={() => setInput(question)}
                            style={{
                                padding: '0.5rem 0.75rem',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-secondary)',
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.borderColor = 'var(--primary-blue)';
                                e.target.style.color = 'var(--text-primary)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.borderColor = 'var(--border-color)';
                                e.target.style.color = 'var(--text-secondary)';
                            }}
                        >
                            {question}
                        </button>
                    ))}
                </div>
            )}

            {fullView && messages.length === 1 && (
                <div style={{
                    marginBottom: 'var(--space-lg)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.75rem'
                }}>
                    {suggestedQuestions.map((question, index) => (
                        <button
                            key={index}
                            onClick={() => setInput(question)}
                            style={{
                                padding: '0.75rem 1rem',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-secondary)',
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                textAlign: 'left'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.borderColor = 'var(--primary-blue)';
                                e.target.style.color = 'var(--text-primary)';
                                e.target.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.borderColor = 'var(--border-color)';
                                e.target.style.color = 'var(--text-secondary)';
                                e.target.style.transform = 'translateY(0)';
                            }}
                        >
                            {question}
                        </button>
                    ))}
                </div>
            )}

            <div className="chat-input-container">
                <input
                    type="text"
                    className="chat-input"
                    placeholder="Ask about water quality, usage, or recommendations..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                />
                <button className="btn btn-primary" onClick={handleSend}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    Send
                </button>
            </div>
        </div>
    );
};

export default AIAssistant;
