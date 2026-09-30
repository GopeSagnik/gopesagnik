// usage: node encrypt.js "your-password"   (reads data.json -> writes data.enc.json)
const c = require('crypto'), fs = require('fs');
const pw = process.argv[2]; if (!pw) { console.log('give a password'); process.exit(1); }
const salt = c.randomBytes(16), iv = c.randomBytes(12);
const key = c.pbkdf2Sync(pw, salt, 250000, 32, 'sha256');
const ci = c.createCipheriv('aes-256-gcm', key, iv);
const enc = Buffer.concat([ci.update(fs.readFileSync('data.json')), ci.final(), ci.getAuthTag()]);
const b = x => x.toString('base64');
fs.writeFileSync('data.enc.json', JSON.stringify({ v: 1, salt: b(salt), iv: b(iv), ct: b(enc) }));
console.log('data.enc.json written');
