import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import Financial from './pages/Financial';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Sales from './pages/Sales';
import Reports from './pages/Reports';

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="vendas" element={<Sales />} />
            <Route path="financeiro" element={<Financial />} />
            <Route path="estoque" element={<Inventory />} />
            <Route path="clientes" element={<Customers />} />
            <Route path="fornecedores" element={<Suppliers />} />
            <Route path="relatorios" element={<Reports />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
