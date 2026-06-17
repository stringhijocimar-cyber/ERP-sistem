// =====================================================
// Fraser Alexander ERP – Cadastro em Massa
// Fornecedores e Materiais via CSV/Planilha + Formulário múltiplo
// =====================================================

// ─── HELPERS ───────────────────────────────────────
function _parseCsvLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

function _gerarIdMassa(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).substr(2,4).toUpperCase();
}

// =====================================================
// CADASTRO EM MASSA – FORNECEDORES
// =====================================================
function abrirCadastroMassaFornecedores() {
  openModalWide('Cadastro em Massa – Fornecedores', `
    <div style="display:flex;gap:0;border-bottom:1px solid var(--border-color);margin-bottom:16px">
      <button id="tab-massa-forn-csv" onclick="switchTabMassaForn('csv')"
        style="padding:10px 18px;border:none;background:var(--bg-tertiary);color:var(--fa-teal);font-weight:700;border-bottom:2px solid var(--fa-teal);cursor:pointer;font-size:13px">
        <i class="fas fa-file-csv" style="margin-right:6px"></i>Importar CSV/Planilha
      </button>
      <button id="tab-massa-forn-form" onclick="switchTabMassaForn('form')"
        style="padding:10px 18px;border:none;background:transparent;color:var(--text-secondary);font-weight:400;border-bottom:2px solid transparent;cursor:pointer;font-size:13px">
        <i class="fas fa-table" style="margin-right:6px"></i>Preencher Tabela
      </button>
    </div>

    <div id="massa-forn-csv-tab">
      <!-- Instruções CSV -->
      <div style="background:rgba(0,180,184,0.07);border:1px solid rgba(0,180,184,0.25);border-radius:10px;padding:14px;margin-bottom:14px">
        <div style="font-size:12px;font-weight:700;color:var(--fa-teal);margin-bottom:8px">
          <i class="fas fa-info-circle" style="margin-right:6px"></i>Formato do arquivo CSV / Excel (salvo como CSV)
        </div>
        <div style="font-size:11px;color:var(--text-secondary);line-height:1.7">
          <strong>Colunas obrigatórias:</strong> razao_social, cnpj<br>
          <strong>Colunas opcionais:</strong> nome_fantasia, categoria, contato_nome, contato_email, contato_telefone, cidade, estado, prazo_pagamento, limite_credito, status<br>
          <strong>Separador:</strong> vírgula (,) ou ponto-e-vírgula (;)<br>
          <strong>Encoding:</strong> UTF-8
        </div>
        <div style="margin-top:8px">
          <button onclick="baixarModeloFornecedoresCSV()" class="btn btn-secondary btn-sm">
            <i class="fas fa-download"></i> Baixar Modelo CSV
          </button>
        </div>
      </div>

      <!-- Área de upload -->
      <div id="drop-forn" style="border:2px dashed var(--border-color);border-radius:12px;padding:32px;text-align:center;cursor:pointer;transition:all 0.2s;margin-bottom:12px"
        onclick="document.getElementById('file-forn-massa').click()"
        ondragover="event.preventDefault();this.style.borderColor='var(--fa-teal)';this.style.background='rgba(0,180,184,0.07)'"
        ondragleave="this.style.borderColor='var(--border-color)';this.style.background='transparent'"
        ondrop="event.preventDefault();this.style.borderColor='var(--border-color)';this.style.background='transparent';handleFornMassaDrop(event)">
        <i class="fas fa-cloud-upload-alt" style="font-size:32px;color:var(--fa-teal);display:block;margin-bottom:8px"></i>
        <div style="font-size:13px;font-weight:600;color:var(--text-primary)">Arraste o arquivo CSV aqui</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">ou clique para selecionar</div>
        <input type="file" id="file-forn-massa" accept=".csv,.txt" style="display:none" onchange="processarFornMassaCSV(this)">
      </div>

      <!-- Colar dados direto -->
      <div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px">
          Ou cole os dados diretamente (CSV):
        </div>
        <textarea id="forn-massa-texto" rows="6" placeholder="razao_social,cnpj,categoria,contato_email&#10;Empresa A,12.345.678/0001-90,Lubrificantes,contato@empresaa.com&#10;Empresa B,98.765.432/0001-10,EPI e Segurança,vendas@empresab.com"
          style="width:100%;padding:10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px;font-family:monospace;box-sizing:border-box;resize:vertical"></textarea>
        <button onclick="processarFornMassaTexto()" class="btn btn-secondary btn-sm" style="margin-top:6px">
          <i class="fas fa-play"></i> Processar Texto
        </button>
      </div>
    </div>

    <div id="massa-forn-form-tab" style="display:none">
      <!-- Tabela de entrada manual -->
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">
        Preencha os dados de cada fornecedor. Clique em <strong>+ Linha</strong> para adicionar mais.
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px" id="tbl-forn-massa">
          <thead>
            <tr style="background:var(--bg-tertiary)">
              <th style="padding:8px;text-align:left;min-width:180px">Razão Social *</th>
              <th style="padding:8px;text-align:left;min-width:130px">CNPJ *</th>
              <th style="padding:8px;text-align:left;min-width:130px">Nome Fantasia</th>
              <th style="padding:8px;text-align:left;min-width:130px">Categoria</th>
              <th style="padding:8px;text-align:left;min-width:160px">E-mail Contato</th>
              <th style="padding:8px;text-align:left;min-width:110px">Telefone</th>
              <th style="padding:8px;text-align:left;min-width:100px">Cidade</th>
              <th style="padding:8px;text-align:left;min-width:50px">UF</th>
              <th style="padding:8px;min-width:36px"></th>
            </tr>
          </thead>
          <tbody id="tbody-forn-massa">
            ${[0,1,2].map(i => _htmlLinhaFornMassa(i)).join('')}
          </tbody>
        </table>
      </div>
      <button onclick="adicionarLinhaFornMassa()" class="btn btn-secondary btn-sm" style="margin-top:8px">
        <i class="fas fa-plus"></i> + Linha
      </button>
    </div>

    <!-- Preview dos dados processados -->
    <div id="preview-forn-massa" style="display:none;margin-top:14px">
      <div style="font-size:12px;font-weight:700;color:var(--fa-teal);margin-bottom:8px">
        <i class="fas fa-eye" style="margin-right:6px"></i>Preview – Dados a importar
      </div>
      <div id="preview-forn-massa-content" style="max-height:200px;overflow-y:auto;border:1px solid var(--border-color);border-radius:8px"></div>
      <div id="preview-forn-massa-erros" style="margin-top:8px"></div>
    </div>

    <div id="massa-forn-resultado" style="display:none;margin-top:12px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="confirmarImportacaoFornecedores()">
      <i class="fas fa-upload"></i> Importar Fornecedores
    </button>
  `);
}

function switchTabMassaForn(tab) {
  const csv = document.getElementById('massa-forn-csv-tab');
  const form = document.getElementById('massa-forn-form-tab');
  const btnCsv = document.getElementById('tab-massa-forn-csv');
  const btnForm = document.getElementById('tab-massa-forn-form');
  if (tab === 'csv') {
    csv.style.display = ''; form.style.display = 'none';
    btnCsv.style.background = 'var(--bg-tertiary)'; btnCsv.style.color = 'var(--fa-teal)';
    btnCsv.style.fontWeight = '700'; btnCsv.style.borderBottom = '2px solid var(--fa-teal)';
    btnForm.style.background = 'transparent'; btnForm.style.color = 'var(--text-secondary)';
    btnForm.style.fontWeight = '400'; btnForm.style.borderBottom = '2px solid transparent';
  } else {
    csv.style.display = 'none'; form.style.display = '';
    btnForm.style.background = 'var(--bg-tertiary)'; btnForm.style.color = 'var(--fa-teal)';
    btnForm.style.fontWeight = '700'; btnForm.style.borderBottom = '2px solid var(--fa-teal)';
    btnCsv.style.background = 'transparent'; btnCsv.style.color = 'var(--text-secondary)';
    btnCsv.style.fontWeight = '400'; btnCsv.style.borderBottom = '2px solid transparent';
  }
}

function _htmlLinhaFornMassa(idx) {
  const cats = ['Peças e Componentes','Lubrificantes','EPI e Segurança','Material Elétrico','Ferramentas','Combustível','Transporte e Logística','Abrasivos','Rolamentos','TI e Software','Outros'];
  return `
    <tr class="linha-forn-massa">
      <td style="padding:4px"><input class="form-control forn-m-razao" placeholder="Razão Social *" style="font-size:11px"></td>
      <td style="padding:4px"><input class="form-control forn-m-cnpj" placeholder="00.000.000/0001-00" style="font-size:11px" oninput="mascararCNPJ(this)"></td>
      <td style="padding:4px"><input class="form-control forn-m-fantasia" placeholder="Nome Fantasia" style="font-size:11px"></td>
      <td style="padding:4px">
        <select class="form-control forn-m-cat" style="font-size:11px">
          <option value="">Selecione</option>
          ${cats.map(c => `<option>${c}</option>`).join('')}
        </select>
      </td>
      <td style="padding:4px"><input class="form-control forn-m-email" placeholder="email@fornecedor.com" type="email" style="font-size:11px"></td>
      <td style="padding:4px"><input class="form-control forn-m-tel" placeholder="(00) 00000-0000" style="font-size:11px"></td>
      <td style="padding:4px"><input class="form-control forn-m-cidade" placeholder="Cidade" style="font-size:11px"></td>
      <td style="padding:4px">
        <select class="form-control forn-m-uf" style="font-size:11px">
          <option value="">UF</option>
          ${['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(uf=>`<option>${uf}</option>`).join('')}
        </select>
      </td>
      <td style="padding:4px;text-align:center">
        <button onclick="this.closest('tr').remove()" class="btn btn-danger btn-sm btn-icon" title="Remover linha"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `;
}

function adicionarLinhaFornMassa() {
  const tbody = document.getElementById('tbody-forn-massa');
  if (!tbody) return;
  const idx = tbody.querySelectorAll('tr').length;
  const tr = document.createElement('tr');
  tr.innerHTML = _htmlLinhaFornMassa(idx);
  tr.className = 'linha-forn-massa';
  tbody.appendChild(tr);
}

function mascararCNPJ(el) {
  let v = el.value.replace(/\D/g,'');
  if (v.length > 14) v = v.substr(0,14);
  v = v.replace(/^(\d{2})(\d)/,'$1.$2');
  v = v.replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3');
  v = v.replace(/\.(\d{3})(\d)/,'.$1/$2');
  v = v.replace(/(\d{4})(\d)/,'$1-$2');
  el.value = v;
}

function handleFornMassaDrop(event) {
  const file = event.dataTransfer.files[0];
  if (file) processarFornMassaArquivo(file);
}

function processarFornMassaCSV(input) {
  const file = input.files[0];
  if (file) processarFornMassaArquivo(file);
}

function processarFornMassaArquivo(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('forn-massa-texto').value = e.target.result;
    processarFornMassaTexto();
  };
  reader.readAsText(file, 'UTF-8');
}

// Dados temporários de preview
let _fornMassaPreview = [];

function processarFornMassaTexto() {
  const texto = document.getElementById('forn-massa-texto')?.value.trim();
  if (!texto) { showToast('Cole ou carregue os dados primeiro.', 'warning'); return; }

  const linhas = texto.split('\n').map(l => l.trim()).filter(l => l);
  if (linhas.length < 2) { showToast('O arquivo precisa ter pelo menos cabeçalho + 1 linha de dados.', 'warning'); return; }

  // Detectar separador
  const sep = linhas[0].includes(';') ? ';' : ',';
  const headers = _parseCsvLine(linhas[0].toLowerCase().replace(/;/g,',')).map(h => h.replace(/"/g,'').trim());

  const dados = [];
  const erros = [];

  for (let i = 1; i < linhas.length; i++) {
    const cols = _parseCsvLine(linhas[i].replace(/;/g,','));
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (cols[idx] || '').replace(/"/g,'').trim(); });

    const razao = obj['razao_social'] || obj['razão_social'] || obj['nome'] || obj['empresa'] || '';
    const cnpj  = obj['cnpj'] || '';

    if (!razao) { erros.push(`Linha ${i+1}: Razão Social obrigatória`); continue; }
    if (!cnpj)  { erros.push(`Linha ${i+1}: CNPJ obrigatório`); continue; }

    dados.push({
      id: _gerarIdMassa('FOR'),
      razao_social: razao,
      cnpj,
      nome_fantasia: obj['nome_fantasia'] || obj['fantasia'] || razao,
      categoria:     obj['categoria'] || 'Outros',
      contato_nome:  obj['contato_nome'] || obj['contato'] || '',
      contato_email: obj['contato_email'] || obj['email'] || '',
      contato_telefone: obj['contato_telefone'] || obj['telefone'] || '',
      cidade: obj['cidade'] || '',
      estado: obj['estado'] || obj['uf'] || '',
      prazo_pagamento: parseInt(obj['prazo_pagamento']) || 30,
      limite_credito: parseFloat(obj['limite_credito']) || 0,
      status: obj['status'] || 'Em Homologação',
      avaliacao: 0,
      total_pedidos: 0,
      total_gasto: 0,
      documentos_ok: false
    });
  }

  _fornMassaPreview = dados;
  _renderPreviewFornecedores(dados, erros);
}

function _renderPreviewFornecedores(dados, erros) {
  const prev = document.getElementById('preview-forn-massa');
  const cont = document.getElementById('preview-forn-massa-content');
  const erroEl = document.getElementById('preview-forn-massa-erros');
  if (!prev || !cont) return;

  prev.style.display = '';

  if (!dados.length && !erros.length) {
    cont.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Nenhum dado válido encontrado.</div>';
    return;
  }

  cont.innerHTML = dados.length ? `
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr style="background:var(--bg-tertiary)">
        <th style="padding:6px 8px;text-align:left">Razão Social</th>
        <th style="padding:6px 8px;text-align:left">CNPJ</th>
        <th style="padding:6px 8px;text-align:left">Categoria</th>
        <th style="padding:6px 8px;text-align:left">E-mail</th>
        <th style="padding:6px 8px;text-align:left">Cidade/UF</th>
        <th style="padding:6px 8px;text-align:left">Status</th>
      </tr></thead>
      <tbody>
        ${dados.map(d => `
          <tr style="border-bottom:1px solid var(--border-color)">
            <td style="padding:5px 8px;font-weight:600;color:var(--text-primary)">${d.razao_social}</td>
            <td style="padding:5px 8px;color:var(--text-muted);font-size:10px">${d.cnpj}</td>
            <td style="padding:5px 8px"><span style="background:rgba(0,180,184,0.1);color:var(--fa-teal);padding:2px 6px;border-radius:4px;font-size:10px">${d.categoria}</span></td>
            <td style="padding:5px 8px;color:var(--text-muted);font-size:10px">${d.contato_email || '—'}</td>
            <td style="padding:5px 8px;font-size:10px">${d.cidade}${d.estado ? '/'+d.estado : ''}</td>
            <td style="padding:5px 8px"><span style="background:rgba(245,158,11,0.15);color:var(--yellow-light);padding:2px 6px;border-radius:4px;font-size:10px">${d.status}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="padding:8px 12px;background:rgba(34,197,94,0.08);font-size:12px;font-weight:600;color:var(--green-light);border-top:1px solid var(--border-color)">
      ✓ ${dados.length} fornecedor(es) prontos para importar
    </div>
  ` : '<div style="padding:20px;text-align:center;color:var(--text-muted)">Nenhum dado válido.</div>';

  erroEl.innerHTML = erros.length ? `
    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:8px;padding:10px">
      <div style="font-size:11px;font-weight:700;color:var(--red-light);margin-bottom:6px"><i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>${erros.length} erro(s) encontrado(s):</div>
      ${erros.map(e => `<div style="font-size:11px;color:var(--text-secondary);padding:2px 0">• ${e}</div>`).join('')}
    </div>
  ` : '';
}

function confirmarImportacaoFornecedores() {
  // Verifica qual aba está ativa
  const csvTab = document.getElementById('massa-forn-csv-tab');
  const isCSV = csvTab && csvTab.style.display !== 'none';

  if (isCSV) {
    // Importar dados do preview CSV
    if (!_fornMassaPreview.length) {
      showToast('Processe os dados antes de importar.', 'warning');
      return;
    }
    _salvarFornecedoresMassa(_fornMassaPreview);
  } else {
    // Coletar dados da tabela manual
    const linhas = document.querySelectorAll('#tbody-forn-massa tr.linha-forn-massa');
    const dados = [];
    linhas.forEach(tr => {
      const razao = tr.querySelector('.forn-m-razao')?.value.trim();
      const cnpj  = tr.querySelector('.forn-m-cnpj')?.value.trim();
      if (!razao || !cnpj) return;
      dados.push({
        id: _gerarIdMassa('FOR'),
        razao_social: razao,
        cnpj,
        nome_fantasia: tr.querySelector('.forn-m-fantasia')?.value.trim() || razao,
        categoria:     tr.querySelector('.forn-m-cat')?.value || 'Outros',
        contato_nome:  '',
        contato_email: tr.querySelector('.forn-m-email')?.value.trim() || '',
        contato_telefone: tr.querySelector('.forn-m-tel')?.value.trim() || '',
        cidade: tr.querySelector('.forn-m-cidade')?.value.trim() || '',
        estado: tr.querySelector('.forn-m-uf')?.value || '',
        prazo_pagamento: 30,
        limite_credito: 0,
        status: 'Em Homologação',
        avaliacao: 0, total_pedidos: 0, total_gasto: 0, documentos_ok: false
      });
    });
    if (!dados.length) { showToast('Preencha pelo menos um fornecedor (Razão Social e CNPJ obrigatórios).', 'warning'); return; }
    _salvarFornecedoresMassa(dados);
  }
}

async function _salvarFornecedoresMassa(lista) {
  const resEl = document.getElementById('massa-forn-resultado');

  // Mostra progresso
  if (resEl) {
    resEl.style.display = '';
    resEl.innerHTML = `
      <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:10px;padding:14px;text-align:center">
        <i class="fas fa-spinner fa-spin" style="font-size:24px;color:#3b82f6;display:block;margin-bottom:8px"></i>
        <div style="font-size:14px;font-weight:600;color:#94a3b8">Salvando fornecedores... <span id="massa-prog">0</span>/${lista.length}</div>
      </div>`;
  }

  // Filtra duplicatas por CNPJ já existentes
  const existentes = typeof _getFornecedores === 'function' ? _getFornecedores() : (typeof FA_FORNECEDORES !== 'undefined' ? FA_FORNECEDORES : []);
  const cnpjsExistentes = new Set(existentes.map(f => (f.cnpj||'').replace(/\D/g,'')));
  const novos     = lista.filter(f => !cnpjsExistentes.has((f.cnpj||'').replace(/\D/g,'')));
  const duplicados = lista.length - novos.length;

  const token = sessionStorage.getItem('fa_token') || localStorage.getItem('fa_token') || '';
  let salvos = 0;
  const erros = [];

  for (let i = 0; i < novos.length; i++) {
    const f = novos[i];
    // Monta payload igual ao salvarNovoFornecedor
    const payload = {
      nome:            f.nome_fantasia || f.razao_social,
      razao_social:    f.razao_social,
      cnpj:            f.cnpj,
      categoria:       f.categoria || 'Outros',
      contato_nome:    f.contato_nome  || null,
      email:           f.contato_email || null,
      telefone:        f.contato_telefone || null,
      cidade:          f.cidade  || null,
      estado:          f.estado  || null,
      prazo_pagamento: f.prazo_pagamento || 30,
      limite_credito:  f.limite_credito  || 0,
      status:          f.status  || 'Em Homologação',
      ativo:           (f.status === 'Ativo') ? 1 : 1,
    };

    try {
      const res = await fetch('/api/fornecedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      salvos++;
    } catch(e) {
      erros.push(`${f.razao_social}: ${e.message}`);
    }

    // Atualiza contador de progresso
    const prog = document.getElementById('massa-prog');
    if (prog) prog.textContent = i + 1;
  }

  // Também persiste no localStorage como fallback (para caso a API não esteja disponível)
  try {
    const cacheAtual = JSON.parse(localStorage.getItem('fa_fornecedores_cache') || '[]');
    const cnpjsCache = new Set(cacheAtual.map(f => (f.cnpj||'').replace(/\D/g,'')));
    novos.forEach(f => {
      if (!cnpjsCache.has((f.cnpj||'').replace(/\D/g,''))) cacheAtual.push(f);
    });
    localStorage.setItem('fa_fornecedores_cache', JSON.stringify(cacheAtual));
    localStorage.setItem('fraser_fornecedores', JSON.stringify(cacheAtual));
    if (typeof FA_FORNECEDORES !== 'undefined') FA_FORNECEDORES = cacheAtual;
  } catch(e) {}

  logAction('Importação em Massa', 'Fornecedores',
    `${salvos} fornecedores importados via API${duplicados ? ', '+duplicados+' duplicados ignorados' : ''}${erros.length ? ', '+erros.length+' com erro' : ''}`);

  // Exibe resultado
  if (resEl) {
    resEl.innerHTML = `
      <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.35);border-radius:10px;padding:16px;text-align:center">
        <i class="fas fa-check-circle" style="font-size:28px;color:#22c55e;display:block;margin-bottom:8px"></i>
        <div style="font-size:15px;font-weight:700;color:#22c55e">${salvos} fornecedor(es) cadastrado(s) com sucesso!</div>
        ${duplicados ? `<div style="font-size:12px;color:#fbbf24;margin-top:4px"><i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>${duplicados} ignorado(s) por CNPJ já cadastrado</div>` : ''}
        ${erros.length ? `<div style="font-size:12px;color:#f87171;margin-top:4px"><i class="fas fa-times-circle" style="margin-right:4px"></i>${erros.length} com erro: ${erros.slice(0,2).join('; ')}${erros.length>2?'...':''}</div>` : ''}
        <div style="font-size:11px;color:#64748b;margin-top:6px">Os fornecedores já estão disponíveis na base de dados.</div>
      </div>`;
  }

  showToast(`✅ ${salvos} fornecedores importados!`, 'success', 5000);
  _fornMassaPreview = [];

  // Recarrega lista e fecha modal
  setTimeout(async () => {
    closeModal();
    if (typeof loadFornecedores === 'function') await loadFornecedores();
    if (typeof _syncFornecedoresIDF === 'function') _syncFornecedoresIDF();
    if (typeof renderFornecedores === 'function') renderFornecedores();
  }, 2200);
}

function baixarModeloFornecedoresCSV() {
  const csv = `razao_social,cnpj,nome_fantasia,categoria,contato_nome,contato_email,contato_telefone,cidade,estado,prazo_pagamento,limite_credito,status
"Razão Social Ltda.","XX.XXX.XXX/0001-XX","Nome Fantasia","Categoria","Contato","email@empresa.com","(XX) XXXX-XXXX","Cidade","UF","30","50000","Ativo"`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff'+csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'modelo_fornecedores_fraser.csv';
  a.click();
  showToast('Modelo baixado!', 'success');
}

// =====================================================
// CADASTRO EM MASSA – MATERIAIS
// =====================================================
function abrirCadastroMassaMateriais() {
  openModalWide('Cadastro em Massa – Materiais', `
    <div style="display:flex;gap:0;border-bottom:1px solid var(--border-color);margin-bottom:16px">
      <button id="tab-massa-mat-csv" onclick="switchTabMassaMat('csv')"
        style="padding:10px 18px;border:none;background:var(--bg-tertiary);color:var(--orange);font-weight:700;border-bottom:2px solid var(--orange);cursor:pointer;font-size:13px">
        <i class="fas fa-file-csv" style="margin-right:6px"></i>Importar CSV/Planilha
      </button>
      <button id="tab-massa-mat-form" onclick="switchTabMassaMat('form')"
        style="padding:10px 18px;border:none;background:transparent;color:var(--text-secondary);font-weight:400;border-bottom:2px solid transparent;cursor:pointer;font-size:13px">
        <i class="fas fa-table" style="margin-right:6px"></i>Preencher Tabela
      </button>
    </div>

    <div id="massa-mat-csv-tab">
      <div style="background:rgba(230,126,34,0.07);border:1px solid rgba(230,126,34,0.25);border-radius:10px;padding:14px;margin-bottom:14px">
        <div style="font-size:12px;font-weight:700;color:var(--orange);margin-bottom:8px">
          <i class="fas fa-info-circle" style="margin-right:6px"></i>Formato do arquivo CSV / Excel (salvo como CSV)
        </div>
        <div style="font-size:11px;color:var(--text-secondary);line-height:1.7">
          <strong>Colunas obrigatórias:</strong> codigo, descricao<br>
          <strong>Colunas opcionais:</strong> categoria, unidade, valor_unitario, estoque_atual, estoque_min, contrato, status, observacoes<br>
          <strong>Separador:</strong> vírgula (,) ou ponto-e-vírgula (;)<br>
          <strong>Status:</strong> Ativo, Alerta, Crítico, Inativo
        </div>
        <div style="margin-top:8px">
          <button onclick="baixarModeloMateriaisCSV()" class="btn btn-secondary btn-sm">
            <i class="fas fa-download"></i> Baixar Modelo CSV
          </button>
        </div>
      </div>

      <div id="drop-mat" style="border:2px dashed var(--border-color);border-radius:12px;padding:32px;text-align:center;cursor:pointer;transition:all 0.2s;margin-bottom:12px"
        onclick="document.getElementById('file-mat-massa').click()"
        ondragover="event.preventDefault();this.style.borderColor='var(--orange)';this.style.background='rgba(230,126,34,0.07)'"
        ondragleave="this.style.borderColor='var(--border-color)';this.style.background='transparent'"
        ondrop="event.preventDefault();this.style.borderColor='var(--border-color)';this.style.background='transparent';handleMatMassaDrop(event)">
        <i class="fas fa-cloud-upload-alt" style="font-size:32px;color:var(--orange);display:block;margin-bottom:8px"></i>
        <div style="font-size:13px;font-weight:600;color:var(--text-primary)">Arraste o arquivo CSV aqui</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">ou clique para selecionar</div>
        <input type="file" id="file-mat-massa" accept=".csv,.txt" style="display:none" onchange="processarMatMassaCSV(this)">
      </div>

      <div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px">Ou cole os dados diretamente (CSV):</div>
        <textarea id="mat-massa-texto" rows="6" placeholder="codigo,descricao,categoria,unidade,valor_unitario,estoque_atual,estoque_min&#10;ROL-6208,Rolamento Esférico 6208-ZZ,Rolamentos,Un,42,0,4&#10;GRA-20KG,Graxa Lubrificante NLGI 2 Balde 20kg,Lubrificantes,Balde,185,8,5"
          style="width:100%;padding:10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:12px;font-family:monospace;box-sizing:border-box;resize:vertical"></textarea>
        <button onclick="processarMatMassaTexto()" class="btn btn-secondary btn-sm" style="margin-top:6px">
          <i class="fas fa-play"></i> Processar Texto
        </button>
      </div>
    </div>

    <div id="massa-mat-form-tab" style="display:none">
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">
        Preencha os dados de cada material. Clique em <strong>+ Linha</strong> para adicionar mais.
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:var(--bg-tertiary)">
              <th style="padding:8px;text-align:left;min-width:100px">Código *</th>
              <th style="padding:8px;text-align:left;min-width:200px">Descrição *</th>
              <th style="padding:8px;text-align:left;min-width:120px">Categoria</th>
              <th style="padding:8px;text-align:left;min-width:70px">Unidade</th>
              <th style="padding:8px;text-align:left;min-width:90px">Val. Unit. (R$)</th>
              <th style="padding:8px;text-align:left;min-width:70px">Est. Atual</th>
              <th style="padding:8px;text-align:left;min-width:70px">Est. Mín.</th>
              <th style="padding:8px;min-width:36px"></th>
            </tr>
          </thead>
          <tbody id="tbody-mat-massa">
            ${[0,1,2,3,4].map(i => _htmlLinhaMatMassa(i)).join('')}
          </tbody>
        </table>
      </div>
      <button onclick="adicionarLinhaMatMassa()" class="btn btn-secondary btn-sm" style="margin-top:8px">
        <i class="fas fa-plus"></i> + Linha
      </button>
    </div>

    <div id="preview-mat-massa" style="display:none;margin-top:14px">
      <div style="font-size:12px;font-weight:700;color:var(--orange);margin-bottom:8px">
        <i class="fas fa-eye" style="margin-right:6px"></i>Preview – Materiais a importar
      </div>
      <div id="preview-mat-massa-content" style="max-height:200px;overflow-y:auto;border:1px solid var(--border-color);border-radius:8px"></div>
      <div id="preview-mat-massa-erros" style="margin-top:8px"></div>
    </div>

    <div id="massa-mat-resultado" style="display:none;margin-top:12px"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="confirmarImportacaoMateriais()" style="background:var(--orange);border-color:var(--orange)">
      <i class="fas fa-upload"></i> Importar Materiais
    </button>
  `);
}

function switchTabMassaMat(tab) {
  const csv = document.getElementById('massa-mat-csv-tab');
  const form = document.getElementById('massa-mat-form-tab');
  const btnCsv = document.getElementById('tab-massa-mat-csv');
  const btnForm = document.getElementById('tab-massa-mat-form');
  if (tab === 'csv') {
    csv.style.display = ''; form.style.display = 'none';
    btnCsv.style.background = 'var(--bg-tertiary)'; btnCsv.style.color = 'var(--orange)';
    btnCsv.style.fontWeight = '700'; btnCsv.style.borderBottom = '2px solid var(--orange)';
    btnForm.style.background = 'transparent'; btnForm.style.color = 'var(--text-secondary)';
    btnForm.style.fontWeight = '400'; btnForm.style.borderBottom = '2px solid transparent';
  } else {
    csv.style.display = 'none'; form.style.display = '';
    btnForm.style.background = 'var(--bg-tertiary)'; btnForm.style.color = 'var(--orange)';
    btnForm.style.fontWeight = '700'; btnForm.style.borderBottom = '2px solid var(--orange)';
    btnCsv.style.background = 'transparent'; btnCsv.style.color = 'var(--text-secondary)';
    btnCsv.style.fontWeight = '400'; btnCsv.style.borderBottom = '2px solid transparent';
  }
}

function _htmlLinhaMatMassa(idx) {
  const cats = ['Lubrificantes','Abrasivos','Rolamentos','EPI','Fixação','Material Elétrico','Ferramentas','Químicos','Combustível','Peças e Componentes','Outros'];
  return `
    <tr class="linha-mat-massa">
      <td style="padding:4px"><input class="form-control mat-m-cod" placeholder="ROL-6208" style="font-size:11px;text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></td>
      <td style="padding:4px"><input class="form-control mat-m-desc" placeholder="Descrição completa do material" style="font-size:11px"></td>
      <td style="padding:4px">
        <select class="form-control mat-m-cat" style="font-size:11px">
          <option value="">Selecione</option>
          ${cats.map(c=>`<option>${c}</option>`).join('')}
        </select>
      </td>
      <td style="padding:4px">
        <select class="form-control mat-m-un" style="font-size:11px">
          ${['Un','Kg','L','M','M²','M³','Balde','Caixa','Pct','Par','Rolo','Saco','Tambor','Jogo'].map(u=>`<option>${u}</option>`).join('')}
        </select>
      </td>
      <td style="padding:4px"><input class="form-control mat-m-val" type="number" min="0" step="0.01" placeholder="0,00" style="font-size:11px"></td>
      <td style="padding:4px"><input class="form-control mat-m-est" type="number" min="0" value="0" style="font-size:11px"></td>
      <td style="padding:4px"><input class="form-control mat-m-min" type="number" min="0" value="0" style="font-size:11px"></td>
      <td style="padding:4px;text-align:center">
        <button onclick="this.closest('tr').remove()" class="btn btn-danger btn-sm btn-icon" title="Remover"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `;
}

function adicionarLinhaMatMassa() {
  const tbody = document.getElementById('tbody-mat-massa');
  if (!tbody) return;
  const idx = tbody.querySelectorAll('tr').length;
  const tr = document.createElement('tr');
  tr.innerHTML = _htmlLinhaMatMassa(idx);
  tr.className = 'linha-mat-massa';
  tbody.appendChild(tr);
}

function handleMatMassaDrop(event) {
  const file = event.dataTransfer.files[0];
  if (file) processarMatMassaArquivo(file);
}

function processarMatMassaCSV(input) {
  const file = input.files[0];
  if (file) processarMatMassaArquivo(file);
}

function processarMatMassaArquivo(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('mat-massa-texto').value = e.target.result;
    processarMatMassaTexto();
  };
  reader.readAsText(file, 'UTF-8');
}

let _matMassaPreview = [];

function processarMatMassaTexto() {
  const texto = document.getElementById('mat-massa-texto')?.value.trim();
  if (!texto) { showToast('Cole ou carregue os dados primeiro.', 'warning'); return; }

  const linhas = texto.split('\n').map(l => l.trim()).filter(l => l);
  if (linhas.length < 2) { showToast('O arquivo precisa ter pelo menos cabeçalho + 1 linha.', 'warning'); return; }

  const sep = linhas[0].includes(';') ? ';' : ',';
  const headers = _parseCsvLine(linhas[0].toLowerCase().replace(/;/g,',')).map(h => h.replace(/"/g,'').trim());

  const dados = [];
  const erros = [];

  for (let i = 1; i < linhas.length; i++) {
    const cols = _parseCsvLine(linhas[i].replace(/;/g,','));
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (cols[idx] || '').replace(/"/g,'').trim(); });

    const codigo = obj['codigo'] || obj['código'] || obj['cod'] || '';
    const desc   = obj['descricao'] || obj['descrição'] || obj['nome'] || '';

    if (!codigo) { erros.push(`Linha ${i+1}: Código obrigatório`); continue; }
    if (!desc)   { erros.push(`Linha ${i+1}: Descrição obrigatória`); continue; }

    const estAtual = parseInt(obj['estoque_atual'] || obj['estoque'] || '0') || 0;
    const estMin   = parseInt(obj['estoque_min'] || obj['estoque_minimo'] || '0') || 0;
    const valUnit  = parseFloat(obj['valor_unitario'] || obj['valor'] || obj['preco'] || '0') || 0;

    let status = obj['status'] || '';
    if (!status) {
      status = estAtual === 0 ? 'Crítico' : estAtual < estMin ? 'Alerta' : 'Ativo';
    }

    dados.push({
      id: _gerarIdMassa('MAT'),
      codigo: codigo.toUpperCase(),
      descricao: desc,
      categoria: obj['categoria'] || 'Outros',
      unidade: obj['unidade'] || obj['un'] || 'Un',
      valor_unitario: valUnit,
      estoque_atual: estAtual,
      estoque_min: estMin,
      contrato: obj['contrato'] || 'Geral',
      status,
      observacoes: obj['observacoes'] || obj['observação'] || ''
    });
  }

  _matMassaPreview = dados;
  _renderPreviewMateriais(dados, erros);
}

function _renderPreviewMateriais(dados, erros) {
  const prev = document.getElementById('preview-mat-massa');
  const cont = document.getElementById('preview-mat-massa-content');
  const erroEl = document.getElementById('preview-mat-massa-erros');
  if (!prev || !cont) return;

  prev.style.display = '';

  cont.innerHTML = dados.length ? `
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr style="background:var(--bg-tertiary)">
        <th style="padding:6px 8px;text-align:left">Código</th>
        <th style="padding:6px 8px;text-align:left">Descrição</th>
        <th style="padding:6px 8px;text-align:left">Categoria</th>
        <th style="padding:6px 8px;text-align:center">Un</th>
        <th style="padding:6px 8px;text-align:right">Val. Unit.</th>
        <th style="padding:6px 8px;text-align:center">Est. Atual</th>
        <th style="padding:6px 8px;text-align:center">Status</th>
      </tr></thead>
      <tbody>
        ${dados.map(d => `
          <tr style="border-bottom:1px solid var(--border-color)">
            <td style="padding:5px 8px;font-weight:700;color:var(--orange)">${d.codigo}</td>
            <td style="padding:5px 8px;color:var(--text-primary)">${d.descricao}</td>
            <td style="padding:5px 8px;font-size:10px;color:var(--text-muted)">${d.categoria}</td>
            <td style="padding:5px 8px;text-align:center;font-size:10px">${d.unidade}</td>
            <td style="padding:5px 8px;text-align:right;font-size:10px">${d.valor_unitario > 0 ? 'R$ '+d.valor_unitario.toFixed(2) : '—'}</td>
            <td style="padding:5px 8px;text-align:center;font-weight:700;color:${d.status==='Crítico'?'var(--red-light)':d.status==='Alerta'?'var(--yellow-light)':'var(--green-light)'}">${d.estoque_atual}</td>
            <td style="padding:5px 8px;text-align:center">
              <span style="background:${d.status==='Crítico'?'rgba(239,68,68,0.15)':d.status==='Alerta'?'rgba(245,158,11,0.15)':'rgba(34,197,94,0.15)'};color:${d.status==='Crítico'?'var(--red-light)':d.status==='Alerta'?'var(--yellow-light)':'var(--green-light)'};padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${d.status}</span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="padding:8px 12px;background:rgba(34,197,94,0.08);font-size:12px;font-weight:600;color:var(--green-light);border-top:1px solid var(--border-color)">
      ✓ ${dados.length} material(is) pronto(s) para importar
    </div>
  ` : '<div style="padding:20px;text-align:center;color:var(--text-muted)">Nenhum dado válido.</div>';

  erroEl.innerHTML = erros.length ? `
    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:8px;padding:10px">
      <div style="font-size:11px;font-weight:700;color:var(--red-light);margin-bottom:6px"><i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>${erros.length} erro(s):</div>
      ${erros.map(e => `<div style="font-size:11px;color:var(--text-secondary);padding:2px 0">• ${e}</div>`).join('')}
    </div>
  ` : '';
}

function confirmarImportacaoMateriais() {
  const csvTab = document.getElementById('massa-mat-csv-tab');
  const isCSV = csvTab && csvTab.style.display !== 'none';

  if (isCSV) {
    if (!_matMassaPreview.length) { showToast('Processe os dados antes de importar.', 'warning'); return; }
    _salvarMateriaisMassa(_matMassaPreview);
  } else {
    const linhas = document.querySelectorAll('#tbody-mat-massa tr.linha-mat-massa');
    const dados = [];
    linhas.forEach(tr => {
      const cod  = tr.querySelector('.mat-m-cod')?.value.trim();
      const desc = tr.querySelector('.mat-m-desc')?.value.trim();
      if (!cod || !desc) return;
      const estAtual = parseInt(tr.querySelector('.mat-m-est')?.value) || 0;
      const estMin   = parseInt(tr.querySelector('.mat-m-min')?.value) || 0;
      dados.push({
        id: _gerarIdMassa('MAT'),
        codigo: cod.toUpperCase(),
        descricao: desc,
        categoria: tr.querySelector('.mat-m-cat')?.value || 'Outros',
        unidade: tr.querySelector('.mat-m-un')?.value || 'Un',
        valor_unitario: parseFloat(tr.querySelector('.mat-m-val')?.value) || 0,
        estoque_atual: estAtual,
        estoque_min: estMin,
        contrato: 'Geral',
        status: estAtual === 0 ? 'Crítico' : estAtual < estMin ? 'Alerta' : 'Ativo',
        observacoes: 'Cadastrado em massa'
      });
    });
    if (!dados.length) { showToast('Preencha pelo menos um material (Código e Descrição obrigatórios).', 'warning'); return; }
    _salvarMateriaisMassa(dados);
  }
}

function _salvarMateriaisMassa(lista) {
  const existentes = typeof _getMateriais === 'function' ? _getMateriais() : [];
  const codsExistentes = new Set(existentes.map(m => m.codigo?.toUpperCase()));
  const novos = lista.filter(m => !codsExistentes.has((m.codigo||'').toUpperCase()));
  const duplicados = lista.length - novos.length;

  const todos = [...novos, ...existentes];
  if (typeof _saveMateriais === 'function') _saveMateriais(todos);
  else localStorage.setItem('fa_materiais', JSON.stringify(todos));

  logAction('Importação em Massa', 'Materiais', `${novos.length} materiais importados${duplicados ? ', '+duplicados+' duplicados ignorados' : ''}`);

  const res = document.getElementById('massa-mat-resultado');
  if (res) {
    res.style.display = '';
    res.innerHTML = `
      <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.35);border-radius:10px;padding:14px;text-align:center">
        <i class="fas fa-check-circle" style="font-size:28px;color:var(--green-light);display:block;margin-bottom:8px"></i>
        <div style="font-size:15px;font-weight:700;color:var(--green-light)">${novos.length} material(is) importado(s) com sucesso!</div>
        ${duplicados ? `<div style="font-size:12px;color:var(--yellow-light);margin-top:4px">${duplicados} ignorados por código duplicado</div>` : ''}
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px">Total na base: ${todos.length} materiais</div>
      </div>
    `;
  }

  showToast(`✅ ${novos.length} materiais importados!`, 'success', 5000);
  _matMassaPreview = [];

  setTimeout(() => {
    closeModal();
    if (typeof renderMateriais === 'function') renderMateriais();
  }, 2000);
}

function baixarModeloMateriaisCSV() {
  const csv = `codigo,descricao,categoria,unidade,valor_unitario,estoque_atual,estoque_min,contrato,observacoes
"COD-001","Descrição do material 1","Categoria","Un","0","0","0","Geral",""
"COD-002","Descrição do material 2","Categoria","Caixa","0","0","0","Geral",""`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff'+csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'modelo_materiais_fraser.csv';
  a.click();
  showToast('Modelo baixado!', 'success');
}

// =====================================================
// BOTÕES DE ATALHO – injeta nos módulos existentes
// =====================================================
window.abrirCadastroMassaFornecedores = abrirCadastroMassaFornecedores;
window.abrirCadastroMassaMateriais    = abrirCadastroMassaMateriais;
window.baixarModeloFornecedoresCSV    = baixarModeloFornecedoresCSV;
window.baixarModeloMateriaisCSV       = baixarModeloMateriaisCSV;
