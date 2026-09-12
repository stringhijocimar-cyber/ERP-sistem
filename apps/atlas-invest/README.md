# Atlas Invest · Android 0.1.0

Aplicativo Android independente para estudar ações brasileiras, FIIs, ETFs, criptoativos em BRL e câmbio de referência. Combina perfil financeiro, indicadores, IA estatística local, fontes de mercado e simulação. Não conecta contas de corretoras nem envia ordens.

## Instalar e desenvolver

O workflow **Atlas Invest • Android and validation** gera `Atlas-Invest-0.1.0.apk` no artefato `Atlas-Invest-0.1.0-Android`. Baixe o ZIP, extraia o APK e abra no Android 8 ou superior. É uma compilação debug para avaliação, não uma versão publicada na Play Store. A chave debug do CI pode variar entre compilações; a distribuição contínua precisa de chave de assinatura própria.

```bash
cd apps/atlas-invest
npm test
npm run serve
# Abra http://127.0.0.1:4173

# Java 17, Gradle 8.10.2 e Android SDK 35:
gradle :app:assembleDebug :app:lintDebug
```

O aplicativo e os cálculos não dependem de pacotes npm. A verificação visual usa Playwright, instalado apenas para desenvolvimento/CI. Não há biblioteca de IA remota, chave de LLM ou cobrança de inferência.

## Fluxo do usuário

1. **Perfil:** 12 perguntas sobre objetivos, horizonte, reserva, dívidas, renda, patrimônio, experiência, conhecimento e perdas. Escolher risco maior não ultrapassa o limite derivado da avaliação.
2. **Radar:** atualizar mercado; filtrar ações, FIIs, ETFs, cripto e moeda; favoritos e busca. Swing, day trade e longo prazo usam critérios próprios. Mudou o horizonte: atualize o intervalo dos dados.
3. **Análise:** preço, fonte, data, gráfico de candles, indicadores, razões favoráveis, riscos, bloqueios, IA, backtest e cenário de risco.
4. **Cenário:** Selic, IPCA, câmbio, manchetes e links para calendários oficiais.
5. **Simulador:** capital, custos, limites, carteira simulada, diário e exportação CSV. O exercício livre aceita preços hipotéticos e fica separado da carteira do radar.

A demonstração é ativada explicitamente e exibe faixa permanente. Seus preços são sintéticos; nunca substituem uma fonte real em caso de falha. Não geram entradas pela análise.

## Inteligência implementada

- MME 21/55, RSI de Wilder 14, MACD 12/26/9, ATR de Wilder 14, Bollinger 20, volume relativo, liquidez estimada, suporte e resistência.
- LTA/LTB por pivôs com três candles à esquerda e à direita. Pivôs só são confirmados com informação já observada. Fibonacci é uma referência do movimento dos últimos 80 candles, não sinal causal ou alvo garantido.
- Regressão logística regularizada com seis atributos de preço, momento, volume e volatilidade. Cada rótulo de treino termina antes da previsão avaliada. A validação avança sem sobreposição entre horizontes de teste. Mostra escore experimental, Brier e referência histórica; não apresenta uma chance de lucro calibrada.
- Backtest de estratégia fixa de tendência nos 35% finais da série. Sinal no fechamento anterior, entrada na abertura seguinte, custos nos dois lados, tamanho limitado por risco e exposição. Gap no stop executa na abertura; stop tem prioridade quando alvo e stop são tocados no mesmo candle.
- Sem alavancagem. Teto de risco por operação, concentração, risco agregado e perdas diárias realizadas. Cripto exige perfil arrojado e limita exposição por ativo a 5% do capital.

A confluência é índice de triagem, não probabilidade. Médias e MACD são correlacionados: somar indicadores não cria evidência independente. A IA só acrescenta peso quando há ao menos 30 previsões fora do treino e melhoria mínima de 5% no Brier contra a referência; isso não é comprovação estatística de rentabilidade.

## Dados e cobertura

| Mercado | Fonte | Condições e limites |
| --- | --- | --- |
| Ações B3 | brapi v2 quote/historical | PETR4, VALE3, ITUB4 e MGLU3 são tickers de teste documentados. Histórico pode ser truncado pelo plano. |
| FIIs e ETFs | brapi v2 | Token e cobertura necessários. FIIs incluem P/VP, DY e patrimônio/cota quando disponíveis. |
| BTC, ETH, SOL | Binance Spot pública | Pares BRL; apenas mercado público. Disponibilidade depende do par, região e fonte. |
| Selic, IPCA, USD/BRL | BCB SGS 432, 433, 1 | Selic anual, IPCA mensal, câmbio de referência. Datas futuras, inválidas ou antigas são rejeitadas. |
| Manchetes | GDELT Doc API | Últimas 24h, marcação por palavras-chave. Horário de indexação, não necessariamente publicação original. |

Cotação e último candle têm verificação de idade separada. Swing permite até quatro dias de idade da cotação e cinco do candle para acomodar fins de semana, sempre exibindo data; isso não certifica preço executável. Day trade exige candles concluídos de 5 minutos, cotação de até dois minutos, último fechamento de até seis minutos e intraday verificável. A brapi B3 **não é considerada intraday verificada** nesta versão: day trade nela fica bloqueado. Não há calendário completo de feriados ou negociação.

FIIs exibem data-base dos indicadores, que pode ser antiga; vacância, dívida, crédito e relatórios completos exigem leitura externa. Longo prazo fica como triagem, com entrada bloqueada: análise técnica não substitui fundamentos completos. Câmbio BCB é referência e nunca gera operação. Não há dados de economia fictícios.

## O que os testes não demonstram

Versão **experimental**, sem rentabilidade comprovada. O gate de backtest requer ao menos 20 operações, expectativa positiva, superar comprar e manter e queda compatível com o perfil. É regra interna, não teste de significância. Comprar e manter usa 100% do capital; a estratégia limita concentração. As exposições diferem.

O backtest valida apenas a estratégia fixa, não o motor completo de seleção, notícias e IA. O modelo estima direção líquida no horizonte, sem simular stops e alvos. Não foram demonstradas calibração, significância, estabilidade entre regimes ou validação prospectiva. Não há busca automática de parâmetros.

Tributos, proventos recebidos, aluguel, correlação da carteira e book de execução não estão incluídos. Taxas e deslizamento padrão são hipóteses editáveis, não custos confirmados de uma corretora. Os indicadores técnicos usam OHLC reescalado por adjustedClose quando disponível; o backtest não soma dividendos novamente.

Stop e alvo atuais são cenários matemáticos. Gaps podem produzir perda maior que a estimada. A carteira simulada exige ação manual para saída e cotação recente; não há monitoramento em segundo plano, execução automática ou alertas de stop.

## Privacidade e segurança

Perfil, preferências, carteira e exercícios ficam no `localStorage` privado do WebView; o backup Android está desativado. Não há CPF, conta de corretora ou transmissão do questionário. O token brapi fica apenas na memória da sessão, é enviado somente à brapi e não é gravado no código, disco ou logs. As fontes recebem consultas e dados normais de rede, como IP.

WebView carrega arquivos locais por origem HTTPS interna. CSP bloqueia scripts remotos, frames e formulários externos. Links HTTPS abrem no navegador. Ponte Java aceita somente endpoints GET fixos de mercado, recusa redirecionamentos e limita tamanho, tempo e simultaneidade. Exportação CSV usa o seletor de documentos Android, sem acesso geral ao armazenamento; textos exportados recebem proteção contra fórmulas em planilhas.

## Para distribuição profissional

Antes de comercializar recomendações personalizadas, definir enquadramento regulatório, responsabilidade profissional, contratos de dados, assinatura de distribuição e tratamento de dados. Questionário interno não equivale a suitability certificado. Aviso educacional não elimina obrigações legais aplicáveis.

Próximas prioridades: dados licenciados com calendário e atraso verificáveis; fundamentos completos; backtest do motor completo, carteira e correlações; validação prospectiva; monitoração de qualidade; revisão por profissional habilitado. Integração com corretoras permanece fora do escopo solicitado.

## Fontes consultadas em 10/09/2026

- [brapi: ações e teste sem token](https://brapi.dev/docs/acoes), [histórico e ajustes](https://brapi.dev/docs/acoes/historico), [indicadores de FIIs](https://brapi.dev/docs/fiis/indicadores).
- [Binance: endpoints públicos](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints).
- [Banco Central: dados abertos](https://dadosabertos.bcb.gov.br/).
- [Android: conteúdo local em WebView](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content).
- [CVM 30: adequação ao perfil](https://conteudo.cvm.gov.br/legislacao/resolucoes/resol030.html), [CVM 20: atividade de analista](https://conteudo.cvm.gov.br/legislacao/resolucoes/resol020.html).

Testes cobrem indicadores, capacidade de risco, dados inválidos, look-ahead, custos, gaps, contabilização, contratos dos provedores, falhas de fontes, navegação, persistência e larguras de tela. O workflow entrega APK, checksum, capturas e relatório visual.
