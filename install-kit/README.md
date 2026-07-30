# install-kit

Instala `.env` + skill `dev-workspace` + comando `/dev-workspace` (`skill-dev-workspace.md` + `command-dev-workspace.md` neste kit).

```bash
./install-kit/install.sh /path/to/consumer \
  --api-url http://localhost:3010 \
  --api-token "$(docker logs dev_workspace_app_local 2>&1 | grep -m1 DEV_WORKSPACE_API_TOKEN= | cut -d= -f2)" \
  --dw-root /path/to/dev-workspace
```

## Testar (só via IA — sem curl manual)

Na raiz do consumidor, com DW rodando e `.env` com URL + token:

```bash
cd /path/to/consumer
cursor agent --print --trust "/dev-workspace checkpoints"
```

**Não use `--mode ask`** — esse modo bloqueia `curl`/shell; a IA precisa rodar Bash para chamar a API.

Ou interativo: `cursor agent` → `/dev-workspace checkpoints`

Importar prompt do DW no repo:

```bash
cursor agent --print --trust "/dev-workspace importar o prompt gsync main"
```

Grava `.cursor/commands/{id}.md` e registra em `.dev-workspace/imported-prompts.json`.

O agente chama a API por você e responde com diagrama ASCII (checkpoints, milestones, features, tasks, projects, pendências).

Tudo sobre API, pendências e planejamento está na skill — sem bootstrap manual.
