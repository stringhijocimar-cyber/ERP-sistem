import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, statusColor } from '../utils/formatters';
import { Plus, Pencil, Trash2, X, Search, ShoppingCart, Eye } from 'lucide-react';

function Modal({ title, onClose, wide, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const paymentMethods = ['Boleto', 'Cartão de Crédito', 'Cartão de Débito', 'PIX', 'Transferência', 'Dinheiro'];
const orderStatuses = ['Pendente', 'Em andamento', 'Entregue', 'Cancelado'];

export default function Sales() {
  const { salesOrders, addOrder, updateOrder, deleteOrder, customers, products } = useApp();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [modal, setModal] = useState(null); // null | { mode, id? } | { mode: 'view', order }
  const [form, setForm] = useState({});
  const [items, setItems] = useState([]);

  const filtered = salesOrders.filter(o => {
    const customer = customers.find(c => c.id === o.customerId);
    const matchSearch = o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
                        (customer?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'Todos' || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const openAdd = () => {
    const nextNum = `PED-2024-${String(salesOrders.length + 1).padStart(3, '0')}`;
    setForm({
      orderNumber: nextNum,
      customerId: customers[0]?.id || '',
      date: new Date().toISOString().slice(0, 10),
      dueDate: '',
      status: 'Pendente',
      paymentMethod: 'PIX',
      notes: '',
    });
    setItems([{ productId: products[0]?.id || '', qty: 1, price: products[0]?.salePrice || 0 }]);
    setModal({ mode: 'add' });
  };

  const openEdit = (order) => {
    setForm({ ...order });
    setItems(order.items.map(i => ({ ...i })));
    setModal({ mode: 'edit', id: order.id });
  };

  const openView = (order) => setModal({ mode: 'view', order });

  const handleProductChange = (idx, productId) => {
    const product = products.find(p => p.id === Number(productId));
    setItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, productId: Number(productId), price: product?.salePrice || 0 } : item
    ));
  };

  const addItem = () => setItems(prev => [...prev, { productId: products[0]?.id || '', qty: 1, price: products[0]?.salePrice || 0 }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx, field, value) => setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  const total = items.reduce((s, item) => s + (parseFloat(item.price) || 0) * (parseInt(item.qty) || 0), 0);

  const handleSave = () => {
    if (!form.customerId || items.length === 0) return;
    const data = { ...form, customerId: Number(form.customerId), items, total };
    modal.mode === 'add' ? addOrder(data) : updateOrder(modal.id, data);
    setModal(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Excluir este pedido?')) deleteOrder(id);
  };

  const totalRevenue = salesOrders.filter(o => o.status === 'Entregue').reduce((s, o) => s + o.total, 0);
  const pendingRevenue = salesOrders.filter(o => o.status === 'Em andamento' || o.status === 'Pendente').reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card"><p className="text-sm text-gray-500">Total de Pedidos</p><p className="text-2xl font-bold mt-1">{salesOrders.length}</p></div>
        <div className="card"><p className="text-sm text-gray-500">Receita (Entregues)</p><p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalRevenue)}</p></div>
        <div className="card"><p className="text-sm text-gray-500">Em Aberto</p><p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(pendingRevenue)}</p></div>
        <div className="card"><p className="text-sm text-gray-500">Cancelados</p><p className="text-2xl font-bold text-red-500 mt-1">{salesOrders.filter(o => o.status === 'Cancelado').length}</p></div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-b">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
                placeholder="Buscar pedido..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              {['Todos', ...orderStatuses].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Pedido
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header">Pedido</th>
                <th className="table-header">Cliente</th>
                <th className="table-header">Data</th>
                <th className="table-header">Entrega</th>
                <th className="table-header">Pagamento</th>
                <th className="table-header">Total</th>
                <th className="table-header">Status</th>
                <th className="table-header">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(order => {
                const customer = customers.find(c => c.id === order.customerId);
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium text-blue-600">{order.orderNumber}</td>
                    <td className="table-cell">{customer?.name?.split(' ').slice(0, 2).join(' ') || '-'}</td>
                    <td className="table-cell">{formatDate(order.date)}</td>
                    <td className="table-cell">{formatDate(order.dueDate)}</td>
                    <td className="table-cell">{order.paymentMethod}</td>
                    <td className="table-cell font-semibold">{formatCurrency(order.total)}</td>
                    <td className="table-cell"><span className={statusColor(order.status)}>{order.status}</span></td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        <button onClick={() => openView(order)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => openEdit(order)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(order.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>Nenhum pedido encontrado</p>
            </div>
          )}
        </div>
        <div className="px-6 py-3 border-t text-sm text-gray-500">{filtered.length} de {salesOrders.length} pedidos</div>
      </div>

      {/* View Modal */}
      {modal?.mode === 'view' && (
        <Modal title={`Pedido ${modal.order.orderNumber}`} onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Cliente:</span> <strong>{customers.find(c => c.id === modal.order.customerId)?.name}</strong></div>
              <div><span className="text-gray-500">Status:</span> <span className={`ml-1 ${statusColor(modal.order.status)}`}>{modal.order.status}</span></div>
              <div><span className="text-gray-500">Data:</span> <strong>{formatDate(modal.order.date)}</strong></div>
              <div><span className="text-gray-500">Entrega:</span> <strong>{formatDate(modal.order.dueDate)}</strong></div>
              <div><span className="text-gray-500">Pagamento:</span> <strong>{modal.order.paymentMethod}</strong></div>
              {modal.order.notes && <div className="col-span-2"><span className="text-gray-500">Observações:</span> {modal.order.notes}</div>}
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Itens do Pedido</h4>
              <table className="w-full text-sm border-collapse">
                <thead><tr className="bg-gray-50"><th className="p-2 text-left">Produto</th><th className="p-2 text-center">Qtd</th><th className="p-2 text-right">Unitário</th><th className="p-2 text-right">Total</th></tr></thead>
                <tbody>
                  {modal.order.items.map((item, i) => {
                    const product = products.find(p => p.id === item.productId);
                    return (
                      <tr key={i} className="border-t">
                        <td className="p-2">{product?.name || 'Produto'}</td>
                        <td className="p-2 text-center">{item.qty}</td>
                        <td className="p-2 text-right">{formatCurrency(item.price)}</td>
                        <td className="p-2 text-right font-semibold">{formatCurrency(item.price * item.qty)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 font-bold">
                    <td colSpan={3} className="p-2 text-right">Total:</td>
                    <td className="p-2 text-right text-blue-600">{formatCurrency(modal.order.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {/* Add/Edit Modal */}
      {(modal?.mode === 'add' || modal?.mode === 'edit') && (
        <Modal title={modal.mode === 'add' ? 'Novo Pedido' : 'Editar Pedido'} onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nº do Pedido</label>
                <input className="input bg-gray-50" value={form.orderNumber || ''} readOnly />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data do Pedido</label>
                <input type="date" className="input" value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                <select className="input" value={form.customerId || ''} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Previsão de Entrega</label>
                <input type="date" className="input" value={form.dueDate || ''} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento</label>
                <select className="input" value={form.paymentMethod || ''} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                  {paymentMethods.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select className="input" value={form.status || ''} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {orderStatuses.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Itens do Pedido</label>
                <button onClick={addItem} className="text-blue-600 text-sm hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar item</button>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6">
                      <select className="input text-sm" value={item.productId || ''} onChange={e => handleProductChange(idx, e.target.value)}>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input type="number" min="1" className="input text-sm" placeholder="Qtd" value={item.qty || ''} onChange={e => updateItem(idx, 'qty', parseInt(e.target.value) || 1)} />
                    </div>
                    <div className="col-span-3">
                      <input type="number" step="0.01" className="input text-sm" placeholder="Preço" value={item.price || ''} onChange={e => updateItem(idx, 'price', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {items.length > 1 && (
                        <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-3 pt-3 border-t">
                <span className="text-lg font-bold text-gray-800">Total: {formatCurrency(total)}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea className="input resize-none" rows={2} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} className="btn-primary">Salvar Pedido</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
