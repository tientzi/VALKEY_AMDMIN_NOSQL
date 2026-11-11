import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Minimize2, Loader2 } from 'lucide-react';
import api from '../services/api';
import './ChatBot.css';

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, type: 'bot', text: 'Xin chào! Tôi là Trợ lý của MiniMart. Tôi có thể giúp gì cho bạn hôm nay?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    setIsMinimized(false);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    setInput('');
    
    // Add user message
    setMessages(prev => [...prev, { id: Date.now(), type: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const response = await api.post('/api/public/chat', { message: userText });
      const botReply = response.data.response || 'Xin lỗi, tôi chưa hiểu ý bạn.';
      
      setMessages(prev => [...prev, { id: Date.now(), type: 'bot', text: botReply }]);
    } catch (error) {
      console.error('Chat error:', error);
      const errMsg = error.response?.data?.error || 'Xin lỗi, kết nối đến Trợ lý ảo đang gặp sự cố.';
      setMessages(prev => [...prev, { id: Date.now(), type: 'bot', text: errMsg, isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button className="chatbot-toggle-btn" onClick={toggleChat} aria-label="Mở chat">
        <MessageCircle size={28} />
      </button>
    );
  }

  return (
    <div className={`chatbot-window glass ${isMinimized ? 'minimized' : ''}`}>
      <div className="chatbot-header">
        <div className="chatbot-title">
          <div className="bot-avatar">
            <Bot size={20} />
            <span className="online-dot"></span>
          </div>
          <div>
            <h4>Trợ lý MiniMart</h4>
            <span className="status-text">Đang hoạt động</span>
          </div>
        </div>
        <div className="chatbot-actions">
          <button onClick={() => setIsMinimized(!isMinimized)} aria-label="Thu gọn">
            <Minimize2 size={18} />
          </button>
          <button onClick={() => setIsOpen(false)} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="chatbot-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`message-wrapper ${msg.type}`}>
                {msg.type === 'bot' && (
                  <div className="msg-avatar bot">
                    <Bot size={16} />
                  </div>
                )}
                <div className={`message-bubble ${msg.isError ? 'error' : ''}`}>
                  {msg.text.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      {i !== msg.text.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </div>
                {msg.type === 'user' && (
                  <div className="msg-avatar user">
                    <User size={16} />
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="message-wrapper bot">
                <div className="msg-avatar bot">
                  <Bot size={16} />
                </div>
                <div className="message-bubble typing">
                  <Loader2 size={16} className="spin-icon" />
                  <span>Đang trả lời...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chatbot-input-area" onSubmit={handleSend}>
            <input
              type="text"
              placeholder="Nhập câu hỏi của bạn..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
            <button type="submit" disabled={!input.trim() || isLoading}>
              <Send size={18} />
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default ChatBot;
