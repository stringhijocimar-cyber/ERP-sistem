export const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

export const formatPercent = (value) => {
  return `${(value * 100).toFixed(1)}%`;
};

export const isOverdue = (dateStr) => {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
};

export const statusColor = (status) => {
  const map = {
    'Ativo': 'badge-success',
    'Inativo': 'badge-danger',
    'Pago': 'badge-success',
    'Pendente': 'badge-warning',
    'Vencido': 'badge-danger',
    'Entregue': 'badge-success',
    'Em andamento': 'badge-info',
    'Cancelado': 'badge-danger',
    'Em estoque': 'badge-success',
    'Estoque baixo': 'badge-warning',
    'Sem estoque': 'badge-danger',
  };
  return map[status] || 'badge-info';
};

export const getStockStatus = (product) => {
  if (product.stock === 0) return 'Sem estoque';
  if (product.stock < product.minStock) return 'Estoque baixo';
  return 'Em estoque';
};
