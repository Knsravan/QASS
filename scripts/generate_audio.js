const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = 'sk_f1f09d81e75fd8a0180e601d348607a2d8f1dd021f30f08a';
const JESSICA_VOICE_ID = 'cgSgspJ2msm6clMCkdW9';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'audio', 'superposition');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const NARRATIONS = [
  { file: '00_welcome.mp3', text: 'Hey there! Welcome to the Quantum World! I am SO excited to show you something absolutely magical today. We are going to discover how tiny things behave in ways that seem totally impossible! Are you ready? Let us go!' },
  { file: '01_ground_state.mp3', text: 'Okay! Imagine you have a magic glowing coin. Right now, our quantum coin is showing heads. Scientists call this the zero state. It is just sitting there, perfectly still. Totally normal. Just like a regular coin resting flat on a table. Simple, right?' },
  { file: '02_hadamard.mp3', text: 'Now we are going to do something magical! We apply something called a Hadamard Gate. Think of it like giving our coin the most perfect flick ever! Whoooosh! Look at that! Our quantum coin is now spinning in the air!' },
  { file: '03_possibilities.mp3', text: 'Here is the really mind-blowing part! While our coin is spinning in the air, it is BOTH heads AND tails at the exact same time! Not one or the other. BOTH at once! Scientists call this superposition. It is like being asleep and awake at the very same moment. Totally wild, right?' },
  { file: '04_pre_collapse.mp3', text: 'Our magic spinning coin is holding every single possibility at once right now! But the universe has a secret rule. The moment someone LOOKS at something quantum and measures it, it has to make up its mind! So go ahead! Give the glowing sphere a click. Peek at it and see what happens!' },
  { file: '05_post_collapse.mp3', text: 'WOW! Did you see that? The moment you looked at it, our quantum coin HAD to choose a side! Scientists call this collapsing the wave function. It is like the universe was juggling all possibilities at once, and the moment you peeked, it had to commit to just one answer. That is quantum measurement, and it is one of the most mysterious things in ALL of science!' },
];

const SOUND_EFFECTS = [
  { file: 'sfx_transition.mp3', prompt: 'smooth ethereal crystal chime sparkle, bright futuristic sci-fi UI transition whoosh, clean modern digital', duration: 2.5 },
  { file: 'sfx_collapse.mp3', prompt: 'powerful quantum wave collapse implosion, deep cinematic bass drop with electric arc discharge crackle, dramatic impact boom', duration: 3.5 },
];

function apiRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(buf);
        else reject(new Error('HTTP ' + res.statusCode + ': ' + buf.toString().slice(0, 300)));
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function genNarration(text, file) {
  process.stdout.write('  Narration: ' + file + ' ... ');
  const body = JSON.stringify({ text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.55, similarity_boost: 0.88, style: 0.35, use_speaker_boost: true } });
  const buf = await apiRequest({ hostname: 'api.elevenlabs.io', path: '/v1/text-to-speech/' + JESSICA_VOICE_ID, method: 'POST', headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, body);
  fs.writeFileSync(path.join(OUTPUT_DIR, file), buf);
  console.log((buf.length/1024).toFixed(1) + ' KB OK');
}

async function genSFX(prompt, duration, file) {
  process.stdout.write('  SFX:       ' + file + ' ... ');
  const body = JSON.stringify({ text: prompt, duration_seconds: duration, prompt_influence: 0.45 });
  const buf = await apiRequest({ hostname: 'api.elevenlabs.io', path: '/v1/sound-generation', method: 'POST', headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, body);
  fs.writeFileSync(path.join(OUTPUT_DIR, file), buf);
  console.log((buf.length/1024).toFixed(1) + ' KB OK');
}

async function main() {
  console.log('\n=== ElevenLabs Audio Generator v2 (Jessica / 5yr-old Scripts) ===\n');
  for (const n of NARRATIONS) { await genNarration(n.text, n.file); await new Promise(r => setTimeout(r, 800)); }
  console.log('');
  for (const s of SOUND_EFFECTS) { await genSFX(s.prompt, s.duration, s.file); await new Promise(r => setTimeout(r, 800)); }
  console.log('\nAll done!');
  fs.readdirSync(OUTPUT_DIR).forEach(f => console.log('  ' + f));
}
main().catch(e => { console.error('\nERROR:', e.message); process.exit(1); });
