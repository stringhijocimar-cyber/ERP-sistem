/**
 * email.js — Adaptador de envio de e-mail (canal das notificações).
 * Mesma filosofia dos demais adaptadores: o envio real exige credencial e roda
 * no servidor. O provedor `mock` não envia nada — apenas valida e simula,
 * permitindo demo/testes. SMTP/SendGrid/SES plugam por EMAIL_PROVIDER.
 *
 * Saída: { status: 'simulado'|'enviado'|'erro', to, assunto, provider, motivo? }
 */
const _emailValido = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || '').trim())

export async function enviarEmail({ to, assunto, corpo } = {}, opts = {}) {
  const provider = (opts.provider || 'mock').toLowerCase()
  if (!_emailValido(to)) return { status: 'erro', to, provider, motivo: 'destinatário inválido' }
  if (!assunto) return { status: 'erro', to, provider, motivo: 'assunto obrigatório' }
  if (provider === 'mock') {
    // Não envia — registra a intenção (visível em logs do servidor).
    return { status: 'simulado', to, assunto, provider, corpo_len: String(corpo || '').length }
  }
  // Provedores reais (SMTP/SendGrid/SES) entram aqui com credencial do env.
  throw new Error('Provedor de e-mail não configurado: ' + provider)
}

export const _internal = { _emailValido }
