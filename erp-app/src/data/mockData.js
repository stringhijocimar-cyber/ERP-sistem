// ===== CLIENTES =====
export const customers = [
  { id: 1, name: 'Tech Solutions Ltda', email: 'contato@techsolutions.com', phone: '(11) 98765-4321', cpfCnpj: '12.345.678/0001-90', type: 'PJ', city: 'São Paulo', state: 'SP', status: 'Ativo', since: '2022-01-15', totalPurchases: 45800.00 },
  { id: 2, name: 'Maria Silva Santos', email: 'maria.santos@email.com', phone: '(21) 97654-3210', cpfCnpj: '234.567.890-12', type: 'PF', city: 'Rio de Janeiro', state: 'RJ', status: 'Ativo', since: '2023-03-20', totalPurchases: 12500.00 },
  { id: 3, name: 'Comercial Norte S.A.', email: 'comercial@norte.com.br', phone: '(92) 98877-6655', cpfCnpj: '98.765.432/0001-10', type: 'PJ', city: 'Manaus', state: 'AM', status: 'Inativo', since: '2021-07-10', totalPurchases: 78300.00 },
  { id: 4, name: 'João Carlos Lima', email: 'joao.lima@gmail.com', phone: '(31) 99988-7766', cpfCnpj: '345.678.901-23', type: 'PF', city: 'Belo Horizonte', state: 'MG', status: 'Ativo', since: '2023-09-05', totalPurchases: 8750.00 },
  { id: 5, name: 'Distribuidora Sul Express', email: 'compras@sulexpress.com', phone: '(51) 3333-4444', cpfCnpj: '11.222.333/0001-44', type: 'PJ', city: 'Porto Alegre', state: 'RS', status: 'Ativo', since: '2022-11-30', totalPurchases: 125600.00 },
  { id: 6, name: 'Ana Paula Ferreira', email: 'anapaula@hotmail.com', phone: '(41) 98765-1234', cpfCnpj: '456.789.012-34', type: 'PF', city: 'Curitiba', state: 'PR', status: 'Ativo', since: '2024-01-10', totalPurchases: 3200.00 },
  { id: 7, name: 'Indústria Metal Forte', email: 'vendas@metalforte.ind.br', phone: '(11) 4444-5555', cpfCnpj: '77.888.999/0001-22', type: 'PJ', city: 'Santo André', state: 'SP', status: 'Ativo', since: '2020-06-01', totalPurchases: 340000.00 },
  { id: 8, name: 'Carlos Roberto Melo', email: 'carlos.melo@empresa.com', phone: '(85) 97777-8888', cpfCnpj: '567.890.123-45', type: 'PF', city: 'Fortaleza', state: 'CE', status: 'Inativo', since: '2023-05-15', totalPurchases: 6400.00 },
];

// ===== FORNECEDORES =====
export const suppliers = [
  { id: 1, name: 'Global Imports Ltda', email: 'compras@globalimports.com', phone: '(11) 3333-2222', cpfCnpj: '55.666.777/0001-88', type: 'PJ', city: 'São Paulo', state: 'SP', status: 'Ativo', category: 'Eletrônicos', totalPurchases: 256000.00 },
  { id: 2, name: 'Atacadão Produtos Gerais', email: 'vendas@atacadao.com', phone: '(19) 3200-0001', cpfCnpj: '33.444.555/0001-66', type: 'PJ', city: 'Campinas', state: 'SP', status: 'Ativo', category: 'Geral', totalPurchases: 184000.00 },
  { id: 3, name: 'TechParts Brasil', email: 'suprimentos@techparts.com.br', phone: '(11) 2222-3333', cpfCnpj: '44.555.666/0001-77', type: 'PJ', city: 'São Paulo', state: 'SP', status: 'Ativo', category: 'Tecnologia', totalPurchases: 420000.00 },
  { id: 4, name: 'Manufatura Nacional S.A.', email: 'comercial@manufaturanacional.com', phone: '(31) 3400-5000', cpfCnpj: '22.333.444/0001-55', type: 'PJ', city: 'Belo Horizonte', state: 'MG', status: 'Inativo', category: 'Industrial', totalPurchases: 95000.00 },
  { id: 5, name: 'Logística Expressa', email: 'operacoes@logexpresso.com', phone: '(21) 2500-8000', cpfCnpj: '66.777.888/0001-99', type: 'PJ', city: 'Rio de Janeiro', state: 'RJ', status: 'Ativo', category: 'Logística', totalPurchases: 67000.00 },
];

// ===== PRODUTOS =====
export const products = [
  { id: 1, code: 'PROD-001', name: 'Notebook Pro 15"', category: 'Eletrônicos', unit: 'UN', costPrice: 2800.00, salePrice: 4299.00, stock: 45, minStock: 10, supplierId: 1, status: 'Ativo' },
  { id: 2, code: 'PROD-002', name: 'Mouse Wireless Ergonômico', category: 'Periféricos', unit: 'UN', costPrice: 65.00, salePrice: 129.90, stock: 230, minStock: 50, supplierId: 3, status: 'Ativo' },
  { id: 3, code: 'PROD-003', name: 'Teclado Mecânico RGB', category: 'Periféricos', unit: 'UN', costPrice: 180.00, salePrice: 329.00, stock: 8, minStock: 20, supplierId: 3, status: 'Ativo' },
  { id: 4, code: 'PROD-004', name: 'Monitor 27" 4K', category: 'Monitores', unit: 'UN', costPrice: 1400.00, salePrice: 2199.00, stock: 22, minStock: 8, supplierId: 1, status: 'Ativo' },
  { id: 5, code: 'PROD-005', name: 'Headset Gamer Pro', category: 'Áudio', unit: 'UN', costPrice: 220.00, salePrice: 399.90, stock: 67, minStock: 15, supplierId: 1, status: 'Ativo' },
  { id: 6, code: 'PROD-006', name: 'Cadeira Escritório Premium', category: 'Mobiliário', unit: 'UN', costPrice: 780.00, salePrice: 1299.00, stock: 14, minStock: 5, supplierId: 2, status: 'Ativo' },
  { id: 7, code: 'PROD-007', name: 'Webcam HD 1080p', category: 'Periféricos', unit: 'UN', costPrice: 120.00, salePrice: 229.90, stock: 3, minStock: 15, supplierId: 1, status: 'Ativo' },
  { id: 8, code: 'PROD-008', name: 'Roteador Wi-Fi 6 AX3000', category: 'Redes', unit: 'UN', costPrice: 350.00, salePrice: 599.00, stock: 38, minStock: 10, supplierId: 3, status: 'Ativo' },
  { id: 9, code: 'PROD-009', name: 'SSD 1TB NVMe', category: 'Armazenamento', unit: 'UN', costPrice: 280.00, salePrice: 489.90, stock: 92, minStock: 20, supplierId: 1, status: 'Ativo' },
  { id: 10, code: 'PROD-010', name: 'Impressora Laser Colorida', category: 'Impressão', unit: 'UN', costPrice: 890.00, salePrice: 1549.00, stock: 11, minStock: 5, supplierId: 2, status: 'Inativo' },
  { id: 11, code: 'PROD-011', name: 'Nobreak 1500VA', category: 'Energia', unit: 'UN', costPrice: 420.00, salePrice: 699.90, stock: 0, minStock: 5, supplierId: 2, status: 'Ativo' },
  { id: 12, code: 'PROD-012', name: 'Switch 24 Portas Gigabit', category: 'Redes', unit: 'UN', costPrice: 650.00, salePrice: 1099.00, stock: 19, minStock: 5, supplierId: 3, status: 'Ativo' },
];

// ===== PEDIDOS DE VENDA =====
export const salesOrders = [
  { id: 1, orderNumber: 'PED-2024-001', customerId: 1, date: '2024-05-10', dueDate: '2024-05-25', status: 'Entregue', paymentMethod: 'Boleto', items: [{productId: 1, qty: 2, price: 4299.00}, {productId: 4, qty: 1, price: 2199.00}], total: 10797.00, notes: '' },
  { id: 2, orderNumber: 'PED-2024-002', customerId: 2, date: '2024-05-12', dueDate: '2024-05-27', status: 'Em andamento', paymentMethod: 'Cartão de Crédito', items: [{productId: 2, qty: 3, price: 129.90}, {productId: 5, qty: 1, price: 399.90}], total: 789.60, notes: 'Entrega urgente' },
  { id: 3, orderNumber: 'PED-2024-003', customerId: 5, date: '2024-05-14', dueDate: '2024-05-29', status: 'Pendente', paymentMethod: 'PIX', items: [{productId: 9, qty: 10, price: 489.90}], total: 4899.00, notes: '' },
  { id: 4, orderNumber: 'PED-2024-004', customerId: 7, date: '2024-05-15', dueDate: '2024-05-30', status: 'Entregue', paymentMethod: 'Transferência', items: [{productId: 1, qty: 5, price: 4299.00}, {productId: 8, qty: 3, price: 599.00}], total: 23292.00, notes: '' },
  { id: 5, orderNumber: 'PED-2024-005', customerId: 4, date: '2024-05-18', dueDate: '2024-06-02', status: 'Em andamento', paymentMethod: 'Boleto', items: [{productId: 6, qty: 2, price: 1299.00}], total: 2598.00, notes: '' },
  { id: 6, orderNumber: 'PED-2024-006', customerId: 1, date: '2024-05-20', dueDate: '2024-06-04', status: 'Cancelado', paymentMethod: 'Cartão de Crédito', items: [{productId: 3, qty: 2, price: 329.00}], total: 658.00, notes: 'Cliente cancelou' },
  { id: 7, orderNumber: 'PED-2024-007', customerId: 6, date: '2024-05-22', dueDate: '2024-06-06', status: 'Pendente', paymentMethod: 'PIX', items: [{productId: 2, qty: 1, price: 129.90}, {productId: 7, qty: 1, price: 229.90}], total: 359.80, notes: '' },
  { id: 8, orderNumber: 'PED-2024-008', customerId: 5, date: '2024-05-25', dueDate: '2024-06-09', status: 'Em andamento', paymentMethod: 'Boleto', items: [{productId: 12, qty: 2, price: 1099.00}, {productId: 8, qty: 4, price: 599.00}], total: 4594.00, notes: '' },
];

// ===== FINANCEIRO - CONTAS A RECEBER =====
export const accountsReceivable = [
  { id: 1, description: 'PED-2024-001 - Tech Solutions', customerId: 1, dueDate: '2024-05-25', amount: 10797.00, status: 'Pago', paymentDate: '2024-05-22', category: 'Venda' },
  { id: 2, description: 'PED-2024-002 - Maria Silva', customerId: 2, dueDate: '2024-05-27', amount: 789.60, status: 'Pendente', paymentDate: null, category: 'Venda' },
  { id: 3, description: 'PED-2024-003 - Distribuidora Sul', customerId: 5, dueDate: '2024-05-29', amount: 4899.00, status: 'Vencido', paymentDate: null, category: 'Venda' },
  { id: 4, description: 'PED-2024-004 - Metal Forte', customerId: 7, dueDate: '2024-05-30', amount: 23292.00, status: 'Pago', paymentDate: '2024-05-29', category: 'Venda' },
  { id: 5, description: 'PED-2024-005 - João Carlos', customerId: 4, dueDate: '2024-06-02', amount: 2598.00, status: 'Pendente', paymentDate: null, category: 'Venda' },
  { id: 6, description: 'Consultoria mensal - Tech Solutions', customerId: 1, dueDate: '2024-06-10', amount: 3500.00, status: 'Pendente', paymentDate: null, category: 'Serviço' },
  { id: 7, description: 'PED-2024-008 - Distribuidora Sul', customerId: 5, dueDate: '2024-06-09', amount: 4594.00, status: 'Pendente', paymentDate: null, category: 'Venda' },
];

// ===== FINANCEIRO - CONTAS A PAGAR =====
export const accountsPayable = [
  { id: 1, description: 'Compra estoque - Global Imports', supplierId: 1, dueDate: '2024-05-20', amount: 15600.00, status: 'Pago', paymentDate: '2024-05-19', category: 'Compra' },
  { id: 2, description: 'Aluguel escritório Junho', supplierId: null, dueDate: '2024-06-05', amount: 4500.00, status: 'Pendente', paymentDate: null, category: 'Aluguel' },
  { id: 3, description: 'Energia elétrica Maio', supplierId: null, dueDate: '2024-05-28', amount: 1234.56, status: 'Vencido', paymentDate: null, category: 'Utilities' },
  { id: 4, description: 'Compra TechParts - lote SSD', supplierId: 3, dueDate: '2024-06-01', amount: 28000.00, status: 'Pendente', paymentDate: null, category: 'Compra' },
  { id: 5, description: 'Internet e Telefone', supplierId: null, dueDate: '2024-06-10', amount: 890.00, status: 'Pendente', paymentDate: null, category: 'Utilities' },
  { id: 6, description: 'Folha de pagamento Maio', supplierId: null, dueDate: '2024-05-31', amount: 32000.00, status: 'Pendente', paymentDate: null, category: 'Folha' },
  { id: 7, description: 'Manutenção equipamentos', supplierId: 4, dueDate: '2024-06-15', amount: 2800.00, status: 'Pendente', paymentDate: null, category: 'Manutenção' },
];

// ===== DADOS PARA GRÁFICOS =====
export const monthlyRevenue = [
  { month: 'Jan', receitas: 42000, despesas: 31000, lucro: 11000 },
  { month: 'Fev', receitas: 38500, despesas: 29000, lucro: 9500 },
  { month: 'Mar', receitas: 51000, despesas: 33000, lucro: 18000 },
  { month: 'Abr', receitas: 47800, despesas: 35000, lucro: 12800 },
  { month: 'Mai', receitas: 55200, despesas: 38000, lucro: 17200 },
  { month: 'Jun', receitas: 49600, despesas: 34000, lucro: 15600 },
  { month: 'Jul', receitas: 62000, despesas: 40000, lucro: 22000 },
  { month: 'Ago', receitas: 58000, despesas: 37000, lucro: 21000 },
  { month: 'Set', receitas: 65000, despesas: 42000, lucro: 23000 },
  { month: 'Out', receitas: 71000, despesas: 44000, lucro: 27000 },
  { month: 'Nov', receitas: 68500, despesas: 41000, lucro: 27500 },
  { month: 'Dez', receitas: 82000, despesas: 48000, lucro: 34000 },
];

export const salesByCategory = [
  { name: 'Eletrônicos', value: 42500, color: '#3b82f6' },
  { name: 'Periféricos', value: 18300, color: '#8b5cf6' },
  { name: 'Monitores', value: 15600, color: '#06b6d4' },
  { name: 'Mobiliário', value: 9800, color: '#10b981' },
  { name: 'Redes', value: 8200, color: '#f59e0b' },
  { name: 'Outros', value: 5600, color: '#ef4444' },
];

export const topProducts = [
  { name: 'Notebook Pro 15"', sold: 38, revenue: 163362.00 },
  { name: 'Monitor 27" 4K', sold: 24, revenue: 52776.00 },
  { name: 'SSD 1TB NVMe', sold: 65, revenue: 31843.50 },
  { name: 'Headset Gamer Pro', sold: 51, revenue: 20394.90 },
  { name: 'Cadeira Premium', sold: 18, revenue: 23382.00 },
];
