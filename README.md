# Solnatura — site completo e demonstração GitHub Pages

Loja exclusivamente online, em português de Portugal. Catálogo de 36 produtos, imagens tratadas, pesquisa, categorias, carrinho, páginas informativas e gestão privada de produtos, stock e pedidos.

## Mostrar ao cliente no GitHub Pages

1. Descompactar este ZIP.
2. Criar um repositório GitHub e carregar o conteúdo, mantendo a pasta `docs` na raiz.
3. Em **Settings → Pages**, selecionar **Deploy from a branch**, a branch `main` e a pasta **/docs**. Guardar.
4. Abrir o endereço que o GitHub apresentar quando terminar a publicação.

A demonstração em `docs` funciona sem backend e inclui navegação por páginas, as 36 imagens, pesquisa, filtro por categoria, fichas de produto e carrinho guardado apenas no navegador. Pode também abrir `docs/index.html` localmente.

**É uma demonstração:** não recolhe contactos, não envia pedidos e não aceita pagamentos. A gestão privada pertence à aplicação completa, não ao GitHub Pages. Não publique credenciais ou dados de clientes no repositório. As páginas legais da demonstração não substituem a identificação real da titular. `docs` não contém os registos da base de dados da loja.

## Aplicação completa

Código principal em `app`, catálogo inicial em `data`, fotografias em `public`. A aplicação completa usa React/Vinext, Cloudflare Workers, D1 e R2. **Não funciona por simples upload para cPanel/WAAC nem diretamente em GitHub Pages.** Migrar para outro alojamento exige adaptar o backend e a autenticação.

- `npm ci`: instalar dependências.
- `npx tsc --noEmit`: verificar tipos.
- `node scripts/check-shop.mjs`: testar com SQLite em memória e e-mail simulado, sem mensagens reais.
- `npm run dev`: desenvolvimento, com o ambiente e bindings locais do projeto configurados.
- `npm run build`: compilar a aplicação de servidor.
- `node scripts/build-client-demo.mjs`: regenerar a demonstração estática.

O ZIP não inclui dependências, compilações, base de dados, sessões, segredos ou credenciais Git.

## Gestão da loja completa

Abrir `/gestao` com a conta do proprietário e associar a gestão enquanto o alojamento estiver privado. A API autoriza escritas no servidor. Criar/editar/ocultar/remover produtos, recuperar removidos, atualizar stock, acompanhar pedidos e exportar CSV.

Os pedidos são pedidos de proposta sem obrigação de compra. O servidor usa os preços e a disponibilidade do catálogo; valores desconhecidos nunca são tratados como produtos gratuitos. O stock é manual e não é reservado nem descontado pela submissão. O pagamento não é cobrado pelo site.

## Antes de vender

Preencher em **Gestão → Configurações**:

- Nome legal, NIF, morada legal para correspondência e devoluções, e-mail e telefone.
- Zonas de entrega, portes e prazos reais; condições de pagamento e devolução.
- Conservação de dados, prestadores reais, Livro de Reclamações e entidade RAL aplicável.
- Rever os produtos com os rótulos/fabricantes: formatos, composição, alergénios, utilização, advertências, preços e stock; confirmar as imagens com os produtos reais e marcar a revisão do catálogo.
- Configurar `RESEND_API_KEY` e `MAIL_FROM` como segredos do alojamento, com remetente verificado, e efetuar um teste autorizado de ponta a ponta.

A receção de pedidos permanece bloqueada até a identificação/condições, a revisão do catálogo e as notificações estarem configuradas. O site mantém o público definido no alojamento; o ZIP não altera o acesso.

## Imagens e conteúdo

Imagens dos produtos tratadas a partir das publicações indicadas nas fichas do catálogo. Os chás são imagens ilustrativas de infusões, não fotografias de embalagens. As edições por IA exigem validação dos rótulos reais antes da venda. Os originais estão preservados em `public/images/instagram`, os recortes em `public/images/catalogue`. O mapeamento só substitui as imagens originais importadas; fotografias personalizadas continuam a ser usadas.

Imagens de ambiente: Unsplash. Tipos de letra: Google Fonts. Não são usados píxeis publicitários nem ferramentas de análise de visitas. Atualizar privacidade/cookies se forem introduzidos outros serviços ou se o alojamento for alterado.
