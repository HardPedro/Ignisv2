import React, { useState, useEffect } from 'react';
import { Wrench, CheckCircle, Play, Calendar, Car, User, Plus, X, Trash2, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function WorkOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('todas');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [catalog, setCatalog] = useState({ services: [], parts: [] });
  
  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');
  
  // Item form state
  const [itemType, setItemType] = useState<'service' | 'part'>('service');
  const [selectedRefId, setSelectedRefId] = useState('');
  const [itemQty, setItemQty] = useState(1);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/work-orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to fetch work orders', err);
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
    setError('');

    let finalItems = [...items];

    // Auto-add item if selected but not added
    if (selectedRefId) {
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
      
      finalItems.push({ type: itemType, ref_id: selectedRefId, name, qty: itemQty, unit_price: unitPrice });
    }

    if (!selectedCustomerId || !selectedVehicleId || finalItems.length === 0) {
      setError('Preencha todos os campos e adicione pelo menos um item.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          customer_id: selectedCustomerId,
          vehicle_id: selectedVehicleId,
          items: finalItems.map(i => ({ type: i.type, ref_id: i.ref_id, qty: i.qty, unit_price: i.unit_price }))
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setSelectedCustomerId('');
        setSelectedVehicleId('');
        setItems([]);
        setSelectedRefId('');
        setItemQty(1);
        setError('');
        fetchOrders();
      } else {
        setError('Erro ao salvar a Ordem de Serviço.');
      }
    } catch (err) {
      console.error('Failed to create work order', err);
      setError('Erro ao salvar a Ordem de Serviço.');
    }
  };

  const filteredVehicles = vehicles.filter(v => v.customer_id === selectedCustomerId);
  const totalAmount = items.reduce((sum, item) => sum + (item.qty * item.unit_price), 0);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/work-orders/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchOrders();
      }
    } catch (err) {
      console.error('Failed to update work order status', err);
    }
  };

  const filteredOrders = statusFilter === 'todas' 
    ? orders 
    : orders.filter(order => order.status === statusFilter);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center">
          <Wrench className="mr-3 h-8 w-8 text-yellow-500" />
          Ordens de Serviço
        </h1>
        
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-gray-400" />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full pl-10 pr-10 py-2 text-sm border-gray-300 rounded-xl focus:ring-yellow-500 focus:border-yellow-500 border bg-white shadow-sm"
            >
              <option value="todas">Todas as OS</option>
              <option value="aberta">Abertas</option>
              <option value="em execução">Em Execução</option>
              <option value="fechada">Fechadas</option>
              <option value="cancelada">Canceladas</option>
            </select>
          </div>

          <button
            onClick={handleOpenModal}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-bold rounded-xl shadow-sm text-gray-900 bg-yellow-500 hover:bg-yellow-400 transition-all duration-200 whitespace-nowrap"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova OS
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm overflow-hidden sm:rounded-2xl border border-gray-100">
        <ul className="divide-y divide-gray-100">
          {isLoading ? (
            <li className="p-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto"></div>
            </li>
          ) : filteredOrders.length === 0 ? (
            <li className="p-8 text-center text-gray-500">Nenhuma OS encontrada com este filtro.</li>
          ) : (
            filteredOrders.map((order, index) => (
              <motion.li 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                key={order.id} 
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${
                        order.status === 'fechada' ? 'bg-gray-100 text-gray-800' :
                        order.status === 'em execução' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {order.status.toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md">
                        OS #{order.id.split('-')[0].substring(0, 8)}
                      </span>
                      <span className="text-sm text-gray-500 flex items-center">
                        <Calendar className="mr-1 h-4 w-4" />
                        {new Date(order.opened_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="flex items-center text-sm font-medium text-gray-900">
                        <User className="mr-2 h-4 w-4 text-gray-400" />
                        {order.customer_name}
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Car className="mr-2 h-4 w-4 text-gray-400" />
                        {order.make} {order.model} <span className="ml-1 font-mono bg-gray-100 px-1 rounded">{order.vehicle_plate}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right mr-4">
                      <p className="text-xs text-gray-500">Valor Total</p>
                      <p className="text-sm font-bold text-gray-900">R$ {order.total_amount?.toFixed(2)}</p>
                    </div>
                    {order.status !== 'fechada' && (
                      <div className="flex space-x-2">
                        {order.status === 'aberta' && (
                          <button 
                            onClick={() => handleStatusChange(order.id, 'em execução')}
                            className="flex items-center px-4 py-2 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 rounded-xl text-sm font-medium transition-colors" 
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Iniciar Execução
                          </button>
                        )}
                        {order.status === 'em execução' && (
                          <button 
                            onClick={() => handleStatusChange(order.id, 'fechada')}
                            className="flex items-center px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl text-sm font-medium transition-colors" 
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Finalizar OS
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.li>
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
                <h3 className="text-xl font-bold text-gray-900">Nova Ordem de Serviço</h3>
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
                        disabled={!selectedCustomerId}
                        className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors disabled:bg-gray-50 disabled:text-gray-500"
                      >
                        <option value="">Selecione um veículo</option>
                        {filteredVehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.make} {v.model} - {v.plate}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Adicionar Itens</h4>
                    
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
                      <div className="grid grid-cols-12 gap-4 items-end">
                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
                          <select 
                            value={itemType} 
                            onChange={e => {
                              setItemType(e.target.value as 'service' | 'part');
                              setSelectedRefId('');
                            }}
                            className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
                          >
                            <option value="service">Serviço</option>
                            <option value="part">Peça</option>
                          </select>
                        </div>
                        <div className="col-span-6">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Item</label>
                          <select 
                            value={selectedRefId} 
                            onChange={e => setSelectedRefId(e.target.value)}
                            className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
                          >
                            <option value="">Selecione...</option>
                            {itemType === 'service' 
                              ? catalog.services.map((s: any) => <option key={s.id} value={s.id}>{s.name} - R$ {s.default_price?.toFixed(2)}</option>)
                              : catalog.parts.map((p: any) => <option key={p.id} value={p.id}>{p.name} - R$ {p.price?.toFixed(2)}</option>)
                            }
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Qtd</label>
                          <input 
                            type="number" 
                            min="1" 
                            step={itemType === 'part' ? '1' : '0.1'}
                            value={itemQty} 
                            onChange={e => setItemQty(parseFloat(e.target.value) || 1)}
                            className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
                          />
                        </div>
                        <div className="col-span-1">
                          <button 
                            type="button" 
                            onClick={handleAddItem}
                            disabled={!selectedRefId}
                            className="w-full flex justify-center items-center py-2 px-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-gray-900 bg-yellow-500 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 transition-colors"
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {items.length > 0 && (
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qtd</th>
                              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Preço Un.</th>
                              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                              <th scope="col" className="relative px-4 py-3"><span className="sr-only">Ações</span></th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {items.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  <span className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full ${item.type === 'service' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
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
                              <td colSpan={4} className="px-4 py-4 text-right text-sm font-medium text-gray-500 uppercase">Total da OS:</td>
                              <td className="px-4 py-4 text-right text-lg font-bold text-yellow-600">R$ {totalAmount.toFixed(2)}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-8 pt-4 border-t border-gray-100 flex flex-col gap-3">
                    {error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                        {error}
                      </div>
                    )}
                    <div className="flex flex-row-reverse gap-3">
                      <button type="submit" className="inline-flex justify-center rounded-xl border border-transparent shadow-sm px-6 py-3 bg-yellow-500 text-sm font-bold text-gray-900 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors">
                        Salvar OS
                      </button>
                      <button type="button" onClick={() => setIsModalOpen(false)} className="inline-flex justify-center rounded-xl border border-gray-300 shadow-sm px-6 py-3 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors">
                        Cancelar
                      </button>
                    </div>
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
