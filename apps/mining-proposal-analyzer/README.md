# Mining Proposal Analyzer — Android

Aplicativo Android para análise técnico-comercial de propostas de compras, contratos e sourcing em mineração.

## Objetivo

Transformar propostas comerciais em uma comparação executiva padronizada, com foco em custo total, aderência técnica, prazo, condição de pagamento, garantia, riscos e oportunidade de negociação.

## Funcionalidades v1.0

- Importação de propostas em PDF diretamente do celular.
- Extração local do texto do PDF, sem envio do documento para servidor externo.
- Inferência inicial de valor, prazo, pagamento, validade e garantia.
- Cadastro e correção manual dos dados críticos.
- Composição de TCO com valor base, frete, mobilização e custo mensal recorrente.
- Comparativo automático entre fornecedores.
- Score técnico-comercial de 0 a 100.
- Benchmark externo/budget informado pelo comprador.
- Saving potencial e variação contra benchmark.
- Estratégia de negociação com desconto sugerido de 5%, 7,5%, 10% ou 12%.
- Detecção de expressões de risco, como exclusões, reajuste, pagamento antecipado, horas extras/franquia, custos por conta da contratante e tributos não inclusos.
- Compartilhamento do resumo executivo pelo Android.
- Persistência local das propostas e do benchmark.

## Critérios do score

| Critério | Peso |
|---|---:|
| Comercial / TCO | 35% |
| Aderência técnica | 30% |
| Prazo | 10% |
| Pagamento | 10% |
| Garantia | 5% |
| Risco | 10% |

O score é um apoio à decisão. Homologação, SHEQ, compliance, escopo técnico, seguros, tributos, responsabilidades e cláusulas contratuais devem ser validados antes da contratação.

## Estrutura de custos

`TCO = valor base + frete + mobilização + (mensalidade × meses × quantidade)`

Para propostas cujo valor apresentado já seja um total fechado, mantenha frete/mobilização/mensalidade em zero ou informe apenas componentes comprovadamente adicionais, evitando dupla contagem.

## Benchmark

O app não inventa benchmark de mercado. O comprador pode informar uma referência validada, como:

- contrato anterior atualizado;
- budget aprovado;
- menor preço histórico comparável;
- should-cost;
- cotação de mercado tecnicamente equivalente.

## Geração do APK

O workflow `.github/workflows/build-mining-proposal-analyzer.yml` compila o aplicativo e publica:

1. um artifact de CI chamado `Mining-Proposal-Analyzer-APK`;
2. um asset na Release `mining-analyzer-v1.0.0`.

## Instalação

Baixe o arquivo `Mining-Proposal-Analyzer-v1.0.0.apk` na área **Releases** do repositório e abra no Android. O aparelho pode solicitar autorização para instalar aplicativos dessa origem.

## Evoluções recomendadas

- leitura de Excel/XLSX e CSV;
- comparação linha a linha por item;
- matriz técnica por requisito obrigatório/desejável;
- análise de impostos e incoterms;
- moedas e câmbio;
- templates específicos para locação, equipamentos, serviços, químicos e infraestrutura;
- geração de RFA / Procurement Comparative Summary em PDF e Excel;
- biblioteca de benchmarks corporativos;
- integração opcional com IA para interpretação semântica de cláusulas e escopos.
