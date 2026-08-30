# 🔧 Manual Fix: Update System Modules

## Problema
Os módulos no banco de dados ainda não têm os nomes PRO™ e podem estar incompletos.

## Solução

### Opção 1: Usar o Supabase Dashboard (Recomendado - 2 minutos)

1. **Abra o Supabase Dashboard**
   - Vá para: https://app.supabase.com
   - Faça login e selecione seu projeto

2. **Abra o SQL Editor**
   - Clique em "SQL Editor" no menu lateral esquerdo
   - Clique em "+ New Query"

3. **Cole o Script**
   - Abra o arquivo: `supabase/manual-fixes/fix_modules_20260217.sql`
   - Copie TODO o conteúdo
   - Cole no SQL Editor do Supabase

4. **Execute**
   - Clique no botão "Execute" (▶️) ou "Run"
   - Aguarde a conclusão

5. **Verifique**
   - Você deve ver a mensagem: "12 rows inserted"
   - A query de verificação no final deve mostrar todos os 12 módulos com nomes corretos

### Opção 2: Usar a Migration (Automático no Deploy)

Se você está usando `supabase db push`:

```bash
supabase db push
```

Isto aplicará automaticamente a migration: `20260217112955_add_pro_modules.sql`

---

## ✅ Depois de Executar

1. **Atualize o Navegador**
   ```
   Pressione Ctrl+Shift+R ou Cmd+Shift+R
   ```

2. **Verifique em Configurações → Módulos**
   - Você deve ver todos os 12 módulos listados:
     - ✅ BI PRO™
     - ✅ OMNI PRO™
     - ✅ CALL PRO™
     - ✅ SENDS PRO™
     - ✅ SCHEDULE PRO™
     - ✅ SCORE PRO™
     - ✅ AI AGENTS PRO™
     - ✅ LP PRO™
     - ✅ Negócios
     - ✅ Clientes
     - ✅ Follow-ups
     - ✅ Configurações

3. **Teste as Toggles**
   - Desative um módulo (ex: SENDS PRO™)
   - Verifique que desapareceu do menu lateral
   - Reative-o
   - Verifique que reapareceu no menu lateral

---

## 📋 O Que Mudou

| Módulo | Antes | Depois |
|--------|-------|--------|
| dashboard | "Dashboard" | "BI PRO™" |
| conversas | "Conversas" | "OMNI PRO™" |
| disparos | "Disparos" | "SENDS PRO™" |
| agendamentos | "Reuniões" | "SCHEDULE PRO™" |
| agentes-ia | "Agentes IA" | "AI AGENTS PRO™" |
| score | (novo) | "SCORE PRO™" |
| call | (novo) | "CALL PRO™" |
| lp | (novo) | "LP PRO™" |

---

## ❓ Se Algo Não Funcionar

1. **Limpe o Cache**
   ```
   Ctrl+Shift+Delete (ou Cmd+Shift+Delete no Mac)
   ```

2. **Deslogue e Faça Login Novamente**

3. **Verifique o Supabase**
   - Vá para: Supabase Dashboard → SQL Editor
   - Execute: `SELECT * FROM settings_system_modules ORDER BY ordem;`
   - Verifique que aparecem 12 linhas com dados corretos

4. **Se ainda não funcionar, execute manualmente via Supabase CLI**
   ```bash
   supabase db push --dry-run
   supabase db push
   ```

---

## 📞 Precisa de Ajuda?

Se o problema persistir:
1. Verifique o console do navegador (F12 → Console)
2. Verifique os logs do Supabase (Dashboard → Logs)
3. Confirme que a tabela `settings_system_modules` existe
4. Confirme que há permissões de SELECT no banco

---

**Última Atualização:** 2026-02-17
**Versão:** 1.0
