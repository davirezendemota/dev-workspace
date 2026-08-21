# 019 Projects · Documentos em checkpoints

> **Última atualização:** 2026-08-21

---

## 1. Contexto e problema

Checkpoints já guardam descrição markdown e atas em texto ([[016]]). Reuniões e
entregas geram PDFs, planilhas e imagens que hoje ficam fora do DW — o usuário
precisa abrir o painel do checkpoint e anexar o arquivo original ali.

A spec 016 deixou armazenamento binário de PDF fora de escopo (só extração de
texto). Esta spec cobre o arquivo em si, como anexo do marco.

## 2. Objetivo

O usuário envia, lista, baixa e remove documentos em cada checkpoint, a partir
do painel expandido na aba Checkpoints.

## 3. Escopo

### Dentro do escopo
- Campo `documents` no JSON do checkpoint (`id`, `filename`, `mimeType`, `size`, `uploadedAt`)
- Bytes em `workspace_data/checkpoint-documents/{projectId}/{documentId}`
- `POST/GET/DELETE` em `/api/projects/{id}/checkpoints/{index}/documents`
- UI de upload, lista, download e exclusão no painel expandido do checkpoint
- Indicador de quantidade de anexos na timeline

### Fora do escopo
- Editor de documentos no browser (preview de PDF/Office)
- OCR / extração de texto no upload (continua em `parse-pdf`, spec 016/017)
- Anexos em milestones, plans ou tasks
- Sincronizar arquivos com GitHub
- Tools MCP dedicadas de upload (a lista GET/PUT de checkpoints já carrega `documents`)

## 4. Requisitos

### Funcionais
- **RF1:** Cada checkpoint tem `documents[]` com metadados; o binário vive no filesystem do DW.
- **RF2:** No painel expandido, o usuário envia um ou mais arquivos e vê a lista atualizada.
- **RF3:** Download devolve o arquivo com o nome original (`Content-Disposition`).
- **RF4:** Excluir remove metadados e o arquivo em disco.
- **RF5:** Checkpoints legados sem `documents` abrem com lista vazia e aceitam upload.
- **RF6:** Tipos permitidos: PDF, imagens comuns, texto/markdown/csv e Office (doc/docx/xls/xlsx/ppt/pptx/odt/ods/odp). Limite 20MB por arquivo.

### Não-funcionais
- **RNF1:** Retrocompatível — projetos sem `documents` continuam válidos.
- **RNF2:** PUT da lista de checkpoints não apaga anexos existentes quando o payload omite `documents`.
- **RNF3:** Pasta padrão Docker `/data/checkpoint-documents` (host `./workspace_data/checkpoint-documents`).

## 5. Fluxo / Comportamento esperado

1. Usuário abre um checkpoint (botão expandir).
2. Na seção Documentos, escolhe arquivos ou usa o seletor.
3. `POST` multipart grava o binário e acrescenta o item em `documents`.
4. A lista mostra nome, tamanho e data; download abre o GET; excluir chama DELETE.
5. Na timeline, um contador aparece quando há anexos.

Estados: loading no envio, erro amigável (tipo/tamanho/falha), lista vazia com CTA.

## 6. Critérios de aceite

- **AC1:** Dado um checkpoint expandido, quando o usuário envia um arquivo permitido, então o anexo aparece na lista e o JSON do projeto contém o metadado.
- **AC2:** Dado um anexo existente, quando o usuário baixa, então o arquivo original é servido com o nome correto.
- **AC3:** Dado um anexo existente, quando o usuário exclui, então o item some da lista e o arquivo é removido do disco.
- **AC4:** Dado um checkpoint legado sem `documents`, quando o painel abre, então a seção Documentos aparece vazia e o upload funciona.

## 7. Modelo de dados (exemplo)

```json
{
  "date": "12/08/2026 18:00",
  "title": "Kickoff com cliente",
  "summary": "Alinhamento de escopo.",
  "description": "## Entregas\n\n- Spec 012",
  "atas": [],
  "documents": [
    {
      "id": "9c1e2a4b-7d3f-4e8a-9b2c-1f0d8e7a6b5c",
      "filename": "ata-kickoff.pdf",
      "mimeType": "application/pdf",
      "size": 245760,
      "uploadedAt": "2026-08-18T13:50:00.000Z"
    }
  ]
}
```

## 8. Notas técnicas

- Tipos e normalização em `app/lib/checkpoints.ts`.
- I/O em `app/lib/server/checkpoint-documents.ts`.
- Rotas em `app/api/projects/[id]/checkpoints/[index]/documents/`.
- UI em `CheckpointDetailSidebar` / `ProjectCheckpoints`.
