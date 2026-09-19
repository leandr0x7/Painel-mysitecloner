MYSITECLONER — PAINEL ADMIN ONLINE
==================================

Pasta de deploy: admin-web/
NÃO envie esta pasta no Drive / ZIP do cliente.


1) PUBLICAR NO NETLIFY (recomendado)
------------------------------------
A) Crie conta em https://www.netlify.com
B) Sites → Add new site → Deploy manually
C) Arraste a pasta inteira admin-web para a área de drop
D) Abra a URL gerada (ex.: https://nome-aleatorio.netlify.app)
E) Login com o ADMIN_API_SECRET (arquivo .env do projeto)

Opcional: Domain settings → domínio próprio.


2) OUTROS HOSTS
---------------
Qualquer host estático serve (Vercel, Cloudflare Pages, etc.):
  publish / output = pasta admin-web

VERCEL + GITHUB
---------------
A) Suba o projeto no GitHub (sem .env / secrets)
B) vercel.com → Add New Project → importe o repo
C) Root Directory: admin-web
D) Framework Preset: Other (site estático)
E) Deploy
F) Abra a URL e entre com o ADMIN_API_SECRET

NÃO coloque o Admin secret no GitHub nem em config.js.


3) USO
------
• Digite o Admin secret e Entrar
• “Ao vivo” atualiza a lista a cada 30 segundos
• Em “Criar chave”: e-mail + tipo (Teste / Mensal / Vitalício)
  – Teste: quantidade de clones
  – Mensal: 1 / 3 / 5 / 12 meses (ou dias personalizados)
  – Vitalício: ilimitado
• Copiar chave, revogar, upgrade Pro, reset de quota
• Salvar checkouts e Product IDs Cakto
• Sair limpa o secret deste navegador


4) SEGURANÇA
------------
• Não coloque o Admin secret em config.js
• robots.txt + meta noindex evitam Google (não é senha)
• Compartilhe a URL só com você / equipe de confiança
• Troque o ADMIN_API_SECRET se a URL vazar


5) LOCAL (sem Netlify)
----------------------
Abra admin-web/index.html no Chrome
ou use o painel local antigo: admin/admin.html
(fonte principal online = esta pasta admin-web)
