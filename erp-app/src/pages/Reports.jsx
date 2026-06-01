import { useApp } from '../context/AppContext';
import { formatCurrency, getStockStatus } from '../utils/formatters';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { monthlyRevenue, salesByCategory } from '../data/mockData';
import { TrendingUp, DollarSign, Package, Users } from 'lucide-react';

export default function Reports() {
  const { customers, products, salesOrders, accountsReceivable, accountsPayable } = useApp();

  // Sales status breakdown
  const salesStatusData = [
    { name: 'Entregue', value: salesOrders.filter(o => o.status === 'Entregue').length, color: '#10b981' },
    { name: 'Em andamento', value: salesOrders.filter(o => o.status === 'Em andamento').length, color: '#3b82f6' },
    { name: 'Pendente', value: salesOrders.filter(o => o.status === 'Pendente').length, color: '#f59e0b' },
    { name: 'Cancelado', value: salesOrders.filter(o => o.status === 'Cancelado').length, color: '#ef4444' },
  ];

  // Stock status
  const stockStatusData = products.map(p => ({
    name: p.name.length > 15 ? p.name.slice(0, 15) + '...' : p.name,
    estoque: p.stock,
    minimo: p.minStock,
  })).slice(0, 8);

  // Financial by category
  const receivableByCategory = accountsReceivable.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + r.amount;
    return acc;
  }, {});
  const payableByCategory = accountsPayable.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + p.amount;
    return acc;
  }, {});

  const financialCatData = Object.keys({ ...receivableByCategory, ...payableByCategory }).map(cat => ({
    name: cat,
    receitas: receivableByCategory[cat] || 0,
    despesas: payableByCategory[cat] || 0,
  }));

  // Customers by state
  const customersByState = customers.reduce((acc, c) => {
    acc[c.state] = (acc[c.state] || 0) + 1;
    return acc;
  }, {});
  const customerStateData = Object.entries(customersByState).map(([state, count]) => ({ state, count })).sort((a, b) => b.count - a.count);

  // Totals
  const totalRevenue = accountsReceivable.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = accountsPayable.reduce((s, p) => s + p.amount, 0);
  const netResult = totalRevenue - totalExpenses;
  const totalStockValue = products.reduce((s, p) => s + p.stock * p.costPrice, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center gap-3 mb-2"><DollarSign className="w-5 h-5 opacity-80" /><span className="text-sm opacity-80">Total a Receber</span></div>
          <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
          <div className="flex items-center gap-3 mb-2"><TrendingUp className="w-5 h-5 opacity-80" /><span className="text-sm opacity-80">Total a Pagar</span></div>
          <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className={`card bg-gradient-to-br text-white ${netResult >= 0 ? 'from-green-500 to-green-600' : 'from-orange-500 to-orange-600'}`}>
          <div className="flex items-center gap-3 mb-2"><TrendingUp className="w-5 h-5 opacity-80" /><span className="text-sm opacity-80">Resultado Líquido</span></div>
          <p className="text-2xl font-bold">{formatCurrency(netResult)}</p>
        </div>
        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center gap-3 mb-2"><Package className="w-5 h-5 opacity-80" /><span className="text-sm opacity-80">Valor em Estoque</span></div>
          <p className="text-2xl font-bold">{formatCurrency(totalStockValue)}</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Lucro Mensal (Ano)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyRevenue} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
              <Line type="monotone" dataKey="lucro" name="Lucro" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 4 }} />
              <Line type="monotone" dataKey="receitas" name="Receitas" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Status dos Pedidos</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="60%" height={220}>
              <PieChart>
                <Pie data={salesStatusData} cx="50%" cy="50%" outerRadius={90} dataKey="value">
                  {salesStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {salesStatusData.map(item => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{item.name}</p>
                    <p className="text-lg font-bold text-gray-800">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Nível de Estoque por Produto</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stockStatusData} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="estoque" name="Estoque Atual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="minimo" name="Estoque Mínimo" fill="#fbbf24" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Financeiro por Categoria</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={financialCatData} margin={{ top: 5, right: 20, left: 10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Clientes por estado */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Clientes por Estado</h3>
          <div className="space-y-2">
            {customerStateData.map(({ state, count }) => (
              <div key={state} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600 w-8">{state}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${(count / customers.length) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-700 w-4">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Produtos sem estoque ou estoque baixo */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Alertas de Estoque</h3>
          <div className="space-y-2">
            {products.filter(p => getStockStatus(p) !== 'Em estoque').map(p => {
              const status = getStockStatus(p);
              return (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{p.stock} un.</p>
                    <span className={`text-xs ${status === 'Sem estoque' ? 'text-red-600' : 'text-yellow-600'}`}>{status}</span>
                  </div>
                </div>
              );
            })}
            {products.filter(p => getStockStatus(p) !== 'Em estoque').length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Todos os produtos estão com estoque adequado!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
