-- ============================================================
-- ERP Fraser Alexander – Seed inicial v2.0 (produção)
-- Apenas o usuário admin padrão. Demais dados devem ser
-- cadastrados diretamente pelo sistema.
-- ============================================================

-- ─── USUÁRIO ADMIN PADRÃO ────────────────────────────────────
-- Senha padrão: Fraser@2025
-- IMPORTANTE: Altere a senha após o primeiro acesso!
INSERT OR IGNORE INTO usuarios(id, nome, email, senha_hash, perfil) VALUES
  ('usr-admin-001', 'Administrador', 'admin@fraseralexander.com.br', '$2b$10$placeholder_admin', 'admin');

-- ─── CONFIG PADRÃO DE APROVAÇÃO ───────────────────────────────
UPDATE config_aprovacao SET dados_json = json_object(
  'estagios', json_array(
    json_object('estagio', 1, 'nome', 'Supervisor', 'perfis', json_array('supervisor', 'admin', 'compras')),
    json_object('estagio', 2, 'nome', 'Compras',    'perfis', json_array('compras', 'admin')),
    json_object('estagio', 3, 'nome', 'Diretor',    'perfis', json_array('diretor', 'admin'))
  ),
  'modulos', json_array('os', 'rc', 'mapa')
), atualizado_em = datetime('now') WHERE id = 'default';
