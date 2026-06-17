// =====================================================
// ERP – Módulo Multi-Empresa (Multi-CNPJ)
// =====================================================

const EMPRESAS_KEY      = 'erp_empresas';
const EMPRESA_ATIVA_KEY = 'erp_empresa_ativa';

const EMPRESA_DEFAULT = {
  id: 'EMP-001',
  nome: 'Minha Empresa S.A.',
  fantasia: 'Minha Empresa',
  cnpj: '00.000.000/0001-00',
  ie: '', endereco: '', cidade: '', estado: '',
  telefone: '', email: '', site: '',
  logo: '', cor_primaria: '#e67e22',
  ativa: true, criada_em: new Date().toISOString()
};

function getEmpresas() {
  try {
    const raw = localStorage.getItem(EMPRESAS_KEY);
    if (!raw) return [{ ...EMPRESA_DEFAULT }];
    const list = JSON.parse(raw);
    return list.length ? list : [{ ...EMPRESA_DEFAULT }];
  } catch { return [{ ...EMPRESA_DEFAULT }]; }
}

function saveEmpresas(list) { localStorage.setItem(EMPRESAS_KEY, JSON.stringify(list)); }

function getEmpresaAtiva() {
  const id  = localStorage.getItem(EMPRESA_ATIVA_KEY);
  const all = getEmpresas();
  return all.find(e => e.id === id) || all[0];
}

function setEmpresaAtiva(id) {
  localStorage.setItem(EMPRESA_ATIVA_KEY, id);
  _renderEmpresaAtivaBadge();
  _renderEmpresaSidebarLogo();
  if (typeof showToast === 'function') showToast(typeof t==='function'?t('emp_switched'):'Empresa alterada!', 'success');
  if (typeof navigate === 'function' && typeof currentPage !== 'undefined') navigate(currentPage);
}

function addEmpresa(dados) {
  const list = getEmpresas();
  const nova = { ...EMPRESA_DEFAULT, ...dados, id:'EMP-'+Date.now().toString(36).toUpperCase(), criada_em:new Date().toISOString() };
  list.push(nova);
  saveEmpresas(list);
  return nova;
}

function updateEmpresa(id, dados) {
  const list = getEmpresas();
  const idx  = list.findIndex(e => e.id === id);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], ...dados };
  saveEmpresas(list);
  _renderEmpresaAtivaBadge();
  _renderEmpresaSidebarLogo();
  return true;
}

function deleteEmpresa(id) {
  const list = getEmpresas().filter(e => e.id !== id);
  if (!list.length) return false;
  saveEmpresas(list);
  if (localStorage.getItem(EMPRESA_ATIVA_KEY) === id) {
    localStorage.setItem(EMPRESA_ATIVA_KEY, list[0].id);
    _renderEmpresaAtivaBadge();
    _renderEmpresaSidebarLogo();
  }
  return true;
}

// ── Badge na topbar ──────────────────────────────
function _renderEmpresaAtivaBadge() {
  const emp = getEmpresaAtiva();
  const el  = document.getElementById('empresaBadge');
  if (!el) return;
  const inicial = (emp.fantasia || emp.nome || 'E').charAt(0).toUpperCase();
  const corBg   = emp.cor_primaria || 'var(--orange)';
  el.innerHTML = `
    ${emp.logo
      ? `<img src="${emp.logo}" style="height:20px;width:20px;border-radius:4px;object-fit:contain;flex-shrink:0">`
      : `<span style="width:20px;height:20px;border-radius:5px;background:${corBg};display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;flex-shrink:0">${inicial}</span>`}
    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600;max-width:120px">${emp.fantasia || emp.nome}</span>
    <i class="fas fa-chevron-down" style="font-size:9px;opacity:.6;flex-shrink:0"></i>
  `;
  el.title = `${emp.nome} · CNPJ: ${emp.cnpj}`;
}

// ── Logo na sidebar ──────────────────────────────
function _renderEmpresaSidebarLogo() {
  const emp = getEmpresaAtiva();
  const cor = emp.cor_primaria || 'var(--orange)';
  const ini = (emp.fantasia || emp.nome || 'E').charAt(0).toUpperCase();

  const full = document.getElementById('sidebarLogoFull');
  if (full) {
    full.innerHTML = emp.logo
      ? `<img src="${emp.logo}" alt="${emp.fantasia||emp.nome}" style="height:38px;max-width:160px;object-fit:contain;border-radius:6px">`
      : `<div style="display:flex;align-items:center;gap:10px;min-width:0">
           <div style="width:36px;height:36px;border-radius:8px;background:${cor};display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;color:#fff;flex-shrink:0">${ini}</div>
           <div style="min-width:0">
             <div style="font-size:13px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:155px">${emp.fantasia || emp.nome}</div>
             <div style="font-size:10px;color:var(--text-muted)">ERP · Gestão Integrada</div>
           </div>
         </div>`;
  }

  const mini = document.getElementById('sidebarLogoMini');
  if (mini) {
    mini.innerHTML = emp.logo
      ? `<img src="${emp.logo}" style="height:32px;width:32px;object-fit:contain;border-radius:6px">`
      : `<div style="width:32px;height:32px;border-radius:8px;background:${cor};display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:#fff">${ini}</div>`;
  }
}

// ── Dropdown de seleção ──────────────────────────
function toggleEmpresaDropdown() {
  const existing = document.getElementById('empresaDropdown');
  if (existing) { existing.remove(); return; }

  const btn   = document.getElementById('empresaBadge');
  if (!btn) return;
  const rect  = btn.getBoundingClientRect();
  const emps  = getEmpresas();
  const ativa = getEmpresaAtiva();

  const dd = document.createElement('div');
  dd.id = 'empresaDropdown';
  dd.style.cssText = `
    position:fixed;top:${rect.bottom+6}px;right:${window.innerWidth-rect.right}px;
    width:290px;background:var(--bg-card);border:1px solid var(--border);
    border-radius:12px;box-shadow:var(--shadow);z-index:9999;overflow:hidden;
    animation:fadeIn .15s ease;
  `;
  dd.innerHTML = `
    <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;font-weight:700;color:var(--text-primary)"><i class="fas fa-building" style="margin-right:6px;color:var(--orange)"></i>${typeof t==='function'?t('emp_title'):'Empresas do Grupo'}</span>
      <button onclick="document.getElementById('empresaDropdown')?.remove();abrirGerenciarEmpresas()"
        style="background:none;border:none;color:var(--fa-teal);font-size:11px;cursor:pointer;font-weight:600">
        <i class="fas fa-cog"></i> Gerenciar
      </button>
    </div>
    <div style="max-height:260px;overflow-y:auto;padding:6px">
      ${emps.map(emp => {
        const cor = emp.cor_primaria||'var(--orange)';
        const ini = (emp.fantasia||emp.nome||'E').charAt(0).toUpperCase();
        const isAtiva = emp.id === ativa.id;
        return `
          <div onclick="setEmpresaAtiva('${emp.id}');document.getElementById('empresaDropdown')?.remove()"
            style="display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;cursor:pointer;
                   background:${isAtiva?'rgba(230,126,34,0.10)':'transparent'};
                   border:1px solid ${isAtiva?'rgba(230,126,34,0.25)':'transparent'};
                   transition:background .15s;margin-bottom:2px"
            onmouseover="this.style.background='${isAtiva?'rgba(230,126,34,0.16)':'var(--bg-hover)'}'"
            onmouseout="this.style.background='${isAtiva?'rgba(230,126,34,0.10)':'transparent'}'">
            <div style="width:34px;height:34px;border-radius:8px;background:${cor};display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:#fff;flex-shrink:0">
              ${emp.logo?`<img src="${emp.logo}" style="width:32px;height:32px;border-radius:6px;object-fit:contain">`:ini}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${emp.fantasia||emp.nome}</div>
              <div style="font-size:10px;color:var(--text-muted)">${emp.cnpj}</div>
            </div>
            ${isAtiva?'<i class="fas fa-check-circle" style="color:var(--orange);font-size:13px;flex-shrink:0"></i>':''}
          </div>`;
      }).join('')}
    </div>
    <div style="padding:7px 12px;border-top:1px solid var(--border)">
      <button onclick="document.getElementById('empresaDropdown')?.remove();abrirNovaEmpresa()"
        style="width:100%;background:none;border:1px dashed var(--border);border-radius:8px;padding:7px;
               color:var(--text-muted);font-size:12px;cursor:pointer;transition:all .15s"
        onmouseover="this.style.borderColor='var(--orange)';this.style.color='var(--orange)'"
        onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'">
        <i class="fas fa-plus"></i> ${typeof t==='function'?t('emp_add_tip'):'Adicionar empresa ao grupo'}
      </button>
    </div>`;
  document.body.appendChild(dd);
  setTimeout(() => {
    document.addEventListener('click', function _cls(e) {
      if (!dd.contains(e.target) && e.target.id !== 'empresaBadge' && !btn.contains(e.target)) {
        dd.remove(); document.removeEventListener('click', _cls);
      }
    });
  }, 100);
}

// ── Modal nova empresa ───────────────────────────
function abrirNovaEmpresa()       { _abrirFormEmpresa(null); }
function abrirEditarEmpresa(id)   { _abrirFormEmpresa(getEmpresas().find(e=>e.id===id)); }

function _abrirFormEmpresa(emp) {
  const isEdit = !!emp;
  const v = emp || {};
  const titulo = isEdit ? (typeof t==='function'?t('emp_edit'):'Editar Empresa') : (typeof t==='function'?t('emp_new'):'Nova Empresa');
  const estados = ['','AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
  if (typeof openModalWide!=='function') return;
  openModalWide(titulo,`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group" style="grid-column:1/-1">
        <label>Razão Social *</label>
        <input type="text" class="form-control" id="empNome" value="${v.nome||''}" placeholder="Razão Social completa">
      </div>
      <div class="form-group">
        <label>Nome Fantasia *</label>
        <input type="text" class="form-control" id="empFantasia" value="${v.fantasia||''}" placeholder="Nome comercial">
      </div>
      <div class="form-group">
        <label>CNPJ *</label>
        <input type="text" class="form-control" id="empCnpj" value="${v.cnpj||''}" placeholder="00.000.000/0001-00"
          oninput="this.value=this.value.replace(/\\D/g,'').replace(/^(\\d{2})(\\d)/,'$1.$2').replace(/^(\\d{2})\\.(\\d{3})(\\d)/,'$1.$2.$3').replace(/\\.(\\d{3})(\\d)/,'.$1/$2').replace(/(\\d{4})(\\d)/,'$1-$2').substring(0,18)">
      </div>
      <div class="form-group">
        <label>Inscrição Estadual</label>
        <input type="text" class="form-control" id="empIE" value="${v.ie||''}" placeholder="Opcional">
      </div>
      <div class="form-group">
        <label>Telefone</label>
        <input type="text" class="form-control" id="empTelefone" value="${v.telefone||''}" placeholder="(00) 00000-0000">
      </div>
      <div class="form-group">
        <label>E-mail</label>
        <input type="email" class="form-control" id="empEmail" value="${v.email||''}" placeholder="contato@empresa.com">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Endereço</label>
        <input type="text" class="form-control" id="empEndereco" value="${v.endereco||''}" placeholder="Rua, número, bairro">
      </div>
      <div class="form-group">
        <label>Cidade</label>
        <input type="text" class="form-control" id="empCidade" value="${v.cidade||''}" placeholder="Cidade">
      </div>
      <div class="form-group">
        <label>Estado</label>
        <select class="form-control" id="empEstado">
          ${estados.map(s=>`<option value="${s}" ${v.estado===s?'selected':''}>${s||'Selecione...'}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Cor Primária</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="color" id="empCor" value="${v.cor_primaria||'#e67e22'}" style="width:44px;height:36px;border:none;border-radius:6px;cursor:pointer;padding:2px">
          <span style="font-size:12px;color:var(--text-muted)">Cor do logotipo e tema</span>
        </div>
      </div>
      <div class="form-group">
        <label>URL do Logo <span style="font-size:10px;color:var(--text-muted)">(opcional)</span></label>
        <input type="text" class="form-control" id="empLogo" value="${v.logo||''}" placeholder="https://... ou deixe vazio para usar inicial">
      </div>
    </div>`,`
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="_salvarEmpresa('${isEdit?emp.id:''}')">
      <i class="fas fa-save"></i> Salvar Empresa
    </button>`);
}

function _salvarEmpresa(id) {
  const nome     = document.getElementById('empNome')?.value.trim();
  const fantasia = document.getElementById('empFantasia')?.value.trim();
  const cnpj     = document.getElementById('empCnpj')?.value.trim();
  if (!nome||!fantasia||!cnpj) {
    if (typeof showToast==='function') showToast('Preencha Razão Social, Nome Fantasia e CNPJ.','error');
    return;
  }
  const dados = {
    nome, fantasia, cnpj,
    ie:          document.getElementById('empIE')?.value.trim()||'',
    telefone:    document.getElementById('empTelefone')?.value.trim()||'',
    email:       document.getElementById('empEmail')?.value.trim()||'',
    endereco:    document.getElementById('empEndereco')?.value.trim()||'',
    cidade:      document.getElementById('empCidade')?.value.trim()||'',
    estado:      document.getElementById('empEstado')?.value||'',
    cor_primaria:document.getElementById('empCor')?.value||'#e67e22',
    logo:        document.getElementById('empLogo')?.value.trim()||'',
  };
  if (id) {
    updateEmpresa(id, dados);
  } else {
    const nova = addEmpresa(dados);
    const all  = getEmpresas();
    if (all.length === 1) setEmpresaAtiva(nova.id);
  }
  if (typeof closeModal==='function') closeModal();
  if (typeof showToast==='function') showToast('Empresa salva com sucesso!','success');
  if (typeof logAction==='function') logAction('Empresa','Configurações',`Empresa ${nome} ${id?'atualizada':'cadastrada'}`);
}

// ── Tela gerenciar empresas ──────────────────────
function abrirGerenciarEmpresas() {
  const emps  = getEmpresas();
  const ativa = getEmpresaAtiva();
  document.getElementById('empresaDropdown')?.remove();
  if (typeof openModalWide!=='function') return;
  openModalWide(typeof t==='function'?t('emp_title'):'Empresas do Grupo',`
    <div style="margin-bottom:12px;display:flex;justify-content:flex-end">
      <button class="btn btn-primary btn-sm" onclick="closeModal();abrirNovaEmpresa()">
        <i class="fas fa-plus"></i> ${typeof t==='function'?t('emp_new'):'Nova Empresa'}
      </button>
    </div>
    <div style="display:grid;gap:10px" id="empList">
      ${emps.map(emp=>{
        const cor=emp.cor_primaria||'#e67e22';
        const ini=(emp.fantasia||emp.nome||'E').charAt(0).toUpperCase();
        const isAtiva=emp.id===ativa.id;
        return `
          <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;
               background:${isAtiva?'rgba(230,126,34,0.07)':'var(--bg-card2)'};
               border:1px solid ${isAtiva?'rgba(230,126,34,0.3)':'var(--border)'};border-radius:10px">
            <div style="width:44px;height:44px;border-radius:10px;background:${cor};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;flex-shrink:0">
              ${emp.logo?`<img src="${emp.logo}" style="width:42px;height:42px;border-radius:8px;object-fit:contain">`:ini}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${emp.fantasia||emp.nome}</div>
              <div style="font-size:12px;color:var(--text-muted)">${emp.nome}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">CNPJ: ${emp.cnpj}${emp.cidade?' · '+emp.cidade+(emp.estado?'/'+emp.estado:''):''}</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;align-items:center">
              ${!isAtiva?`<button class="btn btn-success btn-sm" onclick="setEmpresaAtiva('${emp.id}');closeModal()" title="Ativar"><i class="fas fa-check"></i> Ativar</button>`:`<span class="badge badge-success"><i class="fas fa-check-circle"></i> Ativa</span>`}
              <button class="btn btn-secondary btn-sm" onclick="closeModal();abrirEditarEmpresa('${emp.id}')" title="Editar"><i class="fas fa-edit"></i></button>
              ${emps.length>1?`<button class="btn btn-sm" onclick="_confirmarDeletarEmpresa('${emp.id}')" style="background:rgba(220,38,38,0.12);color:var(--red);border:1px solid rgba(220,38,38,0.3)" title="Excluir"><i class="fas fa-trash"></i></button>`:''}
            </div>
          </div>`;
      }).join('')}
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`);
}

function _confirmarDeletarEmpresa(id) {
  const emp = getEmpresas().find(e=>e.id===id);
  if (!emp) return;
  if (typeof confirmarAcao==='function')
    confirmarAcao('Excluir Empresa',`Deseja excluir <strong>${emp.fantasia||emp.nome}</strong>? Esta ação não pode ser desfeita.`,
      `deleteEmpresa('${id}');closeModal();abrirGerenciarEmpresas()`,true);
}

// ── Inicializa ────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  const emps = getEmpresas();
  if (!localStorage.getItem(EMPRESA_ATIVA_KEY)) localStorage.setItem(EMPRESA_ATIVA_KEY, emps[0].id);
  _renderEmpresaAtivaBadge();
  _renderEmpresaSidebarLogo();
});
