import React, { useState, useEffect } from 'react';
import { Package, Plus, X, Wrench, Box } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function Catalog() {
  const [catalog, setCatalog] = useState({ services: [], parts: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemType, setItemType] = useState<'service' | 'part'>('service');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    default_price: '',
    recall_months: '',
    sku: '',
    unit: 'un',
    cost: '',
    price: '',
    stock_qty: '',
    min_qty: ''
  });

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/catalog', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCatalog(data);
      }
    } catch (err) {
      console.error('Failed to fetch catalog', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const endpoint = itemType === 'service' ? '/api/catalog/services' : '/api/catalog/parts';
      
      const payload = itemType === 'service' 
        ? {
            name: formData.name,
            category: formData.category,
            default_price: parseFloat(formData.default_price) || 0,
            recall_months: parseInt(formData.recall_months) || 0
          }
        : {
            name: formData.name,
            sku: formData.sku,
            unit: formData.unit,
            cost: parseFloat(formData.cost) || 0,
            price: parseFloat(formData.price) || 0,
            stock_qty: parseInt(formData.stock_qty) || 0,
            min_qty: parseInt(formData.min_qty) || 0
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setFormData({
          name: '', category: '', default_price: '', recall_months: '', sku: '', unit: 'un', cost: '', price: '', stock_qty: '', min_qty: ''
        });
        fetchCatalog();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Erro ao salvar item');
      }
    } catch (err) {
      console.error('Failed to save item', err);
      alert('Erro de conexão ao salvar item');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center">
          <Package className="mr-3 h-8 w-8 text-yellow-500" />
          Estoque / Catálogo
        </h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-bold rounded-xl shadow-sm text-gray-900 bg-yellow-500 hover:bg-yellow-400 transition-all duration-200"
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Item
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Services */}
        <div className="bg-white shadow-sm overflow-hidden sm:rounded-2xl border border-gray-100">
          <div className="px-6 py-5 border-b border-gray-100 bg-white flex items-center">
            <div className="p-2 bg-yellow-50 rounded-lg mr-3">
              <Wrench className="h-5 w-5 text-yellow-600" />
            </div>
            <h3 className="text-lg leading-6 font-semibold text-gray-900">Serviços</h3>
          </div>
          <ul className="divide-y divide-gray-100">
            {isLoading ? (
              <li className="p-8 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto"></div>
              </li>
            ) : catalog.services.length === 0 ? (
              <li className="p-8 text-center text-gray-500">Nenhum serviço cadastrado.</li>
            ) : (
              catalog.services.map((service: any) => (
                <li key={service.id} className="px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{service.name}</p>
                    <div className="flex items-center mt-1 space-x-2">
                      <p className="text-xs text-gray-500 inline-block bg-gray-100 px-2 py-1 rounded-md">{service.category}</p>
                      {service.recall_months > 0 && (
                        <span className="text-xs text-purple-700 bg-purple-50 px-2 py-1 rounded-md font-medium">
                          Recall: {service.recall_months} meses
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gray-900 bg-green-50 text-green-700 px-3 py-1 rounded-lg">
                    R$ {service.default_price?.toFixed(2)}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Parts */}
        <div className="bg-white shadow-sm overflow-hidden sm:rounded-2xl border border-gray-100">
          <div className="px-6 py-5 border-b border-gray-100 bg-white flex items-center">
            <div className="p-2 bg-gray-100 rounded-lg mr-3">
              <Box className="h-5 w-5 text-gray-600" />
            </div>
            <h3 className="text-lg leading-6 font-semibold text-gray-900">Peças em Estoque</h3>
          </div>
          <ul className="divide-y divide-gray-100">
            {isLoading ? (
              <li className="p-8 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto"></div>
              </li>
            ) : catalog.parts.length === 0 ? (
              <li className="p-8 text-center text-gray-500">Nenhuma peça cadastrada.</li>
            ) : (
              catalog.parts.map((part: any) => (
                <li key={part.id} className="px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{part.name}</p>
                    <div className="flex items-center mt-1 space-x-2">
                      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">SKU: {part.sku}</span>
                      <span className={`text-xs px-2 py-1 rounded font-medium ${part.stock_qty <= part.min_qty ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                        Estoque: {part.stock_qty} {part.unit}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gray-900 bg-green-50 text-green-700 px-3 py-1 rounded-lg">
                    R$ {part.price?.toFixed(2)}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
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
              className="bg-white rounded-2xl text-left overflow-hidden shadow-xl w-full max-w-lg border border-gray-100 max-h-[90vh] flex flex-col"
            >
              <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">Adicionar Novo Item</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500 bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Tipo de Item</label>
                  <div className="flex space-x-4">
                    <label className={`flex-1 flex items-center justify-center px-4 py-3 border rounded-xl cursor-pointer transition-colors ${itemType === 'service' ? 'border-yellow-500 bg-yellow-50 text-yellow-800' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" className="sr-only" name="itemType" value="service" checked={itemType === 'service'} onChange={() => setItemType('service')} />
                      <Wrench className={`mr-2 h-5 w-5 ${itemType === 'service' ? 'text-yellow-600' : 'text-gray-400'}`} />
                      <span className="font-medium">Serviço</span>
                    </label>
                    <label className={`flex-1 flex items-center justify-center px-4 py-3 border rounded-xl cursor-pointer transition-colors ${itemType === 'part' ? 'border-yellow-500 bg-yellow-50 text-yellow-800' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" className="sr-only" name="itemType" value="part" checked={itemType === 'part'} onChange={() => setItemType('part')} />
                      <Box className={`mr-2 h-5 w-5 ${itemType === 'part' ? 'text-yellow-600' : 'text-gray-400'}`} />
                      <span className="font-medium">Peça</span>
                    </label>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                      <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors" placeholder="Ex: Troca de Óleo" />
                    </div>

                    {itemType === 'service' ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                            <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors" placeholder="Ex: Manutenção Preventiva" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Preço Padrão (R$)</label>
                            <input type="number" step="0.01" value={formData.default_price} onChange={e => setFormData({...formData, default_price: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors" placeholder="0.00" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Período de Retorno / Recall (Meses)</label>
                          <input type="number" min="0" value={formData.recall_months} onChange={e => setFormData({...formData, recall_months: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors" placeholder="Ex: 6 (Deixe 0 se não houver)" />
                          <p className="mt-1 text-xs text-gray-500">Tempo estimado até que o cliente precise realizar este serviço novamente.</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                            <input type="text" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors font-mono" placeholder="COD-123" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                            <input type="text" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors" placeholder="un, kg, l" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Custo (R$)</label>
                            <input type="number" step="0.01" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors" placeholder="0.00" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Venda (R$)</label>
                            <input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors" placeholder="0.00" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Qtd Estoque</label>
                            <input type="number" value={formData.stock_qty} onChange={e => setFormData({...formData, stock_qty: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors" placeholder="0" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Mínimo</label>
                            <input type="number" value={formData.min_qty} onChange={e => setFormData({...formData, min_qty: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm transition-colors" placeholder="0" />
                          </div>
                        </div>
                      </>
                    )}
                    
                    <div className="mt-8 pt-4 border-t border-gray-100 flex flex-row-reverse gap-3">
                      <button type="submit" className="inline-flex justify-center rounded-xl border border-transparent shadow-sm px-6 py-3 bg-yellow-500 text-sm font-bold text-gray-900 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors">
                        Salvar Item
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
