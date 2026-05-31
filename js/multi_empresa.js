// =====================================================
// ERP – Multi-Empresa (Multi-CNPJ / Grupo Empresarial)
// =====================================================

// ── Storage keys ────────────────────────────────────
const ME_STORAGE_KEY      = 'erp_empresas';
const ME_ACTIVE_KEY       = 'erp_empresa_ativa';

// ── Empresa ativa (estado global) ──────────────────
let _empresaAtiva = null;

// ── Empresa padrão (genérica) ───────────────────────
const _EMPRESA_DEFAULT = {
  id:          'EMP-001',
  razao_social: 'Minha Empresa Ltda',
  nome_fantasia: 'Minha Empresa',
  cnpj:         '00.000.000/0001-00',
  endereco:     '',
  telefone:     '',
  email:        '',
  logo_url:     '',             // vazio = mostra ícone genérico
  cor_primaria: '#e67e22',      // laranja padrão
  ativa:        true,
  criado_em:    new Date().toISOString(),
};

// ── CRUD Empresas ────────────────────────────────────
function getEmpresas() {
  const raw = localStorage.getItem(ME_STORAGE_KEY);
  if (!raw) {
    const defaults = [_EMPRESA_DEFAULT];
    localStorage.setItem(ME_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }
  return JSON.parse(raw);
}

function saveEmpresas(lista) {
  localStorage.setItem(ME_STORAGE_KEY, JSON.stringify(lista));
}

function getEmpresaAtiva() {
  if (_empresaAtiva) return _empresaAtiva;
  const id  = localStorage.getItem(ME_ACTIVE_KEY);
  const lista = getEmpresas();
  _empresaAtiva = (id && lista.find(e => e.id === id)) || lista[0] || _EMPRESA_DEFAULT;
  return _empresaAtiva;
}

function setEmpresaAtiva(id) {
  const lista = getEmpresas();
  const emp = lista.find(e => e.id === id);
  if (!emp) return;
  _empresaAtiva = emp;
  localStorage.setItem(ME_ACTIVE_KEY, id);
  _aplicarEmpresaAtiva();
  showToast(`Empresa: ${emp.nome_fantasia || emp.razao_social}`, 'success');
  // Re-renderiza página atual
  if (typeof navigate === 'function' && typeof currentPage !== 'undefined') {
    navigate(currentPage);
  }
}

function adicionarEmpresa(dados) {
  const lista = getEmpresas();
  const id = 'EMP-' + String(lista.length + 1).padStart(3, '0');
  const nova = { ...dados, id, ativa: true, criado_em: new Date().toISOString() };
  lista.push(nova);
  saveEmpresas(lista);
  return nova;
}

function editarEmpresa(id, dados) {
  const lista = getEmpresas();
  const idx = lista.findIndex(e => e.id === id);
  if (idx === -1) return;
  lista[idx] = { ...lista[idx], ...dados };
  saveEmpresas(lista);
  if (_empresaAtiva?.id === id) {
    _empresaAtiva = lista[idx];
    _aplicarEmpresaAtiva();
  }
}

function excluirEmpresa(id) {
  const lista = getEmpresas();
  if (lista.length <= 1) { showToast('Não é possível excluir a única empresa', 'error'); return; }
  const nova = lista.filter(e => e.id !== id);
  saveEmpresas(nova);
  if (_empresaAtiva?.id === id) {
    _empresaAtiva = nova[0];
    localStorage.setItem(ME_ACTIVE_KEY, nova[0].id);
    _aplicarEmpresaAtiva();
  }
}

// ── Aplica identidade visual da empresa ativa ─────
function _aplicarEmpresaAtiva() {
  const emp = getEmpresaAtiva();

  // Cor primária dinâmica
  const cor = emp.cor_primaria || '#e67e22';
  document.documentElement.style.setProperty('--orange', cor);
  document.documentElement.style.setProperty('--fa-teal', cor);

  // Logo sidebar
  const logoFull = document.getElementById('sidebarLogoFull');
  const logoMini = document.getElementById('sidebarLogoMini');
  const logoLogin = document.getElementById('loginLogoImg');

  if (emp.logo_url) {
    if (logoFull)  {
      logoFull.innerHTML  = `
        <img src="${emp.logo_url}" alt="${emp.nome_fantasia}" style="height:38px;max-width:140px;object-fit:contain">
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px">${emp.nome_fantasia||emp.razao_social}</div>
          <div id="sidebarEmpresaNome" style="font-size:10px;color:var(--text-muted);">${emp.cnpj||''}</div>
        </div>`;
    }
    if (logoMini)  { logoMini.innerHTML  = `<img src="${emp.logo_url}" alt="${emp.nome_fantasia}" style="height:32px;width:32px;object-fit:contain;border-radius:6px">`; }
    if (logoLogin) { logoLogin.innerHTML = `<img src="${emp.logo_url}" alt="${emp.nome_fantasia}" style="height:72px;max-width:200px;object-fit:contain;border-radius:8px">`; }
  } else {
    // Logo genérico com iniciais
    const iniciais = _getIniciais(emp.nome_fantasia || emp.razao_social);
    const logoGenerico = `
      <div style="width:42px;height:42px;border-radius:10px;background:${cor};display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:#fff;flex-shrink:0">${iniciais}</div>
      <div style="min-width:0;overflow:hidden">
        <div style="font-size:13px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px">${emp.nome_fantasia||emp.razao_social}</div>
        <div id="sidebarEmpresaNome" style="font-size:10px;color:var(--text-muted);white-space:nowrap;">${emp.cnpj||'ERP'}</div>
      </div>`;
    const logoGenericoMini = `
      <div style="width:36px;height:36px;border-radius:8px;background:${cor};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff">
        ${iniciais}
      </div>`;
    const logoGenericoLogin = `
      <div style="width:80px;height:80px;border-radius:16px;background:${cor};display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;margin:0 auto 12px">
        ${iniciais}
      </div>`;
    if (logoFull)  logoFull.innerHTML  = logoGenerico;
    if (logoMini)  logoMini.innerHTML  = logoGenericoMini;
    if (logoLogin) logoLogin.innerHTML = logoGenericoLogin;
  }

  // Nome da empresa no sidebar (modo expandido)
  const nomeEl = document.getElementById('sidebarEmpresaNome');
  if (nomeEl) nomeEl.textContent = emp.nome_fantasia || emp.razao_social;

  // Seletor de empresa no topbar
  const selectorEl = document.getElementById('topbarEmpresaName');
  if (selectorEl) selectorEl.textContent = emp.nome_fantasia || emp.razao_social;

  // Title da página
  const nomeEmp = emp.nome_fantasia || emp.razao_social;
  if (typeof t === 'function') {
    document.title = `${nomeEmp} – ${t('system_name')}`;
  } else {
    document.title = `${nomeEmp} – Sistema de Gestão`;
  }
}

function _getIniciais(nome) {
  if (!nome) return 'ERP';
  const palavras = nome.trim().split(/\s+/).filter(p => p.length > 2);
  if (palavras.length >= 2) return (palavras[0][0] + palavras[1][0]).toUpperCase();
  return nome.slice(0, 2).toUpperCase();
}

// ── Modal: Gerenciar Empresas ─────────────────────
function abrirGerenciarEmpresas() {
  const lista = getEmpresas();
  const ativa = getEmpresaAtiva();

  const rows = lista.map(emp => `
    <div style="background:${emp.id === ativa.id ? 'rgba(var(--orange-rgb,230,126,34),0.08)' : 'var(--bg-card2)'};
                border:1px solid ${emp.id === ativa.id ? 'var(--orange)' : 'var(--border)'};
                border-radius:10px;padding:14px 16px;margin-bottom:10px;
                display:flex;align-items:center;gap:14px">
      <div style="width:42px;height:42px;border-radius:9px;background:${emp.cor_primaria||'var(--orange)'};
                  display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:#fff;flex-shrink:0">
        ${emp.logo_url ? `<img src="${emp.logo_url}" style="width:38px;height:38px;object-fit:contain;border-radius:7px">` : _getIniciais(emp.nome_fantasia||emp.razao_social)}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;color:var(--text-primary);font-size:14px">${emp.nome_fantasia || emp.razao_social}
          ${emp.id === ativa.id ? '<span style="background:var(--orange);color:#fff;font-size:9px;padding:1px 8px;border-radius:10px;margin-left:6px;vertical-align:middle">ATIVA</span>' : ''}
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${emp.cnpj || '—'} · ${emp.razao_social}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        ${emp.id !== ativa.id ? `
          <button onclick="setEmpresaAtiva('${emp.id}');closeModal()" 
            style="background:var(--orange);color:#fff;border:none;padding:5px 12px;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer">
            <i class="fas fa-check"></i> Ativar
          </button>` : ''}
        <button onclick="_editarEmpresaModal('${emp.id}')"
          style="background:var(--bg-hover);color:var(--text-primary);border:1px solid var(--border);padding:5px 10px;border-radius:7px;font-size:11px;cursor:pointer">
          <i class="fas fa-pen"></i>
        </button>
        ${lista.length > 1 ? `
          <button onclick="_confirmarExcluirEmpresa('${emp.id}')"
            style="background:rgba(220,38,38,0.1);color:var(--red);border:1px solid rgba(220,38,38,0.3);padding:5px 10px;border-radius:7px;font-size:11px;cursor:pointer">
            <i class="fas fa-trash"></i>
          </button>` : ''}
      </div>
    </div>`).join('');

  openModalWide(
    `<i class="fas fa-building" style="color:var(--orange);margin-right:8px"></i>${typeof t==='function'?t('me_title'):'Empresas do Grupo'}`,
    `<div style="margin-bottom:16px">
      <button onclick="_novaEmpresaModal()" style="background:var(--orange);color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
        <i class="fas fa-plus"></i> ${typeof t==='function'?t('me_add'):'Adicionar Empresa'}
      </button>
    </div>
    <div>${rows}</div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">${typeof t==='function'?t('close'):'Fechar'}</button>`
  );
}

function _novaEmpresaModal() {
  _formEmpresaModal(null);
}

function _editarEmpresaModal(id) {
  const emp = getEmpresas().find(e => e.id === id);
  _formEmpresaModal(emp);
}

function _formEmpresaModal(emp) {
  const isEdit = !!emp;
  const titulo = isEdit ? 'Editar Empresa' : 'Nova Empresa';

  openModal(titulo, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group" style="grid-column:1/-1">
        <label>${typeof t==='function'?t('me_trade_name'):'Razão Social'} *</label>
        <input type="text" class="form-control" id="empRazao" value="${emp?.razao_social||''}" placeholder="Empresa XYZ Ltda">
      </div>
      <div class="form-group">
        <label>${typeof t==='function'?t('me_fantasy'):'Nome Fantasia'}</label>
        <input type="text" class="form-control" id="empFantasia" value="${emp?.nome_fantasia||''}" placeholder="Marca Empresa">
      </div>
      <div class="form-group">
        <label>${typeof t==='function'?t('me_cnpj'):'CNPJ'}</label>
        <input type="text" class="form-control" id="empCNPJ" value="${emp?.cnpj||''}" placeholder="00.000.000/0001-00">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>${typeof t==='function'?t('me_address'):'Endereço'}</label>
        <input type="text" class="form-control" id="empEndereco" value="${emp?.endereco||''}" placeholder="Rua, Número, Cidade – UF">
      </div>
      <div class="form-group">
        <label>${typeof t==='function'?t('me_phone'):'Telefone'}</label>
        <input type="text" class="form-control" id="empTel" value="${emp?.telefone||''}" placeholder="(11) 99999-9999">
      </div>
      <div class="form-group">
        <label>${typeof t==='function'?t('me_email'):'E-mail'}</label>
        <input type="email" class="form-control" id="empEmail" value="${emp?.email||''}" placeholder="contato@empresa.com">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>${typeof t==='function'?t('me_logo'):'Logo (URL da imagem)'}</label>
        <input type="text" class="form-control" id="empLogo" value="${emp?.logo_url||''}" placeholder="https://empresa.com/logo.png"
          oninput="_previewLogoEmpresa(this.value)">
        <div id="previewLogoEmp" style="margin-top:8px;display:${emp?.logo_url?'block':'none'}">
          ${emp?.logo_url ? `<img src="${emp.logo_url}" style="height:48px;border-radius:6px;border:1px solid var(--border)">` : ''}
        </div>
      </div>
      <div class="form-group">
        <label>${typeof t==='function'?t('me_color'):'Cor Primária'}</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="color" id="empCor" value="${emp?.cor_primaria||'#e67e22'}"
            style="width:44px;height:36px;border:1px solid var(--border);border-radius:6px;background:none;cursor:pointer;padding:2px">
          <input type="text" class="form-control" id="empCorHex" value="${emp?.cor_primaria||'#e67e22'}"
            style="width:110px" placeholder="#e67e22"
            oninput="document.getElementById('empCor').value=this.value">
        </div>
      </div>
      <div style="grid-column:1/-1;background:rgba(0,180,184,0.06);border:1px solid rgba(0,180,184,0.15);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--text-secondary)">
        <i class="fas fa-info-circle" style="color:var(--teal);margin-right:6px"></i>
        Cada empresa tem CNPJ próprio. Os dados de estoque, fornecedores e financeiro são compartilhados dentro do grupo, mas os documentos fiscais são separados por empresa.
      </div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="_salvarEmpresa(${isEdit ? `'${emp.id}'` : 'null'})">
       <i class="fas fa-save"></i> Salvar
     </button>`
  );

  // Sync color inputs
  setTimeout(() => {
    const cor = document.getElementById('empCor');
    const hex = document.getElementById('empCorHex');
    if (cor && hex) {
      cor.addEventListener('input', () => { hex.value = cor.value; });
    }
  }, 100);
}

function _previewLogoEmpresa(url) {
  const el = document.getElementById('previewLogoEmp');
  if (!el) return;
  if (url) {
    el.style.display = 'block';
    el.innerHTML = `<img src="${url}" style="height:48px;border-radius:6px;border:1px solid var(--border)" onerror="this.style.display='none'">`;
  } else {
    el.style.display = 'none';
    el.innerHTML = '';
  }
}

function _salvarEmpresa(id) {
  const razao = document.getElementById('empRazao')?.value?.trim();
  if (!razao) { showToast('Razão Social é obrigatória', 'error'); return; }

  const dados = {
    razao_social:  razao,
    nome_fantasia: document.getElementById('empFantasia')?.value?.trim() || razao,
    cnpj:          document.getElementById('empCNPJ')?.value?.trim() || '',
    endereco:      document.getElementById('empEndereco')?.value?.trim() || '',
    telefone:      document.getElementById('empTel')?.value?.trim() || '',
    email:         document.getElementById('empEmail')?.value?.trim() || '',
    logo_url:      document.getElementById('empLogo')?.value?.trim() || '',
    cor_primaria:  document.getElementById('empCorHex')?.value?.trim() || document.getElementById('empCor')?.value || '#e67e22',
  };

  if (id) {
    editarEmpresa(id, dados);
    showToast('Empresa atualizada', 'success');
  } else {
    adicionarEmpresa(dados);
    showToast('Empresa adicionada', 'success');
  }

  closeModal();
  setTimeout(abrirGerenciarEmpresas, 200);
}

function _confirmarExcluirEmpresa(id) {
  const emp = getEmpresas().find(e => e.id === id);
  if (!emp) return;
  if (confirm(`Excluir empresa "${emp.nome_fantasia || emp.razao_social}"? Esta ação não pode ser desfeita.`)) {
    excluirEmpresa(id);
    closeModal();
    showToast('Empresa excluída', 'success');
  }
}

// ── Inicializa empresa ao carregar ────────────────
function initEmpresa() {
  const lista = getEmpresas();
  if (!lista.length) saveEmpresas([_EMPRESA_DEFAULT]);
  _aplicarEmpresaAtiva();
}
