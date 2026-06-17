import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency, statusColor, getStockStatus } from '../utils/formatters';
import { Plus, Pencil, Trash2, X, Search, Package, AlertTriangle } from 'lucide-react';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const emptyProduct = {
  code: '', name: '', category: '', unit: 'UN', costPrice: '', salePrice: '',
  stock: '', minStock: '', status: 'Ativo'
};

const categories = ['Eletrônicos', 'Periféricos', 'Monitores', 'Mobiliário', 'Redes', 'Áudio', 'Armazenamento', 'Impressão', 'Energia', 'Outros'];

export default function Inventory() {
  const { products, addProduct, updateProduct, deleteProduct, suppliers } = useApp();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                        p.code.toLowerCase().includes(search.toLowerCase()) ||
                        p.category.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'Todos' ||
      (filterStatus === 'Estoque baixo' && getStockStatus(p) === 'Estoque baixo') ||
      (filterStatus === 'Sem estoque' && getStockStatus(p) === 'Sem estoque') ||
      (filterStatus === 'Ativo' && p.status === 'Ativo') ||
      (filterStatus === 'Inativo' && p.status === 'Inativo');
    return matchSearch && matchStatus;
  });

  const openAdd = () => { setForm({ ...emptyProduct }); setModal({ mode: 'add' }); };
  const openEdit = (p) => { setForm({ ...p }); setModal({ mode: 'edit', id: p.id }); };

  const handleSave = () => {
    if (!form.name || !form.code) return;
    const data = {
      ...form,
      costPrice: parseFloat(form.costPrice) || 0,
      salePrice: parseFloat(form.salePrice) || 0,
      stock: parseInt(form.stock) || 0,
      minStock: parseInt(form.minStock) || 0,
    };
    modal.mode === 'add' ? addProduct(data) : updateProduct(modal.id, data);
    setModal(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Confirmar exclusão do produto?')) deleteProduct(id);
  };

  const totalValue = products.reduce((s, p) => s + p.stock * p.costPrice, 0);
  const lowStock = products.filter(p => getStockStatus(p) === 'Estoque baixo').length;
  const outOfStock = products.filter(p => getStockStatus(p) === 'Sem estoque').length;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Total de Produtos</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{products.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Valor em Estoque</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(totalValue)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-yellow-500" /> Estoque Baixo</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{lowStock}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-red-500" /> Sem Estoque</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{outOfStock}</p>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                placeholder="Buscar produto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              {['Todos', 'Ativo', 'Inativo', 'Estoque baixo', 'Sem estoque'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Produto
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Código</th>
                <th className="table-header">Produto</th>
                <th className="table-header">Categoria</th>
                <th className="table-header">Preço Custo</th>
                <th className="table-header">Preço Venda</th>
                <th className="table-header">Margem</th>
                <th className="table-header">Estoque</th>
                <th className="table-header">Status Estoque</th>
                <th className="table-header">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(product => {
                const stockStatus = getStockStatus(product);
                const margin = product.costPrice > 0 ? ((product.salePrice - product.costPrice) / product.costPrice * 100) : 0;
                return (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-mono text-blue-600">{product.code}</td>
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-gray-800">{product.name}</p>
                        <p className="text-xs text-gray-400">{product.unit}</p>
                      </div>
                    </td>
                    <td className="table-cell"><span className="badge-info">{product.category}</span></td>
                    <td className="table-cell">{formatCurrency(product.costPrice)}</td>
                    <td className="table-cell font-semibold">{formatCurrency(product.salePrice)}</td>
                    <td className="table-cell">
                      <span className={`font-medium ${margin >= 30 ? 'text-green-600' : margin >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{product.stock}</span>
                        <span className="text-xs text-gray-400">/ mín {product.minStock}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={statusColor(stockStatus)}>{stockStatus}</span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(product)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(product.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>Nenhum produto encontrado</p>
            </div>
          )}
        </div>
        <div className="px-6 py-3 border-t border-gray-100 text-sm text-gray-500">
          {filtered.length} de {products.length} produtos
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <Modal title={modal.mode === 'add' ? 'Novo Produto' : 'Editar Produto'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
                <input className="input" value={form.code || ''} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                <select className="input" value={form.unit || 'UN'} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                  {['UN', 'KG', 'L', 'M', 'CX', 'PC'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto *</label>
              <input className="input" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <select className="input" value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">Selecionar...</option>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Custo</label>
                <input type="number" step="0.01" className="input" value={form.costPrice || ''} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Venda</label>
                <input type="number" step="0.01" className="input" value={form.salePrice || ''} onChange={e => setForm(f => ({ ...f, salePrice: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Atual</label>
                <input type="number" className="input" value={form.stock || ''} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Mínimo</label>
                <input type="number" className="input" value={form.minStock || ''} onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className="input" value={form.status || 'Ativo'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {['Ativo', 'Inativo'].map(s => <option key={s}>{s}</option>)}
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
