import React, { useState, useEffect } from 'react';
import { FileText, Plus, CheckCircle, XCircle, X, Trash2, Calendar, Car, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function Quotes() {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [catalog, setCatalog] = useState({ services: [], parts: [] });
  
  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [items, setItems] = useState<any[]>([]);
  
  // Item form state
  const [itemType, setItemType] = useState<'service' | 'part'>('service');
  const [selectedRefId, setSelectedRefId] = useState('');
  const [itemQty, setItemQty] = useState(1);

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/quotes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setQuotes(data);
      }
    } catch (err) {
      console.error('Failed to fetch quotes', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFormData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [custRes, vehRes, catRes] = await Promise.all([
        fetch('/api/customers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/vehicles', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/catalog', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      if (custRes.ok) setCustomers(await custRes.json());
      if (vehRes.ok) setVehicles(await vehRes.json());
      if (catRes.ok) setCatalog(await catRes.json());
    } catch (err) {
      console.error('Failed to fetch form data', err);
    }
  };

  const handleOpenModal = () => {
    fetchFormData();
    setIsModalOpen(true);
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/quotes/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchQuotes();
      }
    } catch (err) {
      console.error('Failed to update quote status', err);
    }
  };

  const handleAddItem = () => {
    if (!selectedRefId) return;
    
    let unitPrice = 0;
    let name = '';
    
    if (itemType === 'service') {
      const service = catalog.services.find((s: any) => s.id === selectedRefId) as any;
      if (service) {
        unitPrice = service.default_price || 0;
        name = service.name;
      }
    } else {
      const part = catalog.parts.find((p: any) => p.id === selectedRefId) as any;
      if (part) {
        unitPrice = part.price || 0;
        name = part.name;
      }
    }
    
    setItems([...items, { type: itemType, ref_id: selectedRefId, name, qty: itemQty, unit_price: unitPrice }]);
    setSelectedRefId('');
    setItemQty(1);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !selectedVehicleId || items.length === 0) {
      alert('Preencha todos os campos e adicione pelo menos um item.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          customer_id: selectedCustomerId,
          vehicle_id: selectedVehicleId,
          items: items.map(i => ({ type: i.type, ref_id: i.ref_id, qty: i.qty, unit_price: i.unit_price }))
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setSelectedCustomerId('');
        setSelectedVehicleId('');
        setItems([]);
        fetchQuotes();
      }
    } catch (err) {
      console.error('Failed to create quote', err);
    }
  };

  const filteredVehicles = vehicles.filter(v => v.customer_id === selectedCustomerId);
  const totalAmount = items.reduce((acc, item) => acc + (item.qty * item.unit_price), 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center">
          <FileText className="mr-3 h-8 w-8 text-yellow-500" />
          Orçamentos
        </h1>
        <button
          onClick={handleOpenModal}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-bold rounded-xl shadow-sm text-gray-900 bg-yellow-500 hover:bg-yellow-400 transition-all duration-200"
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Orçamento
        </button>
      </div>

      <div className="bg-white shadow-sm overflow-hidden sm:rounded-2xl border border-gray-100">
        <ul className="divide-y divide-gray-100">
          {isLoading ? (
            <li className="p-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto"></div>
            </li>
          ) : quotes.length === 0 ? (
            <li className="p-8 text-center text-gray-500">Nenhum orçamento encontrado.</li>
          ) : (
            quotes.map((quote) => (
              <li key={quote.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${
                        quote.status === 'aceito' ? 'bg-green-100 text-green-800' :
                        quote.status === 'recusado' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {quote.status.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500 flex items-center">
                        <Calendar className="mr-1 h-4 w-4" />
                        {new Date(quote.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="flex items-center text-sm font-medium text-gray-900">
                        <User className="mr-2 h-4 w-4 text-gray-400" />
                        {quote.customer_name}
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Car className="mr-2 h-4 w-4 text-gray-400" />
                        {quote.make} {quote.model} <span className="ml-1 font-mono bg-gray-100 px-1 rounded">{quote.vehicle_plate}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end space-y-3">
                    <div className="text-lg font-bold text-gray-900 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                      R$ {quote.total_amount?.toFixed(2)}
                    </div>
                    
                    {quote.status !== 'aceito' && quote.status !== 'recusado' && (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleStatusChange(quote.id, 'aceito')}
                          className="flex items-center px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition-colors" 
                          title="Aceitar"
                        >
                          <CheckCircle className="h-4 w-4 mr-1.5" />
                          Aceitar
                        </button>
                        <button 
                          onClick={() => handleStatusChange(quote.id, 'recusado')}
                          className="flex items-center px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors" 
                          title="Recusar"
                        >
                          <XCircle className="h-4 w-4 mr-1.5" />
                          Recusar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50" onClick={() => setIsModalOpen(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl text-left overflow-hidden shadow-xl w-full max-w-3xl border border-gray-100 max-h-[90vh] flex flex-col"
            >
              <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">Novo Orçamento</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500 bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                        <select 
                          required 
                          value={selectedCustomerId} 
                          onChange={e => {
                            setSelectedCustomerId(e.target.value);
                            setSelectedVehicleId('');
                          }} 
                          className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors"
                        >
                          <option value="">Selecione um cliente</option>
                          {customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Veículo</label>
                        <select 
                          required 
                          value={selectedVehicleId} 
                          onChange={e => setSelectedVehicleId(e.target.value)} 
                          className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors disabled:bg-gray-50 disabled:text-gray-500"
                          disabled={!selectedCustomerId}
                        >
                          <option value="">Selecione um veículo</option>
                          {filteredVehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.make} {v.model} ({v.plate})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Adicionar Itens</h4>
                      <div className="flex space-x-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div className="w-1/4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                          <select 
                            value={itemType} 
                            onChange={e => {
                              setItemType(e.target.value as any);
                              setSelectedRefId('');
                            }} 
                            className="block w-full border border-gray-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors"
                          >
                            <option value="service">Serviço</option>
                            <option value="part">Peça</option>
                          </select>
                        </div>
                        <div className="w-1/2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                          <select 
                            value={selectedRefId} 
                            onChange={e => setSelectedRefId(e.target.value)} 
                            className="block w-full border border-gray-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors"
                          >
                            <option value="">Selecione um item</option>
                            {itemType === 'service' 
                              ? catalog.services.map((s: any) => <option key={s.id} value={s.id}>{s.name} - R$ {s.default_price?.toFixed(2)}</option>)
                              : catalog.parts.map((p: any) => <option key={p.id} value={p.id}>{p.name} - R$ {p.price?.toFixed(2)}</option>)
                            }
                          </select>
                        </div>
                        <div className="w-1/4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Qtd</label>
                          <div className="flex">
                            <input 
                              type="number" 
                              min="1" 
                              value={itemQty} 
                              onChange={e => setItemQty(parseInt(e.target.value) || 1)} 
                              className="block w-full border border-gray-300 rounded-l-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors" 
                            />
                            <button 
                              type="button" 
                              onClick={handleAddItem}
                              disabled={!selectedRefId}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-xl shadow-sm text-white bg-gray-800 hover:bg-gray-900 disabled:opacity-50 transition-colors"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>

                      {items.length > 0 && (
                        <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Qtd</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Preço Un.</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Subtotal</th>
                                <th className="px-4 py-3"></th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${item.type === 'service' ? 'bg-yellow-50 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                                      {item.type === 'service' ? 'Serviço' : 'Peça'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{item.qty}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">R$ {item.unit_price.toFixed(2)}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-bold">R$ {(item.qty * item.unit_price).toFixed(2)}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                    <button type="button" onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors">
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t border-gray-200">
                              <tr>
                                <td colSpan={4} className="px-4 py-4 text-right text-sm font-medium text-gray-500 uppercase">Total do Orçamento:</td>
                                <td className="px-4 py-4 text-right text-lg font-bold text-yellow-600">R$ {totalAmount.toFixed(2)}</td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-8 pt-4 border-t border-gray-100 flex flex-row-reverse gap-3">
                      <button type="submit" className="inline-flex justify-center rounded-xl border border-transparent shadow-sm px-6 py-3 bg-yellow-500 text-sm font-bold text-gray-900 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors">
                        Salvar Orçamento
                      </button>
                      <button type="button" onClick={() => setIsModalOpen(false)} className="inline-flex justify-center rounded-xl border border-gray-300 shadow-sm px-6 py-3 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors">
                        Cancelar
                      </button>
                    </div>
                  </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
