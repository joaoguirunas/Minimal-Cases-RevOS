// 55 Built-in LP templates — organized by PAGE FUNCTION, not industry niche
// factory: t(id, name, category, primaryColor, accentColor, font, layoutKey, metaTitle, metaDesc, blocks[])
const bid = () => crypto.randomUUID();

type LK = "classic"|"modern"|"minimal"|"magazine"|"bold"|"landing"|"editorial"|"agency";
type T = {
  _builtin: true; id: string; name: string; category: string; thumbnail_url: null;
  is_global: true; created_at: "";
  content: {
    meta: { title: string; description: string };
    theme: { primary_color: string; accent_color: string; font_family: string; layout_key?: LK };
    blocks: { id: string; type: string; order: number; data: Record<string, unknown> }[];
  };
};

function t(id: string, name: string, cat: string, pc: string, ac: string,
  font: string, lk: LK, title: string, desc: string,
  blocks: { type: string; data: Record<string, unknown> }[]): T {
  return {
    _builtin: true, id, name, category: cat, thumbnail_url: null, is_global: true, created_at: "",
    content: {
      meta: { title, description: desc },
      theme: { primary_color: pc, accent_color: ac, font_family: font, layout_key: lk },
      blocks: blocks.map((b, i) => ({ id: bid(), type: b.type, order: i, data: b.data })),
    },
  };
}

// Curated Unsplash images (stable, high-res)
const I = {
  dark_code:   "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1920&q=80",
  dark_space:  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1920&q=80",
  dark_city:   "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1920&q=80",
  dark_tech:   "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1920&q=80",
  dark_abs:    "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1920&q=80",
  dark_office: "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1920&q=80",
  meeting:     "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1920&q=80",
  laptop:      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1920&q=80",
  team:        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1920&q=80",
  speaker:     "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1920&q=80",
  webinar:     "https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?auto=format&fit=crop&w=1920&q=80",
  strategy:    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1920&q=80",
  growth:      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1920&q=80",
  handshake:   "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1920&q=80",
  books:       "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1920&q=80",
  phone:       "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1920&q=80",
  product:     "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1920&q=80",
  launch:      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1920&q=80",
  community:   "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1920&q=80",
  success:     "https://images.unsplash.com/photo-1552581234-26160f608093?auto=format&fit=crop&w=1920&q=80",
};

export const LP_BUILT_IN_TEMPLATES: T[] = [

  // ═══════════════════════════════════════════════════════════════════
  //  GERAÇÃO DE LEAD  (6 templates)
  // ═══════════════════════════════════════════════════════════════════

  t("lg-01","Lead Minimalista","lead_gen","#4f46e5","#7c3aed","Inter","minimal",
    "Captura de Lead","Formulário limpo e direto ao ponto.",[
    { type:"hero", data:{ headline:"Receba acesso antecipado", subheading:"Cadastre-se e seja o primeiro a saber quando abrirmos as inscrições.", cta_text:"Garantir minha vaga", bg_color:"#1e1b4b" }},
    { type:"social_proof", data:{ stats:[{value:"4.800+",label:"inscritos na lista"},{value:"48h",label:"resposta média"},{value:"100%",label:"gratuito"}]}},
    { type:"form", data:{ title:"Reserve seu lugar agora", submit_text:"Quero me inscrever" }},
  ]),

  t("lg-02","Lead Dark Pro","lead_gen","#8b5cf6","#6d28d9","Poppins","bold",
    "Captura Dark","Página de lead com visual premium escuro.",[
    { type:"hero", data:{ headline:"Transforme resultados com nossa metodologia", subheading:"Mais de 12.000 profissionais já aplicaram. Junte-se à lista exclusiva e receba o guia completo.", cta_text:"Quero o guia gratuito", bg_color:"#0f0a1e", bg_image_url: I.dark_abs }},
    { type:"features", data:{ title:"O que você vai receber", items:[{icon:"📘",title:"Guia Completo",description:"30 páginas de estratégias testadas e aprovadas."},{icon:"🎯",title:"Checklist Prático",description:"Passo a passo para aplicar amanhã mesmo."},{icon:"🔐",title:"Acesso Exclusivo",description:"Conteúdo disponível apenas para inscritos."}], columns:3 }},
    { type:"form", data:{ title:"Inscreva-se gratuitamente", submit_text:"Quero acesso agora" }},
  ]),

  t("lg-03","Lead Agência","lead_gen","#f59e0b","#d97706","Montserrat","agency",
    "Lead Agência","Layout bold de agência para captura de leads.",[
    { type:"hero", data:{ headline:"Você merece resultados reais", subheading:"Não mais promessas. Apenas estratégia, execução e crescimento mensurável.", cta_text:"Falar com especialista", bg_color:"#1c1917", bg_image_url: I.dark_office }},
    { type:"features", data:{ title:"Por que nós?", items:[{icon:"⚡",title:"Resultados rápidos",description:"Primeiros resultados em até 30 dias."},{icon:"📊",title:"Métricas claras",description:"Dashboard em tempo real com todos os KPIs."},{icon:"🤝",title:"Parceria de verdade",description:"Time dedicado ao seu crescimento."}], columns:3 }},
    { type:"testimonials_grid", data:{ title:"Clientes que já cresceram", items:[{quote:"Em 60 dias dobramos o número de leads qualificados.",author_name:"Rafael Costa",author_role:"CEO, TechStart",rating:5},{quote:"A metodologia é diferente de tudo que já vi. Recomendo.",author_name:"Fernanda Lima",author_role:"CMO, Loja X",rating:5},{quote:"ROI positivo no primeiro mês. Impressionante.",author_name:"Bruno Alves",author_role:"Fundador, App Pro",rating:5}]}},
    { type:"form", data:{ title:"Diagnóstico gratuito", submit_text:"Quero meu diagnóstico" }},
  ]),

  t("lg-04","Lead com Prova Social","lead_gen","#0891b2","#0e7490","DM Sans","modern",
    "Lead Social Proof","Captura de lead com forte prova social.",[
    { type:"hero", data:{ headline:"A lista que 9.400 profissionais leem toda semana", subheading:"Insights práticos sobre crescimento, vendas e tecnologia. Grátis, direto no seu e-mail.", cta_text:"Assinar a newsletter", bg_color:"#0c4a6e", bg_image_url: I.growth }},
    { type:"social_proof", data:{ stats:[{value:"9.400+",label:"assinantes"},{value:"4.9★",label:"avaliação média"},{value:"2x",label:"por semana"}]}},
    { type:"form", data:{ title:"Comece a receber hoje", submit_text:"Assinar grátis" }},
  ]),

  t("lg-05","Lead Vídeo","lead_gen","#dc2626","#b91c1c","Inter","landing",
    "Lead Vídeo","Captura com vídeo de apresentação.",[
    { type:"hero", data:{ headline:"Assista e entenda por que 5.000+ empresas confiam em nós", subheading:"Um vídeo de 3 minutos que vai mudar como você pensa sobre geração de leads.", cta_text:"Ver o vídeo agora", bg_color:"#1a0505", bg_image_url: I.dark_city }},
    { type:"video", data:{ title:"Veja como funciona", video_url:"https://www.youtube.com/embed/dQw4w9WgXcQ", description:"3 minutos que vão transformar sua geração de leads." }},
    { type:"form", data:{ title:"Garanta seu acesso gratuito", submit_text:"Quero começar" }},
  ]),

  t("lg-06","Lead Magazine","lead_gen","#374151","#111827","Lato","magazine",
    "Lead Editorial","Layout editorial elegante para captura.",[
    { type:"hero", data:{ headline:"O guia definitivo de growth para 2025", subheading:"Pesquisa exclusiva com 500 líderes de crescimento. Baixe gratuitamente.", cta_text:"Baixar pesquisa", bg_color:"#111827", bg_image_url: I.books }},
    { type:"features", data:{ title:"O que você vai descobrir", items:[{icon:"📈",title:"Tendências 2025",description:"Os canais que vão dominar nos próximos 12 meses."},{icon:"💡",title:"Estratégias testadas",description:"Cases reais de empresas que cresceram 10x."},{icon:"🔢",title:"Benchmarks do setor",description:"Compare sua empresa com as melhores do mercado."}], columns:3 }},
    { type:"form", data:{ title:"Baixar a pesquisa gratuita", submit_text:"Quero a pesquisa" }},
  ]),

  // ═══════════════════════════════════════════════════════════════════
  //  APRESENTAÇÃO DE PRODUTO  (5 templates)
  // ═══════════════════════════════════════════════════════════════════

  t("ps-01","Apple Style","product_showcase","#000000","#1d1d1f","Inter","bold",
    "Produto Premium","Layout minimalista estilo Apple para apresentar produto.",[
    { type:"hero", data:{ headline:"Redesigned. Reimagined. Revolutionary.", subheading:"O próximo nível chegou. Potência que você sente. Design que você não esquece.", cta_text:"Conheça agora", bg_color:"#000000" }},
    { type:"features", data:{ title:"Engenharia de alto desempenho", items:[{icon:"⚡",title:"10x mais rápido",description:"Processamento que redefine o que é possível."},{icon:"🔋",title:"48h de bateria",description:"Nunca mais se preocupe com energia."},{icon:"🎯",title:"Precisão cirúrgica",description:"Tecnologia que antecipa cada movimento seu."}], columns:3 }},
    { type:"headline", data:{ title:"Feito para quem não aceita menos que o melhor.", align:"center" }},
    { type:"cta", data:{ headline:"Disponível agora", subheadline:"Frete grátis para todo o Brasil. Garantia de 2 anos.", cta_text:"Comprar agora", secondary_cta_text:"Ver especificações" }},
  ]),

  t("ps-02","SaaS Moderno","product_showcase","#2563eb","#1d4ed8","Inter","modern",
    "SaaS Landing","Landing page moderna para produto SaaS.",[
    { type:"hero", data:{ headline:"Escale seu negócio sem escalar sua equipe", subheading:"Automatize processos, centralize dados e tome decisões com confiança. Tudo em uma plataforma.", cta_text:"Começar grátis", bg_color:"#0f2460", bg_image_url: I.laptop }},
    { type:"social_proof", data:{ stats:[{value:"12.000+",label:"empresas ativas"},{value:"99.9%",label:"uptime garantido"},{value:"4.8★",label:"nota no G2"}]}},
    { type:"features", data:{ title:"Tudo que você precisa", items:[{icon:"🤖",title:"Automação inteligente",description:"Workflows que rodam 24/7 sem intervenção humana."},{icon:"📊",title:"Analytics em tempo real",description:"Dashboards completos com todos os seus KPIs."},{icon:"🔗",title:"+200 integrações",description:"Conecte com as ferramentas que já usa."}], columns:3 }},
    { type:"comparison_table", data:{ title:"Compare os planos", columns:[{name:"Starter",highlighted:false},{name:"Pro",highlighted:true},{name:"Enterprise",highlighted:false}], rows:[{feature:"Usuários",values:["3","Ilimitado","Ilimitado"]},{feature:"Automações/mês",values:["1.000","50.000","Ilimitado"]},{feature:"Integrações",values:["10","50","Ilimitado"]},{feature:"Suporte",values:["Email","Chat 24/7","Dedicado"]},{feature:"API",values:["—","✓","✓"]}]}},
    { type:"cta", data:{ headline:"14 dias grátis, sem cartão", cta_text:"Criar conta grátis", secondary_cta_text:"Ver demo" }},
  ]),

  t("ps-03","Developer Tool","product_showcase","#10b981","#059669","DM Sans","bold",
    "Dev Tool","Página estilo Linear/Vercel para ferramentas de dev.",[
    { type:"hero", data:{ headline:"Ship faster. Break nothing.", subheading:"A plataforma que os melhores times de engenharia do mundo escolheram. Deploy em segundos, rollback em um clique.", cta_text:"Get started free", bg_color:"#000000", bg_image_url: I.dark_code }},
    { type:"features", data:{ title:"Built for scale", items:[{icon:"🚀",title:"Deploy in seconds",description:"Push to main and it's live. Zero configuration needed."},{icon:"🔄",title:"Instant rollbacks",description:"One click to go back. Always."},{icon:"🌍",title:"Global edge network",description:"50ms anywhere in the world."}], columns:3 }},
    { type:"tabs", data:{ title:"One platform, every use case", items:[{label:"Frontend",title:"Deploy frontend apps instantly",description:"React, Next.js, Nuxt, Svelte — automatic build detection and optimization.",features:["Automatic SSL","CDN caching","Preview URLs"]},{label:"Backend",title:"Scale APIs without ops",description:"Serverless functions with auto-scaling and zero cold starts.",features:["Node, Python, Go","Auto-scaling","Built-in monitoring"]},{label:"Database",title:"Managed databases",description:"Postgres, Redis, and more — fully managed, always backed up.",features:["Point-in-time recovery","Read replicas","99.99% SLA"]}]}},
    { type:"cta", data:{ headline:"Free for hobbyists. Predictable pricing for teams.", cta_text:"Deploy your first project", secondary_cta_text:"Read docs" }},
  ]),

  t("ps-04","App Mobile","product_showcase","#ec4899","#db2777","Poppins","landing",
    "App Mobile","Página de apresentação de app mobile.",[
    { type:"hero", data:{ headline:"O app que vai mudar sua rotina", subheading:"Mais de 500.000 downloads. Avaliação 4.9 na App Store. Descubra por que todo mundo está falando.", cta_text:"Baixar grátis", bg_color:"#4a0028", bg_image_url: I.phone }},
    { type:"features", data:{ title:"Recursos que fazem a diferença", items:[{icon:"⚡",title:"Ultra rápido",description:"Interface fluida mesmo em conexões lentas."},{icon:"🎨",title:"Personalizável",description:"Configure tudo do jeito que você prefere."},{icon:"🔔",title:"Notificações inteligentes",description:"Alertas quando você realmente precisa."}], columns:3 }},
    { type:"social_proof", data:{ stats:[{value:"500k+",label:"downloads"},{value:"4.9★",label:"App Store"},{value:"98%",label:"satisfação"}]}},
    { type:"cta", data:{ headline:"Disponível para iOS e Android", cta_text:"App Store", secondary_cta_text:"Google Play" }},
  ]),

  t("ps-05","Enterprise B2B","product_showcase","#374151","#1f2937","Inter","agency",
    "Enterprise","Página B2B para produto enterprise.",[
    { type:"hero", data:{ headline:"A plataforma que líderes escolhem", subheading:"Fortune 500 companies rely on us. Security-first. Compliance-ready. Enterprise support included.", cta_text:"Solicitar demo", bg_color:"#0f172a", bg_image_url: I.dark_office }},
    { type:"logo_bar", data:{ title:"Empresas que confiam", logos:[{name:"Company A"},{name:"Company B"},{name:"Company C"},{name:"Company D"},{name:"Company E"}]}},
    { type:"features", data:{ title:"Enterprise-grade desde o dia 1", items:[{icon:"🔒",title:"SOC 2 Certificado",description:"Segurança auditada. Dados sempre protegidos."},{icon:"📋",title:"SLA garantido",description:"99.99% uptime. Penalidades contratuais se não cumprirmos."},{icon:"👥",title:"Customer Success",description:"Gerente dedicado do onboarding ao sucesso."}], columns:3 }},
    { type:"form", data:{ title:"Fale com nosso time comercial", submit_text:"Solicitar proposta personalizada" }},
  ]),

  // ═══════════════════════════════════════════════════════════════════
  //  MATERIAL RICO  (4 templates)
  // ═══════════════════════════════════════════════════════════════════

  t("rm-01","eBook Download","rich_material","#7c3aed","#6d28d9","Poppins","modern",
    "Download eBook","Página para baixar eBook ou guia.",[
    { type:"hero", data:{ headline:"Baixe grátis: O Guia Definitivo de [Tema]", subheading:"47 páginas de estratégias comprovadas. Baixado por mais de 8.000 profissionais.", cta_text:"Baixar agora", bg_color:"#2e1065", bg_image_url: I.books }},
    { type:"features", data:{ title:"O que você vai aprender", items:[{icon:"📌",title:"Capítulo 1: Fundamentos",description:"Bases sólidas que ninguém te contou."},{icon:"🎯",title:"Capítulo 2: Estratégia",description:"Como montar seu plano de ação."},{icon:"📈",title:"Capítulo 3: Escala",description:"De 0 a resultados consistentes."}], columns:3 }},
    { type:"form", data:{ title:"Receber o eBook gratuito", submit_text:"Baixar agora" }},
  ]),

  t("rm-02","Whitepaper B2B","rich_material","#1d4ed8","#1e40af","Inter","editorial",
    "Whitepaper","Página para whitepaper ou research report.",[
    { type:"hero", data:{ headline:"Research Report 2025: O Estado do Mercado Brasileiro", subheading:"Dados de 1.200 empresas. Análise exclusiva com benchmarks, tendências e previsões.", cta_text:"Baixar relatório", bg_color:"#1e3a5f", bg_image_url: I.strategy }},
    { type:"features", data:{ title:"Destaques do relatório", items:[{icon:"📊",title:"120+ métricas",description:"Benchmarks completos por setor e porte de empresa."},{icon:"💡",title:"10 tendências",description:"O que esperar dos próximos 18 meses."},{icon:"🗺️",title:"Roadmap estratégico",description:"Prioridades de investimento recomendadas."}], columns:3 }},
    { type:"form", data:{ title:"Baixar o relatório completo", submit_text:"Acessar relatório" }},
  ]),

  t("rm-03","Checklist Prático","rich_material","#059669","#047857","DM Sans","minimal",
    "Checklist","Página para checklist ou template download.",[
    { type:"hero", data:{ headline:"Checklist: 50 itens para [objetivo]", subheading:"O checklist que profissionais usam para garantir resultados. Simples, direto e prático.", cta_text:"Baixar checklist", bg_color:"#022c22" }},
    { type:"steps", data:{ title:"Como usar", items:[{title:"Baixe o checklist",description:"Clique no botão e receba no seu e-mail em segundos."},{title:"Aplique em ordem",description:"Cada item está em ordem de prioridade e impacto."},{title:"Acompanhe o progresso",description:"Marque cada item conforme avança."}]}},
    { type:"form", data:{ title:"Receber o checklist gratuito", submit_text:"Baixar agora" }},
  ]),

  t("rm-04","Template Pack","rich_material","#f59e0b","#d97706","Montserrat","modern",
    "Templates","Página para pack de templates ou ferramentas.",[
    { type:"hero", data:{ headline:"Pack com 25 Templates Prontos para [Área]", subheading:"Economize horas de trabalho. Templates profissionais usados por +3.000 equipes.", cta_text:"Baixar pack grátis", bg_color:"#451a03", bg_image_url: I.laptop }},
    { type:"features", data:{ title:"O que está incluído", items:[{icon:"📑",title:"25 templates editáveis",description:"Formato Word, Google Docs e Notion."},{icon:"🎨",title:"Guia visual",description:"Como personalizar cada template rapidamente."},{icon:"🔄",title:"Atualizações incluídas",description:"Novos templates adicionados todo mês."}], columns:3 }},
    { type:"form", data:{ title:"Quero meu pack gratuito", submit_text:"Baixar templates" }},
  ]),

  // ═══════════════════════════════════════════════════════════════════
  //  AGENDAR REUNIÃO  (4 templates)
  // ═══════════════════════════════════════════════════════════════════

  t("bm-01","Consulta Executiva","book_meeting","#111827","#374151","Inter","bold",
    "Reunião Executiva","Página premium para agendar reunião executiva.",[
    { type:"hero", data:{ headline:"Reserve 30 minutos. Transforme sua empresa.", subheading:"Uma conversa direta com nosso time sênior. Sem pitch. Só diagnóstico e orientação.", cta_text:"Agendar agora", bg_color:"#000000", bg_image_url: I.meeting }},
    { type:"features", data:{ title:"O que esperar da reunião", items:[{icon:"🔍",title:"Diagnóstico real",description:"Análise honesta da sua situação atual."},{icon:"🗺️",title:"Plano de ação",description:"Próximos passos claros e priorizados."},{icon:"💬",title:"Sem compromisso",description:"Uma conversa, sem pressão de venda."}], columns:3 }},
    { type:"form", data:{ title:"Agendar reunião gratuita", submit_text:"Confirmar agendamento" }},
  ]),

  t("bm-02","Consulta Gratuita","book_meeting","#2563eb","#1d4ed8","Poppins","landing",
    "Consulta Grátis","Agendamento de consulta gratuita, tom amigável.",[
    { type:"hero", data:{ headline:"Sua primeira consulta é por nossa conta", subheading:"45 minutos de atenção 100% dedicada ao seu negócio. Sem compromisso. Sem custo.", cta_text:"Agendar minha consulta", bg_color:"#0c1a4a", bg_image_url: I.handshake }},
    { type:"steps", data:{ title:"É muito simples", items:[{title:"Escolha um horário",description:"Selecione o dia e horário que melhor se encaixa na sua agenda."},{title:"Confirme seus dados",description:"Nome, e-mail e o que você espera da conversa."},{title:"Participe da reunião",description:"Link enviado automaticamente por e-mail. Apareça na hora."}]}},
    { type:"form", data:{ title:"Agendar consulta gratuita", submit_text:"Quero agendar" }},
  ]),

  t("bm-03","Sessão Estratégica","book_meeting","#7c3aed","#6d28d9","Montserrat","agency",
    "Sessão Estratégica","Página para agendar sessão de estratégia.",[
    { type:"hero", data:{ headline:"Sessão estratégica de 60 minutos", subheading:"Para líderes que querem clareza sobre próximos passos. Limitado a 5 vagas por semana.", cta_text:"Ver disponibilidade", bg_color:"#1e0038", bg_image_url: I.dark_abs }},
    { type:"social_proof", data:{ stats:[{value:"500+",label:"sessões realizadas"},{value:"92%",label:"recomendam"},{value:"5★",label:"avaliação média"}]}},
    { type:"testimonials_grid", data:{ title:"O que dizem após a sessão", items:[{quote:"Em 60 minutos ficou mais claro do que em anos de consultoria.",author_name:"Marcelo Torres",author_role:"CEO",rating:5},{quote:"Saí com um plano de ação real e executável. Valeu cada minuto.",author_name:"Ana Paula",author_role:"Diretora Comercial",rating:5},{quote:"A melhor hora que já investi no meu negócio.",author_name:"Lucas Ramos",author_role:"Fundador",rating:5}]}},
    { type:"form", data:{ title:"Reservar minha sessão", submit_text:"Quero agendar" }},
  ]),

  t("bm-04","Discovery Call","book_meeting","#0891b2","#0e7490","DM Sans","minimal",
    "Discovery Call","Página minimalista para discovery call.",[
    { type:"hero", data:{ headline:"Vamos entender o que você precisa", subheading:"Uma call de 20 minutos para descobrirmos como podemos ajudar. Sem pitch.", cta_text:"Agendar call", bg_color:"#0c4a6e" }},
    { type:"features", data:{ title:"O que acontece na call", items:[{icon:"👂",title:"Ouvimos você",description:"Entendemos seu contexto e desafios atuais."},{icon:"💡",title:"Avaliamos juntos",description:"Identificamos se e como podemos ajudar."},{icon:"📋",title:"Próximos passos",description:"Saindo com clareza sobre o caminho."}], columns:3 }},
    { type:"form", data:{ title:"Agendar minha discovery call", submit_text:"Agendar agora" }},
  ]),

  // ═══════════════════════════════════════════════════════════════════
  //  WEBINAR / EVENTO  (4 templates)
  // ═══════════════════════════════════════════════════════════════════

  t("wb-01","Webinar Live","webinar","#dc2626","#b91c1c","Inter","bold",
    "Webinar","Inscrição para webinar ao vivo com countdown.",[
    { type:"hero", data:{ headline:"Webinar Gratuito: [Título do Evento]", subheading:"Ao vivo, online, 100% gratuito. Quinta-feira, 19h. Vagas limitadas.", cta_text:"Garantir minha vaga", bg_color:"#1a0505", bg_image_url: I.webinar }},
    { type:"countdown", data:{ title:"O evento começa em:", target_date:"2025-06-15T19:00:00", cta_text:"Inscrever-me agora" }},
    { type:"features", data:{ title:"O que você vai aprender", items:[{icon:"🎯",title:"Estratégia",description:"Como montar um plano de ação completo em 1 hora."},{icon:"🔧",title:"Ferramentas",description:"As ferramentas que os top 1% usam e você não conhece."},{icon:"💡",title:"Cases reais",description:"Exemplos de empresas que aplicaram e cresceram."}], columns:3 }},
    { type:"form", data:{ title:"Inscrição gratuita", submit_text:"Reservar minha vaga" }},
  ]),

  t("wb-02","Masterclass","webinar","#7c3aed","#6d28d9","Poppins","editorial",
    "Masterclass","Inscrição para masterclass premium.",[
    { type:"hero", data:{ headline:"Masterclass: Domine [Habilidade] em 3 horas", subheading:"Aula ao vivo com o especialista que formou +2.000 profissionais. Certificado incluso.", cta_text:"Inscrever na masterclass", bg_color:"#1e0038", bg_image_url: I.speaker }},
    { type:"features", data:{ title:"O programa completo", items:[{icon:"1️⃣",title:"Bloco 1 (1h)",description:"Fundamentos e framework principal."},{icon:"2️⃣",title:"Bloco 2 (1h)",description:"Aplicação prática com exercícios ao vivo."},{icon:"3️⃣",title:"Bloco 3 (1h)",description:"Casos de uso e Q&A com o especialista."}], columns:3 }},
    { type:"social_proof", data:{ stats:[{value:"2.000+",label:"alunos formados"},{value:"4.9★",label:"avaliação"},{value:"100%",label:"online ao vivo"}]}},
    { type:"form", data:{ title:"Inscrição na masterclass", submit_text:"Quero minha vaga" }},
  ]),

  t("wb-03","Summit Online","webinar","#0891b2","#0e7490","Montserrat","modern",
    "Summit","Registro para summit ou conferência online.",[
    { type:"hero", data:{ headline:"[Nome] Summit 2025", subheading:"2 dias. 15 palestrantes. 1 ingresso gratuito. O maior evento online do ano da área.", cta_text:"Garantir ingresso grátis", bg_color:"#0c2a40", bg_image_url: I.speaker }},
    { type:"features", data:{ title:"O que esperar", items:[{icon:"🎤",title:"15 palestrantes",description:"Líderes e especialistas de empresas referências."},{icon:"📆",title:"2 dias de conteúdo",description:"Mais de 12 horas de palestras e painéis."},{icon:"🏆",title:"Certificado",description:"Certificado de participação para todos os inscritos."}], columns:3 }},
    { type:"form", data:{ title:"Garantir ingresso gratuito", submit_text:"Quero meu ingresso" }},
  ]),

  t("wb-04","Workshop Prático","webinar","#059669","#047857","DM Sans","landing",
    "Workshop","Inscrição para workshop prático.",[
    { type:"hero", data:{ headline:"Workshop ao Vivo: [Entregável em 1 dia]", subheading:"8 horas de prática intensa. Você sai com [resultado tangível] pronto. Turma limitada.", cta_text:"Inscrever no workshop", bg_color:"#022c22", bg_image_url: I.team }},
    { type:"steps", data:{ title:"A jornada do workshop", items:[{title:"Manhã: Fundamentos",description:"9h–12h: Teoria essencial e estruturação do projeto."},{title:"Tarde: Execução",description:"13h–17h: Hands-on com feedback em tempo real."},{title:"Fechamento",description:"17h–18h: Apresentação dos resultados e próximos passos."}]}},
    { type:"form", data:{ title:"Garantir minha vaga no workshop", submit_text:"Me inscrever" }},
  ]),

  // ═══════════════════════════════════════════════════════════════════
  //  DEMO / TRIAL  (4 templates)
  // ═══════════════════════════════════════════════════════════════════

  t("dt-01","Free Trial SaaS","demo_trial","#2563eb","#1d4ed8","Inter","modern",
    "Free Trial","Página de conversão para trial gratuito.",[
    { type:"hero", data:{ headline:"14 dias grátis. Sem cartão de crédito.", subheading:"Experimente todas as funcionalidades sem compromisso. Configure em menos de 5 minutos.", cta_text:"Começar trial gratuito", bg_color:"#0f172a", bg_image_url: I.laptop }},
    { type:"features", data:{ title:"Tudo incluído no trial", items:[{icon:"✅",title:"Todas as funcionalidades",description:"Acesso completo ao plano Pro durante 14 dias."},{icon:"🔧",title:"Suporte prioritário",description:"Time disponível para te ajudar a começar."},{icon:"🚀",title:"Onboarding guiado",description:"Do zero ao primeiro resultado em 30 minutos."}], columns:3 }},
    { type:"faq", data:{ title:"Perguntas frequentes", items:[{question:"Preciso de cartão?",answer:"Não. O trial de 14 dias é totalmente gratuito, sem precisar de cartão."},{question:"O que acontece após 14 dias?",answer:"Você escolhe um plano ou sua conta fica em modo leitura. Sem cobranças automáticas."},{question:"Posso cancelar?",answer:"Sim, a qualquer momento. Sem multa, sem burocracia."}]}},
    { type:"cta", data:{ headline:"Pronto para começar?", cta_text:"Criar conta grátis", secondary_cta_text:"Ver demonstração" }},
  ]),

  t("dt-02","Demo Request","demo_trial","#7c3aed","#6d28d9","Poppins","agency",
    "Demo Request","Solicitação de demonstração personalizada.",[
    { type:"hero", data:{ headline:"Veja na prática, com seus dados", subheading:"Uma demonstração personalizada de 30 minutos com um especialista do produto. Ao vivo.", cta_text:"Solicitar demo personalizada", bg_color:"#1e0038", bg_image_url: I.dark_abs }},
    { type:"features", data:{ title:"O que você vai ver na demo", items:[{icon:"🎯",title:"Seu caso de uso",description:"Mostramos exatamente como resolver seus desafios específicos."},{icon:"⚙️",title:"Configuração ao vivo",description:"Setup do ambiente em tempo real, do zero."},{icon:"❓",title:"Q&A sem limites",description:"Tire todas as dúvidas com um especialista técnico."}], columns:3 }},
    { type:"form", data:{ title:"Agendar demonstração", submit_text:"Quero minha demo" }},
  ]),

  t("dt-03","Beta Access","demo_trial","#10b981","#059669","DM Sans","bold",
    "Beta","Página de acesso beta para produto em desenvolvimento.",[
    { type:"hero", data:{ headline:"Early access. Limited spots.", subheading:"We're letting in 500 early adopters before the public launch. You shape the product.", cta_text:"Request beta access", bg_color:"#000000", bg_image_url: I.dark_code }},
    { type:"features", data:{ title:"Beta member benefits", items:[{icon:"🏷️",title:"Lifetime discount",description:"60% off forever, locked in for beta users."},{icon:"🎤",title:"Direct feedback channel",description:"Weekly calls with the founding team."},{icon:"⭐",title:"Founding member badge",description:"Permanent recognition in the product."}], columns:3 }},
    { type:"form", data:{ title:"Apply for beta access", submit_text:"Request access" }},
  ]),

  t("dt-04","Prova de Conceito","demo_trial","#374151","#1f2937","Inter","minimal",
    "PoC / Piloto","Página para proposta de prova de conceito ou piloto.",[
    { type:"hero", data:{ headline:"Prove o valor antes de assinar", subheading:"Piloto de 30 dias com implementação completa. Métricas claras de sucesso definidas no dia 1.", cta_text:"Propor um piloto", bg_color:"#111827" }},
    { type:"steps", data:{ title:"Como funciona o piloto", items:[{title:"Semana 1: Kick-off",description:"Definição de objetivos, métricas de sucesso e setup."},{title:"Semanas 2–4: Execução",description:"Implementação completa com suporte dedicado."},{title:"Semana 4: Review",description:"Análise dos resultados e decisão baseada em dados."}]}},
    { type:"form", data:{ title:"Solicitar proposta de piloto", submit_text:"Quero proposta de piloto" }},
  ]),

  // ═══════════════════════════════════════════════════════════════════
  //  PREÇOS / PROPOSTA  (4 templates)
  // ═══════════════════════════════════════════════════════════════════

  t("pr-01","Pricing SaaS","pricing","#2563eb","#1d4ed8","Inter","modern",
    "Preços SaaS","Página de preços com 3 planos.",[
    { type:"hero", data:{ headline:"Preços simples e transparentes", subheading:"Sem taxas ocultas. Cancele quando quiser. Escale conforme crescer.", bg_color:"#0f1a3a" }},
    { type:"pricing", data:{ title:"Escolha o plano ideal", plans:[{name:"Starter",price:"R$ 97",period:"/mês",features:["Até 3 usuários","1.000 operações/mês","Suporte por email","5 integrações"],cta_text:"Começar grátis",highlighted:false},{name:"Growth",price:"R$ 297",period:"/mês",features:["Até 15 usuários","Ilimitado operações","Suporte chat 24/7","Integrações ilimitadas","Analytics avançado"],cta_text:"Começar agora",highlighted:true},{name:"Enterprise",price:"Sob consulta",period:"",features:["Usuários ilimitados","SLA garantido","Gerente dedicado","API customizada","On-premise disponível"],cta_text:"Falar com vendas",highlighted:false}]}},
    { type:"faq", data:{ title:"Dúvidas sobre preços", items:[{question:"Posso mudar de plano?",answer:"Sim, upgrade e downgrade a qualquer momento. Cobrança proporcional."},{question:"Há contrato de fidelidade?",answer:"Não. Todos os planos são mensais e podem ser cancelados a qualquer momento."},{question:"Aceitam pagamento anual?",answer:"Sim. Planos anuais têm 20% de desconto."}]}},
  ]),

  t("pr-02","Proposta Enterprise","pricing","#111827","#374151","Inter","bold",
    "Proposta Enterprise","Página de proposta para clientes enterprise.",[
    { type:"hero", data:{ headline:"Proposta personalizada para [Empresa]", subheading:"Construímos soluções sob medida para empresas que precisam de mais do que um produto padrão.", cta_text:"Falar com consultores", bg_color:"#000000", bg_image_url: I.dark_office }},
    { type:"features", data:{ title:"O que está incluído", items:[{icon:"🏗️",title:"Implementação dedicada",description:"Time técnico alocado exclusivamente para o seu projeto."},{icon:"📋",title:"SLA personalizado",description:"Métricas de desempenho definidas em contrato."},{icon:"🔐",title:"Segurança enterprise",description:"SSO, SAML, auditoria completa e compliance LGPD/GDPR."}], columns:3 }},
    { type:"form", data:{ title:"Solicitar proposta personalizada", submit_text:"Quero minha proposta" }},
  ]),

  t("pr-03","Planos Consultoria","pricing","#7c3aed","#6d28d9","Poppins","agency",
    "Planos Serviço","Pricing para serviço de consultoria.",[
    { type:"hero", data:{ headline:"Escolha como quer trabalhar conosco", subheading:"Três formas de engajamento, todas com foco em resultado mensurável.", bg_color:"#1e0038" }},
    { type:"pricing", data:{ title:"Modelos de engajamento", plans:[{name:"Hora Avulsa",price:"R$ 350",period:"/hora",features:["Reunião ou consultoria pontual","Gravação disponível","Resumo executivo","Ideal para dúvidas específicas"],cta_text:"Agendar hora",highlighted:false},{name:"Retainer Mensal",price:"R$ 2.800",period:"/mês",features:["10h/mês de consultoria","Disponibilidade WhatsApp","Review mensal de métricas","Roadmap estratégico"],cta_text:"Contratar agora",highlighted:true},{name:"Projeto Full",price:"Sob proposta",period:"",features:["Escopo definido juntos","Time dedicado","Entrega com garantia","Suporte pós-projeto"],cta_text:"Ver proposta",highlighted:false}]}},
    { type:"cta", data:{ headline:"Não sabe qual escolher?", subheadline:"Fale conosco e entendemos juntos.", cta_text:"Falar com consultor" }},
  ]),

  t("pr-04","Investimento Transparente","pricing","#059669","#047857","DM Sans","minimal",
    "Proposta Transparente","Página de preços com foco em ROI e transparência.",[
    { type:"hero", data:{ headline:"Investimento com retorno garantido", subheading:"Preços claros, escopo definido e contrato justo. Sem surpresas.", bg_color:"#022c22" }},
    { type:"features", data:{ title:"Nossa garantia", items:[{icon:"📊",title:"ROI em 90 dias",description:"Se não atingirmos as metas acordadas, devolvemos 100%."},{icon:"🔄",title:"Escopo flexível",description:"Ajustamos o plano conforme o negócio evolui."},{icon:"💬",title:"Comunicação semanal",description:"Updates semanais com dados, não desculpas."}], columns:3 }},
    { type:"form", data:{ title:"Solicitar proposta", submit_text:"Quero ver números" }},
  ]),

  // ═══════════════════════════════════════════════════════════════════
  //  LANÇAMENTO  (4 templates)
  // ═══════════════════════════════════════════════════════════════════

  t("la-01","Lançamento com Countdown","launch","#dc2626","#b91c1c","Montserrat","bold",
    "Lançamento","Página de lançamento com countdown e urgência.",[
    { type:"hero", data:{ headline:"O lançamento mais esperado do ano chegou", subheading:"Abertura das inscrições em breve. Acesso antecipado com 40% de desconto para os primeiros 100.", cta_text:"Entrar na lista VIP", bg_color:"#1a0505", bg_image_url: I.launch }},
    { type:"countdown", data:{ title:"Inscrições abrem em:", target_date:"2025-07-01T08:00:00", cta_text:"Garantir acesso antecipado" }},
    { type:"features", data:{ title:"Por que entrar na lista?", items:[{icon:"💰",title:"40% de desconto",description:"Preço exclusivo apenas para quem se inscreveu antes."},{icon:"⭐",title:"Bônus especiais",description:"Conteúdos extras que não serão vendidos separadamente."},{icon:"🔐",title:"Acesso prioritário",description:"Você entra antes de todo mundo. Sem filas."}], columns:3 }},
    { type:"form", data:{ title:"Entrar na lista de acesso antecipado", submit_text:"Quero acesso VIP" }},
  ]),

  t("la-02","Coming Soon Minimal","launch","#4f46e5","#7c3aed","Inter","minimal",
    "Coming Soon","Página de em breve minimalista.",[
    { type:"hero", data:{ headline:"Algo grande está chegando.", subheading:"Estamos construindo algo que vai mudar como você trabalha. Seja o primeiro a saber.", cta_text:"Avisar quando lançar", bg_color:"#0f0a2e" }},
    { type:"form", data:{ title:"Cadastre-se para acesso antecipado", submit_text:"Quero ser avisado" }},
  ]),

  t("la-03","Beta Launch","launch","#10b981","#059669","DM Sans","bold",
    "Beta Launch","Lançamento de produto em beta.",[
    { type:"hero", data:{ headline:"We just launched. Join 200 early users.", subheading:"Built in public. Shipping fast. Your feedback shapes everything.", cta_text:"Join beta now", bg_color:"#000000", bg_image_url: I.dark_code }},
    { type:"features", data:{ title:"What's in the beta", items:[{icon:"🚀",title:"Core features",description:"Everything you need to get started and see value."},{icon:"🔧",title:"Raw but functional",description:"We ship, you use, we improve together."},{icon:"💬",title:"Direct line to founders",description:"Chat with us anytime. We actually respond."}], columns:3 }},
    { type:"form", data:{ title:"Join the beta", submit_text:"Get beta access" }},
  ]),

  t("la-04","Acesso Exclusivo","launch","#f59e0b","#d97706","Poppins","agency",
    "Exclusividade","Página de lançamento com foco em exclusividade.",[
    { type:"hero", data:{ headline:"Apenas 50 vagas disponíveis", subheading:"Um programa criado para quem está pronto para dar o próximo salto. Exclusivo. Limitado. Diferente.", cta_text:"Solicitar uma vaga", bg_color:"#1c0e00", bg_image_url: I.dark_abs }},
    { type:"social_proof", data:{ stats:[{value:"50",label:"vagas totais"},{value:"12",label:"já preenchidas"},{value:"100%",label:"edições anteriores lotadas"}]}},
    { type:"testimonials_grid", data:{ title:"Quem já participou diz:", items:[{quote:"A decisão mais acertada que tomei no ano. Impacto imediato nos resultados.",author_name:"Paulo Mendes",author_role:"Empreendedor",rating:5},{quote:"Valeu cada centavo. O acesso à rede sozinho já pagou o investimento.",author_name:"Carla Duarte",author_role:"CEO",rating:5},{quote:"Nunca mais fui o mesmo profissional depois desta experiência.",author_name:"Igor Santos",author_role:"Fundador",rating:5}]}},
    { type:"form", data:{ title:"Solicitar uma das 50 vagas", submit_text:"Quero minha vaga" }},
  ]),

  // ═══════════════════════════════════════════════════════════════════
  //  COMUNIDADE  (3 templates)
  // ═══════════════════════════════════════════════════════════════════

  t("co-01","Comunidade Privada","community","#7c3aed","#6d28d9","Poppins","bold",
    "Comunidade","Página de entrada para comunidade privada.",[
    { type:"hero", data:{ headline:"Junte-se a 3.000 profissionais que crescem juntos", subheading:"Uma comunidade privada de alto nível. Networking real, conteúdo exclusivo e crescimento acelerado.", cta_text:"Quero entrar", bg_color:"#1e0038", bg_image_url: I.community }},
    { type:"features", data:{ title:"O que você encontra aqui", items:[{icon:"🤝",title:"Network de qualidade",description:"Profissionais selecionados e verificados."},{icon:"📚",title:"Conteúdo exclusivo",description:"Aulas, materiais e recursos que não estão no YouTube."},{icon:"🎯",title:"Eventos privados",description:"Masterminds mensais e eventos presenciais."}], columns:3 }},
    { type:"form", data:{ title:"Solicitar entrada na comunidade", submit_text:"Quero fazer parte" }},
  ]),

  t("co-02","Membership Premium","community","#111827","#374151","Inter","bold",
    "Membership","Página de assinatura premium.",[
    { type:"hero", data:{ headline:"The inner circle for [your industry] leaders", subheading:"Not for everyone. For the few who are serious about building something great.", cta_text:"Apply for membership", bg_color:"#000000", bg_image_url: I.meeting }},
    { type:"features", data:{ title:"Member benefits", items:[{icon:"🔒",title:"Exclusive content",description:"Strategies and insights you won't find anywhere else."},{icon:"👥",title:"Peer access",description:"Direct access to the smartest people in the room."},{icon:"🎟️",title:"Events & retreats",description:"In-person gatherings twice a year."}], columns:3 }},
    { type:"pricing", data:{ title:"Membership options", plans:[{name:"Monthly",price:"R$ 197",period:"/mês",features:["Full community access","Monthly mastermind","Exclusive content library"],cta_text:"Join monthly",highlighted:false},{name:"Annual",price:"R$ 1.497",period:"/ano",features:["Everything in Monthly","2 in-person events","1:1 onboarding call","20% savings"],cta_text:"Join annually",highlighted:true}]}},
  ]),

  t("co-03","Rede de Membros","community","#0891b2","#0e7490","DM Sans","modern",
    "Rede","Página de rede profissional ou associação.",[
    { type:"hero", data:{ headline:"A rede que conecta [profissão] de todo o Brasil", subheading:"6.000 profissionais. 500 empresas. Oportunidades que não aparecem no LinkedIn.", cta_text:"Fazer parte da rede", bg_color:"#0c2a40", bg_image_url: I.team }},
    { type:"social_proof", data:{ stats:[{value:"6.000+",label:"membros"},{value:"500+",label:"empresas parceiras"},{value:"R$ 2M+",label:"em negócios fechados"}]}},
    { type:"features", data:{ title:"Benefícios para membros", items:[{icon:"🗺️",title:"Mapa de membros",description:"Encontre profissionais e empresas perto de você."},{icon:"💼",title:"Quadro de vagas",description:"Oportunidades exclusivas compartilhadas pelos membros."},{icon:"📅",title:"Eventos regionais",description:"Meetups mensais em 12 cidades."}], columns:3 }},
    { type:"form", data:{ title:"Solicitar acesso à rede", submit_text:"Quero entrar" }},
  ]),

  // ═══════════════════════════════════════════════════════════════════
  //  CURSO / FORMAÇÃO  (4 templates)
  // ═══════════════════════════════════════════════════════════════════

  t("cu-01","Curso Online","course","#7c3aed","#6d28d9","Poppins","modern",
    "Curso Online","Página de inscrição para curso online.",[
    { type:"hero", data:{ headline:"Domine [habilidade] em 8 semanas", subheading:"O curso mais completo do mercado. Aulas gravadas + ao vivo + mentoria individual.", cta_text:"Quero me inscrever", bg_color:"#1e0038", bg_image_url: I.dark_abs }},
    { type:"features", data:{ title:"O que está incluído", items:[{icon:"🎬",title:"80+ vídeo aulas",description:"Conteúdo gravado para assistir quando e onde quiser."},{icon:"🎓",title:"6 aulas ao vivo",description:"Sessões de Q&A e prática com o professor."},{icon:"📜",title:"Certificado reconhecido",description:"Validado e aceito pelo mercado."}], columns:3 }},
    { type:"steps", data:{ title:"A jornada do curso", items:[{title:"Módulo 1: Base",description:"Semanas 1–2: Fundamentos e configuração do ambiente."},{title:"Módulo 2: Aplicação",description:"Semanas 3–5: Projetos reais com feedback."},{title:"Módulo 3: Excelência",description:"Semanas 6–8: Otimização, portfólio e certificação."}]}},
    { type:"form", data:{ title:"Inscrição no curso", submit_text:"Garantir minha vaga" }},
  ]),

  t("cu-02","Bootcamp Intensivo","course","#dc2626","#b91c1c","Montserrat","bold",
    "Bootcamp","Página de inscrição para bootcamp intensivo.",[
    { type:"hero", data:{ headline:"Bootcamp [Área]: de zero a empregado em 12 semanas", subheading:"Imersão total. 100% online ao vivo. 94% dos alunos conseguiram emprego em 90 dias.", cta_text:"Quero entrar no bootcamp", bg_color:"#1a0505", bg_image_url: I.dark_city }},
    { type:"social_proof", data:{ stats:[{value:"94%",label:"empregados em 90 dias"},{value:"R$ 8.500",label:"salário médio inicial"},{value:"200+",label:"empresas parceiras contratantes"}]}},
    { type:"features", data:{ title:"O método que funciona", items:[{icon:"⏰",title:"40h semanais",description:"Imersão real, não um curso que você deixa para depois."},{icon:"👨‍💻",title:"Projetos reais",description:"Portfólio completo ao final do bootcamp."},{icon:"💼",title:"Career support",description:"Mock interviews, LinkedIn e conexão com empresas."}], columns:3 }},
    { type:"form", data:{ title:"Candidatar-se ao bootcamp", submit_text:"Quero me candidatar" }},
  ]),

  t("cu-03","Formação Profissional","course","#1d4ed8","#1e40af","Inter","editorial",
    "Formação","Formação profissional corporativa.",[
    { type:"hero", data:{ headline:"Formação [Área]: certificação profissional completa", subheading:"Programa reconhecido pelo mercado. Ideal para quem quer crescer na carreira com credencial sólida.", cta_text:"Ver programa completo", bg_color:"#0f2460", bg_image_url: I.strategy }},
    { type:"features", data:{ title:"Por que esta formação", items:[{icon:"🏆",title:"Reconhecimento",description:"Certificado aceito pelas maiores empresas do país."},{icon:"👨‍🏫",title:"Professores praticantes",description:"Quem ensina está ativo no mercado, não só na academia."},{icon:"🌐",title:"Networking",description:"Turmas com profissionais de todo o Brasil."}], columns:3 }},
    { type:"pricing", data:{ title:"Formas de acesso", plans:[{name:"Online",price:"R$ 1.497",period:"",features:["Aulas gravadas + ao vivo","Certificado digital","Comunidade de alunos","6 meses de acesso"],cta_text:"Inscrever online",highlighted:false},{name:"Presencial",price:"R$ 2.997",period:"",features:["Tudo do online +","2 dias presenciais em SP","Material físico incluso","Certificado impresso"],cta_text:"Inscrever presencial",highlighted:true}]}},
  ]),

  t("cu-04","Mini Curso Grátis","course","#059669","#047857","DM Sans","minimal",
    "Mini Curso","Página de mini curso gratuito para captura.",[
    { type:"hero", data:{ headline:"Mini Curso Gratuito: [Tema em 5 aulas]", subheading:"5 aulas curtas. Resultado prático imediato. 100% online e gratuito.", cta_text:"Acessar curso grátis", bg_color:"#022c22" }},
    { type:"steps", data:{ title:"O conteúdo do mini curso", items:[{title:"Aula 1: Introdução",description:"Contexto, por que isso importa e o que você vai construir."},{title:"Aulas 2–4: Aplicação",description:"Passo a passo prático, do zero ao primeiro resultado."},{title:"Aula 5: Próximos passos",description:"Como continuar evoluindo e aprofundar o conhecimento."}]}},
    { type:"form", data:{ title:"Liberar acesso ao mini curso", submit_text:"Quero acesso grátis" }},
  ]),

  // ═══════════════════════════════════════════════════════════════════
  //  PÁGINA DE OBRIGADO  (3 templates)
  // ═══════════════════════════════════════════════════════════════════

  t("ty-01","Obrigado + Próximos Passos","thank_you","#4f46e5","#7c3aed","Inter","minimal",
    "Obrigado","Página de obrigado com próximos passos.",[
    { type:"hero", data:{ headline:"Você está dentro! 🎉", subheading:"Seu cadastro foi confirmado. Verifique seu e-mail — enviamos o acesso agora mesmo.", bg_color:"#1e1b4b" }},
    { type:"steps", data:{ title:"O que acontece agora", items:[{title:"Verifique seu e-mail",description:"Enviamos o link de acesso. Verifique a caixa de spam se não encontrar."},{title:"Acesse a plataforma",description:"Clique no link e configure sua conta em menos de 2 minutos."},{title:"Comece hoje",description:"Não deixe para amanhã. Dê o primeiro passo agora."}]}},
    { type:"cta", data:{ headline:"Enquanto espera o e-mail...", subheadline:"Conheça nosso conteúdo gratuito no blog.", cta_text:"Ir para o blog", secondary_cta_text:"Seguir no Instagram" }},
  ]),

  t("ty-02","Download Liberado","thank_you","#059669","#047857","DM Sans","modern",
    "Download OK","Página de obrigado para download de material.",[
    { type:"hero", data:{ headline:"Seu material está pronto para download! ✅", subheading:"Também enviamos no seu e-mail para você acessar depois.", bg_color:"#022c22" }},
    { type:"cta", data:{ headline:"Gostou? Você vai amar estes conteúdos também", subheadline:"Selecionamos mais recursos gratuitos para você.", cta_text:"Ver mais conteúdos", secondary_cta_text:"Seguir nas redes" }},
  ]),

  t("ty-03","Reunião Confirmada","thank_you","#2563eb","#1d4ed8","Poppins","minimal",
    "Reunião OK","Página de confirmação de agendamento.",[
    { type:"hero", data:{ headline:"Reunião confirmada! 📅", subheading:"Enviamos o link da videoconferência no seu e-mail. Anote na agenda.", bg_color:"#0f172a" }},
    { type:"steps", data:{ title:"Antes da reunião", items:[{title:"Confirme o horário no e-mail",description:"Link de calendário incluso para adicionar automaticamente."},{title:"Prepare suas perguntas",description:"Quanto mais objetivo você for, mais aproveitamos o tempo."},{title:"Teste sua conexão",description:"Entre 5 minutos antes para garantir que tudo funciona."}]}},
  ]),

  // ═══════════════════════════════════════════════════════════════════
  //  VENDA DIRETA  (4 templates)
  // ═══════════════════════════════════════════════════════════════════

  t("vd-01","Oferta com Urgência","direct_sale","#dc2626","#b91c1c","Montserrat","landing",
    "Oferta Urgência","Página de venda com urgência e countdown.",[
    { type:"hero", data:{ headline:"Oferta Especial: [Produto] por R$ 197", subheading:"De R$ 497 por apenas R$ 197. Oferta válida por tempo limitado. Não perca.", cta_text:"Aproveitar oferta agora", bg_color:"#1a0505", bg_image_url: I.dark_abs }},
    { type:"countdown", data:{ title:"Esta oferta expira em:", target_date:"2025-06-10T23:59:00", cta_text:"Garantir meu desconto agora" }},
    { type:"features", data:{ title:"Tudo que está incluso", items:[{icon:"📦",title:"Produto principal",description:"Acesso completo e imediato após o pagamento."},{icon:"🎁",title:"3 bônus exclusivos",description:"Materiais adicionais com valor total de R$ 300."},{icon:"🔒",title:"Garantia de 30 dias",description:"Não gostou? Devolvemos 100% sem perguntas."}], columns:3 }},
    { type:"cta", data:{ headline:"Satisfação garantida ou seu dinheiro de volta", cta_text:"Comprar agora por R$ 197" }},
  ]),

  t("vd-02","Produto Digital","direct_sale","#7c3aed","#6d28d9","Inter","modern",
    "Produto Digital","Venda de produto digital estilo Gumroad.",[
    { type:"hero", data:{ headline:"[Nome do Produto] — R$ 97", subheading:"Download imediato. Acesso vitalício. Atualizações gratuitas para sempre.", cta_text:"Comprar agora", bg_color:"#1e0038" }},
    { type:"features", data:{ title:"O que está incluído", items:[{icon:"📁",title:"Arquivo principal",description:"Entregue em 3 formatos diferentes para sua conveniência."},{icon:"♾️",title:"Acesso vitalício",description:"Pague uma vez e use para sempre. Atualizações inclusas."},{icon:"💬",title:"Comunidade de compradores",description:"Grupo privado para tire dúvidas e troque experiências."}], columns:3 }},
    { type:"cta", data:{ headline:"Acesso imediato após o pagamento", cta_text:"Comprar por R$ 97", secondary_cta_text:"Ver perguntas frequentes" }},
  ]),

  t("vd-03","Pacote Premium","direct_sale","#111827","#374151","Inter","bold",
    "Pacote Enterprise","Venda de pacote/serviço de alto valor.",[
    { type:"hero", data:{ headline:"Resultado garantido ou seu dinheiro de volta", subheading:"Um investimento de alto impacto para quem está pronto para crescer de verdade.", cta_text:"Ver o que está incluído", bg_color:"#000000", bg_image_url: I.dark_office }},
    { type:"features", data:{ title:"O que você vai ter", items:[{icon:"🎯",title:"Estratégia personalizada",description:"Plano criado para a realidade do seu negócio."},{icon:"🛠️",title:"Implementação incluída",description:"Não entregamos só o plano — executamos juntos."},{icon:"📊",title:"Acompanhamento de métricas",description:"Reuniões semanais enquanto durar o projeto."}], columns:3 }},
    { type:"pricing", data:{ title:"Investimento", plans:[{name:"Básico",price:"R$ 4.997",period:"",features:["30 dias de projeto","2 reuniões semanais","Entregáveis definidos"],cta_text:"Contratar básico",highlighted:false},{name:"Completo",price:"R$ 9.997",period:"",features:["90 dias de projeto","Reuniões ilimitadas","Equipe dedicada","Garantia de resultado"],cta_text:"Contratar completo",highlighted:true}]}},
  ]),

  t("vd-04","Venda Simples","direct_sale","#059669","#047857","DM Sans","minimal",
    "Venda Direta","Página de venda simples e focada.",[
    { type:"hero", data:{ headline:"[Produto] por R$ 47 — Acesso imediato", subheading:"Sem mensalidade. Sem burocracia. Clicou, pagou, acessou.", cta_text:"Comprar agora por R$ 47", bg_color:"#022c22" }},
    { type:"features", data:{ title:"Isso está incluído", items:[{icon:"✅",title:"Entrega imediata",description:"Acesso no ato do pagamento."},{icon:"🔒",title:"Pagamento seguro",description:"Cartão, Pix ou boleto. Protegido por SSL."},{icon:"↩️",title:"Garantia 7 dias",description:"Arrependeu? Reembolso total sem perguntas."}], columns:3 }},
    { type:"cta", data:{ headline:"Pronto?", cta_text:"Comprar por R$ 47" }},
  ]),

  // ═══════════════════════════════════════════════════════════════════
  //  CASES / RESULTADOS  (3 templates)
  // ═══════════════════════════════════════════════════════════════════

  t("cs-01","Case de Sucesso","case_study","#1d4ed8","#1e40af","Inter","editorial",
    "Case","Página de case de sucesso com dados.",[
    { type:"hero", data:{ headline:"Como a [Empresa] cresceu 300% em 12 meses", subheading:"Um case real, com números reais, de uma empresa que era igual à sua.", cta_text:"Ler o case completo", bg_color:"#0f2460", bg_image_url: I.success }},
    { type:"social_proof", data:{ stats:[{value:"300%",label:"crescimento em 12 meses"},{value:"R$ 1,2M",label:"em receita adicional"},{value:"8 meses",label:"payback do investimento"}]}},
    { type:"steps", data:{ title:"Como chegamos lá", items:[{title:"Diagnóstico",description:"Identificamos os 3 gargalos que impediam o crescimento."},{title:"Estratégia",description:"Plano de 90 dias focado nos maiores alavancadores de resultado."},{title:"Execução",description:"Implementação com time dedicado e métricas semanais."}]}},
    { type:"cta", data:{ headline:"Quer resultados parecidos?", cta_text:"Falar com especialista" }},
  ]),

  t("cs-02","Resultados com Dados","case_study","#059669","#047857","DM Sans","modern",
    "Resultados","Página de resultados e depoimentos com dados.",[
    { type:"hero", data:{ headline:"Números reais de clientes reais", subheading:"Sem promessas. Só dados verificáveis de empresas que trabalharam com a gente.", bg_color:"#022c22", bg_image_url: I.growth }},
    { type:"social_proof", data:{ stats:[{value:"420+",label:"clientes atendidos"},{value:"R$ 48M",label:"em receita gerada para clientes"},{value:"94%",label:"renovam contrato"}]}},
    { type:"testimonials_grid", data:{ title:"O que os clientes dizem", items:[{quote:"Aumentamos o MRR em 85% nos primeiros 6 meses. Resultado que não esperava tão rápido.",author_name:"Felipe Carvalho",author_role:"CEO, SaaS Growth",rating:5},{quote:"Finalmente entendemos nossos dados. ROI de 12x em 8 meses.",author_name:"Mariana Souza",author_role:"CMO, Varejo Digital",rating:5},{quote:"A metodologia é diferente. Focam no que move o ponteiro, não no que é fácil.",author_name:"Roberto Lima",author_role:"Fundador, Edtech",rating:5}]}},
    { type:"cta", data:{ headline:"Seu resultado começa aqui", cta_text:"Solicitar diagnóstico gratuito" }},
  ]),

  t("cs-03","Depoimentos Wall","case_study","#7c3aed","#6d28d9","Poppins","agency",
    "Depoimentos","Página com mural de depoimentos e prova social.",[
    { type:"hero", data:{ headline:"Mais de 500 clientes satisfeitos não podem estar errados", subheading:"Cada depoimento é real, verificável e conta uma história de transformação.", bg_color:"#1e0038", bg_image_url: I.success }},
    { type:"testimonials_grid", data:{ title:"O que dizem sobre nós", items:[{quote:"Melhor decisão de negócio que tomei nos últimos 3 anos.",author_name:"Ana Costa",author_role:"Diretora de Operações",rating:5},{quote:"Entrega acima do prometido. Time incrível e resultados reais.",author_name:"Marcos Oliveira",author_role:"CEO",rating:5},{quote:"Seria louco não recomendar. Simplesmente funciona.",author_name:"Juliana Ferreira",author_role:"Fundadora",rating:5}]}},
    { type:"social_proof", data:{ stats:[{value:"500+",label:"clientes"},{value:"4.9★",label:"avaliação média"},{value:"98%",label:"recomendam"}]}},
    { type:"cta", data:{ headline:"Seja o próximo case de sucesso", cta_text:"Começar agora" }},
  ]),

  // ═══════════════════════════════════════════════════════════════════
  //  PORTFÓLIO  (3 templates)
  // ═══════════════════════════════════════════════════════════════════

  t("po-01","Agência Criativa","portfolio","#f59e0b","#d97706","Montserrat","agency",
    "Portfólio Agência","Portfólio para agência criativa, design ou marketing.",[
    { type:"hero", data:{ headline:"Criamos marcas que as pessoas amam", subheading:"Design estratégico, identidade visual e campanhas que conectam de verdade.", cta_text:"Ver nosso trabalho", bg_color:"#1c0e00", bg_image_url: I.dark_abs }},
    { type:"features", data:{ title:"Nossos serviços", items:[{icon:"✏️",title:"Branding",description:"Identidade visual completa: logo, paleta, tipografia e guia de marca."},{icon:"📱",title:"Digital",description:"Sites, apps e campanhas digitais orientados por dados."},{icon:"📢",title:"Conteúdo",description:"Estratégia editorial, produção e distribuição de conteúdo."}], columns:3 }},
    { type:"testimonials_grid", data:{ title:"Clientes que confiam", items:[{quote:"Transformaram nossa marca. Reconhecimento aumentou 3x em 6 meses.",author_name:"Ricardo Pinto",author_role:"CMO, Startup Fintech",rating:5},{quote:"Processo incrível, resultado surpreendente. Nossa cara nova.",author_name:"Bianca Melo",author_role:"Fundadora, Moda",rating:5},{quote:"Melhor parceria criativa que já tive.",author_name:"Sergio Batista",author_role:"CEO, Tech",rating:5}]}},
    { type:"form", data:{ title:"Fale sobre o seu projeto", submit_text:"Quero um orçamento" }},
  ]),

  t("po-02","Studio Minimalista","portfolio","#111827","#374151","Inter","minimal",
    "Studio","Portfólio estilo studio ou freelancer premium.",[
    { type:"hero", data:{ headline:"Design que comunica. Código que performa.", subheading:"Studio independente especializado em experiências digitais de alto padrão.", cta_text:"Ver portfólio", bg_color:"#000000" }},
    { type:"features", data:{ title:"O que fazemos", items:[{icon:"🎨",title:"UI/UX Design",description:"Interfaces que as pessoas amam usar."},{icon:"⚡",title:"Frontend",description:"React, Next.js e performance acima do esperado."},{icon:"📐",title:"Design System",description:"Componentes consistentes e escaláveis."}], columns:3 }},
    { type:"form", data:{ title:"Iniciar um projeto", submit_text:"Entrar em contato" }},
  ]),

  t("po-03","Freelancer Pro","portfolio","#2563eb","#1d4ed8","DM Sans","modern",
    "Freelancer","Portfólio para freelancer ou consultor.",[
    { type:"hero", data:{ headline:"[Seu Nome] — Especialista em [Área]", subheading:"Freelancer sênior com 8+ anos de experiência. Projetos entregues para +80 clientes.", cta_text:"Ver meu trabalho", bg_color:"#0f172a", bg_image_url: I.laptop }},
    { type:"social_proof", data:{ stats:[{value:"80+",label:"clientes atendidos"},{value:"8 anos",label:"de experiência"},{value:"100%",label:"projetos no prazo"}]}},
    { type:"services", data:{ title:"Como posso ajudar", subtitle:"Especialidades principais", items:[{icon:"💻",title:"Desenvolvimento",description:"Frontend e backend com tecnologias modernas.",price:""},{icon:"🎨",title:"Design",description:"UI/UX e identidade visual.",price:""},{icon:"📊",title:"Consultoria",description:"Strategy, arquitetura e code review.",price:""}]}},
    { type:"form", data:{ title:"Falar sobre um projeto", submit_text:"Entrar em contato" }},
  ]),

];
