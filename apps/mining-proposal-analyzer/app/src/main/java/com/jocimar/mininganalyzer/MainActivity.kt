package com.jocimar.mininganalyzer

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale
import java.util.UUID
import kotlin.math.max
import kotlin.math.min

private data class Proposal(
    val id: String = UUID.randomUUID().toString(),
    val supplier: String = "",
    val title: String = "",
    val quotedValue: Double = 0.0,
    val freight: Double = 0.0,
    val mobilization: Double = 0.0,
    val recurringMonthly: Double = 0.0,
    val months: Int = 0,
    val quantity: Int = 1,
    val leadTimeDays: Int = 0,
    val paymentDays: Int = 0,
    val technicalCompliance: Double = 80.0,
    val warrantyMonths: Int = 0,
    val validityDays: Int = 0,
    val notes: String = "",
    val sourceText: String = ""
) {
    val totalCost: Double
        get() = quotedValue + freight + mobilization + (recurringMonthly * months * max(quantity, 1))
}

private data class RankedProposal(
    val proposal: Proposal,
    val score: Double,
    val risks: List<String>
)

class MainActivity : ComponentActivity() {

    private val prefs by lazy { getSharedPreferences("mining_analyzer", MODE_PRIVATE) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        PDFBoxResourceLoader.init(applicationContext)
        setContent { MiningAnalyzerApp() }
    }

    @Composable
    private fun MiningAnalyzerApp() {
        val proposals = remember {
            mutableStateListOf<Proposal>().apply { addAll(loadProposals()) }
        }
        var selectedTab by rememberSaveable { mutableIntStateOf(0) }
        var showEditor by remember { mutableStateOf(false) }
        var editing by remember { mutableStateOf<Proposal?>(null) }
        var statusMessage by remember { mutableStateOf<String?>(null) }
        var benchmarkText by rememberSaveable {
            mutableStateOf(prefs.getString("benchmark_value", "") ?: "")
        }

        val pdfLauncher = rememberLauncherForActivityResult(
            contract = ActivityResultContracts.OpenDocument()
        ) { uri ->
            if (uri != null) {
                statusMessage = "Lendo proposta..."
                lifecycleScope.launch(Dispatchers.IO) {
                    runCatching { extractProposalFromPdf(uri) }
                        .onSuccess { imported ->
                            withContext(Dispatchers.Main) {
                                proposals.add(imported)
                                saveProposals(proposals)
                                statusMessage = "PDF importado. Revise os campos extraídos antes da decisão final."
                            }
                        }
                        .onFailure { error ->
                            withContext(Dispatchers.Main) {
                                statusMessage = "Não foi possível ler o PDF: ${error.message ?: "erro desconhecido"}"
                            }
                        }
                }
            }
        }

        MaterialTheme {
            Scaffold(
                topBar = {
                    TopAppBar(
                        title = {
                            Column {
                                Text("Mining Proposal Analyzer", fontWeight = FontWeight.Bold)
                                Text("Compras • Contratos • Sourcing", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    )
                }
            ) { padding ->
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                ) {
                    TabRow(selectedTabIndex = selectedTab) {
                        listOf("Propostas", "Comparativo", "Negociação").forEachIndexed { index, label ->
                            Tab(
                                selected = selectedTab == index,
                                onClick = { selectedTab = index },
                                text = { Text(label) }
                            )
                        }
                    }

                    statusMessage?.let { message ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 8.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(message, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
                                TextButton(onClick = { statusMessage = null }) { Text("OK") }
                            }
                        }
                    }

                    when (selectedTab) {
                        0 -> ProposalEntryScreen(
                            proposals = proposals,
                            onImportPdf = { pdfLauncher.launch(arrayOf("application/pdf")) },
                            onAddManual = {
                                editing = null
                                showEditor = true
                            },
                            onEdit = {
                                editing = it
                                showEditor = true
                            },
                            onDelete = { proposal ->
                                proposals.removeAll { it.id == proposal.id }
                                saveProposals(proposals)
                            }
                        )

                        1 -> ComparisonScreen(
                            proposals = proposals,
                            benchmarkText = benchmarkText,
                            onBenchmarkChange = {
                                benchmarkText = it
                                prefs.edit().putString("benchmark_value", it).apply()
                            },
                            onShare = {
                                shareReport(buildExecutiveReport(proposals, parseNumber(benchmarkText)))
                            }
                        )

                        2 -> NegotiationScreen(
                            proposals = proposals,
                            benchmark = parseNumber(benchmarkText),
                            onShare = {
                                shareReport(buildExecutiveReport(proposals, parseNumber(benchmarkText)))
                            }
                        )
                    }
                }
            }
        }

        if (showEditor) {
            ProposalEditorDialog(
                initial = editing,
                onDismiss = { showEditor = false },
                onSave = { proposal ->
                    val index = proposals.indexOfFirst { it.id == proposal.id }
                    if (index >= 0) proposals[index] = proposal else proposals.add(proposal)
                    saveProposals(proposals)
                    showEditor = false
                }
            )
        }
    }

    @Composable
    private fun ProposalEntryScreen(
        proposals: List<Proposal>,
        onImportPdf: () -> Unit,
        onAddManual: () -> Unit,
        onEdit: (Proposal) -> Unit,
        onDelete: (Proposal) -> Unit
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(onClick = onImportPdf, modifier = Modifier.weight(1f)) { Text("Importar PDF") }
                OutlinedButton(onClick = onAddManual, modifier = Modifier.weight(1f)) { Text("Adicionar manual") }
            }

            Text(
                "O importador procura valores, prazos, pagamento, garantia e termos de risco. Campos críticos devem ser validados pelo comprador.",
                modifier = Modifier.padding(horizontal = 16.dp),
                style = MaterialTheme.typography.bodySmall
            )

            if (proposals.isEmpty()) {
                EmptyState("Adicione pelo menos duas propostas para gerar o comparativo técnico-comercial.")
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(proposals, key = { it.id }) { proposal ->
                        ProposalCard(proposal, onEdit, onDelete)
                    }
                }
            }
        }
    }

    @Composable
    private fun ProposalCard(
        proposal: Proposal,
        onEdit: (Proposal) -> Unit,
        onDelete: (Proposal) -> Unit
    ) {
        val risks = detectRiskFlags(proposal.notes + "\n" + proposal.sourceText)
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(proposal.supplier.ifBlank { "Fornecedor não identificado" }, fontWeight = FontWeight.Bold)
                if (proposal.title.isNotBlank()) Text(proposal.title, style = MaterialTheme.typography.bodySmall)
                Text("TCO estimado: ${money(proposal.totalCost)}", fontWeight = FontWeight.SemiBold)
                Text("Prazo: ${displayDays(proposal.leadTimeDays)} • Pagamento: ${displayDays(proposal.paymentDays)} • Técnico: ${proposal.technicalCompliance.toInt()}%")
                if (risks.isNotEmpty()) {
                    Text("Alertas: ${risks.take(3).joinToString(" • ")}", style = MaterialTheme.typography.bodySmall)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = { onEdit(proposal) }) { Text("Editar") }
                    TextButton(onClick = { onDelete(proposal) }) { Text("Excluir") }
                }
            }
        }
    }

    @Composable
    private fun ComparisonScreen(
        proposals: List<Proposal>,
        benchmarkText: String,
        onBenchmarkChange: (String) -> Unit,
        onShare: () -> Unit
    ) {
        val benchmark = parseNumber(benchmarkText)
        if (proposals.size < 2) {
            EmptyState("Inclua pelo menos duas propostas para comparar custo, técnica, prazo, pagamento e risco.")
            return
        }

        val ranked = rankProposals(proposals)
        val best = ranked.first()
        val highestCost = proposals.maxOfOrNull { it.totalCost } ?: 0.0
        val savingVsHighest = if (highestCost > 0) (highestCost - best.proposal.totalCost) / highestCost * 100 else 0.0

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Recomendação automática", fontWeight = FontWeight.Bold)
                        Text(best.proposal.supplier.ifBlank { "Fornecedor não identificado" }, style = MaterialTheme.typography.titleLarge)
                        Text("Score: ${format1(best.score)}/100 • TCO: ${money(best.proposal.totalCost)}")
                        Text("Saving potencial vs. proposta mais cara: ${format1(savingVsHighest)}%")
                        Text(
                            "A recomendação pondera comercial 35%, aderência técnica 30%, prazo 10%, pagamento 10%, garantia 5% e risco 10%.",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }

            item {
                OutlinedTextField(
                    value = benchmarkText,
                    onValueChange = onBenchmarkChange,
                    label = { Text("Benchmark externo / budget de referência (R$)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                    supportingText = { Text("Opcional. Use uma referência validada de mercado, contrato anterior ou should-cost.") }
                )
            }

            if (benchmark > 0) {
                item {
                    val variance = (best.proposal.totalCost - benchmark) / benchmark * 100
                    Text(
                        "Melhor TCO vs. benchmark: ${if (variance >= 0) "+" else ""}${format1(variance)}% (${money(best.proposal.totalCost - benchmark)})",
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            items(ranked) { item ->
                RankedCard(item, ranked.indexOf(item) + 1)
            }

            item {
                Button(onClick = onShare, modifier = Modifier.fillMaxWidth()) { Text("Compartilhar resumo executivo") }
            }
        }
    }

    @Composable
    private fun RankedCard(item: RankedProposal, position: Int) {
        val p = item.proposal
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text("#$position  ${p.supplier.ifBlank { "Fornecedor" }}", fontWeight = FontWeight.Bold)
                Text("Score ${format1(item.score)}/100 • TCO ${money(p.totalCost)}")
                Text("Técnico ${p.technicalCompliance.toInt()}% • Prazo ${displayDays(p.leadTimeDays)} • Pagamento ${displayDays(p.paymentDays)}")
                if (item.risks.isEmpty()) {
                    Text("Risco documental: sem alerta automático identificado", style = MaterialTheme.typography.bodySmall)
                } else {
                    Text("Riscos: ${item.risks.joinToString(" • ")}", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }

    @Composable
    private fun NegotiationScreen(
        proposals: List<Proposal>,
        benchmark: Double,
        onShare: () -> Unit
    ) {
        if (proposals.isEmpty()) {
            EmptyState("Adicione propostas para calcular alvos de negociação.")
            return
        }

        val bestTotal = proposals.filter { it.totalCost > 0 }.minOfOrNull { it.totalCost } ?: 0.0
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Estratégia de fechamento", fontWeight = FontWeight.Bold)
                        Text("Faixa sugerida baseada na distância para a melhor oferta: 5%, 7,5%, 10% ou 12%.")
                        Text("Meta de savings recomendada para o processo: ≥ 8%, quando tecnicamente e comercialmente sustentável.", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            items(proposals.sortedBy { it.totalCost }) { proposal ->
                val discount = recommendedDiscount(proposal, bestTotal)
                val target = proposal.totalCost * (1 - discount / 100.0)
                val benchmarkGap = if (benchmark > 0) (target - benchmark) / benchmark * 100 else null
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(proposal.supplier.ifBlank { "Fornecedor" }, fontWeight = FontWeight.Bold)
                        Text("Oferta atual: ${money(proposal.totalCost)}")
                        Text("Desconto sugerido: ${format1(discount)}%")
                        Text("Alvo negocial: ${money(target)}", fontWeight = FontWeight.SemiBold)
                        Text("Saving potencial: ${money(proposal.totalCost - target)}")
                        benchmarkGap?.let {
                            Text("Alvo vs. benchmark: ${if (it >= 0) "+" else ""}${format1(it)}%", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }

            item {
                Button(onClick = onShare, modifier = Modifier.fillMaxWidth()) { Text("Compartilhar análise") }
            }
        }
    }

    @Composable
    private fun EmptyState(message: String) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
        ) {
            Text(message, style = MaterialTheme.typography.bodyLarge)
        }
    }

    @Composable
    private fun ProposalEditorDialog(
        initial: Proposal?,
        onDismiss: () -> Unit,
        onSave: (Proposal) -> Unit
    ) {
        var supplier by remember(initial?.id) { mutableStateOf(initial?.supplier ?: "") }
        var title by remember(initial?.id) { mutableStateOf(initial?.title ?: "") }
        var quoted by remember(initial?.id) { mutableStateOf(numberInput(initial?.quotedValue ?: 0.0)) }
        var freight by remember(initial?.id) { mutableStateOf(numberInput(initial?.freight ?: 0.0)) }
        var mobilization by remember(initial?.id) { mutableStateOf(numberInput(initial?.mobilization ?: 0.0)) }
        var monthly by remember(initial?.id) { mutableStateOf(numberInput(initial?.recurringMonthly ?: 0.0)) }
        var months by remember(initial?.id) { mutableStateOf((initial?.months ?: 0).takeIf { it > 0 }?.toString() ?: "") }
        var quantity by remember(initial?.id) { mutableStateOf((initial?.quantity ?: 1).toString()) }
        var lead by remember(initial?.id) { mutableStateOf((initial?.leadTimeDays ?: 0).takeIf { it > 0 }?.toString() ?: "") }
        var payment by remember(initial?.id) { mutableStateOf((initial?.paymentDays ?: 0).takeIf { it > 0 }?.toString() ?: "") }
        var technical by remember(initial?.id) { mutableStateOf(numberInput(initial?.technicalCompliance ?: 80.0)) }
        var warranty by remember(initial?.id) { mutableStateOf((initial?.warrantyMonths ?: 0).takeIf { it > 0 }?.toString() ?: "") }
        var validity by remember(initial?.id) { mutableStateOf((initial?.validityDays ?: 0).takeIf { it > 0 }?.toString() ?: "") }
        var notes by remember(initial?.id) { mutableStateOf(initial?.notes ?: "") }

        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text(if (initial == null) "Nova proposta" else "Editar proposta") },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 560.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Field(supplier, { supplier = it }, "Fornecedor")
                    Field(title, { title = it }, "Descrição / escopo")
                    NumericField(quoted, { quoted = it }, "Valor base / fornecimento (R$)")
                    NumericField(freight, { freight = it }, "Frete / logística (R$)")
                    NumericField(mobilization, { mobilization = it }, "Mobilização (R$)")
                    NumericField(monthly, { monthly = it }, "Custo mensal recorrente por unidade (R$)")
                    NumericField(months, { months = it }, "Meses")
                    NumericField(quantity, { quantity = it }, "Quantidade")
                    NumericField(lead, { lead = it }, "Prazo de entrega (dias)")
                    NumericField(payment, { payment = it }, "Pagamento (dias)")
                    NumericField(technical, { technical = it }, "Aderência técnica (%)")
                    NumericField(warranty, { warranty = it }, "Garantia (meses)")
                    NumericField(validity, { validity = it }, "Validade da proposta (dias)")
                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        label = { Text("Notas, exclusões e condições") },
                        minLines = 3,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        onSave(
                            Proposal(
                                id = initial?.id ?: UUID.randomUUID().toString(),
                                supplier = supplier.trim(),
                                title = title.trim(),
                                quotedValue = parseNumber(quoted),
                                freight = parseNumber(freight),
                                mobilization = parseNumber(mobilization),
                                recurringMonthly = parseNumber(monthly),
                                months = months.toIntOrNull() ?: 0,
                                quantity = max(quantity.toIntOrNull() ?: 1, 1),
                                leadTimeDays = lead.toIntOrNull() ?: 0,
                                paymentDays = payment.toIntOrNull() ?: 0,
                                technicalCompliance = parseNumber(technical).coerceIn(0.0, 100.0),
                                warrantyMonths = warranty.toIntOrNull() ?: 0,
                                validityDays = validity.toIntOrNull() ?: 0,
                                notes = notes.trim(),
                                sourceText = initial?.sourceText ?: ""
                            )
                        )
                    },
                    enabled = supplier.isNotBlank() && (parseNumber(quoted) > 0 || parseNumber(monthly) > 0)
                ) { Text("Salvar") }
            },
            dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } }
        )
    }

    @Composable
    private fun Field(value: String, onChange: (String) -> Unit, label: String) {
        OutlinedTextField(
            value = value,
            onValueChange = onChange,
            label = { Text(label) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )
    }

    @Composable
    private fun NumericField(value: String, onChange: (String) -> Unit, label: String) {
        OutlinedTextField(
            value = value,
            onValueChange = onChange,
            label = { Text(label) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
        )
    }

    private fun extractProposalFromPdf(uri: Uri): Proposal {
        val fileName = queryFileName(uri) ?: "Proposta PDF"
        val text = contentResolver.openInputStream(uri).use { input ->
            requireNotNull(input) { "Arquivo não encontrado" }
            PDDocument.load(input).use { document -> PDFTextStripper().getText(document) }
        }

        val supplierGuess = fileName.substringBeforeLast('.').replace('_', ' ').replace('-', ' ').trim()
        val currencies = extractCurrencies(text)
        val mainValue = currencies.maxOrNull() ?: 0.0
        val lead = extractDaysNear(text, listOf("prazo", "entrega", "lead time"))
        val payment = extractDaysNear(text, listOf("pagamento", "payment", "condição de pagamento", "condicao de pagamento"))
        val validity = extractDaysNear(text, listOf("validade", "validity"))
        val warranty = extractMonthsNear(text, listOf("garantia", "warranty"))
        val riskFlags = detectRiskFlags(text)

        val extractionNotes = buildString {
            append("Importação automática de PDF. Valor principal inferido pelo maior valor monetário identificado")
            if (lead > 0) append("; prazo identificado: $lead dias")
            if (payment > 0) append("; pagamento identificado: $payment dias")
            if (validity > 0) append("; validade identificada: $validity dias")
            if (warranty > 0) append("; garantia identificada: $warranty meses")
            if (riskFlags.isNotEmpty()) append("; alertas: ${riskFlags.joinToString(", ")}")
            append(". Validar escopo e composição do preço antes da aprovação.")
        }

        return Proposal(
            supplier = supplierGuess,
            title = fileName,
            quotedValue = mainValue,
            leadTimeDays = lead,
            paymentDays = payment,
            technicalCompliance = 80.0,
            warrantyMonths = warranty,
            validityDays = validity,
            notes = extractionNotes,
            sourceText = text.take(60_000)
        )
    }

    private fun queryFileName(uri: Uri): String? {
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (index >= 0) return cursor.getString(index)
            }
        }
        return null
    }

    private fun shareReport(report: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "Análise técnico-comercial de propostas")
            putExtra(Intent.EXTRA_TEXT, report)
        }
        startActivity(Intent.createChooser(intent, "Compartilhar análise"))
    }

    private fun buildExecutiveReport(proposals: List<Proposal>, benchmark: Double): String {
        if (proposals.isEmpty()) return "Nenhuma proposta cadastrada."
        val ranked = rankProposals(proposals)
        val best = ranked.first()
        val bestTotal = proposals.filter { it.totalCost > 0 }.minOfOrNull { it.totalCost } ?: 0.0
        return buildString {
            appendLine("ANÁLISE TÉCNICO-COMERCIAL – PROCUREMENT")
            appendLine()
            appendLine("Recomendação: ${best.proposal.supplier}")
            appendLine("Score: ${format1(best.score)}/100")
            appendLine("TCO estimado: ${money(best.proposal.totalCost)}")
            if (benchmark > 0) {
                val variance = (best.proposal.totalCost - benchmark) / benchmark * 100
                appendLine("Variação vs. benchmark: ${format1(variance)}%")
            }
            appendLine()
            appendLine("RANKING")
            ranked.forEachIndexed { index, item ->
                appendLine("${index + 1}. ${item.proposal.supplier} | ${money(item.proposal.totalCost)} | Score ${format1(item.score)} | Técnico ${item.proposal.technicalCompliance.toInt()}% | Prazo ${displayDays(item.proposal.leadTimeDays)}")
            }
            appendLine()
            appendLine("NEGOCIAÇÃO")
            proposals.sortedBy { it.totalCost }.forEach { p ->
                val discount = recommendedDiscount(p, bestTotal)
                val target = p.totalCost * (1 - discount / 100.0)
                appendLine("${p.supplier}: solicitar ${format1(discount)}% | alvo ${money(target)} | saving ${money(p.totalCost - target)}")
            }
            appendLine()
            appendLine("Critérios: comercial 35%, técnico 30%, prazo 10%, pagamento 10%, garantia 5%, risco 10%.")
            appendLine("Nota: alertas automáticos e extração de PDF são apoio à decisão e não substituem validação técnica, contratual, fiscal, SHEQ ou compliance.")
        }
    }

    private fun saveProposals(proposals: List<Proposal>) {
        val array = JSONArray()
        proposals.forEach { p ->
            array.put(JSONObject().apply {
                put("id", p.id)
                put("supplier", p.supplier)
                put("title", p.title)
                put("quotedValue", p.quotedValue)
                put("freight", p.freight)
                put("mobilization", p.mobilization)
                put("recurringMonthly", p.recurringMonthly)
                put("months", p.months)
                put("quantity", p.quantity)
                put("leadTimeDays", p.leadTimeDays)
                put("paymentDays", p.paymentDays)
                put("technicalCompliance", p.technicalCompliance)
                put("warrantyMonths", p.warrantyMonths)
                put("validityDays", p.validityDays)
                put("notes", p.notes)
                put("sourceText", p.sourceText)
            })
        }
        prefs.edit().putString("proposals", array.toString()).apply()
    }

    private fun loadProposals(): List<Proposal> {
        val raw = prefs.getString("proposals", null) ?: return emptyList()
        return runCatching {
            val array = JSONArray(raw)
            buildList {
                for (i in 0 until array.length()) {
                    val o = array.getJSONObject(i)
                    add(
                        Proposal(
                            id = o.optString("id", UUID.randomUUID().toString()),
                            supplier = o.optString("supplier"),
                            title = o.optString("title"),
                            quotedValue = o.optDouble("quotedValue", 0.0),
                            freight = o.optDouble("freight", 0.0),
                            mobilization = o.optDouble("mobilization", 0.0),
                            recurringMonthly = o.optDouble("recurringMonthly", 0.0),
                            months = o.optInt("months", 0),
                            quantity = max(o.optInt("quantity", 1), 1),
                            leadTimeDays = o.optInt("leadTimeDays", 0),
                            paymentDays = o.optInt("paymentDays", 0),
                            technicalCompliance = o.optDouble("technicalCompliance", 80.0),
                            warrantyMonths = o.optInt("warrantyMonths", 0),
                            validityDays = o.optInt("validityDays", 0),
                            notes = o.optString("notes"),
                            sourceText = o.optString("sourceText")
                        )
                    )
                }
            }
        }.getOrElse { emptyList() }
    }
}

private fun rankProposals(proposals: List<Proposal>): List<RankedProposal> {
    val positiveTotals = proposals.map { it.totalCost }.filter { it > 0 }
    val bestTotal = positiveTotals.minOrNull() ?: 1.0
    val positiveLeads = proposals.map { it.leadTimeDays }.filter { it > 0 }
    val bestLead = positiveLeads.minOrNull() ?: 0
    val maxPayment = proposals.maxOfOrNull { it.paymentDays }?.takeIf { it > 0 } ?: 0

    return proposals.map { p ->
        val commercial = if (p.totalCost > 0) min(35.0, bestTotal / p.totalCost * 35.0) else 0.0
        val technical = p.technicalCompliance.coerceIn(0.0, 100.0) * 0.30
        val lead = when {
            p.leadTimeDays <= 0 -> 5.0
            bestLead <= 0 -> 5.0
            else -> min(10.0, bestLead.toDouble() / p.leadTimeDays * 10.0)
        }
        val payment = when {
            p.paymentDays <= 0 -> 5.0
            maxPayment <= 0 -> 5.0
            else -> min(10.0, p.paymentDays.toDouble() / maxPayment * 10.0)
        }
        val warranty = if (p.warrantyMonths <= 0) 2.5 else min(5.0, p.warrantyMonths / 24.0 * 5.0)
        val risks = detectRiskFlags(p.notes + "\n" + p.sourceText)
        val riskScore = max(0.0, 10.0 - risks.size * 1.5)
        RankedProposal(p, commercial + technical + lead + payment + warranty + riskScore, risks)
    }.sortedWith(compareByDescending<RankedProposal> { it.score }.thenBy { it.proposal.totalCost })
}

private fun recommendedDiscount(proposal: Proposal, bestTotal: Double): Double {
    if (proposal.totalCost <= 0 || bestTotal <= 0) return 5.0
    val gap = proposal.totalCost / bestTotal - 1.0
    return when {
        gap <= 0.02 -> 5.0
        gap <= 0.08 -> 7.5
        gap <= 0.15 -> 10.0
        else -> 12.0
    }
}

private fun detectRiskFlags(raw: String): List<String> {
    val text = raw.lowercase(Locale.ROOT)
    val checks = linkedMapOf(
        "Item não incluso" to listOf("não incluso", "nao incluso", "não contempla", "nao contempla"),
        "Custo por conta do cliente" to listOf("por conta do cliente", "por conta da contratante"),
        "Reajuste previsto" to listOf("reajuste", "reajustado", "reajustável", "reajustavel"),
        "Pagamento antecipado" to listOf("pagamento antecipado", "antecipado", "à vista", "a vista"),
        "Hora extra / franquia" to listOf("hora extra", "horas extras", "franquia de horas", "excedente de horas"),
        "Combustível não definido" to listOf("combustível por conta", "combustivel por conta", "diesel por conta"),
        "Exclusão contratual" to listOf("exclusão", "exclusao", "excluído", "excluido"),
        "Seguro / responsabilidade" to listOf("sem seguro", "não possui seguro", "nao possui seguro"),
        "Prazo sujeito a alteração" to listOf("sujeito a alteração", "sujeito a alteracao"),
        "Tributo / imposto em aberto" to listOf("impostos não inclusos", "impostos nao inclusos", "tributos não inclusos", "tributos nao inclusos")
    )
    return checks.filterValues { keywords -> keywords.any { text.contains(it) } }.keys.toList()
}

private fun extractCurrencies(text: String): List<Double> {
    val regex = Regex("(?:R\\$|BRL)\\s*([0-9]{1,3}(?:\\.[0-9]{3})*(?:,[0-9]{2})|[0-9]+(?:,[0-9]{2})?)", RegexOption.IGNORE_CASE)
    return regex.findAll(text).mapNotNull { parseBrazilianMoney(it.groupValues[1]) }.toList()
}

private fun parseBrazilianMoney(value: String): Double? =
    value.replace(".", "").replace(",", ".").toDoubleOrNull()

private fun extractDaysNear(text: String, keywords: List<String>): Int {
    val lines = text.lines()
    keywords.forEach { keyword ->
        lines.firstOrNull { it.lowercase(Locale.ROOT).contains(keyword) }?.let { line ->
            Regex("(\\d{1,3})\\s*(?:dias|days)", RegexOption.IGNORE_CASE).find(line)?.groupValues?.getOrNull(1)?.toIntOrNull()?.let { return it }
        }
    }
    return 0
}

private fun extractMonthsNear(text: String, keywords: List<String>): Int {
    val lines = text.lines()
    keywords.forEach { keyword ->
        lines.firstOrNull { it.lowercase(Locale.ROOT).contains(keyword) }?.let { line ->
            Regex("(\\d{1,3})\\s*(?:meses|mês|mes|months)", RegexOption.IGNORE_CASE).find(line)?.groupValues?.getOrNull(1)?.toIntOrNull()?.let { return it }
        }
    }
    return 0
}

private fun parseNumber(raw: String): Double {
    val clean = raw.trim().replace("R$", "").replace(" ", "")
    if (clean.isBlank()) return 0.0
    return when {
        clean.contains(',') && clean.contains('.') -> clean.replace(".", "").replace(",", ".").toDoubleOrNull() ?: 0.0
        clean.contains(',') -> clean.replace(",", ".").toDoubleOrNull() ?: 0.0
        else -> clean.toDoubleOrNull() ?: 0.0
    }
}

private fun money(value: Double): String = NumberFormat.getCurrencyInstance(Locale("pt", "BR")).format(value)
private fun format1(value: Double): String = String.format(Locale("pt", "BR"), "%.1f", value)
private fun displayDays(value: Int): String = if (value > 0) "$value dias" else "não informado"
private fun numberInput(value: Double): String = if (value == 0.0) "" else if (value % 1.0 == 0.0) value.toLong().toString() else value.toString().replace('.', ',')
