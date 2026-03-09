import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Bot, Send, User, Search, Plus, Phone, CheckCircle, X } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';

import { createPortal } from 'react-dom';

export function WhatsApp() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isBotActive, setIsBotActive] = useState(false);
  
  // New conversation modal
  const [isNewConvModalOpen, setIsNewConvModalOpen] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [whatsappNumbers, setWhatsappNumbers] = useState<any[]>([]);
  const [selectedNumberId, setSelectedNumberId] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
    fetchWhatsappNumbers();
    
    // Poll for new messages every 3 seconds
    const interval = setInterval(() => {
      fetchConversations(false);
      if (selectedConv) {
        fetchMessages(selectedConv.id, false);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [selectedConv]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchWhatsappNumbers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/whatsapp/numbers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWhatsappNumbers(data);
        if (data.length > 0) {
          setSelectedNumberId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch whatsapp numbers', err);
    }
  };

  const fetchConversations = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/whatsapp/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error('Failed to fetch conversations', err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const fetchMessages = async (convId: string, showLoading = true) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/whatsapp/conversations/${convId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        
        // Auto-reply logic if bot is active and last message is inbound
        if (selectedConv && selectedConv.bot_active === 1 && data.length > 0) {
          const lastMsg = data[data.length - 1];
          // Check if the last message is inbound and we haven't replied yet
          if (lastMsg.direction === 'inbound' && !isSending) {
            // Check if the last message was processed by bot already (simple heuristic: if the very last message is inbound, bot hasn't replied yet)
            handleBotAutoReply(convId, data);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch messages', err);
    }
  };

  const handleSelectConversation = (conv: any) => {
    setSelectedConv(conv);
    setIsBotActive(conv.bot_active === 1);
    fetchMessages(conv.id);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !selectedConv) return;

    const content = newMessage;
    setNewMessage('');
    setIsSending(true);

    // Optimistic update
    const tempMsg = {
      id: 'temp-' + Date.now(),
      direction: 'outbound',
      content,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/whatsapp/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversation_id: selectedConv.id,
          content
        }),
      });
      
      if (res.ok) {
        fetchMessages(selectedConv.id, false);
        fetchConversations(false);
      } else {
        const errorData = await res.json();
        console.error('Failed to send message:', errorData);
        // Remove optimistic message on failure
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
        
        if (errorData.details?.error?.message?.includes('expired')) {
          alert('Erro: O token do WhatsApp expirou. Por favor, gere um novo token no painel da Meta e atualize nas Configurações.');
        } else {
          alert('Falha ao enviar mensagem. Verifique as configurações do WhatsApp.');
        }
      }
    } catch (err) {
      console.error('Error sending message', err);
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      alert('Erro de conexão ao enviar mensagem.');
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleBot = async () => {
    if (!selectedConv) return;
    
    const newStatus = !isBotActive;
    setIsBotActive(newStatus);
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/whatsapp/conversations/${selectedConv.id}/bot`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bot_active: newStatus }),
      });
      
      // Update local state
      setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, bot_active: newStatus ? 1 : 0 } : c));
      setSelectedConv(prev => ({ ...prev, bot_active: newStatus ? 1 : 0 }));
      
    } catch (err) {
      console.error('Failed to toggle bot', err);
      setIsBotActive(!newStatus); // Revert on error
    }
  };

  const handleBotAutoReply = async (convId: string, currentMessages: any[]) => {
    if (isSending) return;
    setIsSending(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
      
      // Build context
      let prompt = "Você é um assistente virtual de uma oficina mecânica chamada Oficina Pro. Responda de forma educada, curta e prestativa. Aqui está o histórico da conversa:\n\n";
      
      // Take last 10 messages for context
      const recentMsgs = currentMessages.slice(-10);
      recentMsgs.forEach(msg => {
        prompt += `${msg.direction === 'inbound' ? 'Cliente' : 'Oficina'}: ${msg.content}\n`;
      });
      
      prompt += "\nOficina:";

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const replyText = response.text || "Desculpe, não consegui entender. Pode repetir?";
      
      // Send the generated reply
      const token = localStorage.getItem('token');
      await fetch('/api/whatsapp/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversation_id: convId,
          content: replyText
        }),
      });
      
      fetchMessages(convId, false);
      fetchConversations(false);
    } catch (error) {
      console.error('Bot reply failed:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleStartConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone || !selectedNumberId) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/whatsapp/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer_phone: newPhone.replace(/\D/g, ''),
          customer_name: newName,
          whatsapp_number_id: selectedNumberId
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setIsNewConvModalOpen(false);
        setNewPhone('');
        setNewName('');
        fetchConversations();
        
        // Find and select the new conversation
        setTimeout(() => {
          const conv = conversations.find(c => c.id === data.id) || { id: data.id, customer_phone: newPhone, customer_name: newName, bot_active: 0 };
          handleSelectConversation(conv);
        }, 500);
      }
    } catch (err) {
      console.error('Failed to start conversation', err);
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>
          <p className="text-sm text-gray-500 mt-1">Central de Atendimento Inteligente</p>
        </div>
        <button 
          onClick={() => setIsNewConvModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-gray-900 bg-yellow-500 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Nova Conversa
        </button>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex">
        {/* Sidebar - Conversations List */}
        <div className="w-1/3 border-r border-gray-200 flex flex-col bg-gray-50">
          <div className="p-4 border-b border-gray-200 bg-white">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar conversas..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {isLoading && conversations.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">Carregando...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">Nenhuma conversa encontrada.</div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {conversations.map((conv) => (
                  <li 
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`p-4 hover:bg-gray-100 cursor-pointer transition-colors ${selectedConv?.id === conv.id ? 'bg-yellow-50/50' : ''}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="h-5 w-5 text-gray-500" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {conv.customer_name || conv.customer_phone}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatTime(conv.last_message_at)}
                          </p>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm text-gray-500 truncate">
                            {conv.customer_phone}
                          </p>
                          {conv.bot_active === 1 && (
                            <Bot className="h-3 w-3 text-yellow-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-[#efeae2]">
          {selectedConv ? (
            <>
              {/* Chat Header */}
              <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                    <User className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">{selectedConv.customer_name || selectedConv.customer_phone}</h2>
                    <p className="text-xs text-gray-500">{selectedConv.customer_phone}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleToggleBot}
                    className={`inline-flex items-center px-3 py-1.5 border text-sm font-medium rounded-lg shadow-sm transition-colors ${
                      isBotActive 
                        ? 'bg-yellow-100 border-yellow-200 text-yellow-800 hover:bg-yellow-200' 
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Bot className={`mr-2 h-4 w-4 ${isBotActive ? 'text-yellow-600' : 'text-gray-400'}`} />
                    {isBotActive ? 'Bot Ativo' : 'Ativar Bot'}
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 p-6 overflow-y-auto" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat', opacity: 0.9 }}>
                <div className="space-y-4">
                  {messages.map((msg, idx) => {
                    const isOutbound = msg.direction === 'outbound';
                    return (
                      <div key={msg.id || idx} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                        <div 
                          className={`max-w-[75%] rounded-lg px-4 py-2 shadow-sm relative ${
                            isOutbound ? 'bg-[#d9fdd3] text-gray-900 rounded-tr-none' : 'bg-white text-gray-900 rounded-tl-none'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          <div className="flex items-center justify-end mt-1 space-x-1">
                            <span className="text-[10px] text-gray-500">
                              {formatTime(msg.timestamp)}
                            </span>
                            {isOutbound && (
                              <CheckCircle className={`h-3 w-3 ${msg.status === 'read' ? 'text-blue-500' : 'text-gray-400'}`} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input Area */}
              <div className="p-4 bg-[#f0f2f5] border-t border-gray-200">
                <form onSubmit={handleSendMessage} className="flex space-x-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={isBotActive ? "O Bot está respondendo (digite para assumir)..." : "Digite uma mensagem..."}
                    className="flex-1 block w-full rounded-full border-gray-300 shadow-sm py-3 px-5 focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
                    disabled={isSending}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || isSending}
                    className="inline-flex items-center justify-center h-12 w-12 rounded-full border border-transparent shadow-sm text-white bg-yellow-500 hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-[#f0f2f5]">
              <div className="h-24 w-24 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-medium text-gray-900">Oficina Pro Web</h3>
              <p className="mt-2 text-sm">Selecione uma conversa para começar a enviar mensagens.</p>
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      <AnimatePresence>
        {isNewConvModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setIsNewConvModalOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl text-left overflow-hidden shadow-xl w-full max-w-lg"
            >
              <form onSubmit={handleStartConversation}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                        Nova Conversa WhatsApp
                      </h3>
                      
                      {whatsappNumbers.length === 0 ? (
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                          <div className="flex">
                            <div className="ml-3">
                              <p className="text-sm text-yellow-700">
                                Você precisa configurar um número de WhatsApp nas Configurações primeiro.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Seu Número (Phone ID)</label>
                            <select
                              value={selectedNumberId}
                              onChange={(e) => setSelectedNumberId(e.target.value)}
                              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm rounded-xl"
                            >
                              {whatsappNumbers.map(num => (
                                <option key={num.id} value={num.id}>{num.phone_number}</option>
                              ))}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">Este é o ID do número fornecido pela Meta.</p>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Telefone do Cliente (com DDD)</label>
                            <input
                              type="text"
                              value={newPhone}
                              onChange={(e) => setNewPhone(e.target.value)}
                              placeholder="Ex: 5511999999999"
                              className="mt-1 block w-full border border-gray-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Nome do Cliente (Opcional)</label>
                            <input
                              type="text"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              placeholder="Ex: João Silva"
                              className="mt-1 block w-full border border-gray-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={whatsappNumbers.length === 0 || !newPhone}
                    className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-yellow-500 text-base font-medium text-white hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    Iniciar Conversa
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewConvModalOpen(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-xl border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
