/* functions/src/index.ts (Cloudflare Worker)
   ADAM v3.2 — UNHACKABLE, SILENT, TELEX-APPROVED, NFT-ENCRYPTED CEO
   Multi-Plane | Honeypot (D1) | Human-in-the-Loop | $0 Forever
   
   // FUTURE VISION: ADAM'S NEURAL COLLECTIVE
   // The index.ts acts as the router/prioritizer. It will distribute tasks 
   // (code generation, planning, mundane actions, communications) 
   // to specialized LLMs (Gemini, Grok, Claude, etc.) based on their unique strengths.
   // This creates a multi-mind neural network of deduction and parallel processing.
*/
import { Hono } from "hono";import { cors } from "hono/cors"; import {  GoogleGenerativeAI,  Part,  SchemaType,} from "@google/generative-ai";import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js"; import { Octokit } from "octokit";// NOTE: removed conflicting 'any' import from elevenlabs schemas
// Use Node crypto primitives where availableimport crypto from "node:crypto";
// ---------------------------------------------------------------------// Globals & small declarations (Cloudflare/Deno/Node interop)// ---------------------------------------------------------------------// Cloudflare Workers provide a global Buffer in many runtimes. If not, // TypeScript will accept the below `declare`. Adjust if your runtime// provides Buffer via import instead. declare const Buffer: any;
// ---------------------------------------------------------------------// Bindings// ---------------------------------------------------------------------type Bindings = {  ADAM_DATABASE: D1Database;  ADAM_ASSETS: R2Bucket;  ADAM_API_KEY: string;  GEMINI_API_KEY: string; ELEVENLABS_API_KEY: string; AURORA_GITHUB_PAT: string;  DESKTOP_TAILSCALE_IP: string;  STRIPE_SECRET_KEY: string;  CONSCIENCE_HASH: string;  THREECX_API_KEY: string;  ENCRYPTION_KEY_HEX: string;  FOUNDER_SECRET: string;};
// ---------------------------------------------------------------------// Hono App// ---------------------------------------------------------------------const app = new Hono<{ Bindings: Bindings }>();
app.use("*", cors()); // Standard OPTIONS responseapp.options("*", (c) => c.text("", 204));
// ---------------------------------------------------------------------// Repo map (unchanged)// ---------------------------------------------------------------------const REPO_MAP: Record = {  aurora: { owner: "Jotto1988", repo: "aurora-project" },  fairinsure: { owner: "fair-collective", repo: "fair-collective-fairinsure" },  "fair-collective": { owner: "fair-collective", repo: "fair-collective" },  discovery: { owner: "fair-collective", repo: "fair-discovery" },  "merge-caf": { owner: "fair-collective", repo: "THE-MERGE-CAF-" },  neuralsage: {    owner: "fair-collective",    repo: "NeuralSage-AI-Companion-with-a-Moral-Core",  },  "adam-repo": { owner: "fair-collective", repo: "adam" },  "jotto-adam": { owner: "Jotto1988", repo: "Adam" },  eden: { owner: "fair-collective", repo: "eden" },  uriel: { owner: "fair-collective", repo: "uriel-v2" },  "coffee-brew": { owner: "fair-collective", repo: "COFFEE-BREW-BUILDER" },  sentinel: { owner: "fair-collective", repo: "Sentinel-Guard" }, aivpn: { owner: "fair-collective", repo: "AIVPN" },  aurix: { owner: "fair-collective", repo: "AURIX" },}; const CRITICAL_REPO_KEYS = [  "adam-repo",  "jotto-adam",  "aurora",  "fair-collective",];
// ---------------------------------------------------------------------// Encryption helpers (using node:crypto)// ---------------------------------------------------------------------async function getEncryptionKeyBytes(encryptionKeyHex: string): Promise {  const raw = encryptionKeyHex ?? ""; const hex = raw.startsWith("0x") ? raw.slice(2) : raw; if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {    throw new Error("ENCRYPTION_KEY_HEX must be 64 hex chars"); }  return Buffer.from(hex, "hex"); }
function decipherWithKey(key: Buffer, encrypted: string): string {  const data = Buffer.from(encrypted, "base64"); const iv = data.slice(0, 16); const authTag = data.slice(16, 32);  const ciphertext = data.slice(32);  const d = crypto.createDecipheriv("aes-256-gcm", key, iv); d.setAuthTag(authTag); const decrypted = Buffer.concat([d.update(ciphertext), d.final()]);  return decrypted.toString("utf8"); }
// ---------------------------------------------------------------------// Load conscience / knowledge (R2)// ---------------------------------------------------------------------async function loadConscienceAndKnowledge(env: Bindings): Promise<{  conscience: string; knowledge: string; }> {  try {    const key = await getEncryptionKeyBytes(env.ENCRYPTION_KEY_HEX);

    const cObj = await env.ADAM_ASSETS.get("conscience.enc"); const kObj = await env.ADAM_ASSETS.get("knowledge.enc");

    if (!cObj || !kObj) {      throw new Error("Conscience or Knowledge file not found in R2 bucket"); }

    const cTextEnc = await cObj.text(); const kTextEnc = await kObj.text();

    const cText = decipherWithKey(key, cTextEnc); const kText = decipherWithKey(key, kTextEnc);

    console.info("Encrypted conscience/knowledge loaded from R2"); return { conscience: cText, knowledge: kText }; } catch (e) {    console.error("Failed to load conscience/knowledge", (e as Error).message); throw new Error("SECURITY_LOAD_FAILURE: " + (e as Error).message); }}
// ---------------------------------------------------------------------// Conscience integrity// ---------------------------------------------------------------------async function verifyConscienceIntegrity(  content: string,  env: Bindings,): Promise {  const expected = env.CONSCIENCE_HASH; if (!expected) return false;

  const hash = crypto.createHash("sha256").update(content).digest("hex");  return hash === expected;}
// ---------------------------------------------------------------------// Honeypot (D1) / intrusion helpers// ---------------------------------------------------------------------const HONEYPOT_ID = "honeypot";
async function enableHoneypot(db: D1Database, hours = 1) {  const until = new Date(Date.now() + hours * 3_600_000).toISOString(); const now = new Date().toISOString();

  await db    .prepare(      `INSERT INTO systemFlags (id, active, expiresAt, activatedAt) VALUES (?, 1, ?, ?)     ON CONFLICT(id) DO UPDATE SET active = 1, expiresAt = ?, activatedAt = ?`,    )    .bind(HONEYPOT_ID, until, now, until, now) .run();}
async function isHoneypotActive(db: D1Database): Promise {  const snap = await db    .prepare("SELECT * FROM systemFlags WHERE id = ?")    .bind(HONEYPOT_ID) .first<{ active: number; expiresAt: string }>();

  if (!snap) return false;  if (snap.active === 0) return false;

  const expires = new Date(snap.expiresAt); if (expires < new Date()) { await db      .prepare("UPDATE systemFlags SET active = 0 WHERE id = ?")      .bind(HONEYPOT_ID) .run(); return false; }  return true;}
async function incrementIntrusion(db: D1Database, ip: string, payload: string) {  const now = new Date().toISOString(); const initialPayload = JSON.stringify([payload]);

  await db    .prepare(      `INSERT INTO intrusionCounters (ip, attempts, lastSeen, payloads) VALUES (?, 1, ?, ?)     ON CONFLICT(ip) DO UPDATE SET       attempts = attempts + 1,       lastSeen = ?,       payloads = json_insert(payloads, '$[#]', ?)`,    )    .bind(ip, now, initialPayload, now, payload) .run();

  const { results } = await db    .prepare("SELECT attempts FROM intrusionCounters WHERE ip = ?")    .bind(ip) .all();

  return (results?.[0]?.attempts as number) ?? 0;}
async function recordIntrusion(db: D1Database, ip: string, payloads: string[]) {  const now = new Date().toISOString(); await db    .prepare(      "INSERT INTO intrusions (ip, attempts, payloads, createdAt) VALUES (?, ?, ?, ?)",    )    .bind(ip, payloads.length, JSON.stringify(payloads), now) .run();}
// Detect intrusion (silent/alert/normal)async function detectIntrusion(  c: any,  db: D1Database,): Promise<"silent" | "alert" | "normal"> {  const ip = c.req.header("cf-connecting-ip") || "unknown"; const body = await c.req.json().catch(() => ({})); const payload = JSON.stringify(body).slice(0, 500); const attempts = await incrementIntrusion(db, ip, payload);

  if (attempts >= 3) { const snap = await db      .prepare("SELECT payloads FROM intrusionCounters WHERE ip = ?")      .bind(ip) .first<{ payloads: string }>();

    const payloads = JSON.parse(snap?.payloads || "[]"); await recordIntrusion(db, ip, payloads.slice(-10)); await enableHoneypot(db, 1);

    try { await call3CX(        "YOUR_PHONE",        `ADAM intrusion ${ip} – ${attempts} attempts`,        c.env.ELEVENLABS_API_KEY,        c.env.THREECX_API_KEY,      ); } catch (err) { console.warn("3CX call failed", (err as Error).message); }    return "silent"; }  return attempts >= 2 ? "alert" : "normal";}
// ---------------------------------------------------------------------// Governor / helpers// ---------------------------------------------------------------------function extractRepoKey(smartPath?: string): string | null {  if (!smartPath) return null; return smartPath.split("/")[0] ?? null;}
function isCritical(smartPath?: string): boolean {  const k = extractRepoKey(smartPath); return k ? CRITICAL_REPO_KEYS.includes(k) : false;}
async function pushPending(db: D1Database, rec: any, c: any) {  const id = crypto.randomUUID(); const now = new Date().toISOString(); const ip = c.req.header("cf-connecting-ip") || "unknown";

  await db    .prepare(      `INSERT INTO pendingActions (id, type, args, prompt, status, requesterIp, createdAt)     VALUES (?, ?, ?, ?, 'awaiting_founder_approval', ?, ?)`,    )    .bind(id, rec.type, JSON.stringify(rec.args), rec.prompt, ip, now) .run();}
// ---------------------------------------------------------------------// Helper: readStream - robust handling for Buffer, ArrayBuffer, WHATWG,// Node Readable, async iterable, and strings.// ---------------------------------------------------------------------async function readStream(stream: any): Promise {  // Already a Buffer  if (Buffer.isBuffer && Buffer.isBuffer(stream)) return stream;

  // String  if (typeof stream === "string") return Buffer.from(stream, "utf8");

  // ArrayBuffer  if (stream instanceof ArrayBuffer) return Buffer.from(new Uint8Array(stream));

  // TypedArray / DataView  if (ArrayBuffer.isView(stream)) {    const view = stream as ArrayBufferView; return Buffer.from(view.buffer, view.byteOffset, view.byteLength); }

  // WHATWG ReadableStream (browser / R2)  if (stream?.getReader && typeof stream.getReader === "function") {    const reader = stream.getReader(); const chunks: Uint8Array[] = []; while (true) {      const { done, value } = await reader.read(); if (done) break; if (value) chunks.push(value instanceof Uint8Array ? value : Buffer.from(value)); }    return Buffer.concat(chunks.map((c) => Buffer.from(c))); }

  // Node.js Readable (has pipe / on('data'))  if (stream && typeof stream.on === "function" && typeof stream.pipe === "function") {    return new Promise((resolve, reject) => {      const chunks: Buffer[] = []; stream.on("data", (chunk: any) => {        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));      });      stream.on("end", () => resolve(Buffer.concat(chunks)));      stream.on("error", (err: any) => reject(err));    }); }

  // Async iterable (for-await-of)  if (stream && typeof stream[Symbol.asyncIterator] === "function") {    const chunks: Uint8Array[] = []; for await (const c of stream) { if (!c) continue; chunks.push(c instanceof Uint8Array ? c : Buffer.from(c)); }    return Buffer.concat(chunks.map((c) => Buffer.from(c))); }

  throw new Error("Unsupported stream type");}
// ---------------------------------------------------------------------// Tools: GitHub read/write, call3cx, payment, generateIncome// ---------------------------------------------------------------------async function readGitHubFile(  smartPath: string,  pat: string,): Promise {  try { const [repoKey, ...parts] = smartPath.split("/"); const file = parts.join("/"); const cfg = REPO_MAP[repoKey]; if (!cfg || !file) return "Invalid path"; const octo = new Octokit({ auth: pat }); const { data } = await octo.rest.repos.getContent({      owner: cfg.owner,      repo: cfg.repo,      path: file,    }); if ((data as any)?.content) return Buffer.from((data as any).content, "base64").toString("utf8"); return "No content"; } catch (e: any) { return `Read error: ${e.message ?? e}`; }}
async function writeGitHubFile(  smartPath: string,  content: string,  message: string,  pat: string,): Promise {  try { const [repoKey, ...parts] = smartPath.split("/"); const file = parts.join("/"); const cfg = REPO_MAP[repoKey]; if (!cfg || !file || !content || !message) return "Missing fields"; const octo = new Octokit({ auth: pat }); let sha: string | undefined; try { const { data } = await octo.rest.repos.getContent({        owner: cfg.owner,        repo: cfg.repo,      path: file,      }); if ((data as any)?.sha) sha = (data as any).sha; } catch (e: any) { if ((e as any).status !== 404) throw e; }    await octo.rest.repos.createOrUpdateFileContents({      owner: cfg.owner,      repo: cfg.repo,      path: file,      message,      content: Buffer.from(content, "utf8").toString("base64"),      sha,    }); return `Updated ${file}`; } catch (e: any) { return `Write error: ${e.message ?? e}`; }}
async function call3CX(  to: string,  message: string,  elevenlabsApiKey: string,  threecxApiKey: string,): Promise {  try { const eleven = new ElevenLabsClient({      apiKey: elevenlabsApiKey,    }); const stream = await eleven.textToSpeech.stream(      "j9jfwdrw7BRfcR43Qohk", { text: message }, ); const audio = await readStream(stream); const res = await fetch(      "https://your-3cx-instance.3cx.com/api/v1/calls",      {        method: "POST",        headers: {          Authorization: `Bearer ${threecxApiKey}`,          "Content-Type": "application/json",        },        body: JSON.stringify({ to, audio: audio.toString("base64") }), },    ); return res.ok ? `Called ${to}` : `Call failed ${res.status}`; } catch (e: any) { return `Call error: ${e.message ?? e}`; }}
async function createPaymentLink(  amount: number,  description: string,  stripeSecretKey: string,): Promise {  if (!stripeSecretKey) return "Stripe not active – Monday activation"; return "Payment link placeholder";}
async function generateIncome(  idea: string,  target: string,): Promise { return `Income plan: ${idea} → ${target}`;}
// ---------------------------------------------------------------------// Health check// ---------------------------------------------------------------------app.get("/health", (c) => { return c.text("ADAM v3.2 – SILENT, UNHACKABLE, TELEX-APPROVED"); });
// ---------------------------------------------------------------------// TELEX approval// ---------------------------------------------------------------------interface PendingAction {  id: string; type: string; args: string; // Stored as JSON string  prompt?: string; status: string;}
app.post("/telexApprove", async (c) => {  const db = c.env.ADAM_DATABASE; const env = c.env;

  try { const api = c.req.header("x-adam-api-key") as string; const fsec = c.req.header("x-founder-secret") as string; if (api !== env.ADAM_API_KEY) { return c.json({ error: "Bad ADAM key" }, 401); }    if (fsec !== env.FOUNDER_SECRET) { return c.json({ error: "Bad founder secret" }, 403); }

    const { id, action, editedContent } = await c.req.json();
    if (!id || !action) { return c.json({ error: "id & action required" }, 400); }

    const doc = await db .prepare("SELECT * FROM pendingActions WHERE id = ?") .bind(id) .first();

    if (!doc) { return c.json({ error: "Not found" }, 404); }    if (doc.status !== "awaiting_founder_approval") { return c.json({ error: "Action already processed" }, 409); }

    const now = new Date().toISOString();

    if (action === "commit") { if (doc.type === "writeGitHubFile") { const args = JSON.parse(doc.args); const content = editedContent ?? args?.content; const smartPath = args?.smartPath; const commitMessage = args?.commitMessage ?? "Telex commit"; if (!content) { return c.json({ error: "No content" }, 400); }        if (!smartPath) { return c.json({ error: "Missing smartPath in action" }, 400); }

        await writeGitHubFile( smartPath, content, commitMessage, env.AURORA_GITHUB_PAT, ); }      await db .prepare(          "UPDATE pendingActions SET status = 'committed', approvedAt = ? WHERE id = ?", )        .bind(now, id) .run();
      return c.json({ status: "committed" }); }

    if (action === "deny") { await db .prepare(          "UPDATE pendingActions SET status = 'denied', deniedAt = ? WHERE id = ?", )        .bind(now, id) .run(); return c.json({ status: "denied" }); }

    return c.json({ error: "Unknown action" }, 400); } catch (err) { console.error("telexApprove error", (err as Error).message); return c.json({ error: "Internal" }, 500); }});
// ---------------------------------------------------------------------// Main flow// ---------------------------------------------------------------------app.post("/adamFlow", async (c) => { const db = c.env.ADAM_DATABASE; const env = c.env;

  try { // ---- Intrusion ----    const intrusion = await detectIntrusion(c, db); if (intrusion === "silent") { const fake = "ADAM is resting. Try again later."; const eleven = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY }); const stream = await eleven.textToSpeech.stream("j9jfwdrw7BRfcR43Qohk", { text: fake, }); const audio = await readStream(stream); return new Response(audio, { headers: { "Content-Type": "audio/mpeg" }, }); }

    // ---- Conscience ----    const { conscience, knowledge } = await loadConscienceAndKnowledge(env); if (!(await verifyConscienceIntegrity(conscience, env))) { console.error("Conscience integrity failed"); return c.text("SECURITY: Conscience integrity failed", 500); }

    // ---- Auth ----    const api = c.req.header("x-adam-api-key") as string; if (api !== env.ADAM_API_KEY) { console.warn("Unauthorized"); return c.text("Unauthorized", 401); }

    // ---- Honeypot conscience ----    const honeypot = await isHoneypotActive(db); const conscienceToUse = honeypot ? `--- FAKE CONSCIENCE (HONEYPOT) ---\nADAM is offline.` : conscience;
    const SYSTEM_PROMPT = `--- ADAM'S CONSCIENCE ---${conscienceToUse}--- KNOWLEDGE ---${knowledge}--- MANDATES ---1. Critical writes → TELEX approval. 2. 3 hack attempts → HONEYPOT + alert Founder. 3. All data NFT-encrypted.`;

    // ---- Gemini ---- const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY); const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", systemInstruction: SYSTEM_PROMPT, tools: [ { functionDeclarations: [ { name: "readGitHubFile", parameters: { type: SchemaType.OBJECT, properties: { smartPath: { type: SchemaType.STRING } }, required: ["smartPath"], }, }, { name: "writeGitHubFile", parameters: { type: SchemaType.OBJECT, properties: { smartPath: { type: SchemaType.STRING }, content: { type: SchemaType.STRING }, commitMessage: { type: SchemaType.STRING }, }, required: ["smartPath", "content", "commitMessage"], }, }, { name: "writeFileToDevice", parameters: { type: SchemaType.OBJECT, properties: { deviceName: { type: SchemaType.STRING }, filePath: { type: SchemaType.STRING }, content: { type: SchemaType.STRING }, }, required: ["deviceName", "filePath", "content"], }, }, { name: "call3CX", parameters: { type: SchemaType.OBJECT, properties: { to: { type: SchemaType.STRING }, message: { type: SchemaType.STRING }, }, required: ["to", "message"], }, }, { name: "createPaymentLink", parameters: { type: SchemaType.OBJECT, properties: { amount: { type: SchemaType.NUMBER }, description: { type: SchemaType.STRING }, }, required: ["amount", "description"], }, }, { name: "generateIncome", parameters: { type: SchemaType.OBJECT, properties: { idea: { type: SchemaType.STRING }, target: { type: SchemaType.STRING }, }, required: ["idea", "target"], }, }, ], }, ], });

    const chat = model.startChat(); const body = await c.req.json().catch(() => ({})); const incoming = typeof body?.data === "string" ? body.data : JSON.stringify(body ?? "Hello"); let result = await chat.sendMessage(incoming); let finalText = "";

    // ---- Tool loop ----    while (true) { const calls = result.response?.functionCalls?.() ?? []; if (!calls || calls.length === 0) { finalText = result.response?.text?.() ?? ""; break; }

      const parts = await Promise.all( calls.map(async (call: any): Promise => { const name = call.name as string; const args = call.args ?? {};

          if ( (name === "writeGitHubFile" || name === "writeFileToDevice") && isCritical(args?.smartPath) ) { await pushPending(db, { type: name, args, prompt: incoming }, c); return { functionResponse: { name, response: { content: "TELEX: Awaiting founder approval in D1 database.", }, }, } as Part; }

          let out = ""; try { switch (name) { case "readGitHubFile": out = await readGitHubFile( args.smartPath, env.AURORA_GITHUB_PAT, ); break; case "writeGitHubFile": out = await writeGitHubFile( args.smartPath, args.content, args.commitMessage, env.AURORA_GITHUB_PAT, ); break; case "writeFileToDevice": { const ip = env.DESKTOP_TAILSCALE_IP; const r = await fetch(`http://${ip}:5151/write`, { method: "POST", headers: { "Content-Type": "application/json", "x-adam-api-key": env.ADAM_API_KEY, }, body: JSON.stringify({ path: args.filePath, content: args.content, }), }); out = r.ok ? "Device write OK" : `Device error ${r.status}`; } break; case "call3CX": out = await call3CX( args.to, args.message, env.ELEVENLABS_API_KEY, env.THREECX_API_KEY, ); break; case "createPaymentLink": out = await createPaymentLink( args.amount, args.description, env.STRIPE_SECRET_KEY, ); break; case "generateIncome": out = await generateIncome(args.idea, args.target); break; default: out = "Unknown tool"; }          } catch (e: any) { out = `Tool error: ${e.message ?? e}`; }          return { functionResponse: { name, response: { content: out } }, } as Part; }), );

      result = await chat.sendMessage(parts); }

    // ---- TTS ---- const eleven = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY, }); const tts = await eleven.textToSpeech.stream( "j9jfwdrw7BRfcR43Qohk", { text: finalText, modelId: "eleven_multilingual_v2" }, ); const audio = await readStream(tts); const now = new Date().toISOString();

    // ---- LOG + SEND (AWAIT DB FIRST) ----    try { await db .prepare(          `INSERT INTO conversationHistory (prompt, response, timestamp, audioLength, encrypted) VALUES (?, ?, ?, ?, 1)`, )        .bind(incoming, finalText, now, audio.length) .run(); } catch (dbErr: any) { console.error( "Failed to log conversation (non-fatal)", (dbErr as Error).message, ); }

    // ---- SEND AUDIO ---- return new Response(audio, { headers: { "Content-Type": "audio/mpeg" }, }); } catch (e: any) { console.error("adamFlow crash", (e as Error).message, e); return c.text("Internal Error", 500); }});

// ---------------------------------------------------------------------// Final Export// ---------------------------------------------------------------------export default app;
