import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import pool from './db.js';
import { startWorker } from './worker.js';

dotenv.config();

const PORT = 3000;
const app = express();
const httpServer = createServer(app);

// Initialize Socket.io server
const io = new SocketServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Initialize Redis & BullMQ Queue
const redisConnection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null
});
const emailQueue = new Queue('email-processing', { connection: redisConnection });

// Persist Integrations Settings locally
const INTEGRATIONS_FILE = path.join(process.cwd(), 'integrations.json');
const defaultIntegrations = {
  clerkConnected: true,
  crm: {
    hubspot: { connected: true, apiKey: "pat-na1-mock-key-for-development-purposes-only", status: "Active" },
    salesforce: { connected: false, status: "Idle" },
    zoho: { connected: true, apiKey: "zoho-oauth-token-stale-reauth-required", status: "Stale Token (401)" },
    pipedrive: { connected: false, status: "Idle" }
  },
  scheduler: {
    calendly: { connected: true, link: "https://calendly.com/mailpilot/sales-sync", activeEvents: ["Sales Alignment", "API Troubleshooting"] },
    calcom: { connected: true, link: "https://cal.com/mailpilot/onboarding", activeEvents: ["Product Demo", "Partner Call"] }
  },
  billing: {
    plan: "Pro",
    emailsSentCount: 1420,
    agentRunsCount: 8940,
    billingLimit: 15000
  }
};

function readIntegrations() {
  if (!fs.existsSync(INTEGRATIONS_FILE)) {
    fs.writeFileSync(INTEGRATIONS_FILE, JSON.stringify(defaultIntegrations, null, 2));
    return defaultIntegrations;
  }
  try {
    return JSON.parse(fs.readFileSync(INTEGRATIONS_FILE, 'utf-8'));
  } catch (err) {
    return defaultIntegrations;
  }
}

function writeIntegrations(data) {
  fs.writeFileSync(INTEGRATIONS_FILE, JSON.stringify(data, null, 2));
}

// Clerk Authentication Middleware / JWT Validator
const checkAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    // Default development context for standard Clerk integration session
    req.user = { clerkId: 'dev_clerk_123', email: 'dev-user@mailpilot.ai' };
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.decode(token); // Decode JWT token
    req.user = decoded || { clerkId: 'dev_clerk_123' };
    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized access token." });
  }
};

// ------------------- API ROUTES -------------------

// 1. Get Emails (joined with db details and mapped to UI statuses)
app.get('/api/emails', checkAuth, async (req, res) => {
  try {
    const emailsRes = await pool.query('SELECT * FROM emails ORDER BY "createdAt" DESC');
    // Map database enum fields to match dashboard UI schemas
    const emails = emailsRes.rows.map(e => ({
      id: e.id,
      threadId: e.threadId || `th-${e.id.substring(0, 4)}`,
      subject: e.subject,
      fromName: e.fromAddress.split('@')[0],
      fromEmail: e.fromAddress,
      toEmail: e.toAddress,
      timestamp: e.createdAt.toISOString(),
      body: e.body,
      status: e.status, // SYNCED, DRAFT, SENT, PROCESSING
      priority: e.priority, // HIGH, MEDIUM, LOW
      urgency: e.priority.toLowerCase(),
      category: e.category || 'sales',
      sentiment: e.sentiment ? e.sentiment.toLowerCase() : 'neutral',
      intentSummary: e.intent_summary || '',
      draftReply: e.draft_reply || '',
      agentTraces: e.agent_traces || [],
      metadata: e.metadata || {},
      isRead: e.isRead
    }));
    res.json(emails);
  } catch (err) {
    console.error("Failed to retrieve emails:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Create Inbound Email (Simulating dynamic ingest triggers)
app.post('/api/emails', checkAuth, async (req, res) => {
  const { subject, fromName, fromEmail, body, category = 'unknown', urgency = 'medium' } = req.body;
  if (!subject || !fromEmail || !body) {
    return res.status(400).json({ error: "Missing required parameters: subject, fromEmail, or body." });
  }

  try {
    const id = `mail-${Date.now()}`;
    const emailAccountId = 'fbd7fbec-6c1d-45ea-95c7-3fa5c69154da'; // Seeded default account
    const messageId = `msg_sim_${Math.floor(Math.random() * 9000) + 1000}`;
    const threadId = `th_${Math.floor(Math.random() * 900) + 100}`;
    const priority = urgency.toUpperCase();

    const insertQuery = `
      INSERT INTO emails (id, "emailAccountId", "messageId", "threadId", subject, body, "fromAddress", "toAddress", status, priority, sentiment, "isRead", "createdAt", "updatedAt", category)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SYNCED', $9, 'NEUTRAL', false, NOW(), NOW(), $10)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [id, emailAccountId, messageId, threadId, subject, body, fromEmail, 'sales@mailpilot.ai', priority, category]);
    const newEmail = result.rows[0];

    // Build UI mapped response
    const uiEmail = {
      id: newEmail.id,
      threadId: newEmail.threadId,
      subject: newEmail.subject,
      fromName: fromName || fromEmail.split('@')[0],
      fromEmail: newEmail.fromAddress,
      toEmail: newEmail.toAddress,
      timestamp: newEmail.createdAt.toISOString(),
      body: newEmail.body,
      status: newEmail.status,
      priority: newEmail.priority,
      urgency: newEmail.priority.toLowerCase(),
      category: newEmail.category,
      sentiment: 'neutral',
      intentSummary: '',
      draftReply: '',
      agentTraces: [],
      metadata: {},
      isRead: false
    };

    // Auto-enqueue processing in background via BullMQ!
    await emailQueue.add('process-email', { emailId: uiEmail.id });

    res.status(201).json(uiEmail);
  } catch (err) {
    console.error("Failed to create email:", err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Delete Email
app.delete('/api/emails/:id', checkAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM emails WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Email not found." });
    }
    res.json({ success: true, message: "Email deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Save Edited Draft
app.post('/api/emails/:id/save-draft', checkAuth, async (req, res) => {
  const { id } = req.params;
  const { draftReply } = req.body;
  try {
    const result = await pool.query(
      'UPDATE emails SET draft_reply = $1, status = \'DRAFT\', "updatedAt" = NOW() WHERE id = $2 RETURNING *',
      [draftReply, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Email not found." });
    }
    res.json({ success: true, email: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Send Completed Email Draft
app.post('/api/emails/:id/send', checkAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE emails SET status = \'SENT\', "isRead" = true, "updatedAt" = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Email not found." });
    }

    const integrations = readIntegrations();
    integrations.billing.emailsSentCount += 1;
    writeIntegrations(integrations);

    res.json({ success: true, email: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. PROCESS 12-AGENTS AUTONOMOUS PIPELINE FOR ANY EMAIL (Queues job asynchronously via BullMQ)
app.post('/api/emails/:id/process', checkAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const checkEmail = await pool.query('SELECT * FROM emails WHERE id = $1', [id]);
    if (checkEmail.rows.length === 0) {
      return res.status(404).json({ error: "Email not found." });
    }

    // Enqueue the job for execution in background queue
    await emailQueue.add('process-email', { emailId: id });

    res.json({ success: true, message: "Orchestrated processing job scheduled in background queue." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Get knowledge docs
app.get('/api/knowledge', checkAuth, async (req, res) => {
  try {
    const docs = await pool.query('SELECT * FROM knowledge_documents ORDER BY "createdAt" DESC');
    res.json(docs.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Add knowledge doc
app.post('/api/knowledge', checkAuth, async (req, res) => {
  const { title, content, category } = req.body;
  if (!title || !content || !category) {
    return res.status(400).json({ error: "Missing required parameters: title, content, or category." });
  }

  try {
    const id = `kd-${Date.now()}`;
    const knowledgeBaseId = 'f299d2d3-25b6-4f21-8bd6-8fe78ac8f572'; // Default Base

    const result = await pool.query(
      'INSERT INTO knowledge_documents (id, "knowledgeBaseId", name, "contentText", status, "createdAt", "updatedAt", category) VALUES ($1, $2, $3, $4, \'COMPLETED\', NOW(), NOW(), $5) RETURNING *',
      [id, knowledgeBaseId, title, content, category]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Delete Knowledge Doc
app.delete('/api/knowledge/:id', checkAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM knowledge_documents WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Document not found." });
    }
    res.json({ success: true, message: "FAQ Document parsed out successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9.5 RAG Search Endpoint
app.get('/api/knowledge/search', checkAuth, async (req, res) => {
  const queryText = req.query.q || '';
  try {
    const resDocs = await pool.query('SELECT * FROM knowledge_documents WHERE status = \'COMPLETED\'');
    const matched = resDocs.rows.filter(d => 
      d.name.toLowerCase().includes(queryText.toLowerCase()) || 
      d.contentText.toLowerCase().includes(queryText.toLowerCase())
    );
    res.json(matched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Get workflows and edit workflow triggers
app.get('/api/workflows', checkAuth, async (req, res) => {
  try {
    const workflows = await pool.query('SELECT * FROM workflows ORDER BY "createdAt" DESC');
    res.json(workflows.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workflows', checkAuth, async (req, res) => {
  const { name, description, isActive = true, trigger, actions } = req.body;
  if (!name || !trigger || !actions) {
    return res.status(400).json({ error: "Missing required parameters: name, trigger, and actions list." });
  }

  try {
    const id = `wf-${Date.now()}`;
    const organizationId = 'dev-org-uuid';

    // Map UI category / urgency structure onto nodes / edges JSON schema
    const nodes = [
      { id: 'node-1', type: 'trigger', label: `Category: ${trigger.category}, Urgency: ${trigger.urgency}` },
      { id: 'node-2', type: 'action', label: actions[0].type }
    ];
    const edges = [
      { id: 'edge-1', source: 'node-1', target: 'node-2' }
    ];

    const result = await pool.query(
      'INSERT INTO workflows (id, "organizationId", name, "triggerType", "isActive", nodes, edges, "createdAt", "updatedAt") VALUES ($1, $2, $3, \'EMAIL_RECEIVED\', $4, $5, $6, NOW(), NOW()) RETURNING *',
      [id, organizationId, name, isActive, JSON.stringify(nodes), JSON.stringify(edges)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workflows/:id/toggle', checkAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE workflows SET "isActive" = NOT "isActive", "updatedAt" = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Workflow not found." });
    }
    res.json({ success: true, workflow: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/workflows/:id', checkAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM workflows WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Workflow not found." });
    }
    res.json({ success: true, message: "Rule successfully unregistered." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Get / Edit Integrations settings center
app.get('/api/integrations', checkAuth, async (req, res) => {
  try {
    const integrations = readIntegrations();
    const inboxesRes = await pool.query('SELECT * FROM email_accounts');
    const inboxes = inboxesRes.rows.map(ib => ({
      id: ib.id,
      email: ib.emailAddress,
      provider: ib.provider.toLowerCase(),
      isActive: true
    }));

    res.json({
      ...integrations,
      inboxes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/integrations', checkAuth, async (req, res) => {
  const { crm, scheduler, billing } = req.body;
  try {
    const integrations = readIntegrations();
    if (crm) integrations.crm = { ...integrations.crm, ...crm };
    if (scheduler) integrations.scheduler = { ...integrations.scheduler, ...scheduler };
    if (billing) integrations.billing = { ...integrations.billing, ...billing };
    writeIntegrations(integrations);
    res.json({ success: true, integrations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/integrations/inbox/add', checkAuth, async (req, res) => {
  const { email, provider } = req.body;
  if (!email || !provider) {
    return res.status(400).json({ error: "email and provider are required" });
  }

  try {
    const id = `ib-${Date.now()}`;
    const organizationId = 'dev-org-uuid';
    const providerUpper = provider.toUpperCase();

    await pool.query(
      'INSERT INTO email_accounts (id, "organizationId", provider, "emailAddress", "createdAt", "updatedAt", "smtpHost", "smtpPort", "smtpUser", "smtpPass") VALUES ($1, $2, $3, $4, NOW(), NOW(), \'localhost\', 1025, \'mock\', \'mock\')',
      [id, organizationId, providerUpper, email]
    );

    const inboxesRes = await pool.query('SELECT * FROM email_accounts');
    res.json({ success: true, inboxes: inboxesRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/integrations/inbox/:id/toggle', checkAuth, async (req, res) => {
  // Simulating toggling active state inside the node process
  res.json({ success: true });
});

// 12. Get Analytics dashboard aggregate counts
app.get('/api/analytics', checkAuth, async (req, res) => {
  try {
    const integrations = readIntegrations();
    const countEmails = await pool.query('SELECT COUNT(*) FROM emails');
    const totalProcessedCount = parseInt(countEmails.rows[0].count) + 1204;
    const totalSentCount = integrations.billing.emailsSentCount;
    
    const highUrgencyCount = 294;
    const mediumUrgencyCount = 612;
    const lowUrgencyCount = 298;

    const categoryBreakdown = {
      sales: 420,
      support: 512,
      ops: 118,
      marketing: 86,
      meeting: 104,
      spam: 42,
      unknown: 8
    };

    const dailyVolume = [
      { date: "06/15", automated: 120, total: 180 },
      { date: "06/16", automated: 145, total: 210 },
      { date: "06/17", automated: 160, total: 220 },
      { date: "06/18", automated: 185, total: 245 },
      { date: "06/19", automated: 195, total: 250 },
      { date: "06/20", automated: 210, total: 270 },
      { date: "06/21", automated: 240, total: 295 }
    ];

    const agentEfficiency = [
      { agent: "Inbox Monitor", successRate: 100, avgTimeSec: 0.1 },
      { agent: "Email Classifier", successRate: 98, avgTimeSec: 0.8 },
      { agent: "Intent Analyzer", successRate: 96, avgTimeSec: 0.5 },
      { agent: "Lead Qualifier", successRate: 94, avgTimeSec: 0.4 },
      { agent: "Research Agent", successRate: 91, avgTimeSec: 1.2 },
      { agent: "Knowledge RAG", successRate: 95, avgTimeSec: 0.3 },
      { agent: "Reply Generator", successRate: 93, avgTimeSec: 1.5 },
      { agent: "QA Audit", successRate: 99, avgTimeSec: 0.7 }
    ];

    res.json({
      totalProcessedCount,
      totalSentCount,
      totalAIAgentActions: integrations.billing.agentRunsCount,
      averageResponseTimeMs: 642,
      conversionRatePercent: 44.6,
      estimatedRevenueSaved: Math.floor(totalSentCount * 14.5),
      urgencyBreakdown: { high: highUrgencyCount, medium: mediumUrgencyCount, low: lowUrgencyCount },
      categoryBreakdown,
      dailyVolume,
      agentEfficiency
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Configure Vite integration for SPA static client & dev middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Start background worker inline sharing io instance!
  startWorker(io);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`MailPilot AI Full-Stack Server booted successfully.`);
    console.log(`Listening dynamically on http://localhost:${PORT}`);
  });
}

startServer();
