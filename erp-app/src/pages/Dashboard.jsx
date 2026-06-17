import { useApp } from '../context/AppContext';
import { formatCurrency, getStockStatus } from '../utils/formatters';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { monthlyRevenue, salesByCategory, topProducts } from '../data/mockData';
import {
  DollarSign, ShoppingCart, Package, Users,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle
} from 'lucide-react';

function KpiCard({ title, value, icon: Icon, trend, trendVal, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="card flex items-start gap-4">
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <p className="text-gray-500 text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
        {trend && (
          <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trendVal} vs mês anterior
          </div>
        )}
      </div>
    </div>
  );
}

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function Dashboard() {
  const { customers, products, salesOrders, accountsReceivable, accountsPayable } = useApp();

  const totalRevenue = accountsReceivable.filter(r => r.status === 'Pago').reduce((s, r) => s + r.amount, 0);
  const pendingRevenue = accountsReceivable.filter(r => r.status === 'Pendente').reduce((s, r) => s + r.amount, 0);
  const pendingExpenses = accountsPayable.filter(p => p.status === 'Pendente').reduce((s, p) => s + p.amount, 0);
  const lowStockProducts = products.filter(p => getStockStatus(p) !== 'Em estoque');
  const recentOrders = salesOrders.slice(-5).reverse();
  const overdueReceivable = accountsReceivable.filter(r => r.status === 'Vencido');
  const overduePayable = accountsPayable.filter(p => p.status === 'Vencido');

  const statusColor = {
    'Entregue': 'badge-success',
    'Em andamento': 'badge-info',
    'Pendente': 'badge-warning',
    'Cancelado': 'badge-danger',
  };

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {(overdueReceivable.length > 0 || overduePayable.length > 0 || lowStockProducts.filter(p => p.stock === 0).length > 0) && (
        <div className="space-y-2">
          {overdueReceivable.length > 0 && (
            <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-yellow-800 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span><strong>{overdueReceivable.length}</strong> conta(s) a receber vencida(s) — {formatCurrency(overdueReceivable.reduce((s, r) => s + r.amount, 0))}</span>
            </div>
          )}
          {overduePayable.length > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-800 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span><strong>{overduePayable.length}</strong> conta(s) a pagar vencida(s) — {formatCurrency(overduePayable.reduce((s, p) => s + p.amount, 0))}</span>
            </div>
          )}
          {lowStockProducts.filter(p => p.stock === 0).length > 0 && (
            <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-orange-800 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span><strong>{lowStockProducts.filter(p => p.stock === 0).length}</strong> produto(s) sem estoque</span>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title="Receita Recebida" value={formatCurrency(totalRevenue)} icon={DollarSign} color="green" trend="up" trendVal="+8,2%" />
        <KpiCard title="A Receber" value={formatCurrency(pendingRevenue)} icon={TrendingUp} color="blue" trend="up" trendVal="+3,1%" />
        <KpiCard title="A Pagar" value={formatCurrency(pendingExpenses)} icon={TrendingDown} color="orange" />
        <KpiCard title="Pedidos Ativos" value={salesOrders.filter(o => o.status === 'Em andamento').length} icon={ShoppingCart} color="purple" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title="Clientes Ativos" value={customers.filter(c => c.status === 'Ativo').length} icon={Users} color="blue" />
        <KpiCard title="Produtos Cadastrados" value={products.length} icon={Package} color="purple" />
        <KpiCard title="Estoque Baixo" value={lowStockProducts.length} icon={AlertTriangle} color="orange" />
        <KpiCard title="Pedidos Entregues" value={salesOrders.filter(o => o.status === 'Entregue').length} icon={CheckCircle} color="green" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card xl:col-span-2">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Receitas vs Despesas (Ano)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={monthlyRevenue} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
              <Area type="monotone" dataKey="receitas" name="Receitas" stroke="#3b82f6" fill="url(#colorReceitas)" strokeWidth={2} />
              <Area type="monotone" dataKey="despesas" name="Despesas" stroke="#ef4444" fill="url(#colorDespesas)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Vendas por Categoria</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={salesByCategory} cx="50%" cy="50%" labelLine={false} label={renderCustomizedLabel} outerRadius={90} dataKey="value">
                {salesByCategory.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1 mt-2">
            {salesByCategory.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                {item.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Pedidos Recentes</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header">Pedido</th>
                  <th className="table-header">Cliente</th>
                  <th className="table-header">Total</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => {
                  const customer = customers.find(c => c.id === order.customerId);
                  return (
                    <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="table-cell font-medium text-blue-600">{order.orderNumber}</td>
                      <td className="table-cell">{customer?.name?.split(' ').slice(0, 2).join(' ') || '-'}</td>
                      <td className="table-cell font-medium">{formatCurrency(order.total)}</td>
                      <td className="table-cell">
                        <span className={statusColor[order.status] || 'badge-info'}>{order.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Products */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Produtos Mais Vendidos</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topProducts} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
              <Tooltip />
              <Bar dataKey="sold" name="Qtd Vendida" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
