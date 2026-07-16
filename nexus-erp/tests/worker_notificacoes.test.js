// ============================================================
// Worker (nexus-cf) — e-mail (paridade) + escopo de notificação (puro).
// ============================================================
import { describe, expect, it } from 'vitest'
import { enviarEmail as wEmail, notificacaoNoEscopo } from '../../nexus-cf/src/index.js'
import { enviarEmail as eEmail } from '../lib/email.js'

describe('Worker — enviarEmail (paridade com Express)', () => {
  it('mesma saída do adaptador do Express', async () => {
    expect(await wEmail({ to: 'a@b.com', assunto: 'Oi', corpo: 'x' })).toEqual(await eEmail({ to: 'a@b.com', assunto: 'Oi', corpo: 'x' }))
    expect(await wEmail({ to: 'invalido' })).toEqual(await eEmail({ to: 'invalido' }))
  })
})

describe('Worker — notificacaoNoEscopo', () => {
  const user = { sub: 'u-7', role: 'financeiro' }
  it('própria, do perfil ou global entram no escopo', () => {
    expect(notificacaoNoEscopo({ usuario_id: 'u-7' }, user)).toBe(true)
    expect(notificacaoNoEscopo({ perfil: 'financeiro' }, user)).toBe(true)
    expect(notificacaoNoEscopo({ usuario_id: null, perfil: null }, user)).toBe(true)
  })
  it('de outro usuário/perfil fica fora', () => {
    expect(notificacaoNoEscopo({ usuario_id: 'u-9' }, user)).toBe(false)
    expect(notificacaoNoEscopo({ perfil: 'compliance' }, user)).toBe(false)
  })
})
