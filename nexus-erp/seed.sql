-- ============================================
-- SEED INICIAL - DADOS OFICIAIS APENAS
-- ============================================

-- Admin padrão (senha: Admin@2024!)
INSERT OR IGNORE INTO users (id, name, email, password_hash, role, active) VALUES 
(1, 'Administrador', 'admin@fraser.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 1),
(2, 'Gestor de Projeto', 'gestor@fraser.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'project_manager', 1),
(3, 'Comprador', 'comprador@fraser.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'buyer', 1),
(4, 'Aprovador', 'aprovador@fraser.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'approver', 1),
(5, 'Financeiro', 'financeiro@fraser.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'financial', 1),
(6, 'Almoxarife', 'almoxarife@fraser.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'warehouse', 1),
(7, 'Supervisor de Campo', 'supervisor@fraser.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'field_supervisor', 1),
(8, 'Gestor de Operações', 'operacoes@fraser.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'operations_manager', 1),
(9, 'Diretor', 'diretor@fraser.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'director', 1),
(10, 'Comercial', 'comercial@fraser.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'commercial', 1);

-- Configurações do sistema
INSERT OR IGNORE INTO system_config (key, value, description) VALUES
('company_name', 'Fraser Alexander', 'Nome da empresa'),
('company_logo', '/static/logo.png', 'Logo da empresa'),
('purchase_order_manager_limit', '10000', 'Limite para aprovação gerente (USD)'),
('currency', 'USD', 'Moeda padrão'),
('timezone', 'America/Sao_Paulo', 'Fuso horário');

-- Fluxo de aprovação padrão
INSERT OR IGNORE INTO approval_workflows (name, entity_type, step_order, role, min_value, max_value, active) VALUES
('Aprovação Requisição - Supervisor', 'requisition', 1, 'field_supervisor', 0, 999999999, 1),
('Aprovação Requisição - Gestão Ops', 'requisition', 2, 'operations_manager', 0, 999999999, 1),
('Aprovação PO - Gerente Projeto', 'purchase_order', 1, 'project_manager', 0, 10000, 1),
('Aprovação PO - Diretor', 'purchase_order', 2, 'director', 10001, 999999999, 1),
('Aprovação Medição - Gestor Contrato', 'measurement', 1, 'contract_manager', 0, 999999999, 1),
('Aprovação Medição - Financeiro', 'measurement', 2, 'financial', 0, 999999999, 1);
