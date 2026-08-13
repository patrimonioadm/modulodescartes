npm # DKP · Inventário/Descartes (Supabase)

App para registrar, aprovar e reportar descartes de materiais do Deutscher Klub
Pernambuco. Frontend em React (Vite), backend em Supabase (Postgres + Auth +
Storage + 1 Edge Function).

## 1. Criar o projeto no Supabase

1. Acesse https://supabase.com → **New project**.
2. Guarde a **Project URL** e a **anon public key** (Settings → API).

## 2. Criar as tabelas e políticas de segurança

1. No painel do Supabase, abra **SQL Editor**.
2. Cole o conteúdo de `supabase/schema.sql` e execute.
   Isso cria as tabelas `profiles` e `descartes`, as regras de RLS (cada
   colaborador só vê seus próprios descartes; admins veem tudo) e o bucket
   `fotos-descartes` para as fotos dos itens.

## 3. Criar o primeiro administrador

1. Vá em **Authentication → Users → Add user**, crie com e-mail e senha.
2. Copie o UUID gerado para esse usuário.
3. No SQL Editor, rode (trocando os valores):
   ```sql
   insert into public.profiles (id, nome, email, papel, ativo)
   values ('COLE-O-UUID-AQUI', 'Seu Nome', 'seu@email.com', 'admin', true);
   ```

## 4. Publicar a Edge Function de criação de usuários

Novos usuários (depois do primeiro admin) são criados **de dentro do app**,
pela tela Usuários — isso chama uma Edge Function que roda no Supabase com
a service role key, sem nunca expor essa chave no navegador.

```bash
npm install -g supabase
supabase login
supabase link --project-ref SEU-PROJECT-REF
supabase functions deploy create-user
```

## 5. Configurar o frontend

```bash
cd dkp-app
cp .env.example .env
# edite .env com sua URL e anon key do passo 1
npm install
npm run dev
```

Acesse `http://localhost:5173` e entre com o admin criado no passo 3.

## 6. Publicar em produção

- `npm run build` gera a pasta `dist/` — pode ser publicada em Vercel,
  Netlify, Cloudflare Pages etc. Configure as mesmas variáveis de ambiente
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) no painel do provedor.
- Nenhuma chave secreta (`service_role`) fica no frontend — ela só existe
  dentro da Edge Function, no servidor do Supabase.

## O que muda em relação ao protótipo anterior

| Antes (artifact) | Agora (Supabase) |
|---|---|
| Login comparando senha em texto simples | Autenticação real via Supabase Auth (senhas com hash, sessão com token) |
| Dados em `window.storage` (armazenamento do artifact) | Postgres com Row Level Security por usuário/papel |
| Foto só por URL colada manualmente | Upload de arquivo real para o bucket `fotos-descartes` |
| Sessão perdida ao recarregar a página | Sessão persistente (Supabase mantém o token no navegador) |
| Um único artifact compartilhado por todo mundo | Projeto próprio, hospedável em qualquer domínio do clube |

## Próximos passos possíveis

- Recuperação de senha ("esqueci minha senha") via `supabase.auth.resetPasswordForEmail`.
- Exportar o relatório também em PDF/Excel (não só impressão do navegador).
- Notificação por e-mail ao aprovador quando um novo descarte é registrado
  (via Edge Function + trigger no banco).
