process.removeAllListeners('warning');
process.on('warning', (warning) => {
    if (warning.name === 'DeprecationWarning') return;
    console.warn(warning.message);
});

(async () => {
    require('./config')
    const baileys = require('@whiskeysockets/baileys')
    const {
        useMultiFileAuthState,
        DisconnectReason,
        jidNormalizedUser,
        makeCacheableSignalKeyStore,
    } = baileys
    
    const makeInMemoryStore = baileys.makeInMemoryStore || baileys.default?.makeInMemoryStore
    const PHONENUMBER_MCC1 = { "1": "US/Canada", "44": "UK", "49": "Germany", "62": "Indonesia", "91": "India" }    
    const chalk = require('chalk')
    const WebSocket = require('ws')
    const path = require('path')
    const fs = require('fs')
    const mongoose = require('mongoose')
    const yargs = require('yargs/yargs')
    const cp = require('child_process')
    const _ = require('lodash')
    const syntaxerror = require('syntax-error')
    const P = require('pino')
    const os = require('os')
    const simple = require('./lib/simple')
    const more = String.fromCharCode(8206)
    const readMore = more.repeat(4001)
    const { JSONFile } = require('./lib/lowdb')
    const mongoDB = require('./lib/mongoDB')
    const NodeCache = require('node-cache')

    const msgRetryCounterCache = new NodeCache()

    global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())
    global.prefix = new RegExp('^[' + (opts['prefix'] || '!+/#.') + ']')
    
    const store = makeInMemoryStore 
        ? makeInMemoryStore({ logger: P().child({ level: 'fatal', stream: 'store' }) }) 
        : { bind: () => {}, loadMessage: () => {}, saveToFile: () => {}, readFromFile: () => {} }

    const dbUrl = process.env.DATABASE_URL || opts['db'];

    if (dbUrl && dbUrl.includes('mongodb')) {
        mongoose.set('strictQuery', false);
        mongoose.connect(dbUrl).catch(err => console.error("Gagal koneksi MongoDB:", err));
        const MongoDBConstructor = typeof mongoDB === 'function' ? mongoDB : (mongoDB.default || mongoDB.mongoDB);
        global.db = new MongoDBConstructor(dbUrl);
    } else {
        global.db = new JSONFile(`${opts._[0] ? opts._[0] + '_' : ''}database.json`);
    }
    
    global.DATABASE = global.db
    global.loadDatabase = async function loadDatabase() {
        if (global.db.data !== null) return
        await global.db.read()
        global.db.data = { users: {}, chats: {}, settings: {}, sessions: {}, stats: {}, msgs: {}, menfess: {}, sticker: {}, chara: '', ...(global.db.data || {}) }
        global.db.chain = _.chain(global.db.data)
    }
    await loadDatabase()

    const authFile = `${opts._[0] || 'session'}`
    const { state, saveCreds } = await useMultiFileAuthState(authFile)

    const connectionOptions = {
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' }).child({ level: 'silent' })),
        },
        logger: P({ level: 'silent' }),
        browser: ['Elaina-MD', 'Safari', '1.0.0'],
        version: [2, 3000, 1015901307],
        printQRInTerminal: false, // Wajib false untuk cloud
        getMessage: async (key) => {
            let jid = jidNormalizedUser(key.remoteJid)
            let msg = await store.loadMessage(jid, key.id)
            return msg?.message || ''
        },
        msgRetryCounterCache
    }

    global.conn = simple.makeWASocket(connectionOptions)
    global.pairingNumber = process.env.PAIRING_NUMBER || ""; 

    // LOGIC PAIRING OTOMATIS (TANPA READLINE)
    if (!conn.authState.creds.registered) {
        if (global.pairingNumber) {
            let phoneNumber = global.pairingNumber.toString().replace(/[^0-9]/g, '');
            setTimeout(async () => {
                let code = await conn.requestPairingCode(phoneNumber)
                code = code?.match(/.{1,4}/g)?.join("-") || code
                console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)))
            }, 15000)
        } else {
            console.log(chalk.red("PAIRING_NUMBER belum diatur di Environment Variables!"));
        }
    }

    // ... (sisa fungsi lainnya seperti connectionUpdate, reloadHandler, dan _quickTest biarkan sama)
    // ... Pastikan bagian akhir file tetap memanggil reloadHandler() dan _quickTest()
})()
                                
