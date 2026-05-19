export function msgAniversario(nome: string): string {
  const primeiro = nome.trim().split(' ')[0]
  return `Oi ${primeiro}! 🎉 Feliz aniversário! A equipe do Studio Meus Cílios deseja um dia muito especial pra você. Que tal se presentear com um mimo? Estamos te esperando com muito carinho! 💕`
}

export function msgRecuperacao(nome: string): string {
  const primeiro = nome.trim().split(' ')[0]
  return `Oi ${primeiro}! 💕 Sentimos sua falta aqui no Studio Meus Cílios! Já faz um tempinho desde sua última visita e adoraríamos te receber de novo. Que tal agendar um horário? 😊`
}

export function normalizarCelular(celular: string): string {
  return celular.replace(/\D/g, '')
}

export function linkWhatsApp(celular: string): string {
  return `https://web.whatsapp.com/send?phone=55${normalizarCelular(celular)}`
}
