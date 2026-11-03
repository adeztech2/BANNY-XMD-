import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import http from 'http';

const BOT_NAME = process.env.BOTNAME || 'BANNY XMD';
const PREFIX = process.env.PREFIX || '.';
const OWNER = (process.env.OWNER || '254700000000').replace(/\D/g, '');
const PAIR_NUMBER = (process.env.PAIR_NUMBER || '').replace(/\D/g, '');
const startedAt = Date.now();

// keeps Render / Heroku / Railway happy
http.createServer((_, res) => res.end(`${BOT_NAME} is running`))
  .listen(process.env.PORT || 3000);

const uptime = () => {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`;
};

const box = (title, lines) =>
  `╭───( ${title} )───\n${lines.map(l => `│ ${l}`).join('\n')}\n╰──────────────`;

// ---------- COMMANDS ----------
const commands = {
  ping: {
    desc: 'Check bot speed',
    run: async ({ reply, start }) => reply(`🏓 Pong! ${Date.now() - start}ms`),
  },
  alive: {
    desc: 'Check if bot is online',
    run: async ({ reply }) =>
      reply(box(BOT_NAME, ['Status: online ✅', `Uptime: ${uptime()}`, `Prefix: ${PREFIX}`])),
  },
  menu: {
    desc: 'Show all commands',
    run: async ({ reply }) =>
      reply(box(`${BOT_NAME} MENU`,
        Object.entries(commands).map(([n, c]) => `${PREFIX}${n} - ${c.desc}`))),
  },
  owner: {
    desc: 'Show owner contact',
    run: async ({ reply }) => reply(`Owner: wa.me/${OWNER}`),
  },
  runtime: {
    desc: 'Bot uptime',
    run: async ({ reply }) => reply(`⏱ ${uptime()}`),
  },
  say: {
    desc: 'Repeat your text',
    run: async ({ reply, args }) => reply(args.join(' ') || `Usage: ${PREFIX}say hello`),
  },
  tagall: {
    desc: 'Mention everyone (group admins)',
    run: async ({ sock, m, isGroup, isAdmin, args }) => {
      if (!isGroup) return sock.sendMessage(m.key.remoteJid, { text: 'Groups only.' }, { quoted: m });
      if (!isAdmin) return sock.sendMessage(m.key.remoteJid, { text: 'Admins only.' }, { quoted: m });
      const meta = await sock.groupMetadata(m.key.remoteJid);
      const ids = meta.participants.map(p => p.id);
      const text = (args.join(' ') || 'Attention everyone!') + '\n\n' +
        ids.map(id => `@${id.split('@')[0]}`).join(' ');
      await sock.sendMessage(m.key.remoteJid, { text, mentions: ids }, { quoted: m });
    },
  },
};

// ---------- BOT ----------
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  const { version } = await fetchLatestBaileysVersion();
  const logger = pino({ level: 'silent' });

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: !PAIR_NUMBER,
    browser: [BOT_NAME, 'Chrome', '1.0.0'],
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
  });

  if (PAIR_NUMBER && !sock.authState.creds.registered) {
    setTimeout(async () => {
      const code = await sock.requestPairingCode(PAIR_NUMBER);
      console.log(`\n${BOT_NAME} pairing code: ${code}\n`);
    }, 3000);
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') console.log(`✅ ${BOT_NAME} connected`);
    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.log('Logged out. Delete the "session" folder and pair again.');
      } else {
        console.log('Connection closed, reconnecting...');
        start();
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const m = messages[0];
    if (!m?.message || m.key.fromMe) return;

    const jid = m.key.remoteJid;
    const text =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      m.message.imageMessage?.caption ||
      m.message.videoMessage?.caption || '';
    if (!text.startsWith(PREFIX)) return;

    const [name, ...args] = text.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = commands[name.toLowerCase()];
    if (!cmd) return;

    const isGroup = jid.endsWith('@g.us');
    let isAdmin = false;
    if (isGroup) {
      try {
        const meta = await sock.groupMetadata(jid);
        const sender = m.key.participant || m.participant;
        isAdmin = meta.participants.some(p => p.id === sender && p.admin);
      } catch {}
    }

    const reply = t => sock.sendMessage(jid, { text: t }, { quoted: m });
    try {
      await cmd.run({ sock, m, args, reply, isGroup, isAdmin, start: Date.now() });
    } catch (e) {
      console.error(`Error in ${name}:`, e);
      reply('Something went wrong.');
    }
  });
}

start();
