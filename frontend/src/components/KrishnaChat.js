import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './KrishnaChat.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function KrishnaChat({ guidanceContext }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Initial greeting from Krishna - calm and soft (multilingual support)
    if (messages.length === 0) {
      const greeting = 'Namaste. I am here, always with you. Share what is in your heart, and let the wisdom of the Gita bring clarity to your path. Speak freely in any language (English, Hindi, or any other), and I shall guide you with compassion in the same language. (आप किसी भी भाषा में बात कर सकते हैं - अंग्रेजी, हिंदी, या कोई अन्य।)';
      setMessages([{
        type: 'krishna',
        text: greeting,
        timestamp: new Date().toISOString()
      }]);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message
    const newUserMessage = {
      type: 'user',
      text: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newUserMessage]);
    setLoading(true);

    try {
      // Prepare context from guidance
      const context = guidanceContext ? {
        chapter: guidanceContext.chapter_number || guidanceContext.chapter || 'Unknown',
        verse: guidanceContext.verse_number || guidanceContext.verse || 'Unknown',
        emotion: guidanceContext.emotion || guidanceContext.detected_emotion || 'Unknown',
        what_happened: guidanceContext.what_happened || '',
        krishna_vaani: guidanceContext.krishna_vaani || '',
        verse_text: guidanceContext.text || '',
        verse_meaning: guidanceContext.meaning || '',
        guidance: guidanceContext.guidance || ''
      } : {};

      const response = await axios.post(`${API_URL}/api/krishna-chat`, {
        message: userMessage,
        context: context
      });

      // Add Krishna's response
      const krishnaMessage = {
        type: 'krishna',
        text: response.data.response,
        timestamp: response.data.timestamp
      };
      setMessages(prev => [...prev, krishnaMessage]);
    } catch (error) {
      console.error('Error getting Krishna response:', error);
      // Error message - will be in user's language if they were chatting in another language
      const errorMessage = {
        type: 'krishna',
        text: 'Forgive me, Arjuna. There was an error in receiving your message. Please try again, and I shall respond with wisdom. (कृपया पुनः प्रयास करें)',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const formatMessage = (text) => {
    // Split by double newlines to create paragraphs
    const paragraphs = text.split('\n\n');
    return paragraphs.map((para, idx) => (
      <p key={idx} className="message-paragraph">{para}</p>
    ));
  };

  return (
    <div className="ai-chat-container">
      <div className="chat-header-modern">
        <div className="chat-header-left">
          <div className="ai-avatar">🕉</div>
          <div>
            <h3 className="chat-title">Chat with Krishna</h3>
            <p className="chat-subtitle">AI-powered guidance from the Bhagavad Gita</p>
          </div>
        </div>
      </div>

      <div className="messages-container-modern">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message-modern ${msg.type}`}>
            {msg.type === 'krishna' && (
              <div className="message-avatar-modern">🕉</div>
            )}
            <div className="message-bubble">
              <div className="message-text-modern">
                {formatMessage(msg.text)}
              </div>
              <div className="message-time-modern">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="message-modern krishna">
            <div className="message-avatar-modern">🕉</div>
            <div className="message-bubble">
              <div className="typing-indicator-modern">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="chat-input-form-modern">
                    <input
                      type="text"
                      className="chat-input-modern"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask Krishna for guidance... (English, Hindi, or any language)"
                      disabled={loading}
                    />
        <button 
          type="submit" 
          className="chat-send-btn-modern"
          disabled={loading || !input.trim()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>
  );
}

export default KrishnaChat;
