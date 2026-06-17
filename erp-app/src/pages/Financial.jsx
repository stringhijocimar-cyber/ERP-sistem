import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, statusColor } from '../utils/formatters';
import { Plus, Pencil, Trash2, Check, X, DollarSign, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const emptyReceivable = { description: '', dueDate: '', amount: '', status: 'Pendente', category: 'Venda' };
const emptyPayable = { description: '', dueDate: '', amount: '', status: 'Pendente', category: 'Compra' };

export default function Financial() {
  const { accountsReceivable, addReceivable, updateReceivable, deleteReceivable,
          accountsPayable, addPayable, updatePayable, deletePayable } = useApp();

  const [tab, setTab] = useState('receivable'); // 'receivable' | 'payable'
  const [modal, setModal] = useState(null); // null | { mode: 'add'|'edit', data, type }
  const [form, setForm] = useState({});

  const openAdd = (type) => {
    const empty = type === 'receivable' ? emptyReceivable : emptyPayable;
    setForm({ ...empty });
    setModal({ mode: 'add', type });
  };

  const openEdit = (type, item) => {
    setForm({ ...item });
    setModal({ mode: 'edit', type, id: item.id });
  };

  const handleSave = () => {
    if (!form.description || !form.dueDate || !form.amount) return;
    const data = { ...form, amount: parseFloat(form.amount) };
    if (modal.type === 'receivable') {
      modal.mode === 'add' ? addReceivable(data) : updateReceivable(modal.id, data);
    } else {
      modal.mode === 'add' ? addPayable(data) : updatePayable(modal.id, data);
    }
    setModal(null);
  };

  const handleDelete = (type, id) => {
    if (window.confirm('Confirmar exclusão?')) {
      type === 'receivable' ? deleteReceivable(id) : deletePayable(id);
    }
  };

  const markAsPaid = (type, id) => {
    const today = new Date().toISOString().slice(0, 10);
    if (type === 'receivable') updateReceivable(id, { status: 'Pago', paymentDate: today });
    else updatePayable(id, { status: 'Pago', paymentDate: today });
  };

  const totalAR = accountsReceivable.reduce((s, r) => s + r.amount, 0);
  const paidAR = accountsReceivable.filter(r => r.status === 'Pago').reduce((s, r) => s + r.amount, 0);
  const pendingAR = accountsReceivable.filter(r => r.status === 'Pendente').reduce((s, r) => s + r.amount, 0);
  const overdueAR = accountsReceivable.filter(r => r.status === 'Vencido').reduce((s, r) => s + r.amount, 0);

  const totalAP = accountsPayable.reduce((s, p) => s + p.amount, 0);
  const paidAP = accountsPayable.filter(p => p.status === 'Pago').reduce((s, p) => s + p.amount, 0);
  const pendingAP = accountsPayable.filter(p => p.status === 'Pendente').reduce((s, p) => s + p.amount, 0);
  const overdueAP = accountsPayable.filter(p => p.status === 'Vencido').reduce((s, p) => s + p.amount, 0);

  const currentList = tab === 'receivable' ? accountsReceivable : accountsPayable;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 rounded-lg"><DollarSign className="w-5 h-5 text-green-600" /></div>
            <span className="text-sm text-gray-500">A Receber Total</span>
          </div>
          <p className="text-xl font-bold text-gray-800">{formatCurrency(totalAR)}</p>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-green-600">Pago</span><span className="font-medium">{formatCurrency(paidAR)}</span></div>
            <div className="flex justify-between"><span className="text-yellow-600">Pendente</span><span className="font-medium">{formatCurrency(pendingAR)}</span></div>
            <div className="flex justify-between"><span className="text-red-600">Vencido</span><span className="font-medium">{formatCurrency(overdueAR)}</span></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-50 rounded-lg"><TrendingDown className="w-5 h-5 text-red-600" /></div>
            <span className="text-sm text-gray-500">A Pagar Total</span>
          </div>
          <p className="text-xl font-bold text-gray-800">{formatCurrency(totalAP)}</p>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-green-600">Pago</span><span className="font-medium">{formatCurrency(paidAP)}</span></div>
            <div className="flex justify-between"><span className="text-yellow-600">Pendente</span><span className="font-medium">{formatCurrency(pendingAP)}</span></div>
            <div className="flex justify-between"><span className="text-red-600">Vencido</span><span className="font-medium">{formatCurrency(overdueAP)}</span></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg"><TrendingUp className="w-5 h-5 text-blue-600" /></div>
            <span className="text-sm text-gray-500">Saldo Previsto</span>
          </div>
          <p className={`text-xl font-bold ${(pendingAR - pendingAP) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {formatCurrency(pendingAR - pendingAP)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Receitas - Despesas pendentes</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-50 rounded-lg"><AlertCircle className="w-5 h-5 text-orange-600" /></div>
            <span className="text-sm text-gray-500">Total Vencido</span>
          </div>
          <p className="text-xl font-bold text-red-700">{formatCurrency(overdueAR + overdueAP)}</p>
          <p className="text-xs text-gray-400 mt-1">Requer atenção imediata</p>
        </div>
      </div>

      {/* Tabs + Table */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setTab('receivable')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'receivable' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Contas a Receber ({accountsReceivable.length})
            </button>
            <button
              onClick={() => setTab('payable')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'payable' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Contas a Pagar ({accountsPayable.length})
            </button>
          </div>
          <button onClick={() => openAdd(tab)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Lançamento
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Descrição</th>
                <th className="table-header">Categoria</th>
                <th className="table-header">Vencimento</th>
                <th className="table-header">Valor</th>
                <th className="table-header">Status</th>
                <th className="table-header">Pagamento</th>
                <th className="table-header">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentList.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell font-medium max-w-xs truncate">{item.description}</td>
                  <td className="table-cell">
                    <span className="badge-info">{item.category}</span>
                  </td>
                  <td className="table-cell">{formatDate(item.dueDate)}</td>
                  <td className="table-cell font-semibold text-gray-800">{formatCurrency(item.amount)}</td>
                  <td className="table-cell">
                    <span className={statusColor(item.status)}>{item.status}</span>
                  </td>
                  <td className="table-cell">{formatDate(item.paymentDate)}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      {item.status !== 'Pago' && (
                        <button
                          onClick={() => markAsPaid(tab, item.id)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                          title="Marcar como pago"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => openEdit(tab, item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(tab, item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <Modal
          title={`${modal.mode === 'add' ? 'Novo' : 'Editar'} ${modal.type === 'receivable' ? 'Conta a Receber' : 'Conta a Pagar'}`}
          onClose={() => setModal(null)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
              <input className="input" value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vencimento *</label>
                <input type="date" className="input" value={form.dueDate || ''} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
                <input type="number" step="0.01" className="input" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select className="input" value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {modal.type === 'receivable'
                    ? ['Venda', 'Serviço', 'Outros'].map(c => <option key={c}>{c}</option>)
                    : ['Compra', 'Aluguel', 'Utilities', 'Folha', 'Manutenção', 'Outros'].map(c => <option key={c}>{c}</option>)
                  }
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select className="input" value={form.status || ''} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {['Pendente', 'Pago', 'Vencido'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {form.status === 'Pago' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Pagamento</label>
                <input type="date" className="input" value={form.paymentDate || ''} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} className="btn-primary">Salvar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
