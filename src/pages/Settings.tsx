import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Terminal, Key, Shield, Users, Plus, X, Trash2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const WebhookLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/webhook-logs');
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Logs do Webhook (Últimos 20)</h3>
        <button 
          onClick={fetchLogs}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>
      
      {logs.length === 0 ? (
        <p className="text-gray-500 text-sm">Nenhum log recebido ainda.</p>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {logs.map((log, i) => (
            <div key={i} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-500 mb-2">{new Date(log.time).toLocaleString()}</div>
              <pre className="text-xs text-gray-800 whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(log.body, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ApiLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/api-logs');
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Logs de Envio de Mensagem (Últimos 20)</h3>
        <button 
          onClick={fetchLogs}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>
      
      {logs.length === 0 ? (
        <p className="text-gray-500 text-sm">Nenhum log de envio ainda.</p>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {logs.map((log, i) => (
            <div key={i} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-500 mb-2">{new Date(log.time).toLocaleString()}</div>
              <div className="mb-2">
                <span className="font-semibold text-xs text-gray-700">Payload:</span>
                <pre className="text-xs text-gray-800 whitespace-pre-wrap overflow-x-auto mt-1">
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              </div>
              <div>
                <span className="font-semibold text-xs text-gray-700">Tentativas:</span>
                {log.attempts.map((attempt: any, j: number) => (
                  <div key={j} className="mt-1 p-2 bg-gray-100 rounded border border-gray-200">
                    <div className="text-xs font-mono text-gray-600">{attempt.url} - Status: {attempt.status}</div>
                    <pre className="text-xs text-gray-800 whitespace-pre-wrap overflow-x-auto mt-1">
                      {attempt.response}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export function Settings() {
  const [isDevAreaOpen, setIsDevAreaOpen] = useState(false);
  const [whatsappApiKey, setWhatsappApiKey] = useState('');
  const [whatsappPhoneId, setWhatsappPhoneId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [generalSaveMessage, setGeneralSaveMessage] = useState('');
  
  // Admin state
  const [user, setUser] = useState<any>(null);
  const [isAccountsModalOpen, setIsAccountsModalOpen] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  
  // New account form state
  const [newAccount, setNewAccount] = useState({
    companyName: '',
    username: '',
    password: '',
    name: '',
    plan: 'Core Operacional'
  });
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [updatingPlanId, setUpdatingPlanId] = useState<string | null>(null);

  useEffect(() => {
    // Load saved settings
    const savedApiKey = localStorage.getItem('whatsapp_api_key') || '';
    const savedPhoneId = localStorage.getItem('whatsapp_phone_id') || '';
    setWhatsappApiKey(savedApiKey);
    setWhatsappPhoneId(savedPhoneId);
    
    // Load user
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleSaveGeneralSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralSaveMessage('Configurações salvas com sucesso!');
    setTimeout(() => setGeneralSaveMessage(''), 3000);
  };

  const handleSaveDevSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Save to localStorage for MVP purposes
    localStorage.setItem('whatsapp_api_key', whatsappApiKey);
    localStorage.setItem('whatsapp_phone_id', whatsappPhoneId);
    
    try {
      const token = localStorage.getItem('token');
      
      // Se for 360dialog, o usuário pode não ter um phone_number_id da Meta. 
      // Vamos gerar um dummy se estiver vazio para não quebrar o banco.
      const finalPhoneId = whatsappPhoneId.trim() || `360-${Date.now()}`;
      
      // Also register the number in the backend so the webhook can find it
      const res = await fetch('/api/whatsapp/numbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          phone_number_id: finalPhoneId,
          phone_number: finalPhoneId, // Using ID as fallback for phone number
          access_token: whatsappApiKey,
          waba_id: 'default'
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao salvar no servidor');
      }
      
      setIsSaving(false);
      setSaveMessage('Configurações salvas com sucesso!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error: any) {
      console.error('Failed to save WhatsApp settings to backend', error);
      setIsSaving(false);
      setSaveMessage(error.message || 'Erro ao salvar no servidor.');
    }
  };

  const handleRegister360Webhook = async () => {
    try {
      const token = localStorage.getItem('token');
      // Use the current origin dynamically
      const webhookUrl = `${window.location.origin}/webhooks/360dialog`;
      
      const res = await fetch('/api/360dialog/set-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ webhook_url: webhookUrl })
      });
      
      const data = await res.json();
      if (res.ok) {
        alert('Webhook configurado com sucesso na 360dialog!\nURL: ' + webhookUrl);
      } else {
        const details = data.details ? JSON.stringify(data.details) : '';
        alert('Erro ao configurar webhook: ' + (data.error || 'Erro desconhecido') + '\n' + details);
      }
    } catch (error) {
      console.error('Failed to register webhook', error);
      alert('Erro de conexão ao tentar configurar o webhook.');
    }
  };

  const loadAccounts = async () => {
    setIsLoadingAccounts(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/accounts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch (error) {
      console.error('Failed to load accounts', error);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const handleOpenAccountsModal = () => {
    setIsAccountsModalOpen(true);
    loadAccounts();
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingAccount(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newAccount)
      });
      
      if (res.ok) {
        setNewAccount({ companyName: '', username: '', password: '', name: '', plan: 'Core Operacional' });
        loadAccounts();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao criar conta');
      }
    } catch (error) {
      console.error('Failed to create account', error);
      alert('Erro ao criar conta');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleDeleteAccount = async (tenantId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.')) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/accounts/${tenantId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        loadAccounts();
      } else {
        alert('Erro ao excluir conta');
      }
    } catch (error) {
      console.error('Failed to delete account', error);
    }
  };

  const handleUpdatePlan = async (tenantId: string, plan: string) => {
    setUpdatingPlanId(tenantId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/accounts/${tenantId}/plan`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      });
      
      if (res.ok) {
        loadAccounts();
      } else {
        alert('Erro ao atualizar plano');
      }
    } catch (error) {
      console.error('Failed to update plan', error);
      alert('Erro ao atualizar plano');
    } finally {
      setUpdatingPlanId(null);
    }
  };

  const isSuperAdmin = user?.role === 'SuperAdmin';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center">
          <SettingsIcon className="mr-3 h-8 w-8 text-yellow-500" />
          Configurações
        </h1>
      </div>

      <div className="bg-white shadow-sm sm:rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Configurações Gerais</h2>
          
          <form onSubmit={handleSaveGeneralSettings} className="space-y-6 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Oficina</label>
              <input 
                type="text" 
                defaultValue="Oficina Pro"
                className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail de Contato</label>
              <input 
                type="email" 
                defaultValue="contato@oficinapro.com.br"
                className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors" 
              />
            </div>

            <div className="pt-4 flex items-center">
              <button type="submit" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-bold rounded-xl shadow-sm text-gray-900 bg-yellow-500 hover:bg-yellow-400 transition-all duration-200">
                <Save className="mr-2 h-4 w-4" />
                Salvar Alterações
              </button>
              {generalSaveMessage && (
                <span className="ml-4 text-sm text-green-600 font-medium flex items-center">
                  {generalSaveMessage}
                </span>
              )}
            </div>
          </form>
        </div>
        
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 flex justify-end">
          <button 
            onClick={() => setIsDevAreaOpen(!isDevAreaOpen)}
            className="text-xs font-mono text-gray-500 hover:text-gray-900 flex items-center transition-colors"
          >
            <Terminal className="h-3 w-3 mr-1" />
            Área DEV
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isDevAreaOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-900 shadow-sm sm:rounded-2xl border border-gray-800 overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center">
                  <Terminal className="h-6 w-6 text-yellow-500 mr-3" />
                  <h2 className="text-xl font-semibold text-white">Área do Desenvolvedor</h2>
                </div>
                <div className="flex items-center space-x-4">
                  {isSuperAdmin && (
                    <button
                      onClick={handleOpenAccountsModal}
                      className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 text-sm font-bold px-4 py-2 rounded-xl flex items-center transition-colors"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Administrar Contas
                    </button>
                  )}
                  <span className="bg-red-500/10 text-red-400 text-xs font-bold px-3 py-1 rounded-full flex items-center">
                    <Shield className="h-3 w-3 mr-1" />
                    Zona de Perigo
                  </span>
                </div>
              </div>
              
              <div className="p-8">
                <div className="mb-6 bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                  <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center">
                    <Key className="h-4 w-4 mr-2 text-yellow-500" />
                    Integração WhatsApp Business API (Meta)
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Insira suas credenciais da API Oficial do WhatsApp para habilitar o espelhamento de conversas na Central Inteligente. 
                    O sistema utilizará essas chaves para enviar e receber mensagens diretamente do seu número comercial.
                  </p>
                </div>

                <form onSubmit={handleSaveDevSettings} className="space-y-6 max-w-2xl">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">WhatsApp API Token (Access Token)</label>
                    <input 
                      type="password" 
                      value={whatsappApiKey}
                      onChange={(e) => setWhatsappApiKey(e.target.value)}
                      placeholder="EAA..."
                      className="block w-full bg-gray-800 border border-gray-700 rounded-xl shadow-sm py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors font-mono" 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number ID</label>
                    <input 
                      type="text" 
                      value={whatsappPhoneId}
                      onChange={(e) => setWhatsappPhoneId(e.target.value)}
                      placeholder="101234567890123"
                      className="block w-full bg-gray-800 border border-gray-700 rounded-xl shadow-sm py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors font-mono" 
                    />
                  </div>

                  <div className="pt-4 flex items-center space-x-4">
                    <button 
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-bold rounded-xl shadow-sm text-gray-900 bg-yellow-500 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-yellow-500 transition-all duration-200 disabled:opacity-50"
                    >
                      {isSaving ? 'Salvando...' : 'Salvar Credenciais'}
                    </button>
                    
                    <button 
                      type="button"
                      onClick={handleRegister360Webhook}
                      className="inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-bold rounded-xl shadow-sm text-white bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-500 transition-all duration-200"
                    >
                      Configurar Webhook 360dialog
                    </button>
                    
                    {saveMessage && (
                      <span className="text-sm text-green-400 flex items-center">
                        {saveMessage}
                      </span>
                    )}
                  </div>
                </form>
                
                <div className="mt-8 border-t border-gray-800 pt-6">
                  <WebhookLogs />
                </div>
                
                <div className="mt-8 border-t border-gray-800 pt-6">
                  <ApiLogs />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Accounts Modal */}
      <AnimatePresence>
        {isAccountsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-yellow-500" />
                  Administrar Contas (Estabelecimentos)
                </h2>
                <button 
                  onClick={() => setIsAccountsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-8">
                {/* Create Account Form */}
                <div className="w-full md:w-1/3 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Nova Conta</h3>
                  <form onSubmit={handleCreateAccount} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Estabelecimento</label>
                      <input 
                        type="text" 
                        required
                        value={newAccount.companyName}
                        onChange={e => setNewAccount({...newAccount, companyName: e.target.value})}
                        className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Responsável</label>
                      <input 
                        type="text" 
                        required
                        value={newAccount.name}
                        onChange={e => setNewAccount({...newAccount, name: e.target.value})}
                        className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Usuário (Login)</label>
                      <input 
                        type="text" 
                        required
                        value={newAccount.username}
                        onChange={e => setNewAccount({...newAccount, username: e.target.value})}
                        className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                      <input 
                        type="password" 
                        required
                        value={newAccount.password}
                        onChange={e => setNewAccount({...newAccount, password: e.target.value})}
                        className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Plano</label>
                      <select 
                        required
                        value={newAccount.plan}
                        onChange={e => setNewAccount({...newAccount, plan: e.target.value})}
                        className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm" 
                      >
                        <option value="Core Operacional">Core Operacional (R$ 397)</option>
                        <option value="Central Inteligente">Central Inteligente (R$ 697)</option>
                      </select>
                    </div>
                    <button 
                      type="submit"
                      disabled={isCreatingAccount}
                      className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-gray-900 bg-yellow-500 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
                    >
                      {isCreatingAccount ? 'Criando...' : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Criar Conta
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Accounts List */}
                <div className="w-full md:w-2/3">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Contas Ativas</h3>
                  {isLoadingAccounts ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estabelecimento</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plano</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimento</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {accounts.map((acc) => {
                            const isExpired = acc.plan_expires_at && new Date(acc.plan_expires_at) < new Date();
                            return (
                            <tr key={acc.tenant_id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{acc.tenant_name}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{acc.email}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {acc.email !== 'hardsolutions' ? (
                                  <select
                                    value={acc.plan || 'Core Operacional'}
                                    onChange={(e) => handleUpdatePlan(acc.tenant_id, e.target.value)}
                                    disabled={updatingPlanId === acc.tenant_id}
                                    className="block w-full border border-gray-300 rounded-lg shadow-sm py-1 px-2 focus:ring-yellow-500 focus:border-yellow-500 sm:text-xs"
                                  >
                                    <option value="Core Operacional">Core Operacional</option>
                                    <option value="Central Inteligente">Central Inteligente</option>
                                  </select>
                                ) : (
                                  <span className="px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full bg-gray-100 text-gray-800">
                                    Admin
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {acc.email !== 'hardsolutions' && acc.plan_expires_at ? (
                                  <span className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full ${isExpired ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                    {new Date(acc.plan_expires_at).toLocaleDateString()}
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                {acc.email !== 'hardsolutions' && (
                                  <div className="flex justify-end space-x-2">
                                    <button 
                                      onClick={() => handleUpdatePlan(acc.tenant_id, acc.plan || 'Core Operacional')}
                                      className="text-blue-600 hover:text-blue-900 transition-colors text-xs font-medium"
                                      title="Renovar por 30 dias"
                                      disabled={updatingPlanId === acc.tenant_id}
                                    >
                                      Renovar
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteAccount(acc.tenant_id)}
                                      className="text-red-600 hover:text-red-900 transition-colors"
                                      title="Excluir conta"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )})}
                          {accounts.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                                Nenhuma conta encontrada.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
