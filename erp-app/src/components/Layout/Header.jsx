import { Menu, Bell, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const titles = {
  '/': 'Dashboard',
  '/vendas': 'Vendas',
  '/financeiro': 'Financeiro',
  '/estoque': 'Estoque / Produtos',
  '/clientes': 'Clientes',
  '/fornecedores': 'Fornecedores',
  '/relatorios': 'Relatórios',
};

export default function Header({ onMenuClick }) {
  const location = useLocation();
  const title = titles[location.pathname] || 'ERP';

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500"
      >
        <Menu className="w-5 h-5" />
      </button>

      <h2 className="text-xl font-semibold text-gray-800 flex-1">{title}</h2>

      <div className="hidden sm:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-64">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Pesquisar..."
          className="bg-transparent text-sm focus:outline-none w-full text-gray-600 placeholder-gray-400"
        />
      </div>

      <button className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500">
        <Bell className="w-5 h-5" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
      </button>

      <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center">
        <span className="text-white text-sm font-bold">A</span>
      </div>
    </header>
  );
}
