// Registra os comandos /pago e /pendentes no servidor do estúdio.
// Rodar uma vez (e de novo se mudar a definição):  node --env-file=.env.local scripts/discord-comandos.mjs
// Precisa de DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID e DISCORD_GUILD_ID.

const COMANDOS = [
  {
    name: 'pago',
    description: 'Registra o pagamento de uma conta no mc_control',
    options: [
      { type: 3, name: 'conta', description: 'Conta em aberto (comece a digitar)', required: true, autocomplete: true },
      { type: 10, name: 'valor', description: 'Valor pago. Sem valor = integral (o que falta da conta)', required: false, min_value: 0.01 },
    ],
  },
  {
    name: 'pendentes',
    description: 'Lista as contas em aberto e as que vencem nos próximos 7 dias',
  },
]

const { DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID, DISCORD_GUILD_ID } = process.env
if (!DISCORD_BOT_TOKEN || !DISCORD_APPLICATION_ID || !DISCORD_GUILD_ID) {
  console.error('Faltam DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID ou DISCORD_GUILD_ID')
  process.exit(1)
}

const r = await fetch(
  `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/guilds/${DISCORD_GUILD_ID}/commands`,
  {
    method: 'PUT',
    headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(COMANDOS),
  },
)
const corpo = await r.json()
if (!r.ok) {
  console.error('Erro', r.status, corpo)
  process.exit(1)
}
console.log('Comandos registrados:', corpo.map(c => `/${c.name}`).join(', '))
