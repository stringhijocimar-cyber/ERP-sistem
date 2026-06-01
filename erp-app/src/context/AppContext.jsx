import { createContext, useContext, useState } from 'react';
import {
  customers as initialCustomers,
  suppliers as initialSuppliers,
  products as initialProducts,
  salesOrders as initialSalesOrders,
  accountsReceivable as initialAR,
  accountsPayable as initialAP,
} from '../data/mockData';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [products, setProducts] = useState(initialProducts);
  const [salesOrders, setSalesOrders] = useState(initialSalesOrders);
  const [accountsReceivable, setAccountsReceivable] = useState(initialAR);
  const [accountsPayable, setAccountsPayable] = useState(initialAP);

  // ---- Customer CRUD ----
  const addCustomer = (c) => setCustomers(prev => [...prev, { ...c, id: Date.now(), totalPurchases: 0, since: new Date().toISOString().slice(0, 10) }]);
  const updateCustomer = (id, data) => setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  const deleteCustomer = (id) => setCustomers(prev => prev.filter(c => c.id !== id));

  // ---- Supplier CRUD ----
  const addSupplier = (s) => setSuppliers(prev => [...prev, { ...s, id: Date.now(), totalPurchases: 0 }]);
  const updateSupplier = (id, data) => setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  const deleteSupplier = (id) => setSuppliers(prev => prev.filter(s => s.id !== id));

  // ---- Product CRUD ----
  const addProduct = (p) => setProducts(prev => [...prev, { ...p, id: Date.now() }]);
  const updateProduct = (id, data) => setProducts(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  const deleteProduct = (id) => setProducts(prev => prev.filter(p => p.id !== id));

  // ---- Sales Orders CRUD ----
  const addOrder = (o) => setSalesOrders(prev => [...prev, { ...o, id: Date.now() }]);
  const updateOrder = (id, data) => setSalesOrders(prev => prev.map(o => o.id === id ? { ...o, ...data } : o));
  const deleteOrder = (id) => setSalesOrders(prev => prev.filter(o => o.id !== id));

  // ---- Accounts Receivable ----
  const addReceivable = (r) => setAccountsReceivable(prev => [...prev, { ...r, id: Date.now() }]);
  const updateReceivable = (id, data) => setAccountsReceivable(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
  const deleteReceivable = (id) => setAccountsReceivable(prev => prev.filter(r => r.id !== id));

  // ---- Accounts Payable ----
  const addPayable = (p) => setAccountsPayable(prev => [...prev, { ...p, id: Date.now() }]);
  const updatePayable = (id, data) => setAccountsPayable(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  const deletePayable = (id) => setAccountsPayable(prev => prev.filter(p => p.id !== id));

  const value = {
    customers, addCustomer, updateCustomer, deleteCustomer,
    suppliers, addSupplier, updateSupplier, deleteSupplier,
    products, addProduct, updateProduct, deleteProduct,
    salesOrders, addOrder, updateOrder, deleteOrder,
    accountsReceivable, addReceivable, updateReceivable, deleteReceivable,
    accountsPayable, addPayable, updatePayable, deletePayable,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
