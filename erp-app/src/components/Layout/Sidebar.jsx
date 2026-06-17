import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, DollarSign, Package, Users, ShoppingCart,
  BarChart3, Settings, Building2, TrendingUp, X, ChevronRight
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { to: '/financeiro', label: 'Financeiro', icon: DollarSign },
  { to: '/estoque', label: 'Estoque', icon: Package },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/fornecedores', label: 'Fornecedores', icon: Building2 },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
];

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-gradient-to-b from-blue-900 to-blue-800 z-30 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-blue-700">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg p-2">
              <TrendingUp className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">ERP</h1>
              <p className="text-blue-300 text-xs">Sistema de Gestão</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-blue-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider px-3 mb-2">Menu Principal</p>
          {navItems.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all duration-150 group ${
                  isActive
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-blue-200 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-blue-300 group-hover:text-white'}`} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight className="w-4 h-4 text-white/70" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-blue-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">A</span>
            </div>
            <div>
              <p className="text-white text-sm font-medium">Admin</p>
              <p className="text-blue-300 text-xs">Administrador</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
