window.SITE = {
  nome: "Churrascaria Querência",

  whatsapp: {
    numero: "5551986009524",
    mensagem: "Olá! Conheci a Churrascaria Querência pelo site e gostaria de mais informações sobre o cardápio e os pedidos. Poderiam me ajudar?",
  },

  // Cardápio, pedidos e delivery usam o mesmo sistema. Todo <a data-pedido> recebe este link.
  pedido: {
    url: "https://restaurantequerencia.abbas.delivery/webapp/globais/cardapio/CF8MYS?utm_source=site&utm_medium=botao_delivery",
  },

  // Sem e-mail: o formulário monta a mensagem e abre o WhatsApp da casa.
  contato: { modo: "whatsapp" },

  frames: {
    total: 110, // desktop (valor impresso pelo fatiar_frames.sh)
    totalMobile: 72, // celular usa menos quadros (menos dados)
    desktop: "assets/frames/desktop/f_{n}.webp",
    mobile: "assets/frames/mobile/f_{n}.webp",
  },
};
