import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency, statusColor } from '../utils/formatters';
import { Plus, Pencil, Trash2, X, Search, Building2 } from 'lucide-react';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const emptySupplier = { name: '', email: '', phone: '', cpfCnpj: '', type: 'PJ', city: '', state: '', status: 'Ativo', category: 'Geral', totalPurchases: 0 };
const states = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const categories = ['Eletrônicos', 'Tecnologia', 'Geral', 'Industrial', 'Logística', 'Alimentos', 'Outros'];

export default function Suppliers() {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useApp();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setForm({ ...emptySupplier }); setModal({ mode: 'add' }); };
  const openEdit = (s) => { setForm({ ...s }); setModal({ mode: 'edit', id: s.id }); };
  const handleSave = () => {
    if (!form.name) return;
    modal.mode === 'add' ? addSupplier(form) : updateSupplier(modal.id, form);
    setModal(null);
  };
  const handleDelete = (id) => {
    if (window.confirm('Excluir este fornecedor?')) deleteSupplier(id);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="card"><p className="text-sm text-gray-500">Total de Fornecedores</p><p className="text-2xl font-bold mt-1">{suppliers.length}</p></div>
        <div className="card"><p className="text-sm text-gray-500">Ativos</p><p className="text-2xl font-bold text-green-600 mt-1">{suppliers.filter(s => s.status === 'Ativo').length}</p></div>
        <div className="card"><p className="text-sm text-gray-500">Volume de Compras</p><p className="text-2xl font-bold mt-1">{formatCurrency(suppliers.reduce((s, sup) => s + sup.totalPurchases, 0))}</p></div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              placeholder="Buscar fornecedor..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Fornecedor
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header">Fornecedor</th>
                <th className="table-header">Categoria</th>
                <th className="table-header">CPF/CNPJ</th>
                <th className="table-header">Contato</th>
                <th className="table-header">Cidade/UF</th>
                <th className="table-header">Volume Compras</th>
                <th className="table-header">Status</th>
                <th className="table-header">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm flex-shrink-0">
                        {s.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell"><span className="badge-info">{s.category}</span></td>
                  <td className="table-cell font-mono text-sm">{s.cpfCnpj}</td>
                  <td className="table-cell">{s.phone}</td>
                  <td className="table-cell">{s.city}/{s.state}</td>
                  <td className="table-cell font-semibold">{formatCurrency(s.totalPurchases)}</td>
                  <td className="table-cell"><span className={statusColor(s.status)}>{s.status}</span></td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Building2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>Nenhum fornecedor encontrado</p>
            </div>
          )}
        </div>
        <div className="px-6 py-3 border-t text-sm text-gray-500">{filtered.length} de {suppliers.length} fornecedores</div>
      </div>

      {modal && (
        <Modal title={modal.mode === 'add' ? 'Novo Fornecedor' : 'Editar Fornecedor'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social *</label>
              <input className="input" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ/CPF</label>
                <input className="input" value={form.cpfCnpj || ''} onChange={e => setForm(f => ({ ...f, cpfCnpj: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select className="input" value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input type="email" className="input" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input className="input" value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                <input className="input" value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select className="input" value={form.state || ''} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}>
                  <option value="">UF</option>
                  {states.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className="input" value={form.status || 'Ativo'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option>Ativo</option><option>Inativo</option>
              </select>
            </div>
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
