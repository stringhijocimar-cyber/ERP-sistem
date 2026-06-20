// ============================================================
//  MÓDULO: CONTROLE DE CUSTOS DE PROJETO  (WBS + Mensal)
//  Integrado com OS, RC, PC e CRM
// ============================================================


// ─── HELPER MODAL LOCAL ──────────────────────────────────────
function _custosShowModal(html, largura) {
  const mc = document.getElementById('modalContainer');
  if (mc && largura) {
    mc.style.maxWidth = largura;
    mc.style.width = largura;
  }
  const mb = document.getElementById('modalBody');
  const mt = document.getElementById('modalTitle');
  if (mt) mt.textContent = '';
  if (mb) {
    mb.innerHTML = html;
    mb.style.overflowY = 'auto';
    mb.style.maxHeight = '85vh';
    mb.style.padding = '0';
  }
  const mf = document.getElementById('modalFooter');
  if (mf) mf.innerHTML = '';
  document.getElementById('globalModal')?.classList.add('show');
}
// Alias para compatibilidade
function showModal(html, largura) { _custosShowModal(html, largura); }

// ─── ESTRUTURA DE RASTREABILIDADE — SEED PARAMETRIZÁVEL ───────────────
// ATENÇÃO: estes dados são apenas um exemplo de referência para demonstração.
// Em produção, os dados são carregados via API/contrato específico e NÃO devem
// ser usados como dados reais de nenhum cliente.
// Para criar uma nova estrutura: use o módulo Custos → Nova Proposta/Projeto.
// Para importar dados reais: use o módulo Custos → Importar Planilha.
// ──────────────────────────────────────────────────────────────────────
function _custosGetWBSSeed() {
  return [
    { id:'1.1.1.1', g1:'1', g2:'1.1', g3:'1.1.1', descricao:'Retro Escavadeira', fornecedor:'ETS', natureza:'Subcontracted Services', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:20000.0, est_total:20000.0, custo_real:1902.0, custo_proj:0.0, custo_spot:1902.0, custo_contratos:0, variacao:18098.0, variacao_pct:0.9, selling:31320.0, medicao:'SIM', obs:'Economia vs. estimativa' },
    { id:'1.1.1.2', g1:'1', g2:'1.1', g3:'1.1.1', descricao:'Caminhão Munck', fornecedor:'ETS', natureza:'Subcontracted Services', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:20000.0, est_total:20000.0, custo_real:11183.33, custo_proj:0.0, custo_spot:11183.33, custo_contratos:0, variacao:8816.67, variacao_pct:0.44, selling:31320.0, medicao:'SIM', obs:'Base do run-rate' },
    { id:'1.1.1.3', g1:'1', g2:'1.1', g3:'1.1.1', descricao:'Caminhão Comboio', fornecedor:'ETS', natureza:'Subcontracted Services', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:7500.0, est_total:7500.0, custo_real:6773.0, custo_proj:0.0, custo_spot:6773.0, custo_contratos:0, variacao:727.0, variacao_pct:0.1, selling:11745.0, medicao:'SIM', obs:'Compra única' },
    { id:'1.1.1.4', g1:'1', g2:'1.1', g3:'1.1.1', descricao:'Veiculos de Apoio', fornecedor:'VERSA', natureza:'Subcontracted Services', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:16000.0, est_total:16000.0, custo_real:26239.17, custo_proj:0.0, custo_spot:26239.17, custo_contratos:0, variacao:-10239.17, variacao_pct:-0.64, selling:25056.0, medicao:'SIM', obs:'' },
    { id:'1.1.1.5', g1:'1', g2:'1.1', g3:'1.1.1', descricao:'Geradores', fornecedor:'ABC GERADORES', natureza:'Subcontracted Services', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:15000.0, est_total:15000.0, custo_real:24000.0, custo_proj:0.0, custo_spot:24000.0, custo_contratos:0, variacao:-9000.0, variacao_pct:-0.6, selling:23490.01, medicao:'SIM', obs:'' },
    { id:'1.1.1.6', g1:'1', g2:'1.1', g3:'1.1.1', descricao:'Fossa Septíca', fornecedor:'Caixa forte', natureza:'Subcontracted Services', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:2500.0, est_total:2500.0, custo_real:600.0, custo_proj:0.0, custo_spot:600.0, custo_contratos:0, variacao:1900.0, variacao_pct:0.76, selling:3915.01, medicao:'SIM', obs:'' },
    { id:'1.1.1.7', g1:'1', g2:'1.1', g3:'1.1.1', descricao:'Banheiros Quimicos', fornecedor:'MR Ambiental', natureza:'Subcontracted Services', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:1000.0, est_total:1000.0, custo_real:1200.0, custo_proj:0.0, custo_spot:1200.0, custo_contratos:0, variacao:-200.0, variacao_pct:-0.2, selling:1566.0, medicao:'SIM', obs:'' },
    { id:'1.1.1.8', g1:'1', g2:'1.1', g3:'1.1.1', descricao:'Containers', fornecedor:'LAFAETE', natureza:'Subcontracted Services', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:35000.0, est_total:35000.0, custo_real:15513.23, custo_proj:0.0, custo_spot:15513.23, custo_contratos:0, variacao:19486.77, variacao_pct:0.56, selling:54809.99, medicao:'SIM', obs:'' },
    { id:'1.1.1.9', g1:'1', g2:'1.1', g3:'1.1.1', descricao:'Segurança 24h (torres de monitoramento)', fornecedor:'EMIVE', natureza:'Subcontracted Services', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:20000.0, est_total:20000.0, custo_real:1271.32, custo_proj:0.0, custo_spot:1271.32, custo_contratos:0, variacao:18728.68, variacao_pct:0.94, selling:31320.0, medicao:'SIM', obs:'' },
    { id:'1.1.1.10', g1:'1', g2:'1.1', g3:'1.1.1', descricao:'Torres de iluminação', fornecedor:'Casa Padrão', natureza:'Subcontracted Services', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:10000.0, est_total:10000.0, custo_real:0.0, custo_proj:0.0, custo_spot:0.0, custo_contratos:0, variacao:10000.0, variacao_pct:1.0, selling:15659.99, medicao:'SIM', obs:'' },
    { id:'1.1.1.11', g1:'1', g2:'1.1', g3:'1.1.1', descricao:'Transporte Vans', fornecedor:'AWP', natureza:'Subcontracted Services', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:30000.0, est_total:30000.0, custo_real:37935.28, custo_proj:0.0, custo_spot:37935.28, custo_contratos:0, variacao:-7935.28, variacao_pct:-0.26, selling:46980.0, medicao:'SIM', obs:'' },
    { id:'1.1.1.12', g1:'1', g2:'1.1', g3:'1.1.1', descricao:'Motobomba de Baixa Pressão', fornecedor:'ITUBOMBAS', natureza:'Subcontracted Services', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:15000.0, est_total:15000.0, custo_real:0.0, custo_proj:0.0, custo_spot:0.0, custo_contratos:0, variacao:15000.0, variacao_pct:1.0, selling:23490.01, medicao:'SIM', obs:'' },
    { id:'1.1.2.1', g1:'1', g2:'1.1', g3:'1.1.2', descricao:'Alimentação', fornecedor:'Vários', natureza:'Catering', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:41850.0, est_total:41850.0, custo_real:17656.98, custo_proj:0.0, custo_spot:17656.98, custo_contratos:0, variacao:24193.02, variacao_pct:0.58, selling:65537.09, medicao:'SIM', obs:'' },
    { id:'1.1.3.1', g1:'1', g2:'1.1', g3:'1.1.3', descricao:'EPI\'s, Uniformes', fornecedor:'Vários', natureza:'Consumables', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:155000.0, est_total:155000.0, custo_real:87660.65, custo_proj:0.0, custo_spot:87660.65, custo_contratos:0, variacao:67339.35, variacao_pct:0.43, selling:242730.0, medicao:'SIM', obs:'' },
    { id:'1.1.3.2', g1:'1', g2:'1.1', g3:'1.1.3', descricao:'Ferramentas - Kit', fornecedor:'Vários', natureza:'Consumables', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:25000.0, est_total:25000.0, custo_real:24860.45, custo_proj:0.0, custo_spot:24860.45, custo_contratos:0, variacao:139.55, variacao_pct:0.01, selling:39150.0, medicao:'SIM', obs:'' },
    { id:'1.1.3.3', g1:'1', g2:'1.1', g3:'1.1.3', descricao:'Oleos, Graxas, Talas', fornecedor:'Tecnolube', natureza:'Consumables', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:15000.0, est_total:15000.0, custo_real:15092.88, custo_proj:0.0, custo_spot:15092.88, custo_contratos:0, variacao:-92.88, variacao_pct:-0.01, selling:23490.01, medicao:'SIM', obs:'' },
    { id:'1.1.3.4', g1:'1', g2:'1.1', g3:'1.1.3', descricao:'Placa de Obra', fornecedor:'Mega placas', natureza:'Consumables', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:1000.0, est_total:1000.0, custo_real:660.0, custo_proj:0.0, custo_spot:660.0, custo_contratos:0, variacao:340.0, variacao_pct:0.34, selling:1566.0, medicao:'SIM', obs:'' },
    { id:'1.1.3.5', g1:'1', g2:'1.1', g3:'1.1.3', descricao:'ARTs CREA', fornecedor:'', natureza:'Consumables', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:1000.0, est_total:1000.0, custo_real:0.0, custo_proj:0.0, custo_spot:0.0, custo_contratos:0, variacao:1000.0, variacao_pct:1.0, selling:1566.0, medicao:'SIM', obs:'' },
    { id:'1.1.4.1', g1:'1', g2:'1.1', g3:'1.1.4', descricao:'Acomodação', fornecedor:'Pousada Verde Vilas', natureza:'Accommodation, Travel & Visas', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:10500.0, est_total:10500.0, custo_real:39900.0, custo_proj:0.0, custo_spot:39900.0, custo_contratos:0, variacao:-29400.0, variacao_pct:-2.8, selling:16443.0, medicao:'SIM', obs:'' },
    { id:'1.1.4.2', g1:'1', g2:'1.1', g3:'1.1.4', descricao:'Voos Internacionais consultoria (incluindo liderança LATAM e AS)', fornecedor:'Onfly', natureza:'Accommodation, Travel & Visas', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:40000.0, est_total:40000.0, custo_real:24408.23, custo_proj:0.0, custo_spot:24408.23, custo_contratos:0, variacao:15591.77, variacao_pct:0.39, selling:62640.0, medicao:'SIM', obs:'' },
    { id:'1.1.4.3', g1:'1', g2:'1.1', g3:'1.1.4', descricao:'Voos Domésticos Consultoria', fornecedor:'Onfly', natureza:'Accommodation, Travel & Visas', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:4500.0, est_total:4500.0, custo_real:0.0, custo_proj:0.0, custo_spot:0.0, custo_contratos:0, variacao:4500.0, variacao_pct:1.0, selling:7047.0, medicao:'SIM', obs:'' },
    { id:'1.1.5.1', g1:'1', g2:'1.1', g3:'1.1.5', descricao:'Projetos de Engenharia', fornecedor:'JHBR Automação Industrial', natureza:'Engineering Projects', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:60000.0, est_total:60000.0, custo_real:18507.1, custo_proj:0.0, custo_spot:18507.1, custo_contratos:0, variacao:41492.9, variacao_pct:0.69, selling:93959.99, medicao:'SIM', obs:'' },
    { id:'1.1.5.2', g1:'1', g2:'1.1', g3:'1.1.5', descricao:'Projetos Automação', fornecedor:'TBD', natureza:'Engineering Projects', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:150000.0, est_total:150000.0, custo_real:0.0, custo_proj:0.0, custo_spot:0.0, custo_contratos:0, variacao:150000.0, variacao_pct:1.0, selling:234900.0, medicao:'SIM', obs:'' },
    { id:'1.1.6.1', g1:'1', g2:'1.1', g3:'1.1.6', descricao:'Retro Escavadeira', fornecedor:'Rede Mais', natureza:'Fuel – Mobile Equipment', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:0.0, est_total:0.0, custo_real:0.0, custo_proj:0.0, custo_spot:0.0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:0.0, medicao:'SIM', obs:'' },
    { id:'1.1.6.2', g1:'1', g2:'1.1', g3:'1.1.6', descricao:'Caminhão Munck', fornecedor:'Rede Mais', natureza:'Fuel – Mobile Equipment', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:4200.0, est_total:4200.0, custo_real:4200.0, custo_proj:0.0, custo_spot:4200.0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:6577.2, medicao:'SIM', obs:'' },
    { id:'1.1.6.3', g1:'1', g2:'1.1', g3:'1.1.6', descricao:'Veículos de apoio', fornecedor:'Rede Mais', natureza:'Fuel – Mobile Equipment', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:8400.0, est_total:8400.0, custo_real:8720.0, custo_proj:0.0, custo_spot:8720.0, custo_contratos:0, variacao:-320.0, variacao_pct:-0.04, selling:13154.4, medicao:'SIM', obs:'' },
    { id:'1.1.6.4', g1:'1', g2:'1.1', g3:'1.1.6', descricao:'Vans', fornecedor:'Rede Mais', natureza:'Fuel – Mobile Equipment', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:10500.0, est_total:10500.0, custo_real:3093.0, custo_proj:0.0, custo_spot:3093.0, custo_contratos:0, variacao:7407.0, variacao_pct:0.71, selling:16443.0, medicao:'SIM', obs:'' },
    { id:'1.1.6.5', g1:'1', g2:'1.1', g3:'1.1.6', descricao:'Caminhão comboio', fornecedor:'Rede Mais', natureza:'Fuel – Mobile Equipment', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:3150.0, est_total:3150.0, custo_real:3150.0, custo_proj:3150.0, custo_spot:3150.0, custo_contratos:0, variacao:-3150.0, variacao_pct:-1.0, selling:4932.9, medicao:'SIM', obs:'' },
    { id:'1.1.7.1', g1:'1', g2:'1.1', g3:'1.1.7', descricao:'Motobomba - Alta Pressão 1', fornecedor:'', natureza:'Equipment', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:2500.0, est_total:2500.0, custo_real:0.0, custo_proj:2500.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:3915.01, medicao:'SIM', obs:'' },
    { id:'1.1.7.2', g1:'1', g2:'1.1', g3:'1.1.7', descricao:'Motobomba - Alta Pressão 2 (backup)', fornecedor:'', natureza:'Equipment', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:2500.0, est_total:2500.0, custo_real:0.0, custo_proj:2500.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:3915.01, medicao:'SIM', obs:'' },
    { id:'1.1.7.3', g1:'1', g2:'1.1', g3:'1.1.7', descricao:'e-ROMU (incluindo back-up)', fornecedor:'', natureza:'Equipment', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:5000.0, est_total:5000.0, custo_real:0.0, custo_proj:5000.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:7830.0, medicao:'SIM', obs:'' },
    { id:'1.4.2.1', g1:'1', g2:'1.4', g3:'1.4.2', descricao:'Caminhão Comboio', fornecedor:'', natureza:'Subcontracted Services', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:5000.0, est_total:5000.0, custo_real:0.0, custo_proj:5000.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:7830.0, medicao:'SIM', obs:'' },
    { id:'1.4.2.2', g1:'1', g2:'1.4', g3:'1.4.2', descricao:'Retro Escavadeira', fornecedor:'', natureza:'Subcontracted Services', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:30000.0, est_total:30000.0, custo_real:0.0, custo_proj:30000.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:46980.0, medicao:'SIM', obs:'' },
    { id:'1.4.2.3', g1:'1', g2:'1.4', g3:'1.4.2', descricao:'Munck', fornecedor:'', natureza:'Subcontracted Services', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:32000.0, est_total:32000.0, custo_real:0.0, custo_proj:32000.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:50112.0, medicao:'SIM', obs:'' },
    { id:'1.4.2.4', g1:'1', g2:'1.4', g3:'1.4.2', descricao:'Veículos de Apoio', fornecedor:'', natureza:'Subcontracted Services', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:48000.0, est_total:48000.0, custo_real:0.0, custo_proj:48000.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:75168.0, medicao:'SIM', obs:'' },
    { id:'1.4.2.5', g1:'1', g2:'1.4', g3:'1.4.2', descricao:'Geradores', fornecedor:'', natureza:'Subcontracted Services', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:15000.0, est_total:15000.0, custo_real:0.0, custo_proj:15000.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:23490.01, medicao:'SIM', obs:'' },
    { id:'1.4.2.6', g1:'1', g2:'1.4', g3:'1.4.2', descricao:'Fossa Septíca', fornecedor:'', natureza:'Subcontracted Services', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:5000.0, est_total:5000.0, custo_real:0.0, custo_proj:5000.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:7830.0, medicao:'SIM', obs:'' },
    { id:'1.4.2.7', g1:'1', g2:'1.4', g3:'1.4.2', descricao:'Banheiros Quimicos', fornecedor:'', natureza:'Subcontracted Services', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:2000.0, est_total:2000.0, custo_real:0.0, custo_proj:2000.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:3132.0, medicao:'SIM', obs:'' },
    { id:'1.4.2.8', g1:'1', g2:'1.4', g3:'1.4.2', descricao:'Containers', fornecedor:'', natureza:'Subcontracted Services', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:35000.0, est_total:35000.0, custo_real:0.0, custo_proj:35000.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:54809.99, medicao:'SIM', obs:'' },
    { id:'1.4.2.9', g1:'1', g2:'1.4', g3:'1.4.2', descricao:'Segurança 24h (torres de monitoramento)', fornecedor:'', natureza:'Subcontracted Services', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:20000.0, est_total:20000.0, custo_real:0.0, custo_proj:20000.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:31320.0, medicao:'SIM', obs:'' },
    { id:'1.4.2.10', g1:'1', g2:'1.4', g3:'1.4.2', descricao:'Torres de iluminação', fornecedor:'', natureza:'Subcontracted Services', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:10000.0, est_total:10000.0, custo_real:0.0, custo_proj:10000.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:15659.99, medicao:'SIM', obs:'' },
    { id:'1.4.2.11', g1:'1', g2:'1.4', g3:'1.4.2', descricao:'Transporte Vans (incl. Motorista)', fornecedor:'', natureza:'Subcontracted Services', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:47000.0, est_total:47000.0, custo_real:0.0, custo_proj:47000.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:73602.0, medicao:'SIM', obs:'' },
    { id:'1.4.2.12', g1:'1', g2:'1.4', g3:'1.4.2', descricao:'Motobombas de Baixa Pressão', fornecedor:'', natureza:'Subcontracted Services', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:15000.0, est_total:15000.0, custo_real:0.0, custo_proj:15000.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:23490.01, medicao:'SIM', obs:'' },
    { id:'1.4.3.1', g1:'1', g2:'1.4', g3:'1.4.3', descricao:'Alimentação', fornecedor:'', natureza:'Catering', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:41850.0, est_total:41850.0, custo_real:0.0, custo_proj:41850.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:65537.09, medicao:'SIM', obs:'' },
    { id:'1.4.4.1', g1:'1', g2:'1.4', g3:'1.4.4', descricao:'Retro Escavadeira', fornecedor:'', natureza:'Fuel', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:0.0, est_total:0.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:0.0, medicao:'SIM', obs:'' },
    { id:'1.4.4.2', g1:'1', g2:'1.4', g3:'1.4.4', descricao:'Caminhão Munck', fornecedor:'', natureza:'Fuel', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:6300.0, est_total:6300.0, custo_real:0.0, custo_proj:6300.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:9865.8, medicao:'SIM', obs:'' },
    { id:'1.4.4.3', g1:'1', g2:'1.4', g3:'1.4.4', descricao:'Veículos de apoio', fornecedor:'', natureza:'Fuel', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:4200.0, est_total:4200.0, custo_real:0.0, custo_proj:4200.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:6577.2, medicao:'SIM', obs:'' },
    { id:'1.4.4.4', g1:'1', g2:'1.4', g3:'1.4.4', descricao:'Vans', fornecedor:'', natureza:'Fuel', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:7350.0, est_total:7350.0, custo_real:0.0, custo_proj:7350.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:11510.11, medicao:'SIM', obs:'' },
    { id:'1.4.4.5', g1:'1', g2:'1.4', g3:'1.4.4', descricao:'Caminhão Comboio', fornecedor:'', natureza:'Fuel', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:3150.0, est_total:3150.0, custo_real:0.0, custo_proj:3150.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:4932.9, medicao:'SIM', obs:'' },
    { id:'1.4.5.1', g1:'1', g2:'1.4', g3:'1.4.5', descricao:'Motobomba - Alta Pressão 1', fornecedor:'', natureza:'Equipment', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:2500.0, est_total:2500.0, custo_real:0.0, custo_proj:2500.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:3915.01, medicao:'SIM', obs:'' },
    { id:'1.4.5.2', g1:'1', g2:'1.4', g3:'1.4.5', descricao:'Motobomba - Alta Pressão 2', fornecedor:'', natureza:'Equipment', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:2500.0, est_total:2500.0, custo_real:0.0, custo_proj:2500.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:3915.01, medicao:'SIM', obs:'' },
    { id:'1.4.5.3', g1:'1', g2:'1.4', g3:'1.4.5', descricao:'e-ROMU (incluindo back-up)', fornecedor:'', natureza:'Equipment', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:5000.0, est_total:5000.0, custo_real:0.0, custo_proj:5000.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:7830.0, medicao:'SIM', obs:'' },
    { id:'1.7.1.1', g1:'1', g2:'1.7', g3:'1.7.1', descricao:'Fechamento cerca mourão e arame', fornecedor:'Vários', natureza:'Full Construction of Construction Site', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:28200.0, est_total:28200.0, custo_real:28849.23, custo_proj:0.0, custo_spot:28849.23, custo_contratos:0, variacao:-649.23, variacao_pct:-0.02, selling:44161.2, medicao:'SIM', obs:'' },
    { id:'1.7.1.2', g1:'1', g2:'1.7', g3:'1.7.1', descricao:'Bases de madeira para containers (dormentes)', fornecedor:'JA Madeiras', natureza:'Full Construction of Construction Site', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:30000.0, est_total:30000.0, custo_real:21506.8, custo_proj:0.0, custo_spot:21506.8, custo_contratos:0, variacao:8493.2, variacao_pct:0.28, selling:46980.0, medicao:'SIM', obs:'' },
    { id:'1.7.1.3', g1:'1', g2:'1.7', g3:'1.7.1', descricao:'Brita', fornecedor:'Brumartins', natureza:'Full Construction of Construction Site', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:10000.0, est_total:10000.0, custo_real:10648.23, custo_proj:0.0, custo_spot:10648.23, custo_contratos:0, variacao:-648.23, variacao_pct:-0.06, selling:15659.99, medicao:'SIM', obs:'' },
    { id:'1.7.1.4', g1:'1', g2:'1.7', g3:'1.7.1', descricao:'Fossa Septíca e tubulação primária', fornecedor:'CAIxa Forte', natureza:'Full Construction of Construction Site', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:10000.0, est_total:10000.0, custo_real:10000.0, custo_proj:0.0, custo_spot:10000.0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:15659.99, medicao:'SIM', obs:'' },
    { id:'1.7.1.5', g1:'1', g2:'1.7', g3:'1.7.1', descricao:'Instalações Hidráulicas e elétricas (containers)', fornecedor:'', natureza:'Full Construction of Construction Site', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:15000.0, est_total:15000.0, custo_real:21883.77, custo_proj:0.0, custo_spot:21883.77, custo_contratos:0, variacao:-6883.77, variacao_pct:-0.46, selling:23490.01, medicao:'SIM', obs:'' },
    { id:'1.7.1.6', g1:'1', g2:'1.7', g3:'1.7.1', descricao:'SPDA - Sistema Proteção de Descargas Atmosféricas', fornecedor:'Vários', natureza:'Full Construction of Construction Site', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:15000.0, est_total:15000.0, custo_real:25009.06, custo_proj:0.0, custo_spot:25009.06, custo_contratos:0, variacao:-10009.06, variacao_pct:-0.67, selling:23490.01, medicao:'SIM', obs:'' },
    { id:'1.7.1.7', g1:'1', g2:'1.7', g3:'1.7.1', descricao:'Sinalização', fornecedor:'', natureza:'Full Construction of Construction Site', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:4000.0, est_total:4000.0, custo_real:4005.5, custo_proj:0.0, custo_spot:4005.5, custo_contratos:0, variacao:-5.5, variacao_pct:-0.0, selling:6264.0, medicao:'SIM', obs:'' },
    { id:'1.7.1.8', g1:'1', g2:'1.7', g3:'1.7.1', descricao:'Pintura de pisos, cercas, etc', fornecedor:'Vários', natureza:'Full Construction of Construction Site', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:2000.0, est_total:2000.0, custo_real:3027.08, custo_proj:0.0, custo_spot:3027.08, custo_contratos:0, variacao:-1027.08, variacao_pct:-0.51, selling:3132.0, medicao:'SIM', obs:'' },
    { id:'1.7.1.9', g1:'1', g2:'1.7', g3:'1.7.1', descricao:'Internet', fornecedor:'', natureza:'Full Construction of Construction Site', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:2000.0, est_total:2000.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:2000.0, variacao_pct:1.0, selling:3132.0, medicao:'SIM', obs:'' },
    { id:'1.7.1.10', g1:'1', g2:'1.7', g3:'1.7.1', descricao:'Estações de Trabalho (mesas, cadeiras e armários)', fornecedor:'Nobre', natureza:'Full Construction of Construction Site', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:8000.0, est_total:8000.0, custo_real:7997.0, custo_proj:0.0, custo_spot:7997.0, custo_contratos:0, variacao:3.0, variacao_pct:0.0, selling:12528.0, medicao:'SIM', obs:'' },
    { id:'1.7.1.11', g1:'1', g2:'1.7', g3:'1.7.1', descricao:'Equipamentos de apoio (geladeira, cafeteira, bebedouros, monitores, impressora, nobreak, consumíveis)', fornecedor:'', natureza:'Full Construction of Construction Site', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:8000.0, est_total:8000.0, custo_real:7511.13, custo_proj:0.0, custo_spot:7511.13, custo_contratos:0, variacao:488.87, variacao_pct:0.06, selling:12528.0, medicao:'SIM', obs:'' },
    { id:'1.7.1.12', g1:'1', g2:'1.7', g3:'1.7.1', descricao:'Prateleiras e acessórios para almoxarifado', fornecedor:'Nobre', natureza:'Full Construction of Construction Site', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:4000.0, est_total:4000.0, custo_real:4000.0, custo_proj:0.0, custo_spot:4000.0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:6264.0, medicao:'SIM', obs:'' },
    { id:'1.7.1.13', g1:'1', g2:'1.7', g3:'1.7.1', descricao:'Cômodo para armazenamento de produtos químicos', fornecedor:'CS Serralheiria', natureza:'Full Construction of Construction Site', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:15000.0, est_total:15000.0, custo_real:15000.0, custo_proj:0.0, custo_spot:15000.0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:23490.01, medicao:'SIM', obs:'' },
    { id:'1.7.2.1', g1:'1', g2:'1.7', g3:'1.7.2', descricao:'Bases de madeira para containers (dormentes)', fornecedor:'JA Madeiras', natureza:'Advanced Construction Site Setup', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:3.0, est_unit:8000.0, est_total:24000.0, custo_real:18749.0, custo_proj:0.0, custo_spot:18749.0, custo_contratos:0, variacao:5251.0, variacao_pct:0.22, selling:37584.0, medicao:'SIM', obs:'' },
    { id:'1.7.2.2', g1:'1', g2:'1.7', g3:'1.7.2', descricao:'Brita', fornecedor:'Brumartins', natureza:'Advanced Construction Site Setup', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:3.0, est_unit:3000.0, est_total:9000.0, custo_real:2908.0, custo_proj:0.0, custo_spot:2908.0, custo_contratos:0, variacao:6092.0, variacao_pct:0.68, selling:14094.0, medicao:'SIM', obs:'' },
    { id:'1.7.2.3', g1:'1', g2:'1.7', g3:'1.7.2', descricao:'Instalações Elétricas', fornecedor:'', natureza:'Advanced Construction Site Setup', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:3.0, est_unit:3200.0, est_total:9600.0, custo_real:4765.55, custo_proj:0.0, custo_spot:4765.55, custo_contratos:0, variacao:4834.45, variacao_pct:0.5, selling:15033.6, medicao:'SIM', obs:'' },
    { id:'1.7.2.4', g1:'1', g2:'1.7', g3:'1.7.2', descricao:'Banheiros Químicos', fornecedor:'MR Ambiental', natureza:'Advanced Construction Site Setup', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:3.0, est_unit:3000.0, est_total:9000.0, custo_real:0.0, custo_proj:0.0, custo_spot:0.0, custo_contratos:0, variacao:9000.0, variacao_pct:1.0, selling:14094.0, medicao:'SIM', obs:'' },
    { id:'1.7.2.5', g1:'1', g2:'1.7', g3:'1.7.2', descricao:'Sinalização', fornecedor:'', natureza:'Advanced Construction Site Setup', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:3.0, est_unit:2000.0, est_total:6000.0, custo_real:3147.0, custo_proj:0.0, custo_spot:3147.0, custo_contratos:0, variacao:2853.0, variacao_pct:0.48, selling:9396.0, medicao:'SIM', obs:'' },
    { id:'1.7.2.6', g1:'1', g2:'1.7', g3:'1.7.2', descricao:'Pinturas e acabamentos', fornecedor:'', natureza:'Advanced Construction Site Setup', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:3.0, est_unit:2000.0, est_total:6000.0, custo_real:2786.8, custo_proj:0.0, custo_spot:2786.8, custo_contratos:0, variacao:3213.2, variacao_pct:0.54, selling:9396.0, medicao:'SIM', obs:'' },
    { id:'1.7.2.7', g1:'1', g2:'1.7', g3:'1.7.2', descricao:'Internet', fornecedor:'', natureza:'Advanced Construction Site Setup', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:3.0, est_unit:2000.0, est_total:6000.0, custo_real:1596.0, custo_proj:0.0, custo_spot:1596.0, custo_contratos:0, variacao:4404.0, variacao_pct:0.73, selling:9396.0, medicao:'SIM', obs:'' },
    { id:'1.7.2.8', g1:'1', g2:'1.7', g3:'1.7.2', descricao:'Estações de Trabalho (mesas, cadeiras e armários)', fornecedor:'Nobre', natureza:'Advanced Construction Site Setup', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:3.0, est_unit:4000.0, est_total:12000.0, custo_real:8439.63, custo_proj:0.0, custo_spot:8439.63, custo_contratos:0, variacao:3560.37, variacao_pct:0.3, selling:18792.0, medicao:'SIM', obs:'' },
    { id:'1.8.1.1', g1:'1', g2:'1.8', g3:'1.8.1', descricao:'Containers canteiro central', fornecedor:'LAFAETE', natureza:'Central Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:20000.0, est_total:140000.0, custo_real:98676.71, custo_proj:128898.0, custo_spot:0, custo_contratos:98676.71, variacao:11102.0, variacao_pct:0.08, selling:219240.0, medicao:'SIM', obs:'' },
    { id:'1.8.1.2', g1:'1', g2:'1.8', g3:'1.8.1', descricao:'Internet', fornecedor:'Starlink', natureza:'Central Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:500.0, est_total:3500.0, custo_real:1152.0, custo_proj:2688.0, custo_spot:0, custo_contratos:1152.0, variacao:812.0, variacao_pct:0.23, selling:5481.07, medicao:'SIM', obs:'' },
    { id:'1.8.1.3', g1:'1', g2:'1.8', g3:'1.8.1', descricao:'Água Potável e de Serviço (incluindo análises de potabilidade)', fornecedor:'Vários', natureza:'Central Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:25500.0, est_total:178500.0, custo_real:35963.24, custo_proj:120050.0, custo_spot:18813.24, custo_contratos:17150.0, variacao:39636.76, variacao_pct:0.22, selling:279531.07, medicao:'SIM', obs:'' },
    { id:'1.8.1.4', g1:'1', g2:'1.8', g3:'1.8.1', descricao:'Consumíveis (material de limpeza, escritorio, café, confraternizações)', fornecedor:'Vásrios', natureza:'Central Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:5000.0, est_total:35000.0, custo_real:28289.76, custo_proj:0.0, custo_spot:28289.76, custo_contratos:0, variacao:6710.24, variacao_pct:0.19, selling:54810.0, medicao:'SIM', obs:'' },
    { id:'1.8.1.5', g1:'1', g2:'1.8', g3:'1.8.1', descricao:'Alimentação', fornecedor:'Vários', natureza:'Central Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:41850.0, est_total:292950.0, custo_real:101369.39, custo_proj:147000.0, custo_spot:0, custo_contratos:101369.39, variacao:145950.0, variacao_pct:0.5, selling:458759.63, medicao:'SIM', obs:'' },
    { id:'1.8.1.6', g1:'1', g2:'1.8', g3:'1.8.1', descricao:'Coleta de Efluentes', fornecedor:'MR Ambiental', natureza:'Central Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:10000.0, est_total:70000.0, custo_real:23400.0, custo_proj:72800.0, custo_spot:0, custo_contratos:23400.0, variacao:-2800.0, variacao_pct:-0.04, selling:109619.93, medicao:'SIM', obs:'' },
    { id:'1.8.1.7', g1:'1', g2:'1.8', g3:'1.8.1', descricao:'Coleta de resíduos', fornecedor:'Alô caçambas', natureza:'Central Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:1500.0, est_total:10500.0, custo_real:3500.0, custo_proj:9975.0, custo_spot:0, custo_contratos:3500.0, variacao:525.0, variacao_pct:0.05, selling:16443.07, medicao:'SIM', obs:'' },
    { id:'1.8.1.8', g1:'1', g2:'1.8', g3:'1.8.1', descricao:'Limpeza e Manutenção de Veículos', fornecedor:'Tulio Marcos', natureza:'Central Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:3500.0, est_total:24500.0, custo_real:2610.0, custo_proj:10500.0, custo_spot:0, custo_contratos:2610.0, variacao:14000.0, variacao_pct:0.57, selling:38367.0, medicao:'SIM', obs:'' },
    { id:'1.8.1.9', g1:'1', g2:'1.8', g3:'1.8.1', descricao:'Equipamentos de Informática e comunicação', fornecedor:'Datron', natureza:'Central Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:2500.0, est_total:17500.0, custo_real:6709.9, custo_proj:7700.0, custo_spot:0.0, custo_contratos:6709.9, variacao:9800.0, variacao_pct:0.56, selling:27405.07, medicao:'SIM', obs:'' },
    { id:'1.8.1.10', g1:'1', g2:'1.8', g3:'1.8.1', descricao:'Cercas metálicas (gradil)', fornecedor:'Gradisa', natureza:'Central Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:2500.0, est_total:17500.0, custo_real:9390.0, custo_proj:0.0, custo_spot:9390.0, custo_contratos:0, variacao:8110.0, variacao_pct:0.46, selling:27405.07, medicao:'SIM', obs:'' },
    { id:'1.8.1.11', g1:'1', g2:'1.8', g3:'1.8.1', descricao:'Monitoramento 24h', fornecedor:'Emive', natureza:'Central Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:8000.0, est_total:56000.0, custo_real:6821.81, custo_proj:4458.93, custo_spot:0, custo_contratos:6821.81, variacao:51541.07, variacao_pct:0.92, selling:87696.0, medicao:'SIM', obs:'' },
    { id:'1.8.1.12', g1:'1', g2:'1.8', g3:'1.8.1', descricao:'Iluminação (torre)', fornecedor:'Casa Padrão', natureza:'Central Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:5000.0, est_total:35000.0, custo_real:10796.67, custo_proj:18200.0, custo_spot:0, custo_contratos:10796.67, variacao:16800.0, variacao_pct:0.48, selling:54810.0, medicao:'SIM', obs:'' },
    { id:'1.8.1.13', g1:'1', g2:'1.8', g3:'1.8.1', descricao:'Extintores', fornecedor:'Extimbras', natureza:'Central Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:2000.0, est_total:14000.0, custo_real:180.0, custo_proj:0.0, custo_spot:180.0, custo_contratos:0, variacao:13820.0, variacao_pct:0.99, selling:21924.0, medicao:'SIM', obs:'' },
    { id:'1.8.2.1', g1:'1', g2:'1.8', g3:'1.8.2', descricao:'Container posto avançado', fornecedor:'LAFAETE', natureza:'Advanced Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:10.0, est_unit:2500.0, est_total:25000.0, custo_real:0.0, custo_proj:15058.7, custo_spot:0, custo_contratos:0, variacao:9941.3, variacao_pct:0.4, selling:39150.1, medicao:'SIM', obs:'' },
    { id:'1.8.2.2', g1:'1', g2:'1.8', g3:'1.8.2', descricao:'Internet', fornecedor:'Starlink', natureza:'Advanced Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:10.0, est_unit:500.0, est_total:5000.0, custo_real:0.0, custo_proj:3840.0, custo_spot:0, custo_contratos:0, variacao:1160.0, variacao_pct:0.23, selling:7830.1, medicao:'SIM', obs:'' },
    { id:'1.8.2.3', g1:'1', g2:'1.8', g3:'1.8.2', descricao:'Água Potável e de Serviço', fornecedor:'Vários', natureza:'Advanced Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:10.0, est_unit:3000.0, est_total:30000.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:30000.0, variacao_pct:1.0, selling:46980.0, medicao:'SIM', obs:'' },
    { id:'1.8.2.4', g1:'1', g2:'1.8', g3:'1.8.2', descricao:'Consumíveis (material de limpeza, escritorio, café)', fornecedor:'Vários', natureza:'Advanced Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:10.0, est_unit:700.0, est_total:7000.0, custo_real:5435.45, custo_proj:0.0, custo_spot:5435.45, custo_contratos:0, variacao:1564.55, variacao_pct:0.22, selling:10962.1, medicao:'SIM', obs:'' },
    { id:'1.8.2.5', g1:'1', g2:'1.8', g3:'1.8.2', descricao:'Banheiros químicos', fornecedor:'MR Ambiental', natureza:'Advanced Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:10.0, est_unit:3000.0, est_total:30000.0, custo_real:15120.0, custo_proj:30000.0, custo_spot:0, custo_contratos:15120.0, variacao:0.0, variacao_pct:0.0, selling:46980.0, medicao:'SIM', obs:'' },
    { id:'1.8.2.6', g1:'1', g2:'1.8', g3:'1.8.2', descricao:'Coleta de Efluentes', fornecedor:'MR Ambiental', natureza:'Advanced Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:10.0, est_unit:1000.0, est_total:10000.0, custo_real:0.0, custo_proj:18000.0, custo_spot:0, custo_contratos:0, variacao:-8000.0, variacao_pct:-0.8, selling:15660.0, medicao:'SIM', obs:'' },
    { id:'1.8.2.7', g1:'1', g2:'1.8', g3:'1.8.2', descricao:'Coleta de resíduos', fornecedor:'Alô caçambas', natureza:'Advanced Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:10.0, est_unit:500.0, est_total:5000.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:5000.0, variacao_pct:1.0, selling:7830.1, medicao:'SIM', obs:'' },
    { id:'1.8.2.8', g1:'1', g2:'1.8', g3:'1.8.2', descricao:'Limpeza e Manutenção de equipamentos', fornecedor:'Vários', natureza:'Advanced Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:10.0, est_unit:3500.0, est_total:35000.0, custo_real:7448.93, custo_proj:0.0, custo_spot:7448.93, custo_contratos:0, variacao:27551.07, variacao_pct:0.79, selling:54810.0, medicao:'SIM', obs:'' },
    { id:'1.8.2.9', g1:'1', g2:'1.8', g3:'1.8.2', descricao:'Equipamentos de Informática (impressora)', fornecedor:'Copyprinter', natureza:'Advanced Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:10.0, est_unit:200.0, est_total:2000.0, custo_real:6758.54, custo_proj:3800.0, custo_spot:0, custo_contratos:6758.54, variacao:-1800.0, variacao_pct:-0.9, selling:3132.0, medicao:'SIM', obs:'' },
    { id:'1.8.2.10', g1:'1', g2:'1.8', g3:'1.8.2', descricao:'Cercas Metálicas (gradil)', fornecedor:'Gradisa', natureza:'Advanced Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:10.0, est_unit:500.0, est_total:5000.0, custo_real:0.0, custo_proj:0.0, custo_spot:0.0, custo_contratos:0, variacao:5000.0, variacao_pct:1.0, selling:7830.1, medicao:'SIM', obs:'' },
    { id:'1.8.2.11', g1:'1', g2:'1.8', g3:'1.8.2', descricao:'Monitoramento 24h', fornecedor:'Emive', natureza:'Advanced Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:10.0, est_unit:8000.0, est_total:80000.0, custo_real:0.0, custo_proj:3399.9, custo_spot:0, custo_contratos:0, variacao:76600.1, variacao_pct:0.96, selling:125280.0, medicao:'SIM', obs:'' },
    { id:'1.8.2.12', g1:'1', g2:'1.8', g3:'1.8.2', descricao:'Iluminação (torre)', fornecedor:'Casa Padrão', natureza:'Advanced Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:10.0, est_unit:5000.0, est_total:50000.0, custo_real:10796.67, custo_proj:26000.0, custo_spot:0, custo_contratos:10796.67, variacao:24000.0, variacao_pct:0.48, selling:78300.0, medicao:'SIM', obs:'' },
    { id:'1.8.2.13', g1:'1', g2:'1.8', g3:'1.8.2', descricao:'Extintores', fornecedor:'', natureza:'Advanced Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:10.0, est_unit:500.0, est_total:5000.0, custo_real:0.0, custo_proj:0.0, custo_spot:0.0, custo_contratos:0, variacao:5000.0, variacao_pct:1.0, selling:7830.1, medicao:'SIM', obs:'' },
    { id:'1.9.1.1', g1:'1', g2:'1.9', g3:'1.9.1', descricao:'Alojamentos', fornecedor:'Vários', natureza:'Local Administration', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:8.0, est_unit:42480.0, est_total:339840.0, custo_real:145871.91, custo_proj:309000.0, custo_spot:20989.98, custo_contratos:124881.93, variacao:9850.02, variacao_pct:0.03, selling:532189.44, medicao:'SIM', obs:'' },
    { id:'1.9.1.2', g1:'1', g2:'1.9', g3:'1.9.1', descricao:'Mão de obra Indireta', fornecedor:'', natureza:'Local Administration', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:8.0, est_unit:341171.97, est_total:2729375.76, custo_real:1699646.4, custo_proj:2768000.0, custo_spot:0, custo_contratos:1699646.4, variacao:-38624.24, variacao_pct:-0.01, selling:4274202.48, medicao:'SIM', obs:'' },
    { id:'1.9.1.3', g1:'1', g2:'1.9', g3:'1.9.1', descricao:'Despesas diversas com folga de campo (administrativas, deslocamentos aéreos, terrestres, etc)', fornecedor:'', natureza:'Local Administration', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:8.0, est_unit:70500.0, est_total:564000.0, custo_real:235503.51, custo_proj:0.0, custo_spot:235503.51, custo_contratos:0, variacao:328496.49, variacao_pct:0.58, selling:883224.0, medicao:'SIM', obs:'' },
    { id:'1.9.1.4', g1:'1', g2:'1.9', g3:'1.9.1', descricao:'Alimentação', fornecedor:'Vários', natureza:'Local Administration', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:8.0, est_unit:0.0, est_total:0.0, custo_real:0.0, custo_proj:0.0, custo_spot:0.0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:0.0, medicao:'SIM', obs:'' },
    { id:'1.9.1.5', g1:'1', g2:'1.9', g3:'1.9.1', descricao:'Veículos de apoio (4x4), incluindo combustível', fornecedor:'Versa', natureza:'Local Administration', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:8.0, est_unit:50000.0, est_total:400000.0, custo_real:209058.99, custo_proj:382272.0, custo_spot:0, custo_contratos:209058.99, variacao:17728.0, variacao_pct:0.04, selling:626400.0, medicao:'SIM', obs:'' },
    { id:'1.9.1.6', g1:'1', g2:'1.9', g3:'1.9.1', descricao:'Transporte (Vans), incluindo combustível', fornecedor:'AWP', natureza:'Local Administration', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:8.0, est_unit:53000.0, est_total:424000.0, custo_real:261935.28, custo_proj:448000.0, custo_spot:0, custo_contratos:261935.28, variacao:-24000.0, variacao_pct:-0.06, selling:663984.0, medicao:'SIM', obs:'' },
    { id:'2.1.1.1', g1:'2', g2:'2.1', g3:'2.1.1', descricao:'Unidade remota de desmonte hidráulico - eROMU', fornecedor:'', natureza:'Remote Operated Unit (ROMU)', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:37296.0, est_total:261072.0, custo_real:0.0, custo_proj:261072.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:408838.78, medicao:'SIM', obs:'' },
    { id:'2.1.1.2', g1:'2', g2:'2.1', g3:'2.1.1', descricao:'Painel elétrico 440v, incluindo backup', fornecedor:'', natureza:'Remote Operated Unit (ROMU)', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:8550.0, est_total:59850.0, custo_real:28500.0, custo_proj:0.0, custo_spot:28500.0, custo_contratos:0, variacao:31350.0, variacao_pct:0.52, selling:93725.17, medicao:'SIM', obs:'' },
    { id:'2.1.1.3', g1:'2', g2:'2.1', g3:'2.1.1', descricao:'Cabo Elétrico 5x16mm2 (diâm. 800mm)', fornecedor:'', natureza:'Remote Operated Unit (ROMU)', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:1000.0, est_total:7000.0, custo_real:0.0, custo_proj:7000.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:10962.0, medicao:'SIM', obs:'' },
    { id:'2.1.1.4', g1:'2', g2:'2.1', g3:'2.1.1', descricao:'Mangotes Fraser 8¨ (conjunto de 5 mangotes)', fornecedor:'', natureza:'Remote Operated Unit (ROMU)', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:8764.74, est_total:61353.18, custo_real:0.0, custo_proj:61353.18, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:96079.13, medicao:'SIM', obs:'' },
    { id:'2.1.1.5', g1:'2', g2:'2.1', g3:'2.1.1', descricao:'Parafusos, porcas e arruelas (estojo)', fornecedor:'', natureza:'Remote Operated Unit (ROMU)', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:1500.0, est_total:10500.0, custo_real:0.0, custo_proj:10500.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:16443.07, medicao:'SIM', obs:'' },
    { id:'2.1.1.6', g1:'2', g2:'2.1', g3:'2.1.1', descricao:'Mecânico Manutenção', fornecedor:'', natureza:'Remote Operated Unit (ROMU)', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:11999.95, est_total:83999.65, custo_real:61937.76, custo_proj:83999.65, custo_spot:0, custo_contratos:61937.76, variacao:0.0, variacao_pct:0.0, selling:131543.44, medicao:'SIM', obs:'' },
    { id:'2.1.1.7', g1:'2', g2:'2.1', g3:'2.1.1', descricao:'Ajudante de Serviços Gerais', fornecedor:'', natureza:'Remote Operated Unit (ROMU)', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:3549.3, est_total:24845.1, custo_real:0.0, custo_proj:24845.1, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:38907.4, medicao:'SIM', obs:'' },
    { id:'2.1.5.1', g1:'2', g2:'2.1', g3:'2.1.5', descricao:'Conjunto motobomba baixa pressão', fornecedor:'', natureza:'Low-Pressure System', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:29575.0, est_total:266175.0, custo_real:0.0, custo_proj:261000.0, custo_spot:0, custo_contratos:0, variacao:5175.0, variacao_pct:0.02, selling:416830.05, medicao:'SIM', obs:'' },
    { id:'2.1.5.2', g1:'2', g2:'2.1', g3:'2.1.5', descricao:'Mangueira Sucção 8" com válvula de pé, incluindo acessórios para conexões, intertravamento e flutuação', fornecedor:'', natureza:'Low-Pressure System', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:6700.0, est_total:60300.0, custo_real:0.0, custo_proj:60300.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:94429.8, medicao:'SIM', obs:'' },
    { id:'2.1.5.3', g1:'2', g2:'2.1', g3:'2.1.5', descricao:'Mangotes Fraser 8¨ (conjunto de 5 mangotes)', fornecedor:'', natureza:'Low-Pressure System', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:0.0, est_total:0.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:0.0, medicao:'SIM', obs:'' },
    { id:'2.1.5.4', g1:'2', g2:'2.1', g3:'2.1.5', descricao:'Parafusos, porcas e arruelas (estojo)', fornecedor:'', natureza:'Low-Pressure System', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:0.0, est_total:0.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:0.0, medicao:'SIM', obs:'' },
    { id:'2.1.5.5', g1:'2', g2:'2.1', g3:'2.1.5', descricao:'Diesel', fornecedor:'', natureza:'Low-Pressure System', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:0.0, est_total:0.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:0.0, medicao:'SIM', obs:'' },
    { id:'2.1.5.6', g1:'2', g2:'2.1', g3:'2.1.5', descricao:'Tanque externo para combustível 1.000L, incluindo instalações e acessórios', fornecedor:'', natureza:'Low-Pressure System', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:185.0, est_total:1665.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:1665.0, variacao_pct:1.0, selling:2607.39, medicao:'SIM', obs:'' },
    { id:'2.1.6.1', g1:'2', g2:'2.1', g3:'2.1.6', descricao:'Gerador 330kVa - 440v (eRomu, motobomba elétrica e backup)', fornecedor:'ABC GERADORES', natureza:'Power Supply', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:23000.0, est_total:207000.0, custo_real:182011.76, custo_proj:160638.21, custo_spot:0, custo_contratos:182011.76, variacao:46361.79, variacao_pct:0.22, selling:324162.0, medicao:'SIM', obs:'' },
    { id:'2.1.6.2', g1:'2', g2:'2.1', g3:'2.1.6', descricao:'Gerador 55kVa - 220v (Escritório Central, avançado e backup)', fornecedor:'ABC GERADORES', natureza:'Power Supply', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:15000.0, est_total:135000.0, custo_real:74923.76, custo_proj:90000.0, custo_spot:0, custo_contratos:74923.76, variacao:45000.0, variacao_pct:0.33, selling:211410.09, medicao:'SIM', obs:'' },
    { id:'2.1.6.3', g1:'2', g2:'2.1', g3:'2.1.6', descricao:'Tanque externo para combustível 1.000L', fornecedor:'TBD', natureza:'Power Supply', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:555.0, est_total:4995.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:4995.0, variacao_pct:1.0, selling:7822.17, medicao:'SIM', obs:'' },
    { id:'3.1.1.1', g1:'3', g2:'3.1', g3:'3.1.1', descricao:'RETROESCAVADEIRA CAT 416 - CUSTO FIXO', fornecedor:'ETS', natureza:'Hydraulic Excavators', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:25000.0, est_total:175000.0, custo_real:125000.0, custo_proj:175000.0, custo_spot:0, custo_contratos:125000.0, variacao:0.0, variacao_pct:0.0, selling:274050.0, medicao:'SIM', obs:'' },
    { id:'3.2.1.1', g1:'3', g2:'3.2', g3:'3.2.1', descricao:'CAMINHÃO MUNCK 20 T (INCLUSO PLANO DE RIGGING) - CUSTO FIXO - ADM', fornecedor:'ETS', natureza:'Diesel Trucks', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:38000.0, est_total:266000.0, custo_real:190147.89, custo_proj:231000.0, custo_spot:0, custo_contratos:190147.89, variacao:35000.0, variacao_pct:0.13, selling:416556.07, medicao:'SIM', obs:'' },
    { id:'3.2.1.3', g1:'3', g2:'3.2', g3:'3.2.1', descricao:'CAMINHÃO COMBOIO 6 M³ LUBRIFICANTE 4X4 (ALTA VAZÃO) - CUSTO FIXO - ADM', fornecedor:'ETS', natureza:'Diesel Trucks', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:48600.0, est_total:340200.0, custo_real:166160.0, custo_proj:238700.0, custo_spot:0, custo_contratos:166160.0, variacao:101500.0, variacao_pct:0.3, selling:532753.2, medicao:'SIM', obs:'' },
    { id:'3.3.1.1', g1:'3', g2:'3.3', g3:'3.3.1', descricao:'LEVANTAMENTO PLANIALTIMÉTRICO COM DRONE.', fornecedor:'TBD', natureza:'Area Surveying', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:60.0, est_unit:2167.0, est_total:130020.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:130020.0, variacao_pct:1.0, selling:203611.2, medicao:'NÃO', obs:'' },
    { id:'2.1.4.7', g1:'2', g2:'2.1', g3:'2.1.4', descricao:'Conserto  Motor de Partida', fornecedor:'Inácio Eletromecânica', natureza:'High-Pressure System', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:0.0, est_total:0.0, custo_real:0.0, custo_proj:0.0, custo_spot:0.0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:0, medicao:'SIM', obs:'' },
    { id:'2.1.4.8', g1:'2', g2:'2.1', g3:'2.1.4', descricao:'Trasporte Bateria para Equipamento', fornecedor:'Transdica', natureza:'High-Pressure System', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:0.0, est_total:0.0, custo_real:195.0, custo_proj:0.0, custo_spot:195.0, custo_contratos:0, variacao:-195.0, variacao_pct:-1.0, selling:0, medicao:'SIM', obs:'' },
    { id:'1.8.1.14', g1:'1', g2:'1.8', g3:'1.8.1', descricao:'Bacia de contenção Geradores', fornecedor:'Brasil Contentores', natureza:'Central Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:0, est_total:0.0, custo_real:10052.06, custo_proj:0.0, custo_spot:10052.06, custo_contratos:0, variacao:-10052.06, variacao_pct:-1.0, selling:0, medicao:'SIM', obs:'' },
    { id:'1.8.2.14', g1:'1', g2:'1.8', g3:'1.8.2', descricao:'Bacia de contenção Geradores', fornecedor:'Brasil Contentores', natureza:'Advanced Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:0, est_total:0.0, custo_real:7660.77, custo_proj:0.0, custo_spot:7660.77, custo_contratos:0, variacao:-7660.77, variacao_pct:-1.0, selling:0, medicao:'SIM', obs:'' },
    { id:'1.8.1.15', g1:'1', g2:'1.8', g3:'1.8.1', descricao:'Caixa de dejetos', fornecedor:'Tecnomódulo', natureza:'Central Construction Site Maintenance & Operation', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:0.0, est_total:0.0, custo_real:15000.0, custo_proj:21000.0, custo_spot:0, custo_contratos:15000.0, variacao:-21000.0, variacao_pct:-1.0, selling:0, medicao:'SIM', obs:'' },
    { id:'1.1.5.2', g1:'1', g2:'1.1', g3:'1.1.5', descricao:'Plano de  rigging para içamento de containers', fornecedor:'G’Hoist Engenharia', natureza:'Engineering Projects', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:0, est_total:0.0, custo_real:5000.0, custo_proj:0.0, custo_spot:5000.0, custo_contratos:0, variacao:-5000.0, variacao_pct:-1.0, selling:0, medicao:'SIM', obs:'' },
    { id:'2.1.3.1', g1:'2', g2:'2.1', g3:'2.1.3', descricao:'Mesa de Controle', fornecedor:'', natureza:'Remote Operation Room / Container', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:7000.0, est_total:49000.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:49000.0, variacao_pct:1.0, selling:76734.0, medicao:'SIM', obs:'' },
    { id:'2.1.3.2', g1:'2', g2:'2.1', g3:'2.1.3', descricao:'Conjunto de antenas de comunicação', fornecedor:'', natureza:'Remote Operation Room / Container', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:250.0, est_total:1750.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:1750.0, variacao_pct:1.0, selling:2740.5, medicao:'SIM', obs:'' },
    { id:'2.1.3.3', g1:'2', g2:'2.1', g3:'2.1.3', descricao:'Monitor 42"', fornecedor:'', natureza:'Remote Operation Room / Container', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:750.0, est_total:5250.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:5250.0, variacao_pct:1.0, selling:8221.5, medicao:'SIM', obs:'' },
    { id:'2.1.3.4', g1:'2', g2:'2.1', g3:'2.1.3', descricao:'Operador de Equipamentos', fornecedor:'', natureza:'Remote Operation Room / Container', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:7.0, est_unit:35999.85, est_total:251998.95, custo_real:177690.31, custo_proj:0.0, custo_spot:0, custo_contratos:177690.31, variacao:251998.95, variacao_pct:1.0, selling:394630.39, medicao:'SIM', obs:'' },
    { id:'2.1.4.1', g1:'2', g2:'2.1', g3:'2.1.4', descricao:'Conjunto motobomba alta pressão - elétrica (inclusive backup)', fornecedor:'', natureza:'High-Pressure System', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:45000.0, est_total:405000.0, custo_real:75161.98, custo_proj:0.0, custo_spot:0, custo_contratos:75161.98, variacao:405000.0, variacao_pct:1.0, selling:634230.0, medicao:'SIM', obs:'' },
    { id:'2.1.4.2', g1:'2', g2:'2.1', g3:'2.1.4', descricao:'Painel Elétrico', fornecedor:'', natureza:'High-Pressure System', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:2500.0, est_total:22500.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:22500.0, variacao_pct:1.0, selling:35235.09, medicao:'SIM', obs:'' },
    { id:'2.1.4.3', g1:'2', g2:'2.1', g3:'2.1.4', descricao:'Mecânico Montador', fornecedor:'', natureza:'High-Pressure System', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:11999.95, est_total:107999.55, custo_real:61937.76, custo_proj:0.0, custo_spot:0, custo_contratos:61937.76, variacao:107999.55, variacao_pct:1.0, selling:169127.28, medicao:'SIM', obs:'' },
    { id:'2.1.4.4', g1:'2', g2:'2.1', g3:'2.1.4', descricao:'Ajudante de Serviços Gerais', fornecedor:'', natureza:'High-Pressure System', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:3549.3, est_total:31943.7, custo_real:20561.31, custo_proj:0.0, custo_spot:0, custo_contratos:20561.31, variacao:31943.7, variacao_pct:1.0, selling:50023.8, medicao:'SIM', obs:'' },
    { id:'2.1.4.5', g1:'2', g2:'2.1', g3:'2.1.4', descricao:'Mangotes Fraser 8¨ (conjunto de 5 mangotes)', fornecedor:'', natureza:'High-Pressure System', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:0.0, est_total:0.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:0.0, medicao:'SIM', obs:'' },
    { id:'2.1.4.6', g1:'2', g2:'2.1', g3:'2.1.4', descricao:'Parafusos, porcas e arruelas (estojo)', fornecedor:'', natureza:'High-Pressure System', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:0.0, est_total:0.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:0.0, medicao:'SIM', obs:'' },
    { id:'2.1.5.7', g1:'2', g2:'2.1', g3:'2.1.5', descricao:'Mecânico Montador', fornecedor:'', natureza:'Low-Pressure System', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:11999.95, est_total:107999.55, custo_real:61937.76, custo_proj:0.0, custo_spot:0, custo_contratos:61937.76, variacao:107999.55, variacao_pct:1.0, selling:169127.28, medicao:'SIM', obs:'' },
    { id:'2.1.5.8', g1:'2', g2:'2.1', g3:'2.1.5', descricao:'Ajudante de Serviços Gerais', fornecedor:'', natureza:'Low-Pressure System', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:3549.3, est_total:31943.7, custo_real:20561.31, custo_proj:0.0, custo_spot:0, custo_contratos:20561.31, variacao:31943.7, variacao_pct:1.0, selling:50023.8, medicao:'SIM', obs:'' },
    { id:'2.1.6.4', g1:'2', g2:'2.1', g3:'2.1.6', descricao:'Mecânico Montador', fornecedor:'', natureza:'Power Supply', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:11999.95, est_total:107999.55, custo_real:61937.76, custo_proj:0.0, custo_spot:0, custo_contratos:61937.76, variacao:107999.55, variacao_pct:1.0, selling:169127.28, medicao:'SIM', obs:'' },
    { id:'2.1.6.5', g1:'2', g2:'2.1', g3:'2.1.6', descricao:'Ajudante de Serviços Gerais', fornecedor:'', natureza:'Power Supply', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:3549.3, est_total:31943.7, custo_real:20561.31, custo_proj:0.0, custo_spot:0, custo_contratos:20561.31, variacao:31943.7, variacao_pct:1.0, selling:50023.8, medicao:'SIM', obs:'' },
    { id:'2.1.6.6', g1:'2', g2:'2.1', g3:'2.1.6', descricao:'Diesel', fornecedor:'', natureza:'Power Supply', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:9.0, est_unit:0.0, est_total:0.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:0.0, medicao:'SIM', obs:'' },
    { id:'2.1.7.1', g1:'2', g2:'2.1', g3:'2.1.7', descricao:'Serralheria (material e fabricação)', fornecedor:'', natureza:'Supply and Installation of Modular Roofing', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:6.0, est_unit:7000.0, est_total:42000.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:42000.0, variacao_pct:1.0, selling:65772.0, medicao:'SIM', obs:'' },
    { id:'2.1.7.2', g1:'2', g2:'2.1', g3:'2.1.7', descricao:'Mecânico Montador', fornecedor:'', natureza:'Supply and Installation of Modular Roofing', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:6.0, est_unit:600.0, est_total:3600.0, custo_real:61937.76, custo_proj:0.0, custo_spot:0, custo_contratos:61937.76, variacao:3600.0, variacao_pct:1.0, selling:5637.6, medicao:'SIM', obs:'' },
    { id:'2.1.7.3', g1:'2', g2:'2.1', g3:'2.1.7', descricao:'Ajudante de Serviços Gerais', fornecedor:'', natureza:'Supply and Installation of Modular Roofing', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:6.0, est_unit:354.96, est_total:2129.76, custo_real:20561.31, custo_proj:0.0, custo_spot:0, custo_contratos:20561.31, variacao:2129.76, variacao_pct:1.0, selling:3335.16, medicao:'SIM', obs:'' },
    { id:'4.1.1.1', g1:'4', g2:'4.1', g3:'4.1.1', descricao:'Caminhão guindauto tipo munck (incluido operador)', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:50.0, est_total:2100.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:2100.0, variacao_pct:1.0, selling:3288.6, medicao:'NÃO', obs:'' },
    { id:'4.1.1.2', g1:'4', g2:'4.1', g3:'4.1.1', descricao:'Talha tipo Tirfor 1500kg', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:212.5, est_total:8925.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:8925.0, variacao_pct:1.0, selling:13976.76, medicao:'NÃO', obs:'' },
    { id:'4.1.1.3', g1:'4', g2:'4.1', g3:'4.1.1', descricao:'Esmerilhadeira Elétrica', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:300.0, est_total:12600.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:12600.0, variacao_pct:1.0, selling:19732.02, medicao:'NÃO', obs:'' },
    { id:'4.1.1.4', g1:'4', g2:'4.1', g3:'4.1.1', descricao:'Retificadeira Ponta Montada', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:250.0, est_total:10500.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:10500.0, variacao_pct:1.0, selling:16443.0, medicao:'NÃO', obs:'' },
    { id:'4.1.1.5', g1:'4', g2:'4.1', g3:'4.1.1', descricao:'Parafusadeira Elétrica', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:300.0, est_total:12600.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:12600.0, variacao_pct:1.0, selling:19732.02, medicao:'NÃO', obs:'' },
    { id:'4.1.1.6', g1:'4', g2:'4.1', g3:'4.1.1', descricao:'Torquimetro', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:162.5, est_total:6825.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:6825.0, variacao_pct:1.0, selling:10688.16, medicao:'NÃO', obs:'' },
    { id:'4.1.1.7', g1:'4', g2:'4.1', g3:'4.1.1', descricao:'Talha tipo catraca 750kg', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:212.5, est_total:8925.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:8925.0, variacao_pct:1.0, selling:13976.76, medicao:'NÃO', obs:'' },
    { id:'4.1.1.8', g1:'4', g2:'4.1', g3:'4.1.1', descricao:'Mecânico Montador', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:187.5, est_total:7875.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:7875.0, variacao_pct:1.0, selling:12332.46, medicao:'NÃO', obs:'' },
    { id:'4.1.1.9', g1:'4', g2:'4.1', g3:'4.1.1', descricao:'Auxiliar Mecânico Montador', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:110.93, est_total:4659.06, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:4659.06, variacao_pct:1.0, selling:7296.24, medicao:'NÃO', obs:'' },
    { id:'4.1.1.10', g1:'4', g2:'4.1', g3:'4.1.1', descricao:'Ponta montada para desbaste', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:10.0, est_total:420.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:420.0, variacao_pct:1.0, selling:657.72, medicao:'NÃO', obs:'' },
    { id:'4.1.1.11', g1:'4', g2:'4.1', g3:'4.1.1', descricao:'Disco de Corte', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:15.75, est_total:661.5, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:661.5, variacao_pct:1.0, selling:1035.72, medicao:'NÃO', obs:'' },
    { id:'4.1.1.12', g1:'4', g2:'4.1', g3:'4.1.1', descricao:'Disco de Desbaste', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:11.25, est_total:472.5, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:472.5, variacao_pct:1.0, selling:740.04, medicao:'NÃO', obs:'' },
    { id:'4.1.1.13', g1:'4', g2:'4.1', g3:'4.1.1', descricao:'Material de consumo diversos para montagem da tubulação (ferramentas manuais)', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:275.0, est_total:11550.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:11550.0, variacao_pct:1.0, selling:18087.3, medicao:'NÃO', obs:'' },
    { id:'4.1.2.1', g1:'4', g2:'4.1', g3:'4.1.2', descricao:'Caminhão guindauto tipo munck (incluido operador)', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:44.0, est_total:1848.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:1848.0, variacao_pct:1.0, selling:2893.38, medicao:'NÃO', obs:'' },
    { id:'4.1.2.2', g1:'4', g2:'4.1', g3:'4.1.2', descricao:'Talha tipo Tirfor 1500kg', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:191.25, est_total:8032.5, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:8032.5, variacao_pct:1.0, selling:12579.0, medicao:'NÃO', obs:'' },
    { id:'4.1.2.3', g1:'4', g2:'4.1', g3:'4.1.2', descricao:'Esmerilhadeira Elétrica', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:270.0, est_total:11340.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:11340.0, variacao_pct:1.0, selling:17758.44, medicao:'NÃO', obs:'' },
    { id:'4.1.2.4', g1:'4', g2:'4.1', g3:'4.1.2', descricao:'Retificadeira Ponta Montada', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:225.0, est_total:9450.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:9450.0, variacao_pct:1.0, selling:14798.7, medicao:'NÃO', obs:'' },
    { id:'4.1.2.5', g1:'4', g2:'4.1', g3:'4.1.2', descricao:'Parafusadeira Elétrica', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:270.0, est_total:11340.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:11340.0, variacao_pct:1.0, selling:17758.44, medicao:'NÃO', obs:'' },
    { id:'4.1.2.6', g1:'4', g2:'4.1', g3:'4.1.2', descricao:'Torquimetro', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:146.25, est_total:6142.5, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:6142.5, variacao_pct:1.0, selling:9619.26, medicao:'NÃO', obs:'' },
    { id:'4.1.2.7', g1:'4', g2:'4.1', g3:'4.1.2', descricao:'Talha tipo catraca 750kg', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:191.25, est_total:8032.5, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:8032.5, variacao_pct:1.0, selling:12579.0, medicao:'NÃO', obs:'' },
    { id:'4.1.2.8', g1:'4', g2:'4.1', g3:'4.1.2', descricao:'Mecânico Montador', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:168.75, est_total:7087.5, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:7087.5, variacao_pct:1.0, selling:11098.92, medicao:'NÃO', obs:'' },
    { id:'4.1.2.9', g1:'4', g2:'4.1', g3:'4.1.2', descricao:'Auxiliar Mecânico Montador', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:99.83, est_total:4192.86, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:4192.86, variacao_pct:1.0, selling:6565.86, medicao:'NÃO', obs:'' },
    { id:'4.1.2.10', g1:'4', g2:'4.1', g3:'4.1.2', descricao:'Ponta montada para desbaste', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:10.0, est_total:420.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:420.0, variacao_pct:1.0, selling:657.72, medicao:'NÃO', obs:'' },
    { id:'4.1.2.11', g1:'4', g2:'4.1', g3:'4.1.2', descricao:'Disco de Corte', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:13.5, est_total:567.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:567.0, variacao_pct:1.0, selling:887.88, medicao:'NÃO', obs:'' },
    { id:'4.1.2.12', g1:'4', g2:'4.1', g3:'4.1.2', descricao:'Disco de Desbaste', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:9.0, est_total:378.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:378.0, variacao_pct:1.0, selling:591.78, medicao:'NÃO', obs:'' },
    { id:'4.1.2.13', g1:'4', g2:'4.1', g3:'4.1.2', descricao:'Material de consumo diversos para montagem da tubulação (ferramentas manuais)', fornecedor:'', natureza:'HDPE Pipe Installation (ISO 4427) –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:275.0, est_total:11550.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:11550.0, variacao_pct:1.0, selling:18087.3, medicao:'NÃO', obs:'' },
    { id:'4.1.3.1', g1:'4', g2:'4.1', g3:'4.1.3', descricao:'Caminhão guindauto tipo munck (incluido operador)', fornecedor:'', natureza:'High-Pressure Galvanized Pipe Installation – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:70.0, est_total:2940.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:2940.0, variacao_pct:1.0, selling:4604.04, medicao:'NÃO', obs:'' },
    { id:'4.1.3.2', g1:'4', g2:'4.1', g3:'4.1.3', descricao:'Talha tipo Tirfor 1500kg', fornecedor:'', natureza:'High-Pressure Galvanized Pipe Installation – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:297.5, est_total:12495.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:12495.0, variacao_pct:1.0, selling:19567.38, medicao:'NÃO', obs:'' },
    { id:'4.1.3.3', g1:'4', g2:'4.1', g3:'4.1.3', descricao:'Parafusadeira Elétrica', fornecedor:'', natureza:'High-Pressure Galvanized Pipe Installation – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:420.0, est_total:17640.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:17640.0, variacao_pct:1.0, selling:27624.66, medicao:'NÃO', obs:'' },
    { id:'4.1.3.4', g1:'4', g2:'4.1', g3:'4.1.3', descricao:'Torquimetro', fornecedor:'', natureza:'High-Pressure Galvanized Pipe Installation – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:227.5, est_total:9555.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:9555.0, variacao_pct:1.0, selling:14963.34, medicao:'NÃO', obs:'' },
    { id:'4.1.3.5', g1:'4', g2:'4.1', g3:'4.1.3', descricao:'Talha tipo catraca 750kg', fornecedor:'', natureza:'High-Pressure Galvanized Pipe Installation – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:297.5, est_total:12495.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:12495.0, variacao_pct:1.0, selling:19567.38, medicao:'NÃO', obs:'' },
    { id:'4.1.3.6', g1:'4', g2:'4.1', g3:'4.1.3', descricao:'Mecânico Montador', fornecedor:'', natureza:'High-Pressure Galvanized Pipe Installation – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:213.75, est_total:8977.5, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:8977.5, variacao_pct:1.0, selling:14058.66, medicao:'NÃO', obs:'' },
    { id:'4.1.3.7', g1:'4', g2:'4.1', g3:'4.1.3', descricao:'Auxiliar Mecânico Montador', fornecedor:'', natureza:'High-Pressure Galvanized Pipe Installation – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:155.3, est_total:6522.6, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:6522.6, variacao_pct:1.0, selling:10214.4, medicao:'NÃO', obs:'' },
    { id:'4.1.3.8', g1:'4', g2:'4.1', g3:'4.1.3', descricao:'Ponta montada para desbaste', fornecedor:'', natureza:'High-Pressure Galvanized Pipe Installation – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:10.0, est_total:420.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:420.0, variacao_pct:1.0, selling:657.72, medicao:'NÃO', obs:'' },
    { id:'4.1.3.9', g1:'4', g2:'4.1', g3:'4.1.3', descricao:'Disco de Corte', fornecedor:'', natureza:'High-Pressure Galvanized Pipe Installation – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:13.5, est_total:567.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:567.0, variacao_pct:1.0, selling:887.88, medicao:'NÃO', obs:'' },
    { id:'4.1.3.10', g1:'4', g2:'4.1', g3:'4.1.3', descricao:'Disco de Desbaste', fornecedor:'', natureza:'High-Pressure Galvanized Pipe Installation – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:9.0, est_total:378.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:378.0, variacao_pct:1.0, selling:591.78, medicao:'NÃO', obs:'' },
    { id:'4.1.3.11', g1:'4', g2:'4.1', g3:'4.1.3', descricao:'Material de consumo diversos para montagem da tubulação (ferramentas manuais)', fornecedor:'', natureza:'High-Pressure Galvanized Pipe Installation – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:275.0, est_total:11550.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:11550.0, variacao_pct:1.0, selling:18087.3, medicao:'NÃO', obs:'' },
    { id:'4.2.1.1', g1:'4', g2:'4.2', g3:'4.2.1', descricao:'Caminhão guindauto tipo munck (incluido operador)', fornecedor:'', natureza:'Rubber Hose Installation (ASME B16.5 – Class 150)', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:800.0, est_total:800.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:800.0, variacao_pct:1.0, selling:1252.8, medicao:'NÃO', obs:'' },
    { id:'4.2.1.2', g1:'4', g2:'4.2', g3:'4.2.1', descricao:'Parafusadeira Elétrica', fornecedor:'', natureza:'Rubber Hose Installation (ASME B16.5 – Class 150)', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:480.0, est_total:480.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:480.0, variacao_pct:1.0, selling:751.68, medicao:'NÃO', obs:'' },
    { id:'4.2.1.3', g1:'4', g2:'4.2', g3:'4.2.1', descricao:'Torquimetro', fornecedor:'', natureza:'Rubber Hose Installation (ASME B16.5 – Class 150)', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:260.0, est_total:260.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:260.0, variacao_pct:1.0, selling:407.17, medicao:'NÃO', obs:'' },
    { id:'4.2.1.4', g1:'4', g2:'4.2', g3:'4.2.1', descricao:'Talha tipo catraca 750kg', fornecedor:'', natureza:'Rubber Hose Installation (ASME B16.5 – Class 150)', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:340.0, est_total:340.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:340.0, variacao_pct:1.0, selling:532.45, medicao:'NÃO', obs:'' },
    { id:'4.2.1.5', g1:'4', g2:'4.2', g3:'4.2.1', descricao:'Mecânico Montador', fornecedor:'', natureza:'Rubber Hose Installation (ASME B16.5 – Class 150)', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:600.0, est_total:600.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:600.0, variacao_pct:1.0, selling:939.6, medicao:'NÃO', obs:'' },
    { id:'4.2.1.6', g1:'4', g2:'4.2', g3:'4.2.1', descricao:'Auxiliar Mecânico Montador', fornecedor:'', natureza:'Rubber Hose Installation (ASME B16.5 – Class 150)', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:709.92, est_total:709.92, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:709.92, variacao_pct:1.0, selling:1111.74, medicao:'NÃO', obs:'' },
    { id:'4.2.1.7', g1:'4', g2:'4.2', g3:'4.2.1', descricao:'Material de consumo diversos para montagem da tubulação (ferramentas manuais)', fornecedor:'', natureza:'Rubber Hose Installation (ASME B16.5 – Class 150)', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:275.0, est_total:275.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:275.0, variacao_pct:1.0, selling:430.65, medicao:'NÃO', obs:'' },
    { id:'4.3.1.1', g1:'4', g2:'4.3', g3:'4.3.1', descricao:'Caminhão guindauto tipo munck (incluido operador)', fornecedor:'', natureza:'HDPE Pipe Dismantling – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:30.0, est_total:1260.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:1260.0, variacao_pct:1.0, selling:1973.16, medicao:'NÃO', obs:'' },
    { id:'4.3.1.2', g1:'4', g2:'4.3', g3:'4.3.1', descricao:'Parafusadeira Elétrica', fornecedor:'', natureza:'HDPE Pipe Dismantling – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:300.0, est_total:12600.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:12600.0, variacao_pct:1.0, selling:19732.02, medicao:'NÃO', obs:'' },
    { id:'4.3.1.3', g1:'4', g2:'4.3', g3:'4.3.1', descricao:'Talha tipo catraca 750kg', fornecedor:'', natureza:'HDPE Pipe Dismantling – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:212.5, est_total:8925.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:8925.0, variacao_pct:1.0, selling:13976.76, medicao:'NÃO', obs:'' },
    { id:'4.3.1.4', g1:'4', g2:'4.3', g3:'4.3.1', descricao:'Mecânico Montador', fornecedor:'', natureza:'HDPE Pipe Dismantling – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:187.5, est_total:7875.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:7875.0, variacao_pct:1.0, selling:12332.46, medicao:'NÃO', obs:'' },
    { id:'4.3.1.5', g1:'4', g2:'4.3', g3:'4.3.1', descricao:'Auxiliar Mecânico Montador', fornecedor:'', natureza:'HDPE Pipe Dismantling – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:110.93, est_total:4659.06, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:4659.06, variacao_pct:1.0, selling:7296.24, medicao:'NÃO', obs:'' },
    { id:'4.3.1.6', g1:'4', g2:'4.3', g3:'4.3.1', descricao:'Material de consumo diversos e ferramentas para montagem da tubulação', fornecedor:'', natureza:'HDPE Pipe Dismantling – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:150.0, est_total:6300.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:6300.0, variacao_pct:1.0, selling:9865.8, medicao:'NÃO', obs:'' },
    { id:'4.3.2.1', g1:'4', g2:'4.3', g3:'4.3.2', descricao:'Caminhão guindauto tipo munck (incluido operador)', fornecedor:'', natureza:'HDPE Pipe Dismantling –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:30.0, est_total:1260.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:1260.0, variacao_pct:1.0, selling:1973.16, medicao:'NÃO', obs:'' },
    { id:'4.3.2.2', g1:'4', g2:'4.3', g3:'4.3.2', descricao:'Parafusadeira Elétrica', fornecedor:'', natureza:'HDPE Pipe Dismantling –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:282.0, est_total:11844.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:11844.0, variacao_pct:1.0, selling:18547.62, medicao:'NÃO', obs:'' },
    { id:'4.3.2.3', g1:'4', g2:'4.3', g3:'4.3.2', descricao:'Talha tipo catraca 750kg', fornecedor:'', natureza:'HDPE Pipe Dismantling –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:199.75, est_total:8389.5, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:8389.5, variacao_pct:1.0, selling:13138.02, medicao:'NÃO', obs:'' },
    { id:'4.3.2.4', g1:'4', g2:'4.3', g3:'4.3.2', descricao:'Mecânico Montador', fornecedor:'', natureza:'HDPE Pipe Dismantling –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:187.5, est_total:7875.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:7875.0, variacao_pct:1.0, selling:12332.46, medicao:'NÃO', obs:'' },
    { id:'4.3.2.5', g1:'4', g2:'4.3', g3:'4.3.2', descricao:'Auxiliar Mecânico Montador', fornecedor:'', natureza:'HDPE Pipe Dismantling –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:110.93, est_total:4659.06, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:4659.06, variacao_pct:1.0, selling:7296.24, medicao:'NÃO', obs:'' },
    { id:'4.3.2.6', g1:'4', g2:'4.3', g3:'4.3.2', descricao:'Material de consumo diversos e ferramentas para montagem da tubulação', fornecedor:'', natureza:'HDPE Pipe Dismantling –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:150.0, est_total:6300.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:6300.0, variacao_pct:1.0, selling:9865.8, medicao:'NÃO', obs:'' },
    { id:'4.3.3.1', g1:'4', g2:'4.3', g3:'4.3.3', descricao:'Caminhão guindauto tipo munck (incluido operador)', fornecedor:'', natureza:'Galvanized Pipe and Valve Dismantling – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:30.0, est_total:1260.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:1260.0, variacao_pct:1.0, selling:1973.16, medicao:'NÃO', obs:'' },
    { id:'4.3.3.2', g1:'4', g2:'4.3', g3:'4.3.3', descricao:'Parafusadeira Elétrica', fornecedor:'', natureza:'Galvanized Pipe and Valve Dismantling – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:300.0, est_total:12600.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:12600.0, variacao_pct:1.0, selling:19732.02, medicao:'NÃO', obs:'' },
    { id:'4.3.3.3', g1:'4', g2:'4.3', g3:'4.3.3', descricao:'Talha tipo catraca 750kg', fornecedor:'', natureza:'Galvanized Pipe and Valve Dismantling – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:212.5, est_total:8925.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:8925.0, variacao_pct:1.0, selling:13976.76, medicao:'NÃO', obs:'' },
    { id:'4.3.3.4', g1:'4', g2:'4.3', g3:'4.3.3', descricao:'Mecânico Montador', fornecedor:'', natureza:'Galvanized Pipe and Valve Dismantling – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:187.5, est_total:7875.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:7875.0, variacao_pct:1.0, selling:12332.46, medicao:'NÃO', obs:'' },
    { id:'4.3.3.5', g1:'4', g2:'4.3', g3:'4.3.3', descricao:'Auxiliar Mecânico Montador', fornecedor:'', natureza:'Galvanized Pipe and Valve Dismantling – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:110.93, est_total:4659.06, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:4659.06, variacao_pct:1.0, selling:7296.24, medicao:'NÃO', obs:'' },
    { id:'4.3.3.6', g1:'4', g2:'4.3', g3:'4.3.3', descricao:'Material de consumo diversos e ferramentas para montagem da tubulação', fornecedor:'', natureza:'Galvanized Pipe and Valve Dismantling – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:150.0, est_total:6300.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:6300.0, variacao_pct:1.0, selling:9865.8, medicao:'NÃO', obs:'' },
    { id:'4.4.1.1', g1:'4', g2:'4.4', g3:'4.4.1', descricao:'Caminhão guindauto tipo munck (incluido operador)', fornecedor:'', natureza:'Rubber Hose Dismantling', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:800.0, est_total:800.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:800.0, variacao_pct:1.0, selling:1252.8, medicao:'NÃO', obs:'' },
    { id:'4.4.1.2', g1:'4', g2:'4.4', g3:'4.4.1', descricao:'Parafusadeira Elétrica', fornecedor:'', natureza:'Rubber Hose Dismantling', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:480.0, est_total:480.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:480.0, variacao_pct:1.0, selling:751.68, medicao:'NÃO', obs:'' },
    { id:'4.4.1.3', g1:'4', g2:'4.4', g3:'4.4.1', descricao:'Talha tipo catraca 750kg', fornecedor:'', natureza:'Rubber Hose Dismantling', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:340.0, est_total:340.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:340.0, variacao_pct:1.0, selling:532.45, medicao:'NÃO', obs:'' },
    { id:'4.4.1.4', g1:'4', g2:'4.4', g3:'4.4.1', descricao:'Mecânico Montador', fornecedor:'', natureza:'Rubber Hose Dismantling', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:600.0, est_total:600.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:600.0, variacao_pct:1.0, selling:939.6, medicao:'NÃO', obs:'' },
    { id:'4.4.1.5', g1:'4', g2:'4.4', g3:'4.4.1', descricao:'Auxiliar Mecânico Montador', fornecedor:'', natureza:'Rubber Hose Dismantling', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:709.92, est_total:709.92, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:709.92, variacao_pct:1.0, selling:1111.74, medicao:'NÃO', obs:'' },
    { id:'4.4.1.6', g1:'4', g2:'4.4', g3:'4.4.1', descricao:'Material de consumo diversos e ferramentas para montagem da tubulação', fornecedor:'', natureza:'Rubber Hose Dismantling', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:150.0, est_total:150.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:150.0, variacao_pct:1.0, selling:234.9, medicao:'NÃO', obs:'' },
    { id:'5.1.1.1', g1:'5', g2:'5.1', g3:'5.1.1', descricao:'Tubo PEAD 10" - 10kgf/cm2', fornecedor:'', natureza:'Supply of HDPE Pipe – Low Pressure – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:288.75, est_total:12127.5, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:12127.5, variacao_pct:1.0, selling:18991.56, medicao:'NÃO', obs:'' },
    { id:'5.1.1.2', g1:'5', g2:'5.1', g3:'5.1.1', descricao:'Conexões PEAD 10"', fornecedor:'', natureza:'Supply of HDPE Pipe – Low Pressure – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:100.0, est_total:4200.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:4200.0, variacao_pct:1.0, selling:6577.62, medicao:'NÃO', obs:'' },
    { id:'5.1.1.3', g1:'5', g2:'5.1', g3:'5.1.1', descricao:'Parafusos, porcas e arruelas (estojo)', fornecedor:'', natureza:'Supply of HDPE Pipe – Low Pressure – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:300.0, est_total:12600.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:12600.0, variacao_pct:1.0, selling:19732.02, medicao:'NÃO', obs:'' },
    { id:'5.1.2.1', g1:'5', g2:'5.1', g3:'5.1.2', descricao:'Caminhão guindauto tipo munck (incluido operador)', fornecedor:'', natureza:'Supply of High-Pressure Galvanized Piping – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:70.0, est_total:2940.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:2940.0, variacao_pct:1.0, selling:4604.04, medicao:'NÃO', obs:'' },
    { id:'5.1.2.2', g1:'5', g2:'5.1', g3:'5.1.2', descricao:'Parafusadeira Elétrica', fornecedor:'', natureza:'Supply of High-Pressure Galvanized Piping – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:420.0, est_total:17640.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:17640.0, variacao_pct:1.0, selling:27624.66, medicao:'NÃO', obs:'' },
    { id:'5.1.2.3', g1:'5', g2:'5.1', g3:'5.1.2', descricao:'Torquimetro', fornecedor:'', natureza:'Supply of High-Pressure Galvanized Piping – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:227.5, est_total:9555.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:9555.0, variacao_pct:1.0, selling:14963.34, medicao:'NÃO', obs:'' },
    { id:'5.1.2.4', g1:'5', g2:'5.1', g3:'5.1.2', descricao:'Talha tipo catraca 750kg', fornecedor:'', natureza:'Supply of High-Pressure Galvanized Piping – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:297.5, est_total:12495.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:12495.0, variacao_pct:1.0, selling:19567.38, medicao:'NÃO', obs:'' },
    { id:'5.1.2.5', g1:'5', g2:'5.1', g3:'5.1.2', descricao:'Tubo galvanizado 10"', fornecedor:'', natureza:'Supply of High-Pressure Galvanized Piping – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:997.5, est_total:41895.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:41895.0, variacao_pct:1.0, selling:65607.78, medicao:'NÃO', obs:'' },
    { id:'5.1.2.6', g1:'5', g2:'5.1', g3:'5.1.2', descricao:'Acoplamentos K10 inlcuindo anel borracha para vedação', fornecedor:'', natureza:'Supply of High-Pressure Galvanized Piping – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:162.5, est_total:6825.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:6825.0, variacao_pct:1.0, selling:10688.16, medicao:'NÃO', obs:'' },
    { id:'5.1.2.7', g1:'5', g2:'5.1', g3:'5.1.2', descricao:'Conexões em tubo galvanizado 10"', fornecedor:'', natureza:'Supply of High-Pressure Galvanized Piping – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:250.0, est_total:10500.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:10500.0, variacao_pct:1.0, selling:16443.0, medicao:'NÃO', obs:'' },
    { id:'5.1.2.8', g1:'5', g2:'5.1', g3:'5.1.2', descricao:'Parafusos, porcas e arruelas (estojo)', fornecedor:'', natureza:'Supply of High-Pressure Galvanized Piping – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:60.0, est_total:2520.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:2520.0, variacao_pct:1.0, selling:3946.74, medicao:'NÃO', obs:'' },
    { id:'5.1.2.9', g1:'5', g2:'5.1', g3:'5.1.2', descricao:'Material de consumo diversos e ferramentas para montagem da tubulação', fornecedor:'', natureza:'Supply of High-Pressure Galvanized Piping – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:250.0, est_total:10500.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:10500.0, variacao_pct:1.0, selling:16443.0, medicao:'NÃO', obs:'' },
    { id:'5.1.2.10', g1:'5', g2:'5.1', g3:'5.1.2', descricao:'Mecânico Montador', fornecedor:'', natureza:'Supply of High-Pressure Galvanized Piping – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:0.0, est_total:0.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:0.0, medicao:'NÃO', obs:'' },
    { id:'5.1.2.11', g1:'5', g2:'5.1', g3:'5.1.2', descricao:'Auxiliar Mecânico Montador', fornecedor:'', natureza:'Supply of High-Pressure Galvanized Piping – 10”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:0.0, est_total:0.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:0.0, medicao:'NÃO', obs:'' },
    { id:'5.1.3.1', g1:'5', g2:'5.1', g3:'5.1.3', descricao:'Caminhão guindauto tipo munck (incluido operador)', fornecedor:'', natureza:'Temporary Supply of Flexible High-Pressure Rubber Hose', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:1600.0, est_total:1600.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:1600.0, variacao_pct:1.0, selling:2505.6, medicao:'NÃO', obs:'' },
    { id:'5.1.3.2', g1:'5', g2:'5.1', g3:'5.1.3', descricao:'Parafusadeira Elétrica', fornecedor:'', natureza:'Temporary Supply of Flexible High-Pressure Rubber Hose', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:960.0, est_total:960.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:960.0, variacao_pct:1.0, selling:1503.36, medicao:'NÃO', obs:'' },
    { id:'5.1.3.3', g1:'5', g2:'5.1', g3:'5.1.3', descricao:'Torquimetro', fornecedor:'', natureza:'Temporary Supply of Flexible High-Pressure Rubber Hose', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:520.0, est_total:520.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:520.0, variacao_pct:1.0, selling:814.32, medicao:'NÃO', obs:'' },
    { id:'5.1.3.4', g1:'5', g2:'5.1', g3:'5.1.3', descricao:'Talha tipo catraca 750kg', fornecedor:'', natureza:'Temporary Supply of Flexible High-Pressure Rubber Hose', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:680.0, est_total:680.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:680.0, variacao_pct:1.0, selling:1064.88, medicao:'NÃO', obs:'' },
    { id:'5.1.3.5', g1:'5', g2:'5.1', g3:'5.1.3', descricao:'Mecânico Montador', fornecedor:'', natureza:'Temporary Supply of Flexible High-Pressure Rubber Hose', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:0.0, est_total:0.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:0.0, medicao:'NÃO', obs:'' },
    { id:'5.1.3.6', g1:'5', g2:'5.1', g3:'5.1.3', descricao:'Auxiliar Mecânico Montador', fornecedor:'', natureza:'Temporary Supply of Flexible High-Pressure Rubber Hose', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:0.0, est_total:0.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:0.0, medicao:'NÃO', obs:'' },
    { id:'5.1.3.7', g1:'5', g2:'5.1', g3:'5.1.3', descricao:'Mangote borracha 10" - alta pressão (conjunto de três mangueiras)', fornecedor:'', natureza:'Temporary Supply of Flexible High-Pressure Rubber Hose', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:52588.47, est_total:52588.47, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:52588.47, variacao_pct:1.0, selling:82353.55, medicao:'NÃO', obs:'' },
    { id:'5.1.3.8', g1:'5', g2:'5.1', g3:'5.1.3', descricao:'Parafusos, porcas e arruelas (estojo)', fornecedor:'', natureza:'Temporary Supply of Flexible High-Pressure Rubber Hose', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:900.0, est_total:900.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:900.0, variacao_pct:1.0, selling:1409.41, medicao:'NÃO', obs:'' },
    { id:'5.1.3.9', g1:'5', g2:'5.1', g3:'5.1.3', descricao:'Material de consumo diversos e ferramentas para montagem da tubulação', fornecedor:'', natureza:'Temporary Supply of Flexible High-Pressure Rubber Hose', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:150.0, est_total:150.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:150.0, variacao_pct:1.0, selling:234.9, medicao:'NÃO', obs:'' },
    { id:'5.1.4.1', g1:'5', g2:'5.1', g3:'5.1.4', descricao:'Tubo PEAD 8" - 10kgf/cm2', fornecedor:'', natureza:'Supply of HDPE Pipe – Low Pressure –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:262.5, est_total:11025.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:11025.0, variacao_pct:1.0, selling:17265.78, medicao:'NÃO', obs:'' },
    { id:'5.1.4.2', g1:'5', g2:'5.1', g3:'5.1.4', descricao:'Conexões PEAD 8"', fornecedor:'', natureza:'Supply of HDPE Pipe – Low Pressure –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:90.0, est_total:3780.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:3780.0, variacao_pct:1.0, selling:5919.48, medicao:'NÃO', obs:'' },
    { id:'5.1.4.3', g1:'5', g2:'5.1', g3:'5.1.4', descricao:'Parafusos, porcas e arruelas (conjunto)', fornecedor:'', natureza:'Supply of HDPE Pipe – Low Pressure –  8”', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'dia', qtd_meses:42.0, est_unit:300.0, est_total:12600.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:12600.0, variacao_pct:1.0, selling:19732.02, medicao:'NÃO', obs:'' },
    { id:'1.1.1.2', g1:'1', g2:'1.1', g3:'1.1.1', descricao:'Custo mensal empregados', fornecedor:'', natureza:'Monthly Labor Cost (Wages, Charges, Taxes, Medical Exams, Training, Health Plan)', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:439368.83, est_total:439368.83, custo_real:672249.05, custo_proj:0.0, custo_spot:0, custo_contratos:672249.05, variacao:439368.83, variacao_pct:1.0, selling:688051.62, medicao:'SIM', obs:'Base do run-rate' },
    { id:'6.1.1.1', g1:'6', g2:'6.1', g3:'6.1.1', descricao:'Mão de obra', fornecedor:'', natureza:'Labor', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:1306737.26, est_total:1306737.26, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:1306737.26, variacao_pct:1.0, selling:2046349.8, medicao:'NÃO', obs:'' },
    { id:'1.4.1.1', g1:'1', g2:'1.4', g3:'1.4.1', descricao:'Custo mensal empregados', fornecedor:'', natureza:'Monthly Labor Cost (Wages, Charges, Taxes, Medical Exams, Training, Health Plan)', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:439368.83, est_total:439368.83, custo_real:0.0, custo_proj:439368.83, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:688051.62, medicao:'SIM', obs:'Base do run-rate' },
    { id:'1.7.3.1', g1:'1', g2:'1.7', g3:'1.7.3', descricao:'Supervisor Operacional', fornecedor:'', natureza:'Advanced Construction Site – Mobilization or Demobilization', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:6.0, est_unit:1939.68, est_total:11638.08, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:11638.08, variacao_pct:1.0, selling:18225.24, medicao:'NÃO', obs:'' },
    { id:'1.9.1.7', g1:'1', g2:'1.9', g3:'1.9.1', descricao:'Aluguel de galpões', fornecedor:'Vários', natureza:'Local Administration', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:8.0, est_unit:0.0, est_total:0.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:0, medicao:'SIM', obs:'' },
    { id:'1.2.1.1', g1:'1', g2:'1.2', g3:'1.2.1', descricao:'MOBILIZAÇÃO DE PESSOAS - EVENTUAIS E OUTRAS (POR INDIVÍDUO)', fornecedor:'', natureza:'Monthly Labor Cost (Wages, Charges, Taxes, Medical Exams, Training, Health Plan)', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:273577.56, est_total:273577.56, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:273577.56, variacao_pct:1.0, selling:428422.44, medicao:'NÃO', obs:'Base do run-rate' },
    { id:'1.3.1.1', g1:'1', g2:'1.3', g3:'1.3.1', descricao:'MOBILIZAÇÃO DE EQUIPAMENTOS - EVENTUAIS E OUTRAS (POR EQUIPAMENTO)', fornecedor:'', natureza:'Monthly Labor Cost (Wages, Charges, Taxes, Medical Exams, Training, Health Plan)', expenditure:'CAPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:180000.0, est_total:180000.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:180000.0, variacao_pct:1.0, selling:281880.12, medicao:'NÃO', obs:'Base do run-rate' },
    { id:'3.2.1.2', g1:'3', g2:'3.2', g3:'3.2.1', descricao:'CAMINHÃO MUNCK 20 T (INCLUSO PLANO DE RIGGING) -  CUSTO VARIÁVEL', fornecedor:'ETS', natureza:'Diesel Trucks', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:147840.0, est_total:147840.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0.0, variacao:147840.0, variacao_pct:1.0, selling:231517.44, medicao:'SIM', obs:'' },
    { id:'3.2.1.4', g1:'3', g2:'3.2', g3:'3.2.1', descricao:'CAMINHÃO COMBOIO 6 M³ LUBRIFICANTE 4X4 (ALTA VAZÃO)  - CUSTO VARIÁVEL', fornecedor:'ETS', natureza:'Diesel Trucks', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:129736.8, est_total:129736.8, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0.0, variacao:129736.8, variacao_pct:1.0, selling:203175.04, medicao:'SIM', obs:'' },
    { id:'3.2.2.1', g1:'3', g2:'3.2', g3:'3.2.2', descricao:'MOBILIZAÇÃO - SEMIREBOQUE TIPO CARREGA-TUDO, PLATAFORMA RETA OU REBAIXADA', fornecedor:'', natureza:'Semi-Trailers for Transport of Non-Roadworthy Equipment (Occasional Use)', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'mês', qtd_meses:3.0, est_unit:5000.0, est_total:15000.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0.0, variacao:15000.0, variacao_pct:1.0, selling:23490.0, medicao:'NÃO', obs:'' },
    { id:'3.2.2.2', g1:'3', g2:'3.2', g3:'3.2.2', descricao:'UTILIZAÇÃO - SEMIREBOQUE TIPO CARREGA-TUDO, PLATAFORMA RETA OU REBAIXADA', fornecedor:'', natureza:'Semi-Trailers for Transport of Non-Roadworthy Equipment (Occasional Use)', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:8500.0, est_total:8500.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0.0, variacao:8500.0, variacao_pct:1.0, selling:13311.0, medicao:'NÃO', obs:'' },
    { id:'3.1.1.2', g1:'3', g2:'3.1', g3:'3.1.1', descricao:'RETROESCAVADEIRA CAT 416 - CUSTO VARIÁVEL', fornecedor:'ETS', natureza:'Hydraulic Excavators', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:225456.0, est_total:225456.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0.0, variacao:225456.0, variacao_pct:1.0, selling:353064.1, medicao:'SIM', obs:'' },
    { id:'2.1.2.1', g1:'2', g2:'2.1', g3:'2.1.2', descricao:'Unidade remota de desmonte hidráulico - eROMU', fornecedor:'', natureza:'Remote Operated Unit (ROMU)', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:306188.51, est_total:306188.51, custo_real:0.0, custo_proj:37296.0, custo_spot:0, custo_contratos:0, variacao:268892.51, variacao_pct:0.88, selling:479494.89, medicao:'SIM', obs:'' },
    { id:'1.5.1.1', g1:'1', g2:'1.5', g3:'1.5.1', descricao:'DESMOBILIZAÇÃO DE PESSOAS - EVENTUAIS E OUTRAS (POR INDIVÍDUO)', fornecedor:'', natureza:'Monthly Labor Cost (Wages, Charges, Taxes, Medical Exams, Training, Health Plan)', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:273577.56, est_total:273577.56, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:273577.56, variacao_pct:1.0, selling:428422.44, medicao:'NÃO', obs:'Base do run-rate' },
    { id:'1.6.1.1', g1:'1', g2:'1.6', g3:'1.6.1', descricao:'DESMOBILIZAÇÃO DE EQUIPAMENTOS - EVENTUAIS E OUTRAS (POR EQUIPAMENTO)', fornecedor:'', natureza:'Monthly Labor Cost (Wages, Charges, Taxes, Medical Exams, Training, Health Plan)', expenditure:'OPEX', tipo_custo:'One-off', recorrente:false, unid_rec:'', qtd_meses:0, est_unit:180000.0, est_total:180000.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:180000.0, variacao_pct:1.0, selling:281880.12, medicao:'NÃO', obs:'Base do run-rate' },
    { id:'1.7.3.2', g1:'1', g2:'1.7', g3:'1.7.3', descricao:'Mecânico Montador', fornecedor:'', natureza:'Advanced Construction Site – Mobilization or Demobilization', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:6.0, est_unit:2400.0, est_total:14400.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:14400.0, variacao_pct:1.0, selling:22550.4, medicao:'NÃO', obs:'' },
    { id:'1.7.3.3', g1:'1', g2:'1.7', g3:'1.7.3', descricao:'Auxiliar de Mecânico Montador', fornecedor:'', natureza:'Advanced Construction Site – Mobilization or Demobilization', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:6.0, est_unit:2129.76, est_total:12778.56, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:12778.56, variacao_pct:1.0, selling:20011.26, medicao:'NÃO', obs:'' },
    { id:'1.7.3.4', g1:'1', g2:'1.7', g3:'1.7.3', descricao:'Técnico Eletricista', fornecedor:'', natureza:'Advanced Construction Site – Mobilization or Demobilization', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:6.0, est_unit:600.08, est_total:3600.48, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:3600.48, variacao_pct:1.0, selling:5638.32, medicao:'NÃO', obs:'' },
    { id:'1.7.3.5', g1:'1', g2:'1.7', g3:'1.7.3', descricao:'Eletricista', fornecedor:'', natureza:'Advanced Construction Site – Mobilization or Demobilization', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:6.0, est_unit:557.12, est_total:3342.72, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:3342.72, variacao_pct:1.0, selling:5234.64, medicao:'NÃO', obs:'' },
    { id:'1.7.3.6', g1:'1', g2:'1.7', g3:'1.7.3', descricao:'Caminhão Munck', fornecedor:'', natureza:'Advanced Construction Site – Mobilization or Demobilization', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:6.0, est_unit:3040.0, est_total:18240.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:18240.0, variacao_pct:1.0, selling:28563.84, medicao:'NÃO', obs:'' },
    { id:'1.7.3.7', g1:'1', g2:'1.7', g3:'1.7.3', descricao:'Diesel', fornecedor:'', natureza:'Advanced Construction Site – Mobilization or Demobilization', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:6.0, est_unit:315.0, est_total:1890.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:1890.0, variacao_pct:1.0, selling:2959.74, medicao:'NÃO', obs:'' },
    { id:'1.7.3.8', g1:'1', g2:'1.7', g3:'1.7.3', descricao:'Logística externa', fornecedor:'', natureza:'Advanced Construction Site – Mobilization or Demobilization', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:6.0, est_unit:6000.0, est_total:36000.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:36000.0, variacao_pct:1.0, selling:56376.0, medicao:'NÃO', obs:'' },
    { id:'1.7.3.9', g1:'1', g2:'1.7', g3:'1.7.3', descricao:'Parafusadeira Elétrica', fornecedor:'', natureza:'Advanced Construction Site – Mobilization or Demobilization', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:6.0, est_unit:250.0, est_total:1500.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:1500.0, variacao_pct:1.0, selling:2349.0, medicao:'NÃO', obs:'' },
    { id:'1.7.3.10', g1:'1', g2:'1.7', g3:'1.7.3', descricao:'Ferramentas Manuais', fornecedor:'', natureza:'Advanced Construction Site – Mobilization or Demobilization', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:6.0, est_unit:1500.0, est_total:9000.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0, variacao:9000.0, variacao_pct:1.0, selling:14094.06, medicao:'NÃO', obs:'' },
    { id:'1.9.1.8', g1:'1', g2:'1.9', g3:'1.9.1', descricao:'Impostos COFINS/ PIS/ ISS', fornecedor:'Vários', natureza:'Local Administration', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:8.0, est_unit:0.0, est_total:0.0, custo_real:0.0, custo_proj:0.0, custo_spot:0.0, custo_contratos:0, variacao:0.0, variacao_pct:0.0, selling:0, medicao:'SIM', obs:'' },
    { id:'1.7.1.14', g1:'1', g2:'1.7', g3:'1.7.1', descricao:'Logística externa', fornecedor:'', natureza:'Full Construction of Construction Site', expenditure:'CAPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:6.0, est_unit:0.0, est_total:0.0, custo_real:4350.0, custo_proj:0.0, custo_spot:4350.0, custo_contratos:0, variacao:-4350.0, variacao_pct:-1.0, selling:0, medicao:'SIM', obs:'' },
    { id:'2.1.1.8', g1:'2', g2:'2.1', g3:'2.1.1', descricao:'Depreciação', fornecedor:'', natureza:'Remote Operated Unit (ROMU)', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:10.0, est_unit:0.0, est_total:0.0, custo_real:322813.75, custo_proj:374030.1, custo_spot:0, custo_contratos:322813.75, variacao:-374030.1, variacao_pct:-1.0, selling:0, medicao:'SIM', obs:'' },
    { id:'2.1.3.5', g1:'2', g2:'2.1', g3:'2.1.3', descricao:'Depreciação', fornecedor:'', natureza:'Remote Operation Room / Container', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:10.0, est_unit:0.0, est_total:0.0, custo_real:57545.8, custo_proj:115091.6, custo_spot:0, custo_contratos:57545.8, variacao:-115091.6, variacao_pct:-1.0, selling:0, medicao:'SIM', obs:'' },
    { id:'2.1.4.7', g1:'2', g2:'2.1', g3:'2.1.4', descricao:'Depreciação', fornecedor:'', natureza:'High-Pressure System', expenditure:'OPEX', tipo_custo:'Recorrente', recorrente:true, unid_rec:'', qtd_meses:10.0, est_unit:0.0, est_total:0.0, custo_real:0.0, custo_proj:0.0, custo_spot:0, custo_contratos:0.0, variacao:0.0, variacao_pct:0.0, selling:0, medicao:'SIM', obs:'' },
  ];
}

// ─── WBS LABELS ─────────────────────────────────────────────
const _CUSTOS_WBS_L1 = {
  '1': '1 – Instalações Provisórias De Obras / Instalações Definitivas',
  '2': '2 – Sistema De Desmonte Hidráulico E De Disposição De Rejeitos',
  '3': '3 – Locação De Máquinas E Equipamentos',
  '4': '4 – Montagem De Tubulações, Conexões, Válvulas E Acessòrios',
  '5': '5 – Fornecimento De Tubulações, Conexões, Válvulas E Acessòrios',
  '6': '6 – Apoio | Fornecimento De Mão De Obra',
};
const _CUSTOS_WBS_L2 = {
  '1.1': '1.1 – Mobilização De Pessoal E Equipamentos Apoio - Mobilização Contratual',
  '1.2': '1.2 – Mobilização De Pessoal E Equipamentos Apoio - Mobilização Contratual',
  '1.3': '1.3 – Mobilização De Pessoal E Equipamentos Apoio - Mobilização Contratual',
  '1.4': '1.4 – Desmobilização Pessoal E Equipamentos Apoio - Desmobilização Contratual',
  '1.5': '1.5 – Desmobilização Pessoal E Equipamentos Apoio - Desmobilização Contratual',
  '1.6': '1.6 – Desmobilização Pessoal E Equipamentos Apoio - Desmobilização Contratual',
  '1.7': '1.7 – Canteiro De Obras',
  '1.8': '1.8 – Manutenção E Operação De Canteiro De Obras',
  '1.9': '1.9 – Administração Local',
  '2.1': '2.1 – Desmonte Hidráulico E/Ou Disposição De Rejeitos',
  '3.1': '3.1 – Serviços Eventuais | Máquinas E Equipamentos',
  '3.2': '3.2 – Aluguel De Equipamentos De Transporte',
  '3.3': '3.3 – Serviço De Drone',
  '4.1': '4.1 – Montagem Tubo Pead, Conforme Iso 4427',
  '4.2': '4.2 – Montagem De Mangote De Borracha',
  '4.3': '4.3 – Desmontagem Tubo Pead, Conforme Iso 4427',
  '4.4': '4.4 – Desmontagem De Mangote De Borracha',
  '5.1': '5.1 – Fornecimento De Tubulações, Inclusive Conexões E Válvulas',
  '6.1': '6.1 – Diversos / Motoristas / Operadores/Ajudantes - Mão De Obra Direta',
};
const _CUSTOS_WBS_L3 = {
  '1.1.1': 'Custo Mensal: Salário - Encargos - Taxas - Exames - Treinamentos - Plano De Saúde',
  '1.1.2': 'Alimentação',
  '1.1.3': 'Consumables',
  '1.1.4': 'Hospedagem E Viagens, Visa\'S',
  '1.1.5': 'Projetos De Engenharia',
  '1.1.6': 'Combustível - Equipamentos Móveis',
  '1.1.7': 'Equipamentos',
  '1.2.1': 'Custo Mensal: Salário - Encargos - Taxas - Exames - Treinamentos - Plano De Saúde',
  '1.3.1': 'Custo Mensal: Salário - Encargos - Taxas - Exames - Treinamentos - Plano De Saúde',
  '1.4.1': 'Custo Mensal: Salário - Encargos - Taxas - Exames - Treinamentos - Plano De Saúde',
  '1.4.2': 'Sub Contratações',
  '1.4.3': 'Alimentação',
  '1.4.4': 'Combustível',
  '1.4.5': 'Equipamentos',
  '1.5.1': 'Custo Mensal: Salário - Encargos - Taxas - Exames - Treinamentos - Plano De Saúde',
  '1.6.1': 'Custo Mensal: Salário - Encargos - Taxas - Exames - Treinamentos - Plano De Saúde',
  '1.7.1': 'Construção Completa De Canteiro De Obras',
  '1.7.2': 'Construção Canteiro Avançado De Obra',
  '1.7.3': 'Canteiro Avançado De Obra – Mobilização Ou Desmobilização',
  '1.8.1': 'Manutenção E Operação De Canteiro De Obras - Central',
  '1.8.2': 'Manutenção E Operação De Canteiro De Obras - Avançado',
  '1.9.1': 'Administração Local',
  '2.1.1': 'Equipamento Remoto Romu',
  '2.1.2': 'Equipamento Remoto Romu',
  '2.1.3': 'Sala/Container De Operação Remot',
  '2.1.4': 'Sistema Alta Pressão',
  '2.1.5': 'Sistema Baixa Pressão',
  '2.1.6': 'Energia',
  '2.1.7': 'Fornecimento E Instalação De Cobertura Modular',
  '3.1.1': 'Escavadeiras Hidráulicas',
  '3.2.1': 'Caminhões Diesel',
  '3.2.2': 'Caminhões Diesel',
  '3.3.1': 'Cadastramento De Área',
  '4.1.1': 'Montagem Tubo Pead, Conforme Iso 4427 Inclusive Conexões E Válvulas 10”',
  '4.1.2': 'Montagem Tubo Pead, Conforme Iso 4427 Inclusive Conexões E Válvulas 8”',
  '4.1.3': 'Montagem Tubo Galvanizado De Alta Pressão D = 10"',
  '4.2.1': 'Montagem De Mangueira De Borracha, Extr. Asme B 16.5, Classe 150',
  '4.3.1': 'Desmontagem Tubo Pead 10”',
  '4.3.2': 'Desmontagem Tubo Pead 8”',
  '4.3.3': 'Desmontagem Tubo Galvanizado  Válvulas 10',
  '4.4.1': 'Desmontagem De Mangueira De Borracha,',
  '5.1.1': 'Fornecimento De Tubo Pead _ Baixa Pressão - 10"',
  '5.1.2': 'Fornecimento De Tubulação Galvanizada  De Alta Pressão D = 10"',
  '5.1.3': 'Fornecimento (Temporário) De Mangueira De Borracha Flexível De Alta Pressão',
  '5.1.4': 'Fornecimento De Tubulação De Pead D = 8"',
  '6.1.1': 'Mão De Obra',
};

// ─── NATUREZA → CATEGORY ────────────────────────────────────
const _CUSTOS_NATUREZA_COLORS = {
  'Mão de Obra': '#6366f1','Mão de Obra Direta':'#818cf8',
  'Subcontratações':'#0ea5e9','Equipamento Remoto ROMU':'#f59e0b',
  'Sistema de Alta Pressão':'#ef4444','Sistema de Baixa Pressão':'#10b981',
  'Energia':'#f97316','Infraestrutura':'#64748b','Manutenção':'#84cc16',
  'Administração':'#a855f7','Alimentação':'#ec4899','Consumíveis':'#14b8a6',
  'Hospedagem e Viagens':'#8b5cf6','Projetos de Engenharia':'#0891b2',
  'Combustível – Equip. Móveis':'#d97706','Container de Operação Remota':'#475569',
  'Escavadeiras Hidráulicas':'#b45309','Caminhões Diesel':'#92400e',
  'Serviços de Drone':'#0284c7','Montagem PEAD':'#16a34a',
  'Montagem Galvanizado':'#15803d','Montagem Mangueira':'#166534',
  'Desmontagem':'#dc2626','Fornecimento PEAD':'#2563eb',
  'Fornecimento Galvanizado':'#1d4ed8','Fornecimento Mangueira':'#1e40af'
};

// ─── MESES (simulação de distribuição mensal) ────────────────
const _CUSTOS_MESES = ['Jan/25','Fev/25','Mar/25','Abr/25','Mai/25','Jun/25',
                       'Jul/25','Ago/25','Set/25','Out/25','Nov/25','Dez/25'];

function _custosGetMesesData(item) {
  // Distribui custo real e estimado em 12 meses de forma realista
  const est = item.est_total || 0;
  const real = item.custo_real || 0;
  const meses = _CUSTOS_MESES.length;
  const rows = [];
  for (let i = 0; i < meses; i++) {
    let e = 0, r = 0;
    if (item.recorrente) {
      e = est / meses;
      // real: concentrado nos primeiros meses
      const realMeses = Math.max(1, Math.ceil(real / (est / meses)));
      r = i < Math.min(realMeses, meses) ? real / realMeses : 0;
    } else {
      // one-off: concentrado no mês 3 (Q1 fim)
      e = i === 2 ? est : 0;
      r = i === 2 ? real : 0;
    }
    rows.push({ mes: _CUSTOS_MESES[i], est: Math.round(e), real: Math.round(r) });
  }
  return rows;
}

// ─── STORAGE HELPERS ────────────────────────────────────────
// Versão do seed – ao mudar, força reset automático do cache de demonstração
// IMPORTANTE: Dados de seed são apenas para demonstração do sistema.
// Dados reais devem ser carregados via "Novo Projeto" ou "Importar Planilha".
const _CUSTOS_SEED_VERSION = 'v4-demo-generico-2025';

function _custosGetData(projetoId) {
  // Determina chave de armazenamento por projeto (isolamento entre projetos)
  const pid = projetoId || _custosState?.projeto || null;
  const storageKey = pid ? `erp_custos_estrutura_${pid}` : 'erp_custos_estrutura_demo';

  // Carrega dados do projeto específico
  const raw = localStorage.getItem(storageKey);
  let todos = [];
  if (raw) { try { const d = JSON.parse(raw); if (Array.isArray(d) && d.length > 0) todos = d; } catch(e) {} }

  // Se não há dados para o projeto e não há projeto definido, usa seed de demonstração
  if (!todos.length && !pid) {
    // Verifica versão do seed demo para invalidar cache se necessário
    const seedVer = localStorage.getItem('erp_custos_seed_version');
    if (seedVer !== _CUSTOS_SEED_VERSION) {
      localStorage.removeItem('erp_custos_estrutura_demo');
      localStorage.setItem('erp_custos_seed_version', _CUSTOS_SEED_VERSION);
    }
    const rawDemo = localStorage.getItem('erp_custos_estrutura_demo');
    if (rawDemo) { try { const d = JSON.parse(rawDemo); if (Array.isArray(d) && d.length > 0) todos = d; } catch(e) {} }
    if (!todos.length) {
      // Cria estrutura de demonstração vazia — sem dados reais de nenhum cliente
      todos = [];
      localStorage.setItem('erp_custos_estrutura_demo', JSON.stringify(todos));
    }
  }
  return todos;
}

// Carrega seed de demonstração apenas quando explicitamente solicitado (ex: tutorial/onboarding)
function _custosCarregarDemoSeed() {
  const dados = _custosGetWBSSeed();
  localStorage.setItem('erp_custos_estrutura_demo', JSON.stringify(dados));
  localStorage.setItem('erp_custos_seed_version', _CUSTOS_SEED_VERSION);
  showToast('Dados de demonstração carregados. Estes são dados fictícios para teste do sistema.', 'info', 5000);
}

function _custosTrocarProjeto(id) {
  _custosState.projeto = id;
  _custosState.tabAtiva = 'overview';
  _custosState.wbsExpandido = {};
  renderCustos();
}
function _custosSaveData(data) {
  const pid = _custosState?.projeto || null;
  const storageKey = pid ? `erp_custos_estrutura_${pid}` : 'erp_custos_estrutura_demo';
  localStorage.setItem(storageKey, JSON.stringify(data));
}
function _custosGetProjects() {
  const raw = localStorage.getItem('fraser_custos_projetos');
  if (raw) { try { const d = JSON.parse(raw); if (d && d.length > 0) return d; } catch(e) {} }
  // Sem dados de demonstração – retorna lista vazia para uso com dados reais
  return [];
}

// ─── UTILITÁRIOS ─────────────────────────────────────────────
function _fmtBRL(v) {
  if (v == null || isNaN(v)) return 'R$ 0';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function _fmtPct(v) { return (v == null || isNaN(v)) ? '0%' : Number(v).toFixed(1) + '%'; }
function _variColor(v, est) {
  if (!est) return '#64748b';
  const pct = (v / est) * 100;
  if (pct > 10) return '#ef4444';
  if (pct > 0) return '#f59e0b';
  if (pct < -10) return '#10b981';
  return '#3b82f6';
}

// ─── ESTADO GLOBAL DA PÁGINA ─────────────────────────────────
let _custosState = {
  projeto: 'PROJ-001',
  tabAtiva: 'overview',     // overview | wbs | mensal | realizado | integracao
  wbsExpandido: {},         // g1 → bool, g2 → bool
  filtroNatureza: 'todos',
  filtroTipo: 'todos',
  busca: '',
  mesSel: null              // null = acumulado
};

// ─── RENDER PRINCIPAL ────────────────────────────────────────
function renderCustos() {
  // Usa currentUser (variável global do app.js) ou fallback para _getCurrentUser do db.js
  const user = (typeof currentUser !== 'undefined' && currentUser)
    ? currentUser
    : (typeof _getCurrentUser === 'function' ? _getCurrentUser() : null);
  if (!user) {
    document.getElementById('mainContent').innerHTML =
      `<div style="text-align:center;padding:80px 24px;color:#64748b;">
        <i class="fas fa-lock" style="font-size:48px;opacity:.3;display:block;margin-bottom:16px;"></i>
        <p style="font-size:15px;font-weight:600;">Faça login para acessar o Controle de Custos</p>
      </div>`;
    return;
  }
  // C1: banner de leads aguardando precificação (orçamentação) — pós-render.
  setTimeout(() => { try { _mostrarLeadsOrcamentacao(); } catch (e) {} }, 150);
  const projetos = _custosGetProjects();
  if (!projetos.length) {
    document.getElementById('mainContent').innerHTML = `
      <div style="padding:24px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <i class="fas fa-chart-area" style="color:#0891b2;font-size:22px"></i>
          <h2 style="margin:0;font-size:20px;font-weight:700;color:#0f172a">Controle de Custos de Projeto (WBS)</h2>
        </div>
        <div style="max-width:500px;margin:60px auto;text-align:center">
          <div style="width:72px;height:72px;border-radius:50%;background:rgba(8,145,178,0.1);display:flex;align-items:center;justify-content:center;margin:0 auto 20px">
            <i class="fas fa-folder-open" style="font-size:28px;color:#0891b2"></i>
          </div>
          <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:8px">Nenhum projeto cadastrado</h3>
          <p style="font-size:13px;color:#64748b;margin-bottom:24px">Crie seu primeiro projeto para iniciar o controle de custos e WBS.</p>
          <button onclick="_custosCriarProjeto()"
            style="background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">
            <i class="fas fa-plus"></i> Criar Primeiro Projeto
          </button>
        </div>
      </div>`;
    return;
  }
  const projeto = projetos.find(p => p.id === _custosState.projeto) || projetos[0];
  const items = _custosGetData();

  const totEst = items.reduce((s, i) => s + (i.est_total || 0), 0);
  const totReal = items.reduce((s, i) => s + (i.custo_real || 0), 0);
  const totSelling = items.reduce((s, i) => s + (i.selling || 0), 0);
  const margin = totSelling > 0 ? ((totSelling - totReal) / totSelling * 100) : 0;
  const burnPct = totEst > 0 ? (totReal / totEst * 100) : 0;
  const variacao = totEst - totReal;

  document.getElementById('mainContent').innerHTML = `
  <div style="padding:24px;max-width:1400px;margin:0 auto;">

    <!-- ══ CABEÇALHO ══════════════════════════════════════ -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;gap:12px;flex-wrap:wrap;">
      <div>
        <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0;display:flex;align-items:center;gap:10px;">
          <i class="fas fa-chart-area" style="color:#0891b2;"></i>
          Controle de Custos de Projeto
        </h1>
        <p style="margin:4px 0 0;color:#64748b;font-size:13px;">
          ${projeto.nome} &nbsp;·&nbsp; ${projeto.contrato} &nbsp;·&nbsp; 
          <span style="color:#0891b2;font-weight:600;">${projeto.cliente}</span>
        </p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <!-- Seletor de projeto -->
        <select onchange="_custosTrocarProjeto(this.value)"
          style="padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#475569;background:#fff;cursor:pointer;max-width:240px;">
          ${projetos.map(p=>`<option value="${p.id}" ${p.id===projeto.id?'selected':''}>${p.nome}${p.status==='Proposta'?' 📋':''}</option>`).join('')}
        </select>
        <button onclick="_custosNovaProposta()" 
          style="background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;">
          <i class="fas fa-file-invoice-dollar"></i> Nova Proposta
        </button>
        <button onclick="_custosAbrirNovoItem()" 
          style="background:#f8fafc;color:#0891b2;border:1px solid #bae6fd;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
          <i class="fas fa-plus"></i> Item WBS
        </button>
        <button onclick="_custosExportar()" 
          style="background:#f8fafc;color:#475569;border:1px solid #e2e8f0;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px;">
          <i class="fas fa-download"></i>
        </button>
      </div>
    </div>

    <!-- ══ KPI CARDS ══════════════════════════════════════ -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:20px;">
      ${_custosKpiCard('Budget (Estimado)', totEst, '#3b82f6', 'money-bill-wave', 'BRL')}
      ${_custosKpiCard('Custo Real Acumulado', totReal, '#ef4444', 'receipt', 'BRL')}
      ${_custosKpiCard('Variação', variacao, variacao >= 0 ? '#10b981' : '#ef4444', variacao >= 0 ? 'arrow-down' : 'arrow-up', 'BRL', variacao >= 0 ? '▼ abaixo do budget' : '▲ acima do budget')}
      ${_custosKpiCard('Selling Price', totSelling, '#8b5cf6', 'tag', 'BRL')}
      ${_custosKpiCard('Margem Bruta', margin, margin >= 20 ? '#10b981' : margin >= 10 ? '#f59e0b' : '#ef4444', 'percent', 'PCT')}
      ${_custosKpiCard('Burn Rate', burnPct, burnPct > 90 ? '#ef4444' : burnPct > 70 ? '#f59e0b' : '#10b981', 'fire', 'PCT', burnPct.toFixed(1) + '% do budget')}
    </div>

    <!-- ══ BARRA DE PROGRESSO GERAL ══════════════════════ -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:13px;font-weight:600;color:#0f172a;">Execução Orçamentária Geral</span>
        <span style="font-size:13px;color:#475569;">${_fmtBRL(totReal)} / ${_fmtBRL(totEst)}</span>
      </div>
      <div style="background:#f1f5f9;border-radius:100px;height:12px;overflow:hidden;">
        <div style="width:${Math.min(burnPct,100)}%;background:${burnPct > 90 ? '#ef4444' : burnPct > 70 ? '#f59e0b' : '#10b981'};height:100%;border-radius:100px;transition:width 0.6s;position:relative;">
          ${burnPct > 15 ? `<span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:9px;color:#fff;font-weight:700;">${burnPct.toFixed(1)}%</span>` : ''}
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:#94a3b8;">
        <span>0%</span><span>50%</span><span>100%</span>
      </div>
    </div>

    <!-- ══ ABAS ══════════════════════════════════════════ -->
    <div style="display:flex;gap:4px;margin-bottom:16px;background:#f1f5f9;padding:4px;border-radius:10px;overflow-x:auto;">
      ${['overview','wbs','mensal','realizado','integracao'].map(t => `
        <button onclick="_custosTrocarAba('${t}')" id="tab-custos-${t}"
          style="padding:8px 16px;border:none;border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;
            ${_custosState.tabAtiva === t ? 'background:#fff;color:#0891b2;box-shadow:0 1px 4px rgba(0,0,0,.1);' : 'background:transparent;color:#64748b;'}">
          <i class="fas fa-${t==='overview'?'th-large':t==='wbs'?'sitemap':t==='mensal'?'calendar-alt':t==='realizado'?'check-circle':'link'}" style="margin-right:6px;"></i>
          ${t==='overview'?'Resumo':t==='wbs'?'WBS / Hierarquia':t==='mensal'?'Mensal':t==='realizado'?'Realizado':' Integração'}
        </button>`).join('')}
    </div>

    <!-- ══ CONTEÚDO DA ABA ════════════════════════════════ -->
    <div id="custos-tab-content"></div>
  </div>`;

  _custosRenderAba();
}

function _custosTrocarAba(aba) {
  _custosState.tabAtiva = aba;
  document.querySelectorAll('[id^="tab-custos-"]').forEach(b => {
    const t = b.id.replace('tab-custos-','');
    b.style.background = t === aba ? '#fff' : 'transparent';
    b.style.color = t === aba ? '#0891b2' : '#64748b';
    b.style.boxShadow = t === aba ? '0 1px 4px rgba(0,0,0,.1)' : 'none';
  });
  _custosRenderAba();
}

function _custosRenderAba() {
  const container = document.getElementById('custos-tab-content');
  if (!container) return;
  const t = _custosState.tabAtiva;
  if (t === 'overview') container.innerHTML = _custosTabOverview();
  else if (t === 'wbs') container.innerHTML = _custosTabWBS();
  else if (t === 'mensal') container.innerHTML = _custosTabMensal();
  else if (t === 'realizado') container.innerHTML = _custosTabRealizado();
  else if (t === 'integracao') container.innerHTML = _custosTabIntegracao();
}

// ── KPI CARD HELPER ─────────────────────────────────────────
function _custosKpiCard(label, val, color, icon, tipo, sub) {
  const disp = tipo === 'PCT' ? _fmtPct(val) : _fmtBRL(val);
  return `
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;position:relative;overflow:hidden;">
    <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:${color};border-radius:12px 0 0 12px;"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <span style="font-size:11px;font-weight:500;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">${label}</span>
      <div style="width:30px;height:30px;background:${color}20;border-radius:8px;display:flex;align-items:center;justify-content:center;">
        <i class="fas fa-${icon}" style="color:${color};font-size:13px;"></i>
      </div>
    </div>
    <div style="font-size:18px;font-weight:700;color:#0f172a;">${disp}</div>
    ${sub ? `<div style="font-size:11px;color:#94a3b8;margin-top:3px;">${sub}</div>` : ''}
  </div>`;
}

// ══════════════════════════════════════════════════════════════
//  ABA 1 – OVERVIEW / RESUMO
// ══════════════════════════════════════════════════════════════
function _custosTabOverview() {
  const items = _custosGetData();
  // Agrupar por WBS L1
  const byL1 = {};
  items.forEach(i => {
    const k = i.g1;
    if (!byL1[k]) byL1[k] = { est:0, real:0, sell:0, items:[] };
    byL1[k].est += i.est_total || 0;
    byL1[k].real += i.custo_real || 0;
    byL1[k].sell += i.selling || 0;
    byL1[k].items.push(i);
  });

  // Gráfico de barras horizontais
  const totEst = items.reduce((s,i) => s + (i.est_total||0), 0);
  const barsHTML = Object.entries(byL1).map(([g1, d]) => {
    const pctEst = totEst > 0 ? (d.est / totEst * 100) : 0;
    const pctReal = d.est > 0 ? (d.real / d.est * 100) : 0;
    const over = pctReal > 100;
    return `
    <div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="font-size:12px;font-weight:600;color:#0f172a;max-width:340px;">${_CUSTOS_WBS_L1[g1] || g1}</span>
        <span style="font-size:12px;color:#475569;">${_fmtBRL(d.real)} / ${_fmtBRL(d.est)}</span>
      </div>
      <div style="background:#f1f5f9;border-radius:4px;height:20px;position:relative;overflow:visible;">
        <!-- Budget bar -->
        <div style="width:${pctEst}%;background:#e2e8f0;height:100%;border-radius:4px;position:absolute;top:0;left:0;"></div>
        <!-- Real bar -->
        <div style="width:${Math.min(pctReal,100)}%;background:${over?'#ef4444':pctReal>70?'#f59e0b':'#10b981'};height:100%;border-radius:4px;position:absolute;top:0;left:0;opacity:0.85;"></div>
        <span style="position:absolute;right:4px;top:50%;transform:translateY(-50%);font-size:10px;color:#475569;font-weight:600;">${pctReal.toFixed(0)}%</span>
      </div>
    </div>`;
  }).join('');

  // Tabela de resumo por natureza
  const byNat = {};
  items.forEach(i => {
    const n = i.natureza || 'Outros';
    if (!byNat[n]) byNat[n] = { est:0, real:0, sell:0 };
    byNat[n].est += i.est_total || 0;
    byNat[n].real += i.custo_real || 0;
    byNat[n].sell += i.selling || 0;
  });
  const natRows = Object.entries(byNat)
    .sort((a,b) => b[1].est - a[1].est)
    .slice(0,10)
    .map(([nat, d]) => {
      const vari = d.est - d.real;
      const pct = d.est > 0 ? (d.real/d.est*100) : 0;
      const cor = _CUSTOS_NATUREZA_COLORS[nat] || '#64748b';
      return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:9px 12px;font-size:12px;color:#0f172a;display:flex;align-items:center;gap:8px;">
          <span style="width:10px;height:10px;border-radius:50%;background:${cor};display:inline-block;flex-shrink:0;"></span>
          ${nat}
        </td>
        <td style="padding:9px 12px;font-size:12px;color:#475569;text-align:right;">${_fmtBRL(d.est)}</td>
        <td style="padding:9px 12px;font-size:12px;color:#0f172a;text-align:right;font-weight:600;">${_fmtBRL(d.real)}</td>
        <td style="padding:9px 12px;font-size:12px;color:${vari>=0?'#10b981':'#ef4444'};text-align:right;">${_fmtBRL(vari)}</td>
        <td style="padding:9px 12px;text-align:right;">
          <div style="width:80px;background:#f1f5f9;border-radius:100px;height:6px;display:inline-block;vertical-align:middle;">
            <div style="width:${Math.min(pct,100)}%;height:100%;background:${pct>100?'#ef4444':pct>70?'#f59e0b':'#10b981'};border-radius:100px;"></div>
          </div>
          <span style="font-size:11px;color:#64748b;margin-left:6px;">${pct.toFixed(0)}%</span>
        </td>
      </tr>`;
    }).join('');

  // Distribuição CAPEX vs OPEX
  const capex = items.filter(i=>i.expenditure==='CAPEX').reduce((s,i)=>s+(i.est_total||0),0);
  const opex = items.filter(i=>i.expenditure==='OPEX').reduce((s,i)=>s+(i.est_total||0),0);
  const totEst2 = capex+opex;
  const capexPct = totEst2>0?(capex/totEst2*100):0;
  const opexPct = totEst2>0?(opex/totEst2*100):0;

  return `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
    <!-- Barras por WBS L1 -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
      <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 16px;display:flex;align-items:center;gap:8px;">
        <i class="fas fa-sitemap" style="color:#0891b2;"></i> Execução por WBS Nível 1
      </h3>
      ${barsHTML}
      <div style="display:flex;gap:16px;margin-top:8px;font-size:11px;color:#94a3b8;">
        <span><span style="display:inline-block;width:10px;height:10px;background:#10b981;border-radius:2px;margin-right:4px;"></span>Realizado</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#e2e8f0;border-radius:2px;margin-right:4px;"></span>Budget</span>
      </div>
    </div>

    <!-- CAPEX vs OPEX + Top naturezas -->
    <div style="display:flex;flex-direction:column;gap:16px;">
      <!-- CAPEX/OPEX -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
        <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 14px;display:flex;align-items:center;gap:8px;">
          <i class="fas fa-chart-pie" style="color:#8b5cf6;"></i> CAPEX vs OPEX (Budget)
        </h3>
        <div style="display:flex;gap:16px;align-items:center;">
          <div style="flex:1;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
              <span style="color:#3b82f6;font-weight:600;">CAPEX</span><span>${_fmtBRL(capex)}</span>
            </div>
            <div style="background:#f1f5f9;border-radius:100px;height:10px;">
              <div style="width:${capexPct}%;background:#3b82f6;height:100%;border-radius:100px;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:8px;margin-bottom:4px;">
              <span style="color:#f59e0b;font-weight:600;">OPEX</span><span>${_fmtBRL(opex)}</span>
            </div>
            <div style="background:#f1f5f9;border-radius:100px;height:10px;">
              <div style="width:${opexPct}%;background:#f59e0b;height:100%;border-radius:100px;"></div>
            </div>
          </div>
          <div style="text-align:center;min-width:80px;">
            <div style="font-size:22px;font-weight:700;color:#0891b2;">${capexPct.toFixed(0)}%</div>
            <div style="font-size:11px;color:#94a3b8;">é CAPEX</div>
          </div>
        </div>
      </div>
      <!-- Top alertas de desvio -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
        <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 12px;display:flex;align-items:center;gap:8px;">
          <i class="fas fa-exclamation-triangle" style="color:#ef4444;"></i> Alertas de Desvio
        </h3>
        ${items.filter(i => i.est_total > 0 && i.custo_real > 0 && (i.custo_real / i.est_total) > 1.1)
          .sort((a,b) => (b.custo_real/b.est_total) - (a.custo_real/a.est_total))
          .slice(0,5)
          .map(i => {
            const pct = (i.custo_real / i.est_total * 100).toFixed(0);
            return `
            <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #f8fafc;">
              <div style="background:#fef2f2;border-radius:6px;padding:3px 7px;font-size:11px;color:#ef4444;font-weight:600;white-space:nowrap;">${pct}%</div>
              <div style="font-size:12px;color:#0f172a;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${i.descricao}">${i.id} – ${i.descricao}</div>
            </div>`;
          }).join('') || '<p style="font-size:12px;color:#94a3b8;">Nenhum desvio crítico identificado.</p>'}
      </div>
    </div>
  </div>

  <!-- Tabela por natureza -->
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-top:16px;">
    <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 12px;display:flex;align-items:center;gap:8px;">
      <i class="fas fa-layer-group" style="color:#0891b2;"></i> Resumo por Natureza de Custo
    </h3>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">Natureza</th>
            <th style="padding:9px 12px;text-align:right;font-size:11px;color:#64748b;font-weight:600;">Estimado</th>
            <th style="padding:9px 12px;text-align:right;font-size:11px;color:#64748b;font-weight:600;">Realizado</th>
            <th style="padding:9px 12px;text-align:right;font-size:11px;color:#64748b;font-weight:600;">Variação</th>
            <th style="padding:9px 12px;text-align:right;font-size:11px;color:#64748b;font-weight:600;">Burn</th>
          </tr>
        </thead>
        <tbody>${natRows}</tbody>
      </table>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════════
//  ABA 2 – WBS HIERÁRQUICO (com camadas expansíveis)
// ══════════════════════════════════════════════════════════════
function _custosTabWBS() {
  const items = _custosGetData();

  // Filtros
  const naturezas = [...new Set(items.map(i => i.natureza))].sort();
  const filtHtml = `
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:center;">
    <input id="custos-busca" placeholder="🔍 Buscar por código, descrição, fornecedor..." 
      value="${_custosState.busca}"
      oninput="_custosState.busca=this.value;_custosRenderWBSTree()"
      style="padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;min-width:280px;outline:none;">
    <select onchange="_custosState.filtroNatureza=this.value;_custosRenderWBSTree()"
      style="padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#475569;cursor:pointer;">
      <option value="todos" ${_custosState.filtroNatureza==='todos'?'selected':''}>Todas as Naturezas</option>
      ${naturezas.map(n=>`<option value="${n}" ${_custosState.filtroNatureza===n?'selected':''}>${n}</option>`).join('')}
    </select>
    <select onchange="_custosState.filtroTipo=this.value;_custosRenderWBSTree()"
      style="padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#475569;cursor:pointer;">
      <option value="todos" ${_custosState.filtroTipo==='todos'?'selected':''}>CAPEX + OPEX</option>
      <option value="CAPEX" ${_custosState.filtroTipo==='CAPEX'?'selected':''}>Somente CAPEX</option>
      <option value="OPEX" ${_custosState.filtroTipo==='OPEX'?'selected':''}>Somente OPEX</option>
    </select>
    <button onclick="_custosExpandirTudo(true)" style="padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;cursor:pointer;color:#475569;background:#fff;">
      <i class="fas fa-expand-alt"></i> Expandir Tudo
    </button>
    <button onclick="_custosExpandirTudo(false)" style="padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;cursor:pointer;color:#475569;background:#fff;">
      <i class="fas fa-compress-alt"></i> Recolher
    </button>
  </div>`;

  return `
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:0;display:flex;align-items:center;gap:8px;">
        <i class="fas fa-sitemap" style="color:#0891b2;"></i> WBS – Estrutura Analítica de Custos
      </h3>
      <span style="font-size:12px;color:#94a3b8;">${items.length} itens no WBS</span>
    </div>
    ${filtHtml}
    <!-- Cabeçalho da tabela -->
    <div style="display:grid;grid-template-columns:1fr 120px 120px 100px 90px 80px;gap:0;background:#f8fafc;border-radius:8px 8px 0 0;padding:8px 12px;border:1px solid #e2e8f0;border-bottom:none;">
      <span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Descrição / Código WBS</span>
      <span style="font-size:11px;font-weight:600;color:#64748b;text-align:right;">Estimado</span>
      <span style="font-size:11px;font-weight:600;color:#64748b;text-align:right;">Realizado</span>
      <span style="font-size:11px;font-weight:600;color:#64748b;text-align:right;">Variação</span>
      <span style="font-size:11px;font-weight:600;color:#64748b;text-align:center;">Burn</span>
      <span style="font-size:11px;font-weight:600;color:#64748b;text-align:center;">Ações</span>
    </div>
    <div id="custos-wbs-tree" style="border:1px solid #e2e8f0;border-radius:0 0 8px 8px;"></div>
  </div>`;
}

function _custosRenderWBSTree() {
  const el = document.getElementById('custos-wbs-tree');
  if (!el) return;
  const items = _custosGetData();
  const busca = (_custosState.busca || '').toLowerCase();
  const filtNat = _custosState.filtroNatureza;
  const filtTipo = _custosState.filtroTipo;

  // Filtrar itens
  let filtered = items.filter(i => {
    if (filtNat !== 'todos' && i.natureza !== filtNat) return false;
    if (filtTipo !== 'todos' && i.expenditure !== filtTipo) return false;
    if (busca) {
      const haystack = `${i.id} ${i.subitem_ct} ${i.descricao} ${i.fornecedor}`.toLowerCase();
      if (!haystack.includes(busca)) return false;
    }
    return true;
  });

  // Agrupar
  const byG1 = {}, byG2 = {};
  filtered.forEach(i => {
    if (!byG1[i.g1]) byG1[i.g1] = { est:0, real:0, items:[] };
    byG1[i.g1].est += i.est_total||0;
    byG1[i.g1].real += i.custo_real||0;
    byG1[i.g1].items.push(i);
    if (!byG2[i.g2]) byG2[i.g2] = { est:0, real:0, items:[] };
    byG2[i.g2].est += i.est_total||0;
    byG2[i.g2].real += i.custo_real||0;
    byG2[i.g2].items.push(i);
  });

  let html = '';
  const colors1 = ['#0891b2','#8b5cf6','#f59e0b','#10b981','#3b82f6','#ef4444'];

  Object.entries(byG1).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([g1, d1], gi) => {
    const exp1 = _custosState.wbsExpandido['g1_'+g1] !== false; // expandido por padrão
    const pct1 = d1.est > 0 ? (d1.real/d1.est*100) : 0;
    const cor1 = colors1[gi % colors1.length];
    const vari1 = d1.est - d1.real;
    html += `
    <div style="border-bottom:1px solid #f1f5f9;">
      <!-- L1 Row -->
      <div onclick="_custosToggle('g1_${g1}')" style="display:grid;grid-template-columns:1fr 120px 120px 100px 90px 80px;gap:0;padding:11px 12px;cursor:pointer;background:${exp1?'#f8fafc':'#fff'};transition:background .15s;align-items:center;"
        onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='${exp1?'#f8fafc':'#fff'}'">
        <div style="display:flex;align-items:center;gap:10px;">
          <i class="fas fa-chevron-${exp1?'down':'right'}" style="color:${cor1};width:12px;font-size:11px;"></i>
          <span style="width:8px;height:8px;background:${cor1};border-radius:50%;display:inline-block;flex-shrink:0;"></span>
          <span style="font-size:13px;font-weight:700;color:#0f172a;">${_CUSTOS_WBS_L1[g1] || 'Grupo '+g1}</span>
          <span style="font-size:11px;color:#94a3b8;">(${d1.items.length} itens)</span>
        </div>
        <span style="font-size:12px;color:#475569;text-align:right;">${_fmtBRL(d1.est)}</span>
        <span style="font-size:12px;font-weight:600;color:#0f172a;text-align:right;">${_fmtBRL(d1.real)}</span>
        <span style="font-size:12px;color:${vari1>=0?'#10b981':'#ef4444'};text-align:right;">${_fmtBRL(vari1)}</span>
        <div style="text-align:center;">
          <div style="width:60px;background:#f1f5f9;border-radius:100px;height:6px;display:inline-block;vertical-align:middle;">
            <div style="width:${Math.min(pct1,100)}%;background:${pct1>100?'#ef4444':pct1>70?'#f59e0b':'#10b981'};height:100%;border-radius:100px;"></div>
          </div>
          <span style="font-size:10px;color:#64748b;margin-left:4px;">${pct1.toFixed(0)}%</span>
        </div>
        <div></div>
      </div>`;

    if (exp1) {
      // L2
      const l2s = [...new Set(d1.items.map(i=>i.g2))].sort();
      l2s.forEach(g2 => {
        const d2 = byG2[g2];
        if (!d2) return;
        const exp2 = _custosState.wbsExpandido['g2_'+g2];
        const pct2 = d2.est > 0 ? (d2.real/d2.est*100) : 0;
        const vari2 = d2.est - d2.real;
        html += `
        <!-- L2 Row -->
        <div onclick="_custosToggle('g2_${g2}')" style="display:grid;grid-template-columns:1fr 120px 120px 100px 90px 80px;gap:0;padding:9px 12px 9px 32px;cursor:pointer;background:#fff;border-top:1px solid #f8fafc;align-items:center;"
          onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
          <div style="display:flex;align-items:center;gap:8px;">
            <i class="fas fa-chevron-${exp2?'down':'right'}" style="color:${cor1};width:10px;font-size:10px;opacity:.7;"></i>
            <span style="width:6px;height:6px;background:${cor1};border-radius:50%;display:inline-block;flex-shrink:0;opacity:.6;"></span>
            <span style="font-size:12px;font-weight:600;color:#334155;">${_CUSTOS_WBS_L2[g2] || 'Sub '+g2}</span>
            <span style="font-size:11px;color:#94a3b8;">(${d2.items.length})</span>
          </div>
          <span style="font-size:12px;color:#64748b;text-align:right;">${_fmtBRL(d2.est)}</span>
          <span style="font-size:12px;font-weight:500;color:#334155;text-align:right;">${_fmtBRL(d2.real)}</span>
          <span style="font-size:12px;color:${vari2>=0?'#10b981':'#ef4444'};text-align:right;">${_fmtBRL(vari2)}</span>
          <div style="text-align:center;">
            <div style="width:50px;background:#f1f5f9;border-radius:100px;height:5px;display:inline-block;vertical-align:middle;">
              <div style="width:${Math.min(pct2,100)}%;background:${pct2>100?'#ef4444':pct2>70?'#f59e0b':'#10b981'};height:100%;border-radius:100px;"></div>
            </div>
            <span style="font-size:10px;color:#94a3b8;margin-left:3px;">${pct2.toFixed(0)}%</span>
          </div>
          <div></div>
        </div>`;

        if (exp2) {
          // L3 agrupado
          const byG3 = {};
          d2.items.forEach(i => {
            if (!byG3[i.g3]) byG3[i.g3] = { est:0, real:0, items:[] };
            byG3[i.g3].est += i.est_total||0;
            byG3[i.g3].real += i.custo_real||0;
            byG3[i.g3].items.push(i);
          });
          Object.entries(byG3).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([g3, d3]) => {
            const exp3 = _custosState.wbsExpandido['g3_'+g3];
            const pct3 = d3.est > 0 ? (d3.real/d3.est*100) : 0;
            const vari3 = d3.est - d3.real;
            html += `
            <!-- L3 Row -->
            <div onclick="_custosToggle('g3_${g3}')" style="display:grid;grid-template-columns:1fr 120px 120px 100px 90px 80px;gap:0;padding:8px 12px 8px 52px;cursor:pointer;background:#fafafa;border-top:1px solid #f1f5f9;align-items:center;"
              onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='#fafafa'">
              <div style="display:flex;align-items:center;gap:8px;">
                <i class="fas fa-chevron-${exp3?'down':'right'}" style="color:#94a3b8;width:10px;font-size:9px;"></i>
                <span style="font-size:11px;font-weight:600;color:#64748b;">${g3} – ${_CUSTOS_WBS_L3[g3] || g3}</span>
                <span style="font-size:10px;color:#cbd5e1;">(${d3.items.length})</span>
              </div>
              <span style="font-size:11px;color:#94a3b8;text-align:right;">${_fmtBRL(d3.est)}</span>
              <span style="font-size:11px;color:#475569;text-align:right;">${_fmtBRL(d3.real)}</span>
              <span style="font-size:11px;color:${vari3>=0?'#10b981':'#ef4444'};text-align:right;">${_fmtBRL(vari3)}</span>
              <div style="text-align:center;">
                <span style="font-size:10px;color:${pct3>100?'#ef4444':pct3>70?'#f59e0b':'#10b981'};font-weight:600;">${pct3.toFixed(0)}%</span>
              </div>
              <div></div>
            </div>`;

            if (exp3) {
              // Itens individuais (L4)
              d3.items.forEach(item => {
                const pctI = item.est_total > 0 ? (item.custo_real/item.est_total*100) : 0;
                const variI = (item.est_total||0) - (item.custo_real||0);
                const cor = _CUSTOS_NATUREZA_COLORS[item.natureza] || '#64748b';
                html += `
                <div style="display:grid;grid-template-columns:1fr 120px 120px 100px 90px 80px;gap:0;padding:7px 12px 7px 68px;background:#f9fafb;border-top:1px solid #f1f5f9;align-items:center;">
                  <div style="display:flex;flex-direction:column;gap:2px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="font-size:10px;font-family:monospace;color:#94a3b8;background:#f1f5f9;padding:1px 5px;border-radius:4px;">${item.id}</span>
                      <span style="font-size:12px;color:#334155;">${item.descricao}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;margin-left:2px;">
                      <span style="font-size:10px;color:#94a3b8;">🏢 ${item.fornecedor || '–'}</span>
                      <span style="width:6px;height:6px;background:${cor};border-radius:50%;display:inline-block;"></span>
                      <span style="font-size:10px;color:${cor};">${item.natureza}</span>
                      <span style="font-size:10px;color:#94a3b8;background:${item.expenditure==='CAPEX'?'#eff6ff':'#fffbeb'};padding:1px 5px;border-radius:4px;color:${item.expenditure==='CAPEX'?'#3b82f6':'#f59e0b'};">${item.expenditure||item.tipo||'–'}</span>
                    </div>
                  </div>
                  <span style="font-size:11px;color:#94a3b8;text-align:right;">${_fmtBRL(item.est_total)}</span>
                  <span style="font-size:11px;font-weight:500;color:${item.custo_real>0?'#0f172a':'#cbd5e1'};text-align:right;">${_fmtBRL(item.custo_real)}</span>
                  <span style="font-size:11px;color:${variI>=0?'#10b981':'#ef4444'};text-align:right;">${_fmtBRL(variI)}</span>
                  <div style="text-align:center;">
                    <span style="font-size:11px;font-weight:600;color:${pctI>100?'#ef4444':pctI>70?'#f59e0b':'#475569'};">${pctI.toFixed(0)}%</span>
                  </div>
                  <div style="display:flex;justify-content:center;gap:4px;">
                    <button onclick="event.stopPropagation();_custosEditarItem('${item.id}')" title="Editar"
                      style="width:26px;height:26px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                      <i class="fas fa-pen" style="font-size:10px;color:#0891b2;"></i>
                    </button>
                    <button onclick="event.stopPropagation();_custosVerItem('${item.id}')" title="Detalhe"
                      style="width:26px;height:26px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                      <i class="fas fa-eye" style="font-size:10px;color:#64748b;"></i>
                    </button>
                  </div>
                </div>`;
              });
            }
          });
        }
      });
    }
    html += '</div>';
  });

  el.innerHTML = html || '<div style="padding:40px;text-align:center;color:#94a3b8;">Nenhum item encontrado com os filtros aplicados.</div>';
}

function _custosToggle(key) {
  _custosState.wbsExpandido[key] = !_custosState.wbsExpandido[key];
  _custosRenderAba();
  // Restaurar scroll position
}
function _custosExpandirTudo(expand) {
  const items = _custosGetData();
  items.forEach(i => {
    _custosState.wbsExpandido['g1_'+i.g1] = expand;
    _custosState.wbsExpandido['g2_'+i.g2] = expand;
    _custosState.wbsExpandido['g3_'+i.g3] = expand;
  });
  _custosRenderAba();
}

// Chamar render depois que ABA WBS é mostrada
const _origCustosTab = _custosRenderAba;
window.addEventListener('DOMContentLoaded', () => {});
// Patch para chamar _custosRenderWBSTree depois de renderizar WBS
function _custosRenderAbaPatched() {
  _custosRenderAba_orig();
  if (_custosState.tabAtiva === 'wbs') {
    setTimeout(() => _custosRenderWBSTree(), 50);
  }
}

// ══════════════════════════════════════════════════════════════
//  ABA 3 – CONTROLE MENSAL
// ══════════════════════════════════════════════════════════════
function _custosTabMensal() {
  const items = _custosGetData();

  // Acumular por mês
  const byMes = {};
  _CUSTOS_MESES.forEach(m => { byMes[m] = { est:0, real:0, estAcum:0, realAcum:0 }; });

  items.forEach(item => {
    const mDist = _custosGetMesesData(item);
    mDist.forEach(row => {
      if (byMes[row.mes]) {
        byMes[row.mes].est += row.est;
        byMes[row.mes].real += row.real;
      }
    });
  });

  // Acumulado
  let eAcum = 0, rAcum = 0;
  Object.keys(byMes).forEach(m => {
    eAcum += byMes[m].est;
    rAcum += byMes[m].real;
    byMes[m].estAcum = eAcum;
    byMes[m].realAcum = rAcum;
  });

  const maxVal = Math.max(...Object.values(byMes).map(m => m.est || 0));

  // Gráfico de barras mensais
  const barRows = Object.entries(byMes).map(([mes, d]) => {
    const hEst = maxVal > 0 ? (d.est / maxVal * 120) : 0;
    const hReal = maxVal > 0 ? (d.real / maxVal * 120) : 0;
    const over = d.real > d.est && d.est > 0;
    return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;min-width:0;">
      <div style="display:flex;align-items:flex-end;gap:2px;height:130px;">
        <div style="width:20px;background:#dbeafe;border-radius:3px 3px 0 0;height:${hEst}px;" title="Est: ${_fmtBRL(d.est)}"></div>
        <div style="width:20px;background:${over?'#ef4444':'#0891b2'};border-radius:3px 3px 0 0;height:${hReal}px;opacity:0.85;" title="Real: ${_fmtBRL(d.real)}"></div>
      </div>
      <span style="font-size:9px;color:#94a3b8;text-align:center;">${mes}</span>
    </div>`;
  }).join('');

  // Tabela mensal
  const tableRows = Object.entries(byMes).map(([mes, d]) => {
    const vari = d.est - d.real;
    const pct = d.est > 0 ? (d.real/d.est*100).toFixed(0) : '–';
    return `
    <tr style="border-bottom:1px solid #f1f5f9;${_custosState.mesSel===mes?'background:#eff6ff;':''}">
      <td style="padding:9px 12px;font-size:12px;font-weight:500;color:#0f172a;cursor:pointer;" onclick="_custosState.mesSel=_custosState.mesSel==='${mes}'?null:'${mes}';_custosRenderAba();">${mes}</td>
      <td style="padding:9px 12px;font-size:12px;color:#64748b;text-align:right;">${_fmtBRL(d.est)}</td>
      <td style="padding:9px 12px;font-size:12px;font-weight:600;color:${d.real>d.est&&d.est>0?'#ef4444':'#0f172a'};text-align:right;">${_fmtBRL(d.real)}</td>
      <td style="padding:9px 12px;font-size:12px;color:${vari>=0?'#10b981':'#ef4444'};text-align:right;">${_fmtBRL(vari)}</td>
      <td style="padding:9px 12px;text-align:center;">
        <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;background:${pct>100?'#fef2f2':pct>70?'#fffbeb':'#f0fdf4'};color:${pct>100?'#ef4444':pct>70?'#f59e0b':'#10b981'};">${pct}%</span>
      </td>
      <td style="padding:9px 12px;font-size:12px;color:#64748b;text-align:right;">${_fmtBRL(d.estAcum)}</td>
      <td style="padding:9px 12px;font-size:12px;font-weight:600;color:#0f172a;text-align:right;">${_fmtBRL(d.realAcum)}</td>
    </tr>`;
  }).join('');

  // Detalhe do mês selecionado
  let detalheHtml = '';
  if (_custosState.mesSel) {
    const mesIdx = _CUSTOS_MESES.indexOf(_custosState.mesSel);
    const itensDoMes = items.map(item => {
      const mDist = _custosGetMesesData(item);
      const m = mDist[mesIdx];
      return { ...item, mes_est: m.est, mes_real: m.real };
    }).filter(i => i.mes_est > 0 || i.mes_real > 0)
      .sort((a,b) => b.mes_real - a.mes_real);

    detalheHtml = `
    <div style="margin-top:16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;">
      <h4 style="font-size:13px;font-weight:700;color:#1e40af;margin:0 0 12px;display:flex;align-items:center;gap:8px;">
        <i class="fas fa-calendar-day"></i> Detalhamento – ${_custosState.mesSel}
        <button onclick="_custosState.mesSel=null;_custosRenderAba();" style="margin-left:auto;background:none;border:none;cursor:pointer;color:#64748b;font-size:16px;">✕</button>
      </h4>
      <div style="overflow-x:auto;max-height:300px;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#dbeafe;">
            <th style="padding:7px 10px;text-align:left;font-weight:600;color:#1e40af;">Cód.</th>
            <th style="padding:7px 10px;text-align:left;font-weight:600;color:#1e40af;">Descrição</th>
            <th style="padding:7px 10px;text-align:left;font-weight:600;color:#1e40af;">Natureza</th>
            <th style="padding:7px 10px;text-align:right;font-weight:600;color:#1e40af;">Estimado</th>
            <th style="padding:7px 10px;text-align:right;font-weight:600;color:#1e40af;">Realizado</th>
          </tr></thead>
          <tbody>${itensDoMes.map(i => `
            <tr style="border-bottom:1px solid #dbeafe;">
              <td style="padding:6px 10px;font-family:monospace;color:#6366f1;">${i.id}</td>
              <td style="padding:6px 10px;color:#0f172a;">${i.descricao}</td>
              <td style="padding:6px 10px;color:#64748b;">${i.natureza}</td>
              <td style="padding:6px 10px;text-align:right;color:#475569;">${_fmtBRL(i.mes_est)}</td>
              <td style="padding:6px 10px;text-align:right;font-weight:600;color:${i.mes_real>i.mes_est&&i.mes_est>0?'#ef4444':'#0f172a'};">${_fmtBRL(i.mes_real)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  return `
  <div style="display:flex;flex-direction:column;gap:16px;">
    <!-- Gráfico mensal -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
      <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 16px;display:flex;align-items:center;gap:8px;">
        <i class="fas fa-chart-bar" style="color:#0891b2;"></i> Distribuição Mensal de Custos
        <span style="font-size:11px;color:#94a3b8;font-weight:400;margin-left:8px;">Clique na linha para detalhar o mês</span>
      </h3>
      <div style="display:flex;gap:4px;align-items:flex-end;overflow-x:auto;padding-bottom:4px;">
        ${barRows}
      </div>
      <div style="display:flex;gap:16px;margin-top:12px;font-size:11px;color:#94a3b8;">
        <span><span style="display:inline-block;width:10px;height:10px;background:#dbeafe;border-radius:2px;margin-right:4px;"></span>Estimado</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#0891b2;border-radius:2px;margin-right:4px;"></span>Realizado</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#ef4444;border-radius:2px;margin-right:4px;"></span>Acima do budget</span>
      </div>
    </div>

    <!-- Tabela mensal -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
      <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 12px;">Resumo Mensal</h3>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Mês</th>
              <th style="padding:9px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;">Est. Mensal</th>
              <th style="padding:9px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;">Real Mensal</th>
              <th style="padding:9px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;">Variação</th>
              <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:600;color:#64748b;">%</th>
              <th style="padding:9px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;">Est. Acum.</th>
              <th style="padding:9px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;">Real Acum.</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      ${detalheHtml}
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════════
//  ABA 4 – CUSTOS REALIZADOS (OS + RC + PC integrados)
// ══════════════════════════════════════════════════════════════
function _custosTabRealizado() {
  // Busca lançamentos reais de OS, RC, PC
  const fluxoOS = JSON.parse(localStorage.getItem('fraser_fluxo_os') || '[]');
  const rcs = JSON.parse(localStorage.getItem('fraser_rcs') || '[]');
  const pedidos = JSON.parse(localStorage.getItem('fraser_pedidos') || '[]');
  const contasPagar = JSON.parse(localStorage.getItem('fraser_contas_pagar') || '[]');

  const lancamentos = [];

  // OS → lançamentos
  fluxoOS.filter(os => os.status === 'Aprovado').forEach(os => {
    const val = os.valorTotal || os.itens?.reduce((s,i)=>s+(i.valorTotal||0),0) || 0;
    lancamentos.push({
      tipo:'OS', ref: os.osId || os.id, desc: os.descricao || 'OS sem descrição',
      contrato: os.contrato || '–', data: os.dataCriacao || '–',
      valor: val, natureza:'Subcontratações', wbs:'1.1.1', status:'Aprovado'
    });
  });

  // RC → lançamentos
  rcs.filter(rc => rc.status === 'Aprovado' || rc.status === 'Emitido').forEach(rc => {
    const val = rc.total || rc.itens?.reduce((s,i)=>s+(parseFloat(i.totalItem)||0),0) || 0;
    lancamentos.push({
      tipo:'RC', ref: rc.id || rc.rcId, desc: rc.titulo || 'RC sem título',
      contrato: rc.contrato || '–', data: rc.dataEmissao || rc.data || '–',
      valor: val, natureza: rc.tipo === 'Material' ? 'Consumíveis' : 'Subcontratações',
      wbs:'1.1.1', status: rc.status
    });
  });

  // Pedidos de compra
  pedidos.filter(p => p.status !== 'Rascunho').forEach(p => {
    const val = p.valorTotal || p.total || 0;
    lancamentos.push({
      tipo:'PC', ref: p.id || p.pcId, desc: p.descricao || 'Pedido de Compra',
      contrato: p.contrato || '–', data: p.dataEmissao || p.data || '–',
      valor: val, natureza:'Consumíveis', wbs:'1.1.3', status: p.status
    });
  });

  // Contas a pagar
  contasPagar.filter(c => c.status === 'Pago').forEach(c => {
    lancamentos.push({
      tipo:'CP', ref: c.id, desc: c.descricao || 'Conta a Pagar',
      contrato: c.contrato || '–', data: c.dataPagamento || c.data || '–',
      valor: c.valor || 0, natureza: c.categoria || 'Administração', wbs:'1.4.1', status:'Pago'
    });
  });

  const totReal = lancamentos.reduce((s,l) => s+l.valor, 0);
  const items = _custosGetData();
  const totEst = items.reduce((s,i) => s+(i.est_total||0), 0);

  const badgeColor = { OS:'#0891b2', RC:'#8b5cf6', PC:'#f59e0b', CP:'#ef4444' };

  return `
  <div style="display:flex;flex-direction:column;gap:16px;">
    <!-- Resumo integrado -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
      ${[['OS Aprovadas', fluxoOS.filter(o=>o.status==='Aprovado').length, '#0891b2','clipboard-check'],
         ['RCs Emitidos', rcs.filter(r=>r.status==='Aprovado'||r.status==='Emitido').length, '#8b5cf6','file-alt'],
         ['Pedidos de Compra', pedidos.filter(p=>p.status!=='Rascunho').length, '#f59e0b','shopping-cart'],
         ['Contas Pagas', contasPagar.filter(c=>c.status==='Pago').length, '#ef4444','check-circle']
        ].map(([label,count,cor,icon]) => `
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;display:flex;align-items:center;gap:12px;">
          <div style="width:36px;height:36px;background:${cor}20;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="fas fa-${icon}" style="color:${cor};font-size:16px;"></i>
          </div>
          <div>
            <div style="font-size:20px;font-weight:700;color:#0f172a;">${count}</div>
            <div style="font-size:11px;color:#64748b;">${label}</div>
          </div>
        </div>`).join('')}
    </div>

    <!-- Lançamentos -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:0;display:flex;align-items:center;gap:8px;">
          <i class="fas fa-list-alt" style="color:#0891b2;"></i> Lançamentos Integrados
          <span style="font-size:12px;font-weight:400;color:#94a3b8;">(${lancamentos.length} registros)</span>
        </h3>
        <span style="font-size:14px;font-weight:700;color:#0891b2;">Total: ${_fmtBRL(totReal)}</span>
      </div>
      ${lancamentos.length === 0 ? `
        <div style="text-align:center;padding:40px;color:#94a3b8;">
          <i class="fas fa-inbox" style="font-size:32px;margin-bottom:12px;display:block;"></i>
          <p>Nenhum lançamento encontrado. OS aprovadas, RCs emitidos, Pedidos de Compra e Contas Pagas aparecerão aqui automaticamente.</p>
          <p style="font-size:12px;margin-top:8px;">Acesse os módulos de <strong>Fluxo de Aprovação</strong>, <strong>Compras</strong> e <strong>Financeiro</strong> para gerar registros.</p>
        </div>` : `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;">Tipo</th>
                <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;">Referência</th>
                <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;">Descrição</th>
                <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;">Data</th>
                <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;">Natureza</th>
                <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;">WBS</th>
                <th style="padding:9px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${lancamentos.map(l => `
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:9px 12px;">
                  <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;background:${badgeColor[l.tipo]}20;color:${badgeColor[l.tipo]};">${l.tipo}</span>
                </td>
                <td style="padding:9px 12px;font-size:12px;font-family:monospace;color:#6366f1;">${l.ref || '–'}</td>
                <td style="padding:9px 12px;font-size:12px;color:#0f172a;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${l.desc}">${l.desc}</td>
                <td style="padding:9px 12px;font-size:12px;color:#64748b;">${l.data}</td>
                <td style="padding:9px 12px;font-size:12px;color:#64748b;">${l.natureza}</td>
                <td style="padding:9px 12px;font-size:12px;font-family:monospace;color:#8b5cf6;">${l.wbs}</td>
                <td style="padding:9px 12px;font-size:12px;font-weight:600;color:#0f172a;text-align:right;">${_fmtBRL(l.valor)}</td>
              </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#f8fafc;border-top:2px solid #e2e8f0;">
                <td colspan="6" style="padding:10px 12px;font-size:13px;font-weight:700;color:#0f172a;">TOTAL REALIZADO</td>
                <td style="padding:10px 12px;font-size:14px;font-weight:700;color:#0891b2;text-align:right;">${_fmtBRL(totReal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>`}
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════════
//  ABA 5 – INTEGRAÇÃO (CRM / OS / RC / PC linkados ao WBS)
// ══════════════════════════════════════════════════════════════
function _custosTabIntegracao() {
  const fluxoOS = JSON.parse(localStorage.getItem('fraser_fluxo_os') || '[]');
  const rcs = JSON.parse(localStorage.getItem('fraser_rcs') || '[]');
  const crm = JSON.parse(localStorage.getItem('fraser_crm_oportunidades') || '[]');
  const contratos = JSON.parse(localStorage.getItem('fraser_contratos') || '[]');
  // OS com vínculo WBS direto (módulo OS)
  const todasOS = JSON.parse(localStorage.getItem('fa_ordens_servico') || '[]');
  const osVinculadas = todasOS.filter(o => o.wbs_id);
  const totalCustoOSWBS = osVinculadas.reduce((s, o) => s + (o.custo_realizado || 0), 0);

  const aprovPct = fluxoOS.length > 0
    ? (fluxoOS.filter(o => o.status === 'Aprovado').length / fluxoOS.length * 100)
    : 0;

  return `
  <div style="display:flex;flex-direction:column;gap:16px;">
    <!-- CRM → Proposta → WBS -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
      <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 16px;display:flex;align-items:center;gap:8px;">
        <i class="fas fa-link" style="color:#8b5cf6;"></i> Rastreabilidade: CRM → Proposta → WBS → Execução
      </h3>
      <div style="display:flex;align-items:center;gap:0;overflow-x:auto;padding-bottom:8px;">
        ${[
          { label:'Oportunidades CRM', count:crm.length, cor:'#8b5cf6', icon:'handshake', desc:'Prospecção comercial' },
          { label:'Contratos Ativos', count:contratos.filter(c=>c.status==='Ativo'||c.status==='Em Execução').length, cor:'#0891b2', icon:'file-contract', desc:'Contratos vigentes' },
          { label:'OS em Aprovação', count:fluxoOS.filter(o=>o.status!=='Aprovado'&&o.status!=='Reprovado').length, cor:'#f59e0b', icon:'clipboard-list', desc:'Aguardando aprovação' },
          { label:'OS Aprovadas', count:fluxoOS.filter(o=>o.status==='Aprovado').length, cor:'#10b981', icon:'check-circle', desc:'Aprovação concluída' },
          { label:'RCs Emitidos', count:rcs.filter(r=>r.status!=='Rascunho').length, cor:'#6366f1', icon:'file-alt', desc:'Requisições de compra' }
        ].map((s, idx, arr) => `
          <div style="display:flex;align-items:center;gap:0;">
            <div style="background:#fff;border:2px solid ${s.cor}40;border-radius:12px;padding:14px 18px;min-width:140px;text-align:center;">
              <div style="width:40px;height:40px;background:${s.cor}20;border-radius:8px;display:flex;align-items:center;justify-content:center;margin:0 auto 8px;">
                <i class="fas fa-${s.icon}" style="color:${s.cor};font-size:18px;"></i>
              </div>
              <div style="font-size:22px;font-weight:700;color:${s.cor};">${s.count}</div>
              <div style="font-size:11px;font-weight:600;color:#0f172a;">${s.label}</div>
              <div style="font-size:10px;color:#94a3b8;">${s.desc}</div>
            </div>
            ${idx < arr.length - 1 ? `<div style="width:32px;height:2px;background:${arr[idx+1].cor}40;position:relative;"><i class="fas fa-chevron-right" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#cbd5e1;font-size:10px;"></i></div>` : ''}
          </div>`).join('')}
      </div>
    </div>

    <!-- Como integrar nova proposta -->
    <div style="background:linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%);border:1px solid #bae6fd;border-radius:12px;padding:20px;">
      <h3 style="font-size:14px;font-weight:700;color:#0c4a6e;margin:0 0 14px;display:flex;align-items:center;gap:8px;">
        <i class="fas fa-lightbulb" style="color:#f59e0b;"></i> Como criar um WBS para nova proposta
      </h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
        ${[
          { num:'1', title:'Cadastrar Oportunidade no CRM', desc:'Registre o prospect, escopo técnico e estimativa comercial preliminar no módulo CRM.', cor:'#8b5cf6' },
          { num:'2', title:'Gerar WBS de Custos', desc:'Use "Novo Item WBS" para estruturar os grupos 1–6 com estimativas por natureza (CAPEX/OPEX, One-off/Recorrente).', cor:'#0891b2' },
          { num:'3', title:'Vincular ao Contrato', desc:'Ao ganhar a oportunidade, vincule o WBS ao contrato gerado. Todas as OS/RC herdam o código WBS.', cor:'#10b981' },
          { num:'4', title:'Controle Mensal', desc:'Configure os meses do projeto. Cada OS aprovada e RC emitido alimenta automaticamente os custos realizados.', cor:'#f59e0b' },
          { num:'5', title:'Relatório de Desvio', desc:'Acompanhe variação estimado vs. realizado por WBS, natureza e mês. Exporte para Excel ou PDF.', cor:'#ef4444' }
        ].map(s => `
          <div style="background:#fff;border-radius:10px;padding:14px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <div style="width:28px;height:28px;background:${s.cor};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0;">${s.num}</div>
              <span style="font-size:12px;font-weight:700;color:#0f172a;">${s.title}</span>
            </div>
            <p style="font-size:11px;color:#64748b;margin:0;line-height:1.5;">${s.desc}</p>
          </div>`).join('')}
      </div>
    </div>

    <!-- Melhores práticas de mineração/serviços -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
      <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 14px;display:flex;align-items:center;gap:8px;">
        <i class="fas fa-hard-hat" style="color:#f59e0b;"></i> Boas Práticas – Controle de Custos Mineração & Serviços
      </h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        ${[
          { icon:'layer-group', cor:'#0891b2', title:'WBS em 4 Níveis', desc:'Grupo (L1) → Sub-grupo (L2) → Pacote de trabalho (L3) → Atividade (L4). Facilita drill-down e relatórios por disciplina.' },
          { icon:'chart-line', cor:'#10b981', title:'Curva S de Custos', desc:'Monitore a curva acumulada realizado vs. planejado mensalmente. Desvios > 10% exigem ação corretiva imediata.' },
          { icon:'tags', cor:'#8b5cf6', title:'Classificação CAPEX/OPEX', desc:'CAPEX: ativos e mobilizações (amortizáveis). OPEX: operação e manutenção (despesas recorrentes). Impacta tributação e resultado.' },
          { icon:'exchange-alt', cor:'#f59e0b', title:'Variação EV (Earned Value)', desc:'EVM: meça o Earned Value (EV) contra Planned Value (PV) e Actual Cost (AC). CPI = EV/AC; SPI = EV/PV.' },
          { icon:'exclamation-triangle', cor:'#ef4444', title:'Contingência (10-15%)', desc:'Projetos de mineração exigem reserva de contingência de 10% (risco moderado) a 15% (alto risco / escopo aberto).' },
          { icon:'file-invoice-dollar', cor:'#6366f1', title:'Medição por Avanço Físico', desc:'Vincule os custos ao percentual de avanço físico de cada OS/pacote. Evita "front-loading" e surpresas no fechamento.' }
        ].map(p => `
          <div style="display:flex;gap:12px;padding:12px;background:#f8fafc;border-radius:8px;">
            <div style="width:36px;height:36px;background:${p.cor}20;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i class="fas fa-${p.icon}" style="color:${p.cor};font-size:15px;"></i>
            </div>
            <div>
              <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:3px;">${p.title}</div>
              <div style="font-size:11px;color:#64748b;line-height:1.5;">${p.desc}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <!-- OS Vinculadas ao WBS -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:0;display:flex;align-items:center;gap:8px;">
          <i class="fas fa-sitemap" style="color:#10b981;"></i> OS Vinculadas ao WBS – Rastreamento de Custos
        </h3>
        <div style="display:flex;gap:10px;align-items:center;">
          <span style="font-size:12px;color:#64748b;">${osVinculadas.length} OS vinculadas &nbsp;|&nbsp; Total realizado: <strong style="color:#10b981;">${totalCustoOSWBS.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2})}</strong></span>
          <button onclick="if(typeof navigate==='function')navigate('os')" style="padding:6px 14px;background:#10b981;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer"><i class="fas fa-external-link-alt" style="margin-right:4px"></i>Módulo OS</button>
        </div>
      </div>
      ${osVinculadas.length === 0 ? `
        <div style="text-align:center;padding:32px;color:#94a3b8;">
          <i class="fas fa-link" style="font-size:32px;margin-bottom:12px;display:block;opacity:0.4;"></i>
          <div style="font-size:13px;font-weight:600;margin-bottom:6px;">Nenhuma OS vinculada ao WBS ainda</div>
          <div style="font-size:12px;">Ao criar ou editar uma Ordem de Serviço, selecione a linha WBS correspondente.<br>Os custos realizados serão automaticamente lançados aqui.</div>
        </div>
      ` : `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;white-space:nowrap;">OS</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;">Descrição</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;white-space:nowrap;">Linha WBS</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;">Natureza</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;">Estimado</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;">Realizado</th>
                <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;color:#64748b;">Status</th>
                <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;color:#64748b;">Progresso</th>
              </tr>
            </thead>
            <tbody>
              ${osVinculadas.map((os, idx) => {
                const isEven = idx % 2 === 0;
                const custoEst = os.custo_estimado || 0;
                const custoReal = os.custo_realizado || 0;
                const desvio = custoEst > 0 ? ((custoReal - custoEst) / custoEst * 100) : 0;
                const desvioColor = desvio > 10 ? '#ef4444' : desvio > 0 ? '#f59e0b' : '#10b981';
                const statusColors = {
                  'Em Andamento': '#f59e0b', 'Concluída': '#10b981', 'Agendada': '#3b82f6',
                  'Pausada': '#8b5cf6', 'Cancelada': '#ef4444', 'Aguardando Peça': '#f97316'
                };
                const statusCor = statusColors[os.status] || '#64748b';
                return `
                <tr style="background:${isEven?'#fff':'#f8fafc'};border-bottom:1px solid #f1f5f9;">
                  <td style="padding:10px 12px;font-weight:600;color:#0891b2;white-space:nowrap;">${os.id}</td>
                  <td style="padding:10px 12px;color:#374151;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${os.descricao}">${os.descricao}</td>
                  <td style="padding:10px 12px;white-space:nowrap;">
                    <span style="background:#10b98115;color:#10b981;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;">${os.wbs_id}</span>
                  </td>
                  <td style="padding:10px 12px;color:#64748b;font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${os.wbs_natureza||'—'}</td>
                  <td style="padding:10px 12px;text-align:right;color:#374151;">${custoEst > 0 ? custoEst.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}) : '—'}</td>
                  <td style="padding:10px 12px;text-align:right;font-weight:700;color:#10b981;">${custoReal > 0 ? custoReal.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}) : '—'}</td>
                  <td style="padding:10px 12px;text-align:center;">
                    <span style="background:${statusCor}20;color:${statusCor};padding:3px 8px;border-radius:6px;font-size:10px;font-weight:600;white-space:nowrap;">${os.status}</span>
                  </td>
                  <td style="padding:10px 12px;text-align:center;min-width:80px;">
                    <div style="background:#e2e8f0;border-radius:4px;height:6px;overflow:hidden;">
                      <div style="background:${(os.progress||0)===100?'#10b981':'#f59e0b'};height:100%;width:${os.progress||0}%;transition:width 0.3s;"></div>
                    </div>
                    <div style="font-size:10px;color:#64748b;margin-top:2px;">${os.progress||0}%</div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#f0fdf4;border-top:2px solid #10b98140;">
                <td colspan="4" style="padding:10px 12px;font-size:12px;font-weight:700;color:#0f172a;">TOTAL</td>
                <td style="padding:10px 12px;text-align:right;font-weight:700;color:#374151;">${osVinculadas.reduce((s,o)=>s+(o.custo_estimado||0),0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0})}</td>
                <td style="padding:10px 12px;text-align:right;font-weight:700;color:#10b981;">${totalCustoOSWBS.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0})}</td>
                <td colspan="2" style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;">${osVinculadas.filter(o=>o.status==='Concluída').length} concluídas</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `}
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════════
//  MODAL – NOVO / EDITAR ITEM WBS
// ══════════════════════════════════════════════════════════════
function _custosAbrirNovoItem(id) {
  const items = _custosGetData();
  const item = id ? items.find(i => i.id === id) : null;
  const titulo = id ? 'Editar Item WBS' : 'Novo Item WBS';

  const naturezas = [...new Set(items.map(i => i.natureza))].sort();

  showModal(`
  <div style="padding:24px;max-width:700px;margin:0 auto;">
    <h2 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 20px;display:flex;align-items:center;gap:10px;">
      <i class="fas fa-plus-circle" style="color:#0891b2;"></i>${titulo}
    </h2>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Grupo L1 (1–6)</label>
        <input id="ci-g1" value="${item?.g1||''}" placeholder="ex: 1"
          style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Sub-grupo L2</label>
        <input id="ci-g2" value="${item?.g2||''}" placeholder="ex: 1.1"
          style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Pacote L3</label>
        <input id="ci-g3" value="${item?.g3||''}" placeholder="ex: 1.1.1"
          style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
      </div>
    </div>
    <div style="margin-bottom:12px;">
      <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Código do Item (ex: 1.1.1.1)</label>
      <input id="ci-id" value="${item?.id||''}" placeholder="1.1.1.1"
        style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
    </div>
    <div style="margin-bottom:12px;">
      <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Descrição *</label>
      <input id="ci-desc" value="${item?.descricao||''}" placeholder="Descrição detalhada do item de custo"
        style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Natureza</label>
        <input id="ci-nat" value="${item?.natureza||''}" list="ci-nat-list" placeholder="Mão de Obra, CAPEX, etc."
          style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
        <datalist id="ci-nat-list">${naturezas.map(n=>`<option value="${n}">`).join('')}</datalist>
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Fornecedor</label>
        <input id="ci-forn" value="${item?.fornecedor||''}" placeholder="Nome do fornecedor"
          style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Tipo</label>
        <select id="ci-tipo" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
          <option value="CAPEX" ${item?.expenditure==='CAPEX'?'selected':''}>CAPEX</option>
          <option value="OPEX" ${item?.expenditure==='OPEX'?'selected':''}>OPEX</option>
        </select>
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Recorrente</label>
        <select id="ci-rec" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
          <option value="false" ${!item?.recorrente?'selected':''}>One-off</option>
          <option value="true" ${item?.recorrente?'selected':''}>Recorrente</option>
        </select>
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Unidade</label>
        <input id="ci-unid" value="${item?.unid||'vb'}" placeholder="vb, m, h, mês"
          style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Qtd</label>
        <input id="ci-qtd" type="number" value="${item?.qtd||1}" min="0"
          style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Valor Unitário Est. (R$)</label>
        <input id="ci-estunit" type="number" value="${item?.est_unit||0}" min="0" oninput="_custosCalcEstTotal()"
          style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Total Estimado (R$)</label>
        <input id="ci-esttot" type="number" value="${item?.est_total||0}" min="0"
          style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;background:#f8fafc;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Custo Real Acum. (R$)</label>
        <input id="ci-real" type="number" value="${item?.custo_real||0}" min="0"
          style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
      </div>
    </div>
    <div style="margin-bottom:12px;">
      <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Selling Price (R$)</label>
      <input id="ci-sell" type="number" value="${item?.selling||0}" min="0"
        style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
    </div>
    <div style="margin-bottom:20px;">
      <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Observações</label>
      <textarea id="ci-obs" rows="2" placeholder="Observações, premissas, base de cálculo..."
        style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;resize:vertical;">${item?.obs||''}</textarea>
    </div>
    <div id="ci-erro" style="color:#ef4444;font-size:12px;margin-bottom:8px;display:none;"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;">
      <button onclick="closeModal()" style="padding:10px 20px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;font-size:13px;cursor:pointer;">Cancelar</button>
      <button onclick="_custosSalvarItem('${id||''}')" style="padding:10px 24px;border:none;border-radius:8px;background:#0891b2;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">
        <i class="fas fa-save" style="margin-right:6px;"></i>Salvar
      </button>
    </div>
  </div>`);
}

function _custosCalcEstTotal() {
  const qtd = parseFloat(document.getElementById('ci-qtd')?.value || 1);
  const unit = parseFloat(document.getElementById('ci-estunit')?.value || 0);
  const tot = document.getElementById('ci-esttot');
  if (tot) tot.value = (qtd * unit).toFixed(0);
}

function _custosEditarItem(id) { _custosAbrirNovoItem(id); }

function _custosSalvarItem(idOriginal) {
  const g = id => document.getElementById(id)?.value?.trim();
  const desc = g('ci-desc');
  if (!desc) {
    const e = document.getElementById('ci-erro');
    if (e) { e.textContent = 'Descrição é obrigatória.'; e.style.display='block'; }
    return;
  }
  const novoItem = {
    id: g('ci-id') || `${g('ci-g3')}.${Date.now()}`,
    g1: g('ci-g1'), g2: g('ci-g2'), g3: g('ci-g3'),
    descricao: desc, natureza: g('ci-nat'), fornecedor: g('ci-forn'),
    tipo: document.getElementById('ci-tipo')?.value || 'OPEX',
    recorrente: document.getElementById('ci-rec')?.value === 'true',
    unid: g('ci-unid') || 'vb',
    qtd: parseFloat(g('ci-qtd')) || 1,
    est_unit: parseFloat(g('ci-estunit')) || 0,
    est_total: parseFloat(g('ci-esttot')) || 0,
    custo_real: parseFloat(g('ci-real')) || 0,
    selling: parseFloat(g('ci-sell')) || 0,
    obs: g('ci-obs') || ''
  };
  let items = _custosGetData();
  if (idOriginal) {
    const idx = items.findIndex(i => i.id === idOriginal);
    if (idx >= 0) items[idx] = novoItem; else items.push(novoItem);
  } else {
    items.push(novoItem);
  }
  _custosSaveData(items);
  closeModal();
  renderCustos();
  if (typeof showToast === 'function') showToast('Item WBS salvo com sucesso!', 'success');
}

function _custosVerItem(id) {
  const items = _custosGetData();
  const item = items.find(i => i.id === id);
  if (!item) return;
  const pct = item.est_total > 0 ? (item.custo_real/item.est_total*100).toFixed(1) : 0;
  const cor = _CUSTOS_NATUREZA_COLORS[item.natureza] || '#64748b';
  showModal(`
  <div style="padding:24px;max-width:550px;">
    <h2 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 16px;display:flex;align-items:center;gap:8px;">
      <span style="font-family:monospace;color:#6366f1;font-size:13px;">${item.id}</span>
      ${item.descricao}
    </h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
      ${[['WBS L1',_CUSTOS_WBS_L1[item.g1]||item.g1],['WBS L2',_CUSTOS_WBS_L2[item.g2]||item.g2],
         ['WBS L3',_CUSTOS_WBS_L3[item.g3]||item.g3],['Natureza',item.natureza],
         ['Tipo',item.expenditure||'–'],['Recorrente',item.recorrente?'Sim':'Não'],
         ['Fornecedor',item.fornecedor||'–'],['Unidade',item.unid_rec||'–']
        ].map(([l,v])=>`
        <div style="background:#f8fafc;border-radius:8px;padding:10px;">
          <div style="font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:600;margin-bottom:3px;">${l}</div>
          <div style="font-size:13px;color:#0f172a;">${v||'–'}</div>
        </div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
      <div style="background:#eff6ff;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:10px;color:#3b82f6;font-weight:600;margin-bottom:4px;">ESTIMADO</div>
        <div style="font-size:16px;font-weight:700;color:#1d4ed8;">${_fmtBRL(item.est_total)}</div>
      </div>
      <div style="background:#f0fdf4;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:10px;color:#10b981;font-weight:600;margin-bottom:4px;">REALIZADO</div>
        <div style="font-size:16px;font-weight:700;color:#065f46;">${_fmtBRL(item.custo_real)}</div>
      </div>
      <div style="background:#fdf4ff;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:10px;color:#8b5cf6;font-weight:600;margin-bottom:4px;">SELLING</div>
        <div style="font-size:16px;font-weight:700;color:#6d28d9;">${_fmtBRL(item.selling)}</div>
      </div>
    </div>
    <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px;">
        <span style="color:#64748b;">Burn Rate</span>
        <span style="font-weight:600;color:${pct>100?'#ef4444':pct>70?'#f59e0b':'#10b981'};">${pct}%</span>
      </div>
      <div style="background:#e2e8f0;border-radius:100px;height:8px;">
        <div style="width:${Math.min(pct,100)}%;background:${pct>100?'#ef4444':pct>70?'#f59e0b':'#10b981'};height:100%;border-radius:100px;"></div>
      </div>
    </div>
    ${item.obs ? `<p style="font-size:12px;color:#64748b;background:#fffbeb;padding:10px;border-radius:8px;border-left:3px solid #f59e0b;">📝 ${item.obs}</p>` : ''}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
      <button onclick="closeModal()" style="padding:9px 20px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;font-size:13px;cursor:pointer;">Fechar</button>
      <button onclick="closeModal();_custosEditarItem('${item.id}')" style="padding:9px 20px;border:none;border-radius:8px;background:#0891b2;color:#fff;font-size:13px;cursor:pointer;">
        <i class="fas fa-pen" style="margin-right:6px;"></i>Editar
      </button>
    </div>
  </div>`);
}

// ══════════════════════════════════════════════════════════════
//  WIZARD – NOVA PROPOSTA / NOVO PROJETO WBS
//  5 etapas: Identificação → Estrutura → Itens de Custo → Precificação → Revisão
// ══════════════════════════════════════════════════════════════
const _PROP_WBS_TEMPLATES = {
  'mineracao': {
    label: 'Mineração – Serviços de Campo',
    grupos: [
      { g1:'1', desc:'Infraestrutura Temporária de Obra', subs:[
        { g2:'1.1', desc:'Mobilização de Pessoal e Equipamentos' },
        { g2:'1.2', desc:'Construção de Canteiro de Obras' },
        { g2:'1.3', desc:'Manutenção e Operação de Canteiro' },
        { g2:'1.4', desc:'Desmobilização' },
        { g2:'1.5', desc:'Administração Local' }
      ]},
      { g1:'2', desc:'Equipamentos e Sistemas', subs:[
        { g2:'2.1', desc:'Equipamentos Principais' },
        { g2:'2.2', desc:'Sistemas de Apoio' },
        { g2:'2.3', desc:'Infraestrutura de Energia' }
      ]},
      { g1:'3', desc:'Locação de Máquinas e Equipamentos', subs:[
        { g2:'3.1', desc:'Máquinas Pesadas' },
        { g2:'3.2', desc:'Veículos e Transporte' },
        { g2:'3.3', desc:'Serviços Especializados' }
      ]},
      { g1:'4', desc:'Materiais e Insumos', subs:[
        { g2:'4.1', desc:'Tubulações e Conexões' },
        { g2:'4.2', desc:'EPI e Consumíveis' },
        { g2:'4.3', desc:'Combustíveis e Lubrificantes' }
      ]},
      { g1:'5', desc:'Mão de Obra', subs:[
        { g2:'5.1', desc:'Mão de Obra Direta' },
        { g2:'5.2', desc:'Mão de Obra Indireta' },
        { g2:'5.3', desc:'Subcontratados' }
      ]},
      { g1:'6', desc:'Gestão e Engenharia', subs:[
        { g2:'6.1', desc:'Projetos e Documentação' },
        { g2:'6.2', desc:'SSMA e Qualidade' },
        { g2:'6.3', desc:'Gerenciamento do Projeto' }
      ]}
    ]
  },
  'civil': {
    label: 'Construção Civil / Infraestrutura',
    grupos: [
      { g1:'1', desc:'Serviços Preliminares', subs:[
        { g2:'1.1', desc:'Mobilização e Canteiro' },
        { g2:'1.2', desc:'Limpeza e Terraplenagem' }
      ]},
      { g1:'2', desc:'Fundações e Estruturas', subs:[
        { g2:'2.1', desc:'Fundações' },
        { g2:'2.2', desc:'Estrutura Metálica / Concreto' }
      ]},
      { g1:'3', desc:'Instalações', subs:[
        { g2:'3.1', desc:'Instalações Elétricas' },
        { g2:'3.2', desc:'Instalações Hidráulicas' },
        { g2:'3.3', desc:'AVAC / HVAC' }
      ]},
      { g1:'4', desc:'Acabamentos', subs:[
        { g2:'4.1', desc:'Revestimentos e Pisos' },
        { g2:'4.2', desc:'Esquadrias e Vidros' }
      ]},
      { g1:'5', desc:'Mão de Obra', subs:[
        { g2:'5.1', desc:'MOD – Produção' },
        { g2:'5.2', desc:'MOI – Supervisão' }
      ]}
    ]
  },
  'offshore': {
    label: 'Offshore / Oil & Gas',
    grupos: [
      { g1:'1', desc:'Mobilização Offshore', subs:[
        { g2:'1.1', desc:'Pessoal e Passagens' },
        { g2:'1.2', desc:'Equipamentos e Ferramentas' }
      ]},
      { g1:'2', desc:'Embarcações e Equipamentos', subs:[
        { g2:'2.1', desc:'Embarcação de Apoio' },
        { g2:'2.2', desc:'Equipamentos ROV/Mergulho' }
      ]},
      { g1:'3', desc:'Serviços Técnicos', subs:[
        { g2:'3.1', desc:'Inspeção e Monitoramento' },
        { g2:'3.2', desc:'Manutenção Submarina' }
      ]},
      { g1:'4', desc:'Mão de Obra', subs:[
        { g2:'4.1', desc:'Técnicos Especializados' },
        { g2:'4.2', desc:'Suporte e Logística' }
      ]}
    ]
  },
  'servicos': {
    label: 'Serviços Gerais / Manutenção',
    grupos: [
      { g1:'1', desc:'Mão de Obra', subs:[
        { g2:'1.1', desc:'Equipe Técnica' },
        { g2:'1.2', desc:'Supervisão' }
      ]},
      { g1:'2', desc:'Materiais', subs:[
        { g2:'2.1', desc:'Peças e Sobressalentes' },
        { g2:'2.2', desc:'Consumíveis' }
      ]},
      { g1:'3', desc:'Equipamentos e Ferramentas', subs:[
        { g2:'3.1', desc:'Locação de Equipamentos' },
        { g2:'3.2', desc:'Ferramental Especial' }
      ]},
      { g1:'4', desc:'Despesas Indiretas', subs:[
        { g2:'4.1', desc:'Administração e Logística' },
        { g2:'4.2', desc:'SSMA' }
      ]}
    ]
  }
};

// Estado global do wizard
let _propState = {
  etapa: 1,
  totalEtapas: 5,
  // Etapa 1 – Identificação
  nome: '', cliente: '', contrato: '', descricao: '',
  inicio: '', fim: '', moeda: 'BRL', meses: 12,
  // Etapa 2 – Estrutura
  template: 'mineracao',
  grupos: [],
  // Etapa 3 – Itens de custo
  itens: [],
  itenEditando: null,
  // Etapa 4 – Precificação
  contingencia: 10, overhead: 8, markup: 30,
  // Etapa 5 – Revisão/Geração
};

function _custosNovaProposta() {
  // Reset do estado
  _propState = {
    etapa: 1, totalEtapas: 5,
    nome: '', cliente: '', contrato: '', descricao: '',
    inicio: new Date().toISOString().slice(0,10),
    fim: new Date(Date.now() + 365*24*3600*1000).toISOString().slice(0,10),
    moeda: 'BRL', meses: 12,
    template: 'mineracao', grupos: [],
    itens: [], itenEditando: null,
    contingencia: 10, overhead: 8, markup: 30
  };
  _propRenderWizard();
}

function _propRenderWizard() {
  const etapaFns = [null, _propEtapa1, _propEtapa2, _propEtapa3, _propEtapa4, _propEtapa5];
  const conteudo = etapaFns[_propState.etapa]();
  const steps = [
    { n:1, icon:'id-card',    label:'Identificação' },
    { n:2, icon:'sitemap',    label:'Estrutura WBS' },
    { n:3, icon:'list-ul',    label:'Itens de Custo' },
    { n:4, icon:'percentage', label:'Precificação' },
    { n:5, icon:'check-circle',label:'Revisão & Geração' }
  ];

  showModal(`
  <div style="width:min(860px,90vw);min-height:540px;display:flex;flex-direction:column;">
    <!-- ── Cabeçalho ── -->
    <div style="padding:20px 24px 0;border-bottom:1px solid #f1f5f9;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h2 style="font-size:18px;font-weight:700;color:#0f172a;margin:0;display:flex;align-items:center;gap:10px;">
          <i class="fas fa-file-invoice-dollar" style="color:#0891b2;"></i>
          Nova Proposta – WBS de Custos
        </h2>
        <span style="font-size:12px;color:#94a3b8;background:#f1f5f9;padding:4px 10px;border-radius:20px;">
          Etapa ${_propState.etapa} de ${_propState.totalEtapas}
        </span>
      </div>
      <!-- Progress steps -->
      <div style="display:flex;gap:0;margin-bottom:-1px;">
        ${steps.map(s => {
          const ativa = s.n === _propState.etapa;
          const concluida = s.n < _propState.etapa;
          return `
          <div onclick="${s.n < _propState.etapa ? `_propIrEtapa(${s.n})` : ''}"
            style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;
                   border-bottom:2px solid ${ativa?'#0891b2':concluida?'#10b981':'#e2e8f0'};
                   cursor:${s.n < _propState.etapa?'pointer':'default'};transition:all .15s;">
            <div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;
                        background:${ativa?'#0891b2':concluida?'#10b981':'#f1f5f9'};transition:all .15s;">
              <i class="fas fa-${concluida?'check':s.icon}" style="font-size:11px;color:${ativa||concluida?'#fff':'#94a3b8'};"></i>
            </div>
            <span style="font-size:10px;font-weight:${ativa?'700':'500'};color:${ativa?'#0891b2':concluida?'#10b981':'#94a3b8'};text-align:center;line-height:1.2;">${s.label}</span>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- ── Conteúdo da etapa ── -->
    <div style="flex:1;padding:24px;overflow-y:auto;">
      ${conteudo}
    </div>

    <!-- ── Rodapé navegação ── -->
    <div style="padding:16px 24px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;background:#fafafa;border-radius:0 0 12px 12px;">
      <button onclick="${_propState.etapa > 1 ? '_propAnterior()' : 'closeModal()'}"
        style="padding:9px 20px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px;">
        <i class="fas fa-${_propState.etapa > 1 ? 'arrow-left' : 'times'}"></i>
        ${_propState.etapa > 1 ? 'Anterior' : 'Cancelar'}
      </button>
      <div style="display:flex;gap:8px;">
        ${_propState.etapa < _propState.totalEtapas
          ? `<button onclick="_propProximo()"
              style="padding:9px 24px;border:none;border-radius:8px;background:#0891b2;color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
              Próximo <i class="fas fa-arrow-right"></i>
            </button>`
          : `<button onclick="_propGerar()"
              style="padding:9px 24px;border:none;border-radius:8px;background:#10b981;color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
              <i class="fas fa-rocket"></i> Gerar Projeto & WBS
            </button>`
        }
      </div>
    </div>
  </div>`, '860px');
}

// ─── ETAPA 1 – Identificação do projeto ──────────────────────
function _propEtapa1() {
  return `
  <div>
    <div style="margin-bottom:18px;">
      <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 4px;">1. Identificação do Projeto</h3>
      <p style="font-size:12px;color:#64748b;margin:0;">Preencha os dados básicos da proposta comercial.</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:5px;">Nome do Projeto *</label>
        <input id="prop-nome" value="${_propState.nome}" placeholder="Ex: Demolição Hidráulica – Mina Carajás"
          style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;"
          oninput="_propState.nome=this.value">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:5px;">Cliente *</label>
        <input id="prop-cliente" value="${_propState.cliente}" placeholder="Ex: Vale S.A., Petrobras, Anglo American"
          style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;"
          oninput="_propState.cliente=this.value">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px;">
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:5px;">Nº da Proposta / Contrato</label>
        <input id="prop-contrato" value="${_propState.contrato}" placeholder="PROP-2025-001"
          style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;"
          oninput="_propState.contrato=this.value">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:5px;">Data de Início</label>
        <input id="prop-inicio" type="date" value="${_propState.inicio}"
          style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;"
          oninput="_propState.inicio=this.value;_propCalcMeses()">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:5px;">Data de Término</label>
        <input id="prop-fim" type="date" value="${_propState.fim}"
          style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;"
          oninput="_propState.fim=this.value;_propCalcMeses()">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px;">
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:5px;">Descrição / Escopo Resumido</label>
        <textarea id="prop-desc" rows="3" placeholder="Descreva brevemente o escopo do projeto, localização, principais atividades..."
          style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;resize:vertical;"
          oninput="_propState.descricao=this.value">${_propState.descricao}</textarea>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:5px;">Moeda</label>
          <select id="prop-moeda" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;"
            onchange="_propState.moeda=this.value">
            <option value="BRL" ${_propState.moeda==='BRL'?'selected':''}>BRL – Real</option>
            <option value="USD" ${_propState.moeda==='USD'?'selected':''}>USD – Dólar</option>
            <option value="EUR" ${_propState.moeda==='EUR'?'selected':''}>EUR – Euro</option>
          </select>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:10px;color:#065f46;font-weight:600;margin-bottom:2px;">DURAÇÃO</div>
          <div id="prop-meses-display" style="font-size:22px;font-weight:700;color:#10b981;">${_propState.meses}</div>
          <div style="font-size:10px;color:#065f46;">meses</div>
        </div>
      </div>
    </div>
    <div id="prop-e1-erro" style="color:#ef4444;font-size:12px;display:none;padding:8px 12px;background:#fef2f2;border-radius:6px;margin-top:8px;"></div>
  </div>`;
}

function _propCalcMeses() {
  const ini = document.getElementById('prop-inicio')?.value;
  const fim = document.getElementById('prop-fim')?.value;
  if (ini && fim) {
    const d1 = new Date(ini), d2 = new Date(fim);
    const meses = Math.max(1, Math.round((d2-d1)/(30*24*3600*1000)));
    _propState.meses = meses;
    const el = document.getElementById('prop-meses-display');
    if (el) el.textContent = meses;
  }
}

// ─── ETAPA 2 – Estrutura WBS ──────────────────────────────────
function _propEtapa2() {
  const tpl = _PROP_WBS_TEMPLATES[_propState.template] || _PROP_WBS_TEMPLATES.mineracao;
  const grupos = _propState.grupos.length ? _propState.grupos : tpl.grupos;

  return `
  <div>
    <div style="margin-bottom:16px;">
      <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 4px;">2. Estrutura WBS</h3>
      <p style="font-size:12px;color:#64748b;margin:0;">Escolha um template de mercado ou personalize a estrutura de decomposição do trabalho.</p>
    </div>

    <!-- Templates -->
    <div style="margin-bottom:18px;">
      <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:8px;">Template de Mercado</label>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
        ${Object.entries(_PROP_WBS_TEMPLATES).map(([k,t]) => `
        <div onclick="_propSelecionarTemplate('${k}')" style="border:2px solid ${_propState.template===k?'#0891b2':'#e2e8f0'};
          border-radius:10px;padding:12px;cursor:pointer;text-align:center;transition:all .15s;
          background:${_propState.template===k?'#f0f9ff':'#fff'};">
          <i class="fas fa-${k==='mineracao'?'mountain':k==='civil'?'building':k==='offshore'?'ship':'tools'}"
            style="font-size:18px;color:${_propState.template===k?'#0891b2':'#94a3b8'};display:block;margin-bottom:6px;"></i>
          <div style="font-size:11px;font-weight:600;color:${_propState.template===k?'#0891b2':'#475569'};line-height:1.3;">${t.label}</div>
        </div>`).join('')}
      </div>
    </div>

    <!-- Grupos WBS editáveis -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="font-size:12px;font-weight:600;color:#475569;">
          <i class="fas fa-sitemap" style="color:#0891b2;margin-right:6px;"></i>
          Grupos WBS (${grupos.length} grupos de 1º nível)
        </span>
        <button onclick="_propAddGrupo()" style="font-size:11px;padding:5px 12px;background:#0891b2;color:#fff;border:none;border-radius:6px;cursor:pointer;">
          <i class="fas fa-plus"></i> Grupo
        </button>
      </div>
      <div id="prop-grupos-list" style="display:flex;flex-direction:column;gap:8px;">
        ${grupos.map((g, gi) => `
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="width:24px;height:24px;background:#0891b2;border-radius:6px;display:flex;align-items:center;justify-content:center;
                         font-size:11px;font-weight:700;color:#fff;flex-shrink:0;">${g.g1}</span>
            <input value="${g.desc}" onchange="_propUpdateGrupo(${gi},'desc',this.value)"
              style="flex:1;padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;font-weight:600;">
            <button onclick="_propRemoveGrupo(${gi})" style="width:26px;height:26px;border:1px solid #fee2e2;border-radius:6px;
              background:#fef2f2;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i class="fas fa-times" style="font-size:10px;color:#ef4444;"></i>
            </button>
          </div>
          <div style="padding-left:32px;display:flex;flex-wrap:wrap;gap:6px;">
            ${(g.subs||[]).map((s, si) => `
            <span style="display:inline-flex;align-items:center;gap:5px;background:#f1f5f9;border-radius:20px;padding:3px 10px;font-size:11px;color:#475569;">
              <span style="font-family:monospace;color:#6366f1;font-size:10px;">${s.g2}</span>
              <input value="${s.desc}" onchange="_propUpdateSub(${gi},${si},this.value)"
                style="border:none;background:transparent;font-size:11px;color:#475569;width:${Math.max(100,s.desc.length*7)}px;outline:none;">
              <span onclick="_propRemoveSub(${gi},${si})" style="cursor:pointer;color:#cbd5e1;font-size:11px;">×</span>
            </span>`).join('')}
            <button onclick="_propAddSub(${gi})" style="background:transparent;border:1px dashed #cbd5e1;border-radius:20px;
              padding:3px 10px;font-size:11px;color:#94a3b8;cursor:pointer;">+ sub-grupo</button>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function _propSelecionarTemplate(key) {
  _propState.template = key;
  _propState.grupos = JSON.parse(JSON.stringify(_PROP_WBS_TEMPLATES[key].grupos));
  _propRenderWizard();
}
function _propUpdateGrupo(gi, campo, val) {
  _propState.grupos[gi][campo] = val;
}
function _propUpdateSub(gi, si, val) {
  _propState.grupos[gi].subs[si].desc = val;
}
function _propRemoveGrupo(gi) {
  _propState.grupos.splice(gi, 1);
  _propRenderWizard();
}
function _propAddGrupo() {
  const n = _propState.grupos.length + 1;
  _propState.grupos.push({ g1: String(n), desc: 'Novo Grupo ' + n, subs: [] });
  _propRenderWizard();
}
function _propAddSub(gi) {
  const g = _propState.grupos[gi];
  const n = (g.subs||[]).length + 1;
  if (!g.subs) g.subs = [];
  g.subs.push({ g2: g.g1 + '.' + n, desc: 'Sub-grupo ' + n });
  _propRenderWizard();
}
function _propRemoveSub(gi, si) {
  _propState.grupos[gi].subs.splice(si, 1);
  _propRenderWizard();
}

// ─── ETAPA 3 – Itens de Custo ─────────────────────────────────
function _propEtapa3() {
  const grupos = _propState.grupos.length ? _propState.grupos : _PROP_WBS_TEMPLATES[_propState.template].grupos;
  const totEst = _propState.itens.reduce((s,i) => s + (i.est_total||0), 0);
  const naturezasCom = [
    'Mão de Obra Direta','Mão de Obra Indireta','Subcontratados','Locação de Equipamentos',
    'Materiais / Consumíveis','Combustíveis e Lubrificantes','Alimentação e Hospedagem',
    'Transporte e Logística','EPI e Segurança','Projetos de Engenharia',
    'Manutenção','Administração Local','Outros'
  ];

  // Grupos para o select
  const grupoOpts = grupos.flatMap(g => (g.subs||[]).map(s =>
    `<option value="${g.g1}|${s.g2}|${s.g2}.1">${g.g1}.${s.g2.split('.')[1]} – ${g.desc}: ${s.desc}</option>`
  )).join('');

  const itensHtml = _propState.itens.length
    ? _propState.itens.map((item, idx) => `
    <div style="display:grid;grid-template-columns:30px 1fr 80px 100px 100px 90px 60px;gap:6px;align-items:center;
      padding:8px 10px;background:${idx%2===0?'#f8fafc':'#fff'};border-bottom:1px solid #f1f5f9;">
      <span style="font-size:11px;font-family:monospace;color:#6366f1;text-align:center;">${item.id||idx+1}</span>
      <div>
        <div style="font-size:12px;font-weight:600;color:#0f172a;">${item.descricao}</div>
        <div style="font-size:10px;color:#94a3b8;">${item.natureza} · ${item.expenditure} · ${item.tipo_custo}</div>
      </div>
      <span style="font-size:11px;color:#64748b;text-align:right;">${item.unid_rec||'vb'} × ${item.qtd_meses||1}</span>
      <span style="font-size:11px;color:#475569;text-align:right;">${_fmtBRL(item.est_unit)}</span>
      <span style="font-size:12px;font-weight:600;color:#0f172a;text-align:right;">${_fmtBRL(item.est_total)}</span>
      <span style="font-size:11px;color:#8b5cf6;text-align:right;">${_fmtBRL(item.selling)}</span>
      <div style="display:flex;gap:4px;justify-content:flex-end;">
        <button onclick="_propEditarItem(${idx})" style="width:24px;height:24px;border:1px solid #e2e8f0;border-radius:5px;background:#fff;cursor:pointer;">
          <i class="fas fa-pen" style="font-size:9px;color:#0891b2;"></i>
        </button>
        <button onclick="_propRemoverItem(${idx})" style="width:24px;height:24px;border:1px solid #fee2e2;border-radius:5px;background:#fef2f2;cursor:pointer;">
          <i class="fas fa-trash" style="font-size:9px;color:#ef4444;"></i>
        </button>
      </div>
    </div>`).join('')
    : `<div style="text-align:center;padding:32px;color:#94a3b8;">
        <i class="fas fa-list-ul" style="font-size:28px;display:block;margin-bottom:8px;opacity:.4;"></i>
        <p style="font-size:12px;margin:0;">Nenhum item adicionado ainda.<br>Clique em "+ Adicionar Item" para começar.</p>
       </div>`;

  return `
  <div>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;gap:12px;">
      <div>
        <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 4px;">3. Itens de Custo</h3>
        <p style="font-size:12px;color:#64748b;margin:0;">Adicione os pacotes de custo vinculados à estrutura WBS.</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <span style="font-size:12px;font-weight:700;color:#0891b2;background:#f0f9ff;padding:5px 12px;border-radius:20px;">
          <i class="fas fa-sigma" style="margin-right:4px;"></i> ${_fmtBRL(totEst)}
        </span>
        <button onclick="_propNovoItemModal()" style="padding:7px 14px;background:#0891b2;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">
          <i class="fas fa-plus"></i> Adicionar Item
        </button>
      </div>
    </div>

    <!-- Cabeçalho da tabela -->
    ${_propState.itens.length ? `
    <div style="display:grid;grid-template-columns:30px 1fr 80px 100px 100px 90px 60px;gap:6px;padding:6px 10px;background:#f1f5f9;border-radius:8px 8px 0 0;margin-bottom:0;">
      <span style="font-size:10px;font-weight:600;color:#64748b;text-align:center;">#</span>
      <span style="font-size:10px;font-weight:600;color:#64748b;">Descrição / Natureza</span>
      <span style="font-size:10px;font-weight:600;color:#64748b;text-align:right;">Qtd/Un</span>
      <span style="font-size:10px;font-weight:600;color:#64748b;text-align:right;">Unit.</span>
      <span style="font-size:10px;font-weight:600;color:#64748b;text-align:right;">Total Est.</span>
      <span style="font-size:10px;font-weight:600;color:#64748b;text-align:right;">Selling</span>
      <span></span>
    </div>` : ''}

    <div style="border:1px solid #e2e8f0;border-radius:${_propState.itens.length?'0 0 10px 10px':'10px'};overflow:hidden;max-height:280px;overflow-y:auto;">
      ${itensHtml}
    </div>
  </div>`;
}

function _propNovoItemModal(idx) {
  const isEdit = idx !== undefined;
  const item = isEdit ? _propState.itens[idx] : {};
  const grupos = _propState.grupos.length ? _propState.grupos : _PROP_WBS_TEMPLATES[_propState.template].grupos;
  const naturezas = [
    'Mão de Obra Direta','Mão de Obra Indireta','Subcontratados','Locação de Equipamentos',
    'Materiais / Consumíveis','Combustíveis e Lubrificantes','Alimentação e Hospedagem',
    'Transporte e Logística','EPI e Segurança','Projetos de Engenharia',
    'Manutenção','Administração Local','Outros'
  ];

  const grupoOpts = grupos.flatMap(g => (g.subs||[]).map(s =>
    `<option value="${g.g1}|${s.g2}" ${item.g2===s.g2?'selected':''}>${g.g1}.${s.g2.split('.')[1]||'x'} – ${s.desc}</option>`
  )).join('');

  // Modal interno sobre o wizard (usa outro div overlay)
  const overlay = document.createElement('div');
  overlay.id = 'prop-item-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:#00000040;z-index:9999;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
  <div style="background:#fff;border-radius:14px;padding:24px;width:min(560px,90vw);box-shadow:0 20px 60px #00000030;">
    <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 18px;display:flex;align-items:center;gap:8px;">
      <i class="fas fa-${isEdit?'pen':'plus'}" style="color:#0891b2;"></i> ${isEdit?'Editar':'Novo'} Item de Custo
    </h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      <div style="grid-column:1/-1;">
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Grupo WBS *</label>
        <select id="pi-grupo" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
          ${grupoOpts}
        </select>
      </div>
      <div style="grid-column:1/-1;">
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Descrição do Item *</label>
        <input id="pi-desc" value="${item.descricao||''}" placeholder="Ex: Escavadeira hidráulica 30t – mobilização"
          style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Natureza</label>
        <select id="pi-nat" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
          ${naturezas.map(n=>`<option value="${n}" ${item.natureza===n?'selected':''}>${n}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">CAPEX / OPEX</label>
        <select id="pi-exp" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
          <option value="CAPEX" ${item.expenditure==='CAPEX'?'selected':''}>CAPEX – Investimento</option>
          <option value="OPEX" ${item.expenditure!=='CAPEX'?'selected':''}>OPEX – Operacional</option>
        </select>
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Tipo de Custo</label>
        <select id="pi-tipo" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;" onchange="_piToggleRec()">
          <option value="One-off" ${(!item.tipo_custo||item.tipo_custo==='One-off')?'selected':''}>One-off (pontual)</option>
          <option value="Recorrente" ${item.tipo_custo==='Recorrente'?'selected':''}>Recorrente (mensal)</option>
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:12px;" id="pi-qtd-row">
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Unidade</label>
        <select id="pi-unid" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
          ${['vb','mês','dia','semana','hora','m','m²','m³','t','un'].map(u=>`<option value="${u}" ${item.unid_rec===u?'selected':''}>${u}</option>`).join('')}
        </select>
      </div>
      <div id="pi-meses-wrap">
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Qtd / Meses</label>
        <input id="pi-meses" type="number" value="${item.qtd_meses||1}" min="1"
          style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;"
          oninput="_piCalc()">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Vlr Unitário (R$)</label>
        <input id="pi-unit" type="number" value="${item.est_unit||0}" min="0"
          style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;"
          oninput="_piCalc()">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Total Est. (R$)</label>
        <input id="pi-total" type="number" value="${item.est_total||0}" readonly
          style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;background:#f8fafc;">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Fornecedor / Referência</label>
        <input id="pi-forn" value="${item.fornecedor||''}" placeholder="Nome do fornecedor ou base de referência"
          style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Observações / Premissas</label>
        <input id="pi-obs" value="${item.obs||''}" placeholder="Premissas de cálculo, cotação, prazo..."
          style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">
      <button onclick="document.getElementById('prop-item-overlay').remove()"
        style="padding:9px 20px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;font-size:13px;cursor:pointer;">Cancelar</button>
      <button onclick="_propSalvarItemModal(${isEdit?idx:'undefined'})"
        style="padding:9px 22px;border:none;border-radius:8px;background:#0891b2;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">
        <i class="fas fa-check" style="margin-right:6px;"></i>Confirmar
      </button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

function _piToggleRec() {
  const tipo = document.getElementById('pi-tipo')?.value;
  const wrap = document.getElementById('pi-meses-wrap');
  if (wrap) wrap.style.opacity = tipo === 'Recorrente' ? '1' : '0.5';
}
function _piCalc() {
  const qtd = parseFloat(document.getElementById('pi-meses')?.value||1);
  const unit = parseFloat(document.getElementById('pi-unit')?.value||0);
  const tot = document.getElementById('pi-total');
  if (tot) tot.value = Math.round(qtd * unit);
}
function _propEditarItem(idx) { _propNovoItemModal(idx); }
function _propRemoverItem(idx) {
  _propState.itens.splice(idx, 1);
  _propRenderWizard();
}
function _propSalvarItemModal(idx) {
  const g = id => document.getElementById(id)?.value?.trim();
  const desc = g('pi-desc');
  if (!desc) { alert('Informe a descrição do item.'); return; }
  const grupoVal = g('pi-grupo') || '';
  const [g1, g2] = grupoVal.split('|');
  const g3 = g2 ? g2 + '.1' : '1.1.1';
  const tipo_custo = g('pi-tipo') || 'One-off';
  const qtd = parseFloat(g('pi-meses')||1);
  const unit = parseFloat(g('pi-unit')||0);
  const novoItem = {
    id: (g2||'1.1') + '.' + (Date.now()%1000),
    g1: g1||'1', g2: g2||'1.1', g3,
    descricao: desc,
    natureza: g('pi-nat')||'Outros',
    expenditure: g('pi-exp')||'OPEX',
    tipo_custo,
    recorrente: tipo_custo === 'Recorrente',
    unid_rec: g('pi-unid')||'vb',
    qtd_meses: qtd,
    est_unit: unit,
    est_total: Math.round(qtd * unit),
    custo_real: 0, custo_proj: 0, custo_spot: 0,
    variacao: 0, variacao_pct: 0, selling: 0,
    fornecedor: g('pi-forn')||'',
    medicao: 'SIM', obs: g('pi-obs')||''
  };
  if (idx !== undefined && idx !== null) {
    _propState.itens[idx] = novoItem;
  } else {
    _propState.itens.push(novoItem);
  }
  document.getElementById('prop-item-overlay')?.remove();
  _propRenderWizard();
}

// ─── ETAPA 4 – Precificação ───────────────────────────────────
function _propEtapa4() {
  const totCusto = _propState.itens.reduce((s,i) => s + (i.est_total||0), 0);
  const contingV = totCusto * (_propState.contingencia/100);
  const overheadV = (totCusto + contingV) * (_propState.overhead/100);
  const subtotal = totCusto + contingV + overheadV;
  const markupV = subtotal * (_propState.markup/100);
  const precoVenda = subtotal + markupV;
  const margem = precoVenda > 0 ? ((precoVenda - subtotal)/precoVenda*100) : 0;
  const fatorM = precoVenda > 0 ? (precoVenda/subtotal) : 1;

  // Calcular selling price por item
  _propState.itens.forEach(item => {
    item.selling = Math.round((item.est_total||0) * fatorM);
  });

  return `
  <div>
    <div style="margin-bottom:18px;">
      <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 4px;">4. Precificação da Proposta</h3>
      <p style="font-size:12px;color:#64748b;margin:0;">Configure contingência, overhead e markup para calcular o preço de venda ao cliente.</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <!-- Sliders -->
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <label style="font-size:12px;font-weight:600;color:#0f172a;">Contingência <span style="font-size:10px;color:#64748b;font-weight:400;">(risco do escopo)</span></label>
            <span id="prop-cont-val" style="font-size:14px;font-weight:700;color:#f59e0b;">${_propState.contingencia}%</span>
          </div>
          <input type="range" id="prop-cont" min="0" max="30" value="${_propState.contingencia}"
            style="width:100%;accent-color:#f59e0b;"
            oninput="_propState.contingencia=+this.value;_propAtualizarPreco()">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-top:2px;">
            <span>0% – Escopo fixo</span><span>10% – Moderado</span><span>30% – Alto risco</span>
          </div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <label style="font-size:12px;font-weight:600;color:#0f172a;">Overhead <span style="font-size:10px;color:#64748b;font-weight:400;">(custos indiretos)</span></label>
            <span id="prop-over-val" style="font-size:14px;font-weight:700;color:#8b5cf6;">${_propState.overhead}%</span>
          </div>
          <input type="range" id="prop-over" min="0" max="30" value="${_propState.overhead}"
            style="width:100%;accent-color:#8b5cf6;"
            oninput="_propState.overhead=+this.value;_propAtualizarPreco()">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-top:2px;">
            <span>0%</span><span>8% – Típico</span><span>30%</span>
          </div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <label style="font-size:12px;font-weight:600;color:#0f172a;">Markup <span style="font-size:10px;color:#64748b;font-weight:400;">(lucro bruto)</span></label>
            <span id="prop-mark-val" style="font-size:14px;font-weight:700;color:#10b981;">${_propState.markup}%</span>
          </div>
          <input type="range" id="prop-mark" min="5" max="80" value="${_propState.markup}"
            style="width:100%;accent-color:#10b981;"
            oninput="_propState.markup=+this.value;_propAtualizarPreco()">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-top:2px;">
            <span>5% – Competitivo</span><span>30% – Padrão</span><span>80%</span>
          </div>
        </div>
      </div>

      <!-- Resumo de preço -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
        <div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:16px;text-transform:uppercase;letter-spacing:.5px;">
          Composição do Preço
        </div>
        <div id="prop-preco-resumo">
          ${_propBuildPrecoResumo(totCusto, contingV, overheadV, subtotal, markupV, precoVenda, margem)}
        </div>
      </div>
    </div>
  </div>`;
}

function _propBuildPrecoResumo(totCusto, contingV, overheadV, subtotal, markupV, precoVenda, margem) {
  return `
  <div style="display:flex;flex-direction:column;gap:10px;">
    ${[
      ['Custo Direto (WBS)', totCusto, '#3b82f6'],
      ['+ Contingência', contingV, '#f59e0b'],
      ['+ Overhead', overheadV, '#8b5cf6'],
      ['= Custo Total', subtotal, '#0f172a'],
      ['+ Markup (Lucro)', markupV, '#10b981'],
    ].map(([l,v,c]) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#fff;border-radius:8px;">
      <span style="font-size:12px;color:${l.startsWith('=')?'#0f172a':'#64748b'};font-weight:${l.startsWith('=')?'700':'400'};">${l}</span>
      <span style="font-size:13px;font-weight:600;color:${c};">${_fmtBRL(v)}</span>
    </div>`).join('')}
    <div style="background:linear-gradient(135deg,#0891b2,#0c4a6e);border-radius:10px;padding:14px;text-align:center;margin-top:4px;">
      <div style="font-size:11px;color:#bae6fd;font-weight:600;margin-bottom:4px;">PREÇO DE VENDA (SELLING PRICE)</div>
      <div style="font-size:24px;font-weight:700;color:#fff;">${_fmtBRL(precoVenda)}</div>
      <div style="font-size:11px;color:#bae6fd;margin-top:4px;">Margem Bruta: <strong>${margem.toFixed(1)}%</strong></div>
    </div>
  </div>`;
}

function _propAtualizarPreco() {
  const totCusto = _propState.itens.reduce((s,i) => s + (i.est_total||0), 0);
  const contingV = totCusto * (_propState.contingencia/100);
  const overheadV = (totCusto + contingV) * (_propState.overhead/100);
  const subtotal = totCusto + contingV + overheadV;
  const markupV = subtotal * (_propState.markup/100);
  const precoVenda = subtotal + markupV;
  const margem = precoVenda > 0 ? ((precoVenda - subtotal)/precoVenda*100) : 0;

  // Atualizar labels dos sliders
  const cv = document.getElementById('prop-cont-val');
  const ov = document.getElementById('prop-over-val');
  const mv = document.getElementById('prop-mark-val');
  if (cv) cv.textContent = _propState.contingencia + '%';
  if (ov) ov.textContent = _propState.overhead + '%';
  if (mv) mv.textContent = _propState.markup + '%';

  // Atualizar resumo de preço
  const el = document.getElementById('prop-preco-resumo');
  if (el) el.innerHTML = _propBuildPrecoResumo(totCusto, contingV, overheadV, subtotal, markupV, precoVenda, margem);
}

// ─── ETAPA 5 – Revisão & Geração ─────────────────────────────
function _propEtapa5() {
  const totCusto = _propState.itens.reduce((s,i) => s + (i.est_total||0), 0);
  const contingV = totCusto * (_propState.contingencia/100);
  const overheadV = (totCusto + contingV) * (_propState.overhead/100);
  const subtotal = totCusto + contingV + overheadV;
  const markupV = subtotal * (_propState.markup/100);
  const precoVenda = subtotal + markupV;
  const margem = precoVenda > 0 ? ((precoVenda - subtotal)/precoVenda*100) : 0;

  const grupos = _propState.grupos.length ? _propState.grupos : _PROP_WBS_TEMPLATES[_propState.template].grupos;
  const byG1 = {};
  _propState.itens.forEach(i => {
    if (!byG1[i.g1]) byG1[i.g1] = { est:0, n:0 };
    byG1[i.g1].est += i.est_total||0;
    byG1[i.g1].n++;
  });

  const erros = [];
  if (!_propState.nome) erros.push('Nome do projeto não preenchido (Etapa 1)');
  if (!_propState.cliente) erros.push('Cliente não informado (Etapa 1)');
  if (_propState.itens.length === 0) erros.push('Nenhum item de custo adicionado (Etapa 3)');

  return `
  <div>
    <div style="margin-bottom:16px;">
      <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 4px;">5. Revisão & Geração do Projeto</h3>
      <p style="font-size:12px;color:#64748b;margin:0;">Confira o resumo antes de gerar o projeto no sistema.</p>
    </div>

    ${erros.length ? `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:14px;">
      <div style="font-size:12px;font-weight:700;color:#ef4444;margin-bottom:6px;"><i class="fas fa-exclamation-triangle"></i> Atenção – Campos obrigatórios</div>
      ${erros.map(e=>`<div style="font-size:11px;color:#dc2626;">• ${e}</div>`).join('')}
    </div>` : `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
      <i class="fas fa-check-circle" style="color:#10b981;font-size:16px;"></i>
      <span style="font-size:12px;color:#065f46;font-weight:600;">Tudo pronto! O projeto será gerado com ${_propState.itens.length} itens WBS.</span>
    </div>`}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      <!-- Ficha do projeto -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:12px;">Identificação</div>
        ${[
          ['Projeto', _propState.nome||'–'],
          ['Cliente', _propState.cliente||'–'],
          ['Contrato', _propState.contrato||'(sem número)'],
          ['Período', `${_propState.inicio} → ${_propState.fim} (${_propState.meses} meses)`],
          ['Template WBS', _PROP_WBS_TEMPLATES[_propState.template]?.label||'–'],
          ['Grupos WBS', grupos.length + ' grupos / ' + grupos.reduce((s,g)=>s+(g.subs||[]).length,0) + ' sub-grupos'],
        ].map(([l,v]) => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f8fafc;font-size:12px;">
          <span style="color:#64748b;">${l}</span>
          <span style="color:#0f172a;font-weight:600;max-width:200px;text-align:right;">${v}</span>
        </div>`).join('')}
      </div>

      <!-- Resumo financeiro -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:12px;">Resumo Financeiro</div>
        ${[
          ['Custo Direto (WBS)', totCusto, '#3b82f6'],
          ['+ Contingência (' + _propState.contingencia + '%)', contingV, '#f59e0b'],
          ['+ Overhead (' + _propState.overhead + '%)', overheadV, '#8b5cf6'],
          ['= Custo Total', subtotal, '#475569'],
          ['Selling Price', precoVenda, '#0891b2'],
          ['Margem Bruta', null, '#10b981'],
        ].map(([l,v,c]) => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f8fafc;font-size:12px;">
          <span style="color:#64748b;">${l}</span>
          <span style="color:${c};font-weight:700;">${v===null ? margem.toFixed(1)+'%' : _fmtBRL(v)}</span>
        </div>`).join('')}
      </div>

      <!-- Itens por grupo -->
      <div style="grid-column:1/-1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:10px;">WBS por Grupo (${_propState.itens.length} itens)</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          ${grupos.map(g => {
            const d = byG1[g.g1] || { est:0, n:0 };
            return `
            <div style="background:#fff;border-radius:8px;padding:10px;border:1px solid #e2e8f0;">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <span style="width:20px;height:20px;background:#0891b220;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#0891b2;">${g.g1}</span>
                <span style="font-size:11px;font-weight:600;color:#334155;">${g.desc}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:11px;">
                <span style="color:#94a3b8;">${d.n} itens</span>
                <span style="font-weight:600;color:#0f172a;">${_fmtBRL(d.est)}</span>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

// ─── NAVEGAÇÃO DO WIZARD ──────────────────────────────────────
function _propIrEtapa(n) {
  _propState.etapa = n;
  _propRenderWizard();
}
function _propAnterior() {
  _propColherEtapaAtual();
  _propState.etapa = Math.max(1, _propState.etapa - 1);
  _propRenderWizard();
}
function _propProximo() {
  if (!_propValidarEtapa()) return;
  _propColherEtapaAtual();
  _propState.etapa = Math.min(_propState.totalEtapas, _propState.etapa + 1);
  _propRenderWizard();
}
function _propColherEtapaAtual() {
  if (_propState.etapa === 1) {
    _propState.nome = document.getElementById('prop-nome')?.value || _propState.nome;
    _propState.cliente = document.getElementById('prop-cliente')?.value || _propState.cliente;
    _propState.contrato = document.getElementById('prop-contrato')?.value || _propState.contrato;
    _propState.descricao = document.getElementById('prop-desc')?.value || _propState.descricao;
    _propState.inicio = document.getElementById('prop-inicio')?.value || _propState.inicio;
    _propState.fim = document.getElementById('prop-fim')?.value || _propState.fim;
    _propState.moeda = document.getElementById('prop-moeda')?.value || _propState.moeda;
    _propCalcMeses();
  }
  if (_propState.etapa === 2 && !_propState.grupos.length) {
    _propState.grupos = JSON.parse(JSON.stringify(_PROP_WBS_TEMPLATES[_propState.template].grupos));
  }
}
function _propValidarEtapa() {
  if (_propState.etapa === 1) {
    const nome = document.getElementById('prop-nome')?.value?.trim();
    const cli = document.getElementById('prop-cliente')?.value?.trim();
    const e = document.getElementById('prop-e1-erro');
    if (!nome || !cli) {
      if (e) { e.textContent = '⚠ Nome do projeto e Cliente são obrigatórios.'; e.style.display='block'; }
      return false;
    }
    _propState.nome = nome;
    _propState.cliente = cli;
    if (e) e.style.display = 'none';
  }
  return true;
}

// ─── GERAR PROJETO NO SISTEMA ─────────────────────────────────
function _propGerar() {
  _propColherEtapaAtual();

  const erros = [];
  if (!_propState.nome) erros.push('Nome do projeto');
  if (!_propState.cliente) erros.push('Cliente');
  if (_propState.itens.length === 0) erros.push('Itens de custo (mínimo 1)');
  if (erros.length) {
    alert('Preencha os campos obrigatórios:\n• ' + erros.join('\n• '));
    return;
  }

  // Calcular selling price final
  const totCusto = _propState.itens.reduce((s,i) => s + (i.est_total||0), 0);
  const contingV = totCusto * (_propState.contingencia/100);
  const overheadV = (totCusto + contingV) * (_propState.overhead/100);
  const subtotal = totCusto + contingV + overheadV;
  const markupV = subtotal * (_propState.markup/100);
  const precoVenda = subtotal + markupV;
  const fatorM = totCusto > 0 ? (precoVenda/subtotal) : 1;
  _propState.itens.forEach(item => { item.selling = Math.round((item.est_total||0) * fatorM); });

  // Criar projeto
  const projId = 'PROJ-' + Date.now().toString().slice(-6);
  const novoProjeto = {
    id: projId,
    nome: _propState.nome,
    contrato: _propState.contrato || ('PROP-' + new Date().getFullYear() + '-' + projId.slice(-3)),
    cliente: _propState.cliente,
    status: 'Proposta',
    inicio: _propState.inicio,
    fim: _propState.fim,
    mesesContrato: _propState.meses,
    budget: Math.round(subtotal),
    selling: Math.round(precoVenda),
    moeda: _propState.moeda,
    descricao: _propState.descricao,
    contingencia: _propState.contingencia,
    overhead: _propState.overhead,
    markup: _propState.markup,
    dataCriacao: new Date().toISOString().slice(0,10)
  };

  // Salvar projeto
  const projetos = _custosGetProjects();
  projetos.push(novoProjeto);
  localStorage.setItem('fraser_custos_projetos', JSON.stringify(projetos));

  // Salvar itens WBS vinculados ao novo projeto (com campo projeto_id)
  const itensExistentes = _custosGetData();
  const novosItens = _propState.itens.map(item => ({
    ...item,
    projeto_id: projId,
    custo_real: 0, custo_proj: 0, variacao: item.est_total||0, variacao_pct: 1,
    selling: Math.round((item.est_total||0) * fatorM)
  }));
  const todosItens = [...itensExistentes, ...novosItens];
  _custosSaveData(todosItens);

  // Trocar para o novo projeto
  _custosState.projeto = projId;
  _custosState.tabAtiva = 'overview';

  closeModal();
  renderCustos();
  if (typeof showToast === 'function') {
    showToast(`✅ Projeto "${_propState.nome}" criado com ${_propState.itens.length} itens WBS!`, 'success');
  }
}

function _custosExportar() {
  const items = _custosGetData();
  const linhas = [['Código','Grupo L1','Grupo L2','L3','Descrição','Natureza','Tipo','Fornecedor','Unid','Qtd','Est. Unitário','Est. Total','Custo Real','Variação','Selling','Obs']];
  items.forEach(i => {
    const vari = (i.est_total||0) - (i.custo_real||0);
    linhas.push([i.id,i.g1,i.g2,i.g3,i.descricao,i.natureza,i.expenditure,i.fornecedor,i.unid_rec,i.qtd_meses,
      i.est_unit,i.est_total,i.custo_real,vari,i.selling,i.obs]);
  });
  const csv = linhas.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'WBS_Custos_Projeto.csv'; a.click();
  URL.revokeObjectURL(url);
  if (typeof showToast === 'function') showToast('Exportação iniciada!', 'success');
}

// ─── PATCH: Chamar _custosRenderWBSTree após renderizar ABA WBS ──
(function() {
  const orig = window._custosRenderAba;
  // Será chamado pelo navigate → renderCustos → _custosRenderAba → post-render
})();

// ─── CRIAR NOVO PROJETO ──────────────────────────────────────────────
function _custosCriarProjeto() {
  const hoje = new Date().toISOString().split('T')[0];
  const fim = new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0];
  if (typeof openModalWide === 'function') {
    openModalWide('Novo Projeto / Contrato WBS', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div style="grid-column:1/-1">
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Nome do Projeto *</label>
          <input id="np_nome" placeholder="Ex: Manutenção Industrial – Complexo Norte" style="width:100%;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Número do Contrato</label>
          <input id="np_contrato" placeholder="CTR-2026-001" style="width:100%;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Cliente</label>
          <input id="np_cliente" placeholder="Nome do cliente" style="width:100%;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Status</label>
          <select id="np_status" style="width:100%;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
            <option>Proposta</option><option>Em Execução</option><option>Mobilização</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Data Início</label>
          <input id="np_inicio" type="date" value="${hoje}" style="width:100%;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Data Fim</label>
          <input id="np_fim" type="date" value="${fim}" style="width:100%;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Meses do Contrato</label>
          <input id="np_meses" type="number" value="12" min="1" style="width:100%;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Moeda</label>
          <select id="np_moeda" style="width:100%;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;box-sizing:border-box">
            <option value="BRL">BRL – Real</option><option value="USD">USD – Dólar</option>
          </select>
        </div>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="_custosConfirmarCriarProjeto()"><i class="fas fa-plus"></i> Criar Projeto</button>
    `);
  }
}
function _custosConfirmarCriarProjeto() {
  const nome = document.getElementById('np_nome')?.value?.trim();
  if (!nome) { if(typeof showToast==='function') showToast('Informe o nome do projeto.','error'); return; }
  const projetos = _custosGetProjects();
  const ano = new Date().getFullYear();
  const id = 'PROJ-'+ano+'-'+String(projetos.length+1).padStart(3,'0');
  const novo = {
    id, nome,
    contrato: document.getElementById('np_contrato')?.value||'',
    cliente: document.getElementById('np_cliente')?.value||'',
    status: document.getElementById('np_status')?.value||'Proposta',
    inicio: document.getElementById('np_inicio')?.value||'',
    fim: document.getElementById('np_fim')?.value||'',
    mesesContrato: parseInt(document.getElementById('np_meses')?.value||12),
    moeda: document.getElementById('np_moeda')?.value||'BRL',
    budget: 0, selling: 0, runRateEstimado: 0, dataRef: new Date().toISOString().split('T')[0]
  };
  projetos.push(novo);
  localStorage.setItem('fraser_custos_projetos', JSON.stringify(projetos));
  if (typeof closeModal==='function') closeModal();
  if (typeof showToast==='function') showToast(`Projeto ${id} criado!`,'success');
  _custosState.projeto = id;
  renderCustos();
}

// ─── Override global para chamar renderWBSTree na aba WBS ────
window._custosRenderAba = function() {
  const container = document.getElementById('custos-tab-content');
  if (!container) return;
  const t = _custosState.tabAtiva;
  if (t === 'overview') container.innerHTML = _custosTabOverview();
  else if (t === 'wbs') {
    container.innerHTML = _custosTabWBS();
    _custosRenderWBSTree();
  }
  else if (t === 'mensal') container.innerHTML = _custosTabMensal();
  else if (t === 'realizado') container.innerHTML = _custosTabRealizado();
  else if (t === 'integracao') container.innerHTML = _custosTabIntegracao();
};

// ── C1: leads do CRM aguardando precificação (orçamentação) ──────────────
async function _mostrarLeadsOrcamentacao() {
  const main = document.getElementById('mainContent');
  if (!main || typeof apiAuth !== 'function') return;
  let leads = [];
  try { leads = await apiAuth('/api/crm/orcamentacao?status=pendente') || []; } catch (e) { return; }
  const old = document.getElementById('orcamentacao_banner');
  if (old) old.remove();
  if (!leads.length) return;
  const div = document.createElement('div');
  div.id = 'orcamentacao_banner';
  div.style.cssText = 'margin:0 0 16px;padding:14px 16px;border:1px solid rgba(217,119,6,.35);background:rgba(217,119,6,.07);border-radius:10px';
  div.innerHTML = `
    <div style="font-size:13px;font-weight:700;color:#d97706;margin-bottom:8px">
      <i class="fas fa-calculator" style="margin-right:6px"></i>${leads.length} lead(s) aguardando estimativa de custos (WBS)
    </div>
    ${leads.map(l => `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;padding:5px 0;border-top:1px dashed rgba(0,0,0,.06)">
        <span><b>${l.titulo || 'Lead'}</b> — ${l.cliente || ''} ${l.valor ? '· R$ ' + Number(l.valor).toLocaleString('pt-BR') : ''} <span style="color:var(--text-muted)">(${l.estagio})</span></span>
        <button class="btn btn-primary btn-sm" style="padding:2px 8px;font-size:11px" onclick="criarEstimativaLead('${l.id}','${(l.titulo||'').replace(/'/g,'')}')"><i class="fas fa-plus"></i> Criar estimativa</button>
      </div>`).join('')}`;
  main.insertBefore(div, main.firstChild);
}

async function criarEstimativaLead(leadId, titulo) {
  const desc = prompt(`Estimativa de custos para "${titulo}".\nDescreva a 1ª linha da WBS (ex.: Mobilização):`, 'Estimativa inicial');
  if (!desc) return;
  const valor = parseFloat(prompt('Valor estimado (R$) desta linha:', '0')) || 0;
  try {
    await apiAuth('/api/wbs', { method: 'POST', body: JSON.stringify({ descricao: desc, lead_id: leadId, origem: 'orcamentacao', valor_total_est: valor }) });
    if (typeof showToast === 'function') showToast('Estimativa iniciada e vinculada ao lead. O comercial já pode preparar a proposta.', 'success', 6000);
    _mostrarLeadsOrcamentacao();
  } catch (e) { if (typeof showToast === 'function') showToast('Falha: ' + e.message, 'error'); }
}

window.criarEstimativaLead = criarEstimativaLead;
