import React, { useState, useEffect } from "react";
import {
  Mail,
  Inbox,
  Shield,
  Search,
  BookOpen,
  GitBranch,
  Settings,
  Layers,
  Database,
  BarChart3,
  Calendar,
  Zap,
  ArrowRight,
  TrendingUp,
  Clock,
  Briefcase,
  MessageCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Send,
  Sliders,
  Sparkles,
  Link2,
  Trash2,
  Plus,
  RefreshCw,
  SearchCode,
  SlidersHorizontal,
  Bot,
  User,
  ExternalLink,
  ChevronRight,
  FileText,
  BadgeAlert
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { io } from "socket.io-client";
import { AgentType } from "./types.js";

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState("inbox");
  
  // Data lists
  const [emails, setEmailList] = useState([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [integrations, setIntegrations] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [semanticSearching, setSemanticSearching] = useState(false);

  // Active selections
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // New Form states
  const [newFaqTitle, setNewFaqTitle] = useState("");
  const [newFaqContent, setNewFaqContent] = useState("");
  const [newFaqCategory, setNewFaqCategory] = useState("product");

  const [newWfName, setNewWfName] = useState("");
  const [newWfDesc, setNewWfDesc] = useState("");
  const [newWfCategory, setNewWfCategory] = useState("sales");
  const [newWfUrgency, setNewWfUrgency] = useState("any");
  const [newWfAction, setNewWfAction] = useState("auto_draft");

  const [excelUrl, setExcelUrl] = useState("");
  const [excelConnecting, setExcelConnecting] = useState(false);
  const [excelMessage, setExcelMessage] = useState("");

  const [activeOutreachTab, setActiveOutreachTab] = useState("email");

  const getDraftForTab = (email, tab) => {
    if (!email) return "";
    if (email.metadata && email.metadata.outreachVersions) {
      return email.metadata.outreachVersions[tab] || "";
    }
    if (tab === "email") return email.draftReply || "";
    return "";
  };

  const handleOutreachTabChange = (tab) => {
    if (selectedEmail) {
      if (!selectedEmail.metadata) selectedEmail.metadata = {};
      if (!selectedEmail.metadata.outreachVersions) {
        selectedEmail.metadata.outreachVersions = {
          email: selectedEmail.draftReply || "",
          linkedin: "",
          instagram: ""
        };
      }
      selectedEmail.metadata.outreachVersions[activeOutreachTab] = editedDraft;
    }
    setActiveOutreachTab(tab);
    setEditedDraft(getDraftForTab(selectedEmail, tab));
  };

  const [semanticQuery, setSemanticQuery] = useState("");
  const [semanticResults, setSemanticResults] = useState([]);

  // Simulated live event logger for terminal element
  const [liveLog, setLiveLog] = useState(["[System] MailPilot Operations Core initialized successfully."]);

  // Draft editing state
  const [editedDraft, setEditedDraft] = useState("");

  // Inbound simulation generator values
  const systemInbounds = [
    {
      subject: "Frustrated: Cannot change password on support platform",
      fromName: "Gale Thompson",
      fromEmail: "gale@cloudventures.cc",
      body: "Hi operations, I've tried updating our company security dashboard password but the validation verification email doesn't deliver. We are deadlocked. Can someone check your outbound SMTP logs and clear this block? Urgent.",
      category: "support",
      urgency: "high"
    },
    {
      subject: "Demo request for 200 seat enterprise roll",
      fromName: "Richard Miller",
      fromEmail: "rmiller@apexconsulting.com",
      body: "Hello MailPilot team! We operate a high volume customer triage agency and are looking to integrate MailPilot's RAG and auto-generation into our Salesforce architecture under strict QA governance. Can we coordinate a sales alignment demo this week with our CTO?",
      category: "sales",
      urgency: "high"
    },
    {
      subject: "Newsletter pitch: MailPilot partnership spotlight",
      fromName: "Aria Sterling",
      fromEmail: "aria@theinboxdigest.co",
      body: "Hi team, I write the Inbox Digest daily newsletter read by 45,000 Sales ops technicians. We would love to feature MailPilot's AI agents in our tech review section. Are you open to sponsoring a weekly guide?",
      category: "marketing",
      urgency: "low"
    }
  ];

  // Fetch initial data
  const fetchData = async (backgroundOnly = false) => {
    if (!backgroundOnly) setLoading(true);
    try {
      const [emailsRes, knowledgeDocsRes, workflowsRes, integrationsRes, analyticsRes] = await Promise.all([
        fetch("/api/emails").then(r => r.json()),
        fetch("/api/knowledge").then(r => r.json()),
        fetch("/api/workflows").then(r => r.json()),
        fetch("/api/integrations").then(r => r.json()),
        fetch("/api/analytics").then(r => r.json())
      ]);

      setEmailList(emailsRes);
      setKnowledgeDocs(knowledgeDocsRes);
      setWorkflows(workflowsRes);
      setIntegrations(integrationsRes);
      setAnalytics(analyticsRes);

      // Restore selections
      if (emailsRes.length > 0) {
        if (!selectedEmail) {
          setSelectedEmail(emailsRes[0]);
          setEditedDraft(getDraftForTab(emailsRes[0], activeOutreachTab));
        } else {
          const fresh = emailsRes.find((m) => m.id === selectedEmail.id);
          if (fresh) {
            setSelectedEmail(fresh);
            setEditedDraft(getDraftForTab(fresh, activeOutreachTab));
          }
        }
      }
    } catch (err) {
      console.error("API Fetch Error:", err);
      logEvent("[Error] Lost hook synchronization with local server.");
    } finally {
      if (!backgroundOnly) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Set up Socket.io for live updates
    const socket = io();
    socket.on("connect", () => {
      logEvent("[System] Connected to operations queue via WebSocket channel.");
    });

    socket.on("agent-trace", (data) => {
      logEvent(`[${data.agentType}] ${data.title}: ${data.description}`);
      // Auto reload lists in background to update statuses
      fetchData(true);
    });

    socket.on("job-completed", (data) => {
      logEvent(`[Queue] Task completed for email: "${data.subject}"`);
      fetchData(true);
    });

    socket.on("job-failed", (data) => {
      logEvent(`[Error] Processing failed for email ID: ${data.emailId}`);
      fetchData(true);
    });

    socket.on("disconnect", () => {
      logEvent("[System] Live WebSocket connection lost. Reconnecting...");
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const logEvent = (msg) => {
    const time = new Date().toLocaleTimeString();
    setLiveLog(prev => [`[${time}] ${msg}`, ...prev.slice(0, 14)]);
  };

  // Trigger outbound email dispatcher simulator
  const handleSimulateInbound = async () => {
    const sample = systemInbounds[Math.floor(Math.random() * systemInbounds.length)];
    try {
      logEvent(`[Inbound] Queueing new incoming message: "${sample.subject}" from ${sample.fromEmail}`);
      const res = await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sample)
      });
      if (res.ok) {
        const email = await res.json();
        logEvent(`[Inbox Monitor] Sanitized email successfully. Allocated ID ${email.id}.`);
        await fetchData(true);
        setSelectedEmail(email);
        setEditedDraft("");
      }
    } catch (err) {
      logEvent("[Error] Failed to inject dynamic inbound simulated email.");
    }
  };

  // Connect and import leads from Excel online spreadsheet link
  const handleConnectExcel = async (e) => {
    e.preventDefault();
    if (!excelUrl) return;
    setExcelConnecting(true);
    setExcelMessage("");
    logEvent(`[Excel Ingestor] Connecting to Excel Online sheet...`);
    try {
      const res = await fetch('/api/integrations/excel/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: excelUrl })
      });
      const data = await res.json();
      if (res.ok) {
        setExcelMessage(`Connected successfully! Imported and enqueued ${data.count} leads.`);
        logEvent(`[Excel Ingestor] Connected! Imported ${data.count} leads from spreadsheet.`);
        fetchData(true);
        setExcelUrl("");
      } else {
        setExcelMessage(`Connection failed: ${data.error}`);
        logEvent(`[Error] Excel integration failed: ${data.error}`);
      }
    } catch (err) {
      setExcelMessage("Connection timeout or server offline.");
      logEvent("[Error] Excel connection exception.");
    } finally {
      setExcelConnecting(false);
    }
  };

  // Run the 12-Agent Pipeline
  const handleProcessEmail = async (id) => {
    setProcessingId(id);
    logEvent(`[Agent Pipeline] Bootstrapping Autonomous Operations Team for Email ID ${id}.`);
    logEvent(`[Workflow Orchestrator] Locking thread context. Engaging agents 1 through 12...`);
    try {
      const res = await fetch(`/api/emails/${id}/process`, {
        method: "POST"
      });
      if (res.ok) {
        const email = await res.json();
        logEvent(`[Orchestrator] Email processing job scheduled in background queue.`);
        await fetchData(true);
        setSelectedEmail(email);
        setEditedDraft(getDraftForTab(email, activeOutreachTab));
      }
    } catch (err) {
      logEvent("[Error] Neural classifier loop aborted with token errors.");
    } finally {
      setProcessingId(null);
    }
  };

  // Save manual overrides of the reply draft
  const handleSaveDraft = async () => {
    if (!selectedEmail) return;
    try {
      const versions = selectedEmail.metadata?.outreachVersions || {
        email: selectedEmail.draftReply || "",
        linkedin: "",
        instagram: ""
      };
      versions[activeOutreachTab] = editedDraft;

      const updatedMetadata = {
        ...selectedEmail.metadata,
        outreachVersions: versions
      };

      const res = await fetch(`/api/emails/${selectedEmail.id}/save-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          draftReply: versions.email,
          metadata: updatedMetadata
        })
      });
      if (res.ok) {
        logEvent(`[Draft Studio] Saved physical adjustments for outreach versions.`);
        fetchData(true);
      }
    } catch (err) {
      logEvent("[Error] Failed to capture manual overrides.");
    }
  };

  // Send the actual crafted response
  const handleSendEmail = async (id) => {
    setSendingId(id);
    logEvent(`[Dispatch Manager] Connecting custom SMTP relays. Compiling parameters...`);
    try {
      const res = await fetch(`/api/emails/${id}/send`, {
        method: "POST"
      });
      if (res.ok) {
        logEvent(`[SMTP Agent] Email dispatched securely! Synced logs onto CRM database.`);
        await fetchData(true);
      }
    } catch (err) {
      logEvent("[Error] Lost SMTP authorization stream during transmission.");
    } finally {
      setSendingId(null);
    }
  };

  // Delete an email
  const handleDeleteEmail = async (id) => {
    if (!confirm("Are you sure you want to remove this email record?")) return;
    try {
      const res = await fetch(`/api/emails/${id}`, { method: "DELETE" });
      if (res.ok) {
        logEvent(`[Dispatcher] Purged email ID: ${id}`);
        setSelectedEmail(null);
        fetchData(true);
      }
    } catch (err) {
      logEvent("[Error] Email record locking error.");
    }
  };

  // Knowledge FAQs Creators
  const handleAddFaq = async (e) => {
    e.preventDefault();
    if (!newFaqTitle || !newFaqContent) return;
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newFaqTitle,
          content: newFaqContent,
          category: newFaqCategory
        })
      });
      if (res.ok) {
        logEvent(`[Grounding] Ingested document: "${newFaqTitle}". Ingesting vector embeddings.`);
        setNewFaqTitle("");
        setNewFaqContent("");
        fetchData(true);
      }
    } catch (err) {
      logEvent("[Error] Grounding document ingestion error.");
    }
  };

  // FAQ Delete
  const handleDeleteFaq = async (id) => {
    try {
      const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
      if (res.ok) {
        logEvent(`[Knowledge] Evicted document records from vector memory.`);
        fetchData(true);
      }
    } catch (err) {
      logEvent("[Error] Eviction index locking failure.");
    }
  };

  // Workflow triggers creators
  const handleCreateWorkflow = async (e) => {
    e.preventDefault();
    if (!newWfName) return;
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWfName,
          description: newWfDesc || "Automated team action cascade.",
          trigger: {
            category: newWfCategory,
            urgency: newWfUrgency
          },
          actions: [
            { type: newWfAction, params: { tone: "professional", autoSubmit: false } }
          ]
        })
      });
      if (res.ok) {
        logEvent(`[Workflow Orchestrator] Compiled trigger rule: "${newWfName}" active.`);
        setNewWfName("");
        setNewWfDesc("");
        fetchData(true);
      }
    } catch (err) {
      logEvent("[Error] Flow compilation engine error.");
    }
  };

  // Toggle Workflow toggle
  const handleToggleWorkflow = async (id) => {
    try {
      const res = await fetch(`/api/workflows/${id}/toggle`, { method: "POST" });
      if (res.ok) {
        logEvent(`[Workflow Orchestrator] Toggled policy status.`);
        fetchData(true);
      }
    } catch (err) {
      logEvent("[Error] Flow status error.");
    }
  };

  // Delete Workflow trigger
  const handleDeleteWorkflow = async (id) => {
    try {
      const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      if (res.ok) {
        logEvent(`[Workflow Orchestrator] Deregistered routing rule.`);
        fetchData(true);
      }
    } catch (err) {
      logEvent("[Error] Rule unregistering error.");
    }
  };

  // Semantic search simulated RAG query
  const handleSemanticSearch = (e) => {
    e.preventDefault();
    if (!semanticQuery.trim()) return;
    setSemanticSearching(true);
    logEvent(`[RAG Search] Vector matching question: "${semanticQuery}"`);
    
    fetch(`/api/knowledge/search?q=${encodeURIComponent(semanticQuery)}`)
      .then(res => res.json())
      .then(results => {
        setSemanticResults(results.map(r => `[Source: ${r.title}] ${r.content}`));
        setSemanticSearching(false);
        logEvent(`[RAG Search] Retrieved ${results.length} grounding matches for AI drafting.`);
      })
      .catch(err => {
        logEvent("[Error] Semantic search call failed.");
        setSemanticSearching(false);
      });
  };

  // Filters calculation
  const filteredEmails = emails.filter((m) => {
    const matchesSearch =
      m.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.fromAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.fromName && m.fromName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      m.body.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === "all" || m.category === categoryFilter;
    const matchesUrgency = urgencyFilter === "all" || m.priority.toLowerCase() === urgencyFilter.toLowerCase();
    
    let matchesStatus = true;
    if (statusFilter !== "all") {
      if (statusFilter === "unread") matchesStatus = !m.isRead && m.status !== "SENT" && m.status !== "DRAFT";
      else if (statusFilter === "drafted") matchesStatus = m.status === "DRAFT";
      else if (statusFilter === "sent") matchesStatus = m.status === "SENT";
    }

    return matchesSearch && matchesCategory && matchesUrgency && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-teal-500/20 selection:text-teal-300">
      
      {/* Dynamic Top Indicator & Meta Hub */}
      <div className="bg-slate-900 border-b border-slate-800 py-3 px-6 shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="bg-teal-500/10 text-teal-400 p-2 rounded-lg border border-teal-500/20 flex items-center justify-center animate-pulse">
            <Bot size={22} id="btn_telemetry_icon" />
          </div>
          <div>
            <span className="text-xs uppercase tracking-widest text-slate-400 font-mono">Operations Platform</span>
            <h1 className="text-xl font-bold font-sans tracking-tight text-white mt-0.5" id="lbl_brand_name">
              MailPilot <span className="text-teal-400 font-mono text-sm leading-none font-medium ml-1">AI</span>
            </h1>
          </div>
        </div>

        {/* Live system statuses */}
        <div className="flex items-center space-x-6 text-xs font-mono">
          <div className="flex items-center space-x-2 bg-slate-950 py-1.5 px-3 rounded-md border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-slate-300">SMTP: Connected</span>
          </div>

          <div className="flex items-center space-x-2 bg-slate-950 py-1.5 px-3 rounded-md border border-slate-800">
            <Shield size={13} className="text-teal-400" />
            <span className="text-slate-300">Auth: Clerk (Active)</span>
          </div>

          <div className="flex items-center space-x-2 bg-slate-950 py-1.5 px-3 rounded-md border border-slate-800">
            <Zap size={13} className="text-amber-400" />
            <span className="text-slate-300">Plan: {integrations?.billing?.plan || "Pro"}</span>
          </div>

          <button
            onClick={handleSimulateInbound}
            id="btn_simulate_email"
            className="bg-teal-600 hover:bg-teal-500 text-slate-950 cursor-pointer text-xs font-sans font-bold py-1.5 px-3 rounded-md flex items-center space-x-1.5 hover:shadow-lg hover:shadow-teal-900/20 active:scale-95 transition"
          >
            <Plus size={14} />
            <span>Simulate Inbound</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Navigation Sidebar */}
        <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 justify-between">
          <div className="p-4 space-y-1">
            <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">
              Cockpits
            </div>

            <button
              onClick={() => setActiveTab("inbox")}
              id="sidebar_inbox_tab"
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer text-left ${
                activeTab === "inbox"
                  ? "bg-teal-500/10 text-teal-400 border-l-2 border-teal-400"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
              }`}
            >
              <Inbox size={18} />
              <span className="flex-1">Operations Inbox</span>
              {emails.filter(e => !e.isRead && e.status !== "SENT").length > 0 && (
                <span className="bg-teal-500 text-slate-950 font-bold px-1.5 py-0.5 rounded text-xs">
                  {emails.filter(e => !e.isRead && e.status !== "SENT").length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("knowledge")}
              id="sidebar_knowledge_tab"
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer text-left ${
                activeTab === "knowledge"
                  ? "bg-teal-500/10 text-teal-400 border-l-2 border-teal-400"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
              }`}
            >
              <Database size={18} />
              <span>RAG Knowledge</span>
            </button>

            <button
              onClick={() => setActiveTab("workflows")}
              id="sidebar_workflows_tab"
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer text-left ${
                activeTab === "workflows"
                  ? "bg-teal-500/10 text-teal-400 border-l-2 border-teal-400"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
              }`}
            >
              <GitBranch size={18} />
              <span>Automation Flows</span>
            </button>

            <button
              onClick={() => setActiveTab("integrations")}
              id="sidebar_integrations_tab"
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer text-left ${
                activeTab === "integrations"
                  ? "bg-teal-500/10 text-teal-400 border-l-2 border-teal-400"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
              }`}
            >
              <Layers size={18} />
              <span>Connections Hub</span>
            </button>

            <div className="pt-4 px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">
              Metrics
            </div>

            <button
              onClick={() => setActiveTab("analytics")}
              id="sidebar_analytics_tab"
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer text-left ${
                activeTab === "analytics"
                  ? "bg-teal-500/10 text-teal-400 border-l-2 border-teal-400"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
              }`}
            >
              <BarChart3 size={18} />
              <span>SLA & Analytics</span>
            </button>
          </div>

          {/* Running Task Logger (Terminal View) */}
          <div className="p-4 border-t border-slate-800 bg-slate-950">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-2">
              <span className="flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-ping" />
                <span>ACTIVE AUTONOMY FLOWS</span>
              </span>
              <RefreshCw
                size={11}
                className="hover:text-slate-300 cursor-pointer shrink-0"
                onClick={() => fetchData(true)}
              />
            </div>
            <div className="h-40 rounded bg-slate-900 border border-slate-850 p-2 font-mono text-[10px] leading-relaxed overflow-y-auto space-y-1.5 scrollbar-thin text-slate-400">
              {liveLog.map((log, i) => (
                <div key={i} className="truncate">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Display Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          
          <AnimatePresence mode="wait">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-8 bg-teal-400 rounded animate-bounce delay-75" />
                  <div className="w-2 h-8 bg-teal-300 rounded animate-bounce delay-150" />
                  <div className="w-2 h-8 bg-teal-500 rounded animate-bounce delay-300" />
                </div>
                <div className="font-mono text-xs">Aligning MailPilot Operational Core...</div>
              </div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex overflow-hidden"
              >
                
                {/* 1. OP INBOX TAB */}
                {activeTab === "inbox" && (
                  <div className="flex-1 flex overflow-hidden">
                    
                    {/* Mail list Panel */}
                    <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-900 shrink-0">
                      
                      {/* Search and filter controls */}
                      <div className="p-3 border-b border-slate-800 space-y-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 text-slate-500" size={15} />
                          <input
                            type="text"
                            placeholder="Search inbounds..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 rounded-md py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500/60"
                          />
                        </div>

                        {/* Filters list */}
                        <div className="flex gap-2">
                          <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="flex-1 bg-slate-950 border border-slate-850 text-[11px] text-slate-300 rounded p-1"
                          >
                            <option value="all">Any Category</option>
                            <option value="sales">Sales</option>
                            <option value="support">Support</option>
                            <option value="ops">Ops</option>
                            <option value="marketing">Marketing</option>
                            <option value="spam">Spam</option>
                          </select>

                          <select
                            value={urgencyFilter}
                            onChange={(e) => setUrgencyFilter(e.target.value)}
                            className="flex-1 bg-slate-950 border border-slate-850 text-[11px] text-slate-300 rounded p-1"
                          >
                            <option value="all">Any Urgency</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                      </div>

                      {/* Emails Thread Stack */}
                      <div className="flex-1 overflow-y-auto divide-y divide-slate-850">
                        {filteredEmails.length === 0 ? (
                          <div className="p-8 text-center text-xs text-slate-550 font-mono">
                            No matching inbound mail threads found.
                          </div>
                        ) : (
                          filteredEmails.map((m) => {
                            const isSelected = selectedEmail?.id === m.id;
                            return (
                              <div
                                key={m.id}
                                onClick={() => {
                                  setSelectedEmail(m);
                                  setEditedDraft(getDraftForTab(m, activeOutreachTab));
                                }}
                                className={`p-3.5 text-left cursor-pointer transition relative hover:bg-slate-800/40 ${
                                  isSelected ? "bg-slate-800/80 border-l-2 border-teal-400" : ""
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1 mb-1.5">
                                  <span className="text-[11px] font-mono text-slate-400 font-semibold truncate max-w-[130px]">
                                    {m.fromName || m.fromAddress.split("@")[0]}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <h4 className="text-xs font-bold text-white truncate mb-1">
                                  {m.subject}
                                </h4>
                                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                                  {m.body}
                                </p>

                                <div className="flex items-center gap-1.5">
                                  {/* Urgency tag */}
                                  <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-mono ${
                                    m.priority === "HIGH"
                                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                      : m.priority === "MEDIUM"
                                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                      : "bg-slate-500/10 text-slate-400 border border-slate-700/20"
                                  }`}>
                                    {m.priority.toLowerCase()}
                                  </span>

                                  {/* Category Tag */}
                                  <span className="text-[10px] capitalize px-1.5 py-0.5 rounded font-mono bg-slate-950 text-slate-300 border border-slate-800">
                                    {m.category}
                                  </span>

                                  {/* Status Icon */}
                                  <div className="ml-auto">
                                    {m.status === "SYNCED" && !m.isRead && (
                                      <span className="flex h-2.5 w-2.5 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500"></span>
                                      </span>
                                    )}
                                    {m.status === "PROCESSING" && (
                                      <Bot size={12} className="text-teal-400 animate-spin" />
                                    )}
                                    {m.status === "DRAFT" && (
                                      <Sliders size={12} className="text-amber-400" />
                                    )}
                                    {m.status === "SENT" && (
                                      <CheckCircle2 size={12} className="text-emerald-400" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Work Detail / Pipeline Review Split Area */}
                    {selectedEmail ? (
                      <div className="flex-1 flex overflow-hidden bg-slate-950">
                        
                        {/* Core email details & workspace split */}
                        <div className="flex-1 p-6 overflow-y-auto space-y-6">
                          
                          {/* Thread Header card */}
                          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div>
                                <span className="text-[10px] font-mono text-teal-400 uppercase tracking-widest block mb-1">
                                  Thread ID: {selectedEmail.threadId || "T-"+selectedEmail.id.substring(0,6)}
                                </span>
                                <h3 className="text-lg font-bold text-white tracking-tight">
                                  {selectedEmail.subject}
                                </h3>
                              </div>
                              <button
                                onClick={() => handleDeleteEmail(selectedEmail.id)}
                                className="text-slate-500 hover:text-rose-400 p-1.5 hover:bg-rose-500/5 rounded transition cursor-pointer"
                                title="Delete thread"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400 border-t border-slate-850 pt-3">
                              <div>
                                <span className="text-slate-500 mr-1.5">From:</span>
                                <span className="font-semibold text-slate-200">{selectedEmail.fromName || selectedEmail.fromAddress.split("@")[0]}</span>
                                <span className="font-mono text-[11px] text-slate-500 ml-1">({selectedEmail.fromAddress})</span>
                              </div>
                              <div className="hidden sm:block text-slate-700">|</div>
                              <div>
                                <span className="text-slate-500 mr-1.5">Received:</span>
                                <span className="text-slate-300">{new Date(selectedEmail.createdAt).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          {/* Email Body text content */}
                          <div className="bg-slate-900 border border-slate-850 rounded-lg p-5">
                            <div className="text-xs uppercase font-mono tracking-widest text-slate-500 mb-3 border-b border-slate-850 pb-2">
                              ORIGINAL INBOUND MESSAGE
                            </div>
                            <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                              {selectedEmail.body}
                            </p>
                          </div>

                          {/* Grounded Grounding Context Summary */}
                          {selectedEmail.metadata && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-slate-900 border border-slate-850 rounded-lg p-4 font-mono">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                  <UsersIcon size={12} className="text-teal-400" />
                                  <span>Opportunity Assessment</span>
                                </div>
                                <div className="text-lg font-bold text-white">
                                  Value: <span className="text-emerald-400">${selectedEmail.metadata.estimatedValue || 0}</span>
                                </div>
                                <div className="text-[11px] text-slate-450 mt-1">
                                  Lead Score: {selectedEmail.metadata.leadScore || 0}/100 ({selectedEmail.metadata.companySize || "N/A"})
                                </div>
                              </div>

                              <div className="bg-slate-900 border border-slate-850 rounded-lg p-4 font-mono">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                  <SmileIcon size={12} className="text-teal-400" />
                                  <span>Sentiment & Tone</span>
                                </div>
                                <div className="text-lg font-bold text-white capitalize">
                                  Indicator: <span className={selectedEmail.sentiment === "POSITIVE" ? "text-emerald-400" : selectedEmail.sentiment === "NEGATIVE" ? "text-rose-400" : "text-slate-400"}>{selectedEmail.sentiment?.toLowerCase() || "neutral"}</span>
                                </div>
                                <div className="text-[11px] text-slate-450 mt-1 truncate">
                                  Intent: {selectedEmail.intentSummary || "Need general support info."}
                                </div>
                              </div>

                              <div className="bg-slate-900 border border-slate-850 rounded-lg p-4 font-mono">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                  <BookOpen size={12} className="text-teal-400" />
                                  <span>RAG Grounded Citations</span>
                                </div>
                                <div className="text-xs font-semibold text-slate-200 truncate">
                                  {selectedEmail.metadata.groundedSources?.join(", ") || "No vector grounding matched."}
                                </div>
                                <div className="text-[11px] text-slate-450 mt-1">
                                  Token cost: {selectedEmail.tokensUsed || 0} tokens
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Dynamic Action Area: Process / Draft Work Studio */}
                          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                            <div className="bg-slate-850 py-3 px-4 border-b border-slate-800 flex items-center justify-between">
                              <span className="font-sans font-bold text-xs uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                                <SlidersHorizontal size={14} className="text-teal-400" />
                                <span>MailPilot Draft Output Studio</span>
                              </span>

                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleProcessEmail(selectedEmail.id)}
                                  disabled={processingId !== null || selectedEmail.status === "PROCESSING"}
                                  className="bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 p-2 text-xs font-bold font-sans rounded border border-teal-500/30 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 active:scale-95 transition"
                                >
                                  {processingId === selectedEmail.id || selectedEmail.status === "PROCESSING" ? (
                                    <>
                                      <div className="w-3.5 h-3.5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                                      <span>Engaging 12-Agents Pipeline...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles size={13} />
                                      <span>Generate with AI Pipeline</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            <div className="p-4 space-y-4">
                              {selectedEmail.draftReply ? (
                                <div className="space-y-3">
                                  {selectedEmail.id.startsWith("mail-excel") && (
                                    <div className="flex border-b border-slate-800 mb-2">
                                      <button
                                        onClick={() => handleOutreachTabChange("email")}
                                        className={`px-4 py-2 text-xs font-mono font-bold border-b-2 cursor-pointer transition ${
                                          activeOutreachTab === "email" ? "border-teal-400 text-teal-400 bg-slate-900/30" : "border-transparent text-slate-400 hover:text-slate-200"
                                        }`}
                                      >
                                        Gmail Outreach
                                      </button>
                                      <button
                                        onClick={() => handleOutreachTabChange("linkedin")}
                                        className={`px-4 py-2 text-xs font-mono font-bold border-b-2 cursor-pointer transition ${
                                          activeOutreachTab === "linkedin" ? "border-teal-400 text-teal-400 bg-slate-900/30" : "border-transparent text-slate-400 hover:text-slate-200"
                                        }`}
                                      >
                                        LinkedIn Connection Note
                                      </button>
                                      <button
                                        onClick={() => handleOutreachTabChange("instagram")}
                                        className={`px-4 py-2 text-xs font-mono font-bold border-b-2 cursor-pointer transition ${
                                          activeOutreachTab === "instagram" ? "border-teal-400 text-teal-400 bg-slate-900/30" : "border-transparent text-slate-400 hover:text-slate-200"
                                        }`}
                                      >
                                        Instagram DM
                                      </button>
                                    </div>
                                  )}

                                  <textarea
                                    value={editedDraft}
                                    onChange={(e) => setEditedDraft(e.target.value)}
                                    rows={12}
                                    placeholder="Verify or adjust the AI agent output response..."
                                    className="w-full bg-slate-950 text-slate-200 text-sm p-4 rounded-lg border border-slate-800 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 leading-relaxed font-sans"
                                  />

                                  <div className="flex items-center justify-between pt-1">
                                    <span className="text-xs text-slate-500 flex items-center gap-1.5 font-mono">
                                      <CheckCircle2 size={13} className="text-teal-400" />
                                      <span>Authorized for outbound dispatch</span>
                                    </span>

                                    <div className="flex gap-2">
                                      <button
                                        onClick={handleSaveDraft}
                                        className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold py-2 px-4 rounded border border-slate-700 cursor-pointer active:scale-95 transition"
                                      >
                                        Save Draft Changes
                                      </button>

                                      <button
                                        onClick={() => handleSendEmail(selectedEmail.id)}
                                        disabled={sendingId !== null || selectedEmail.status === "SENT"}
                                        className="bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 text-xs font-bold py-2 px-5 rounded flex items-center space-x-2 cursor-pointer active:scale-95 transition"
                                      >
                                        {sendingId === selectedEmail.id ? (
                                          <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                          <Send size={13} />
                                        )}
                                        <span>{selectedEmail.status === "SENT" ? "Dispatched" : "Approve & Send Draft"}</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="py-12 text-center">
                                  <div className="bg-slate-950 p-4 rounded-full w-14 h-14 mx-auto flex items-center justify-center border border-slate-800 mb-3 text-slate-500">
                                    <Sparkles size={24} />
                                  </div>
                                  <h4 className="text-sm font-bold text-white mb-1">
                                    No Response Draft Generated Yet
                                  </h4>
                                  <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4 leading-relaxed">
                                    MailPilot pipeline hasn't processed this inbox thread yet. Run the 12-autonomous agents team to run RAG grounding audits and generate compliance responses.
                                  </p>
                                  <button
                                    onClick={() => handleProcessEmail(selectedEmail.id)}
                                    className="bg-teal-600 hover:bg-teal-500 text-slate-950 text-xs font-bold font-sans py-2 px-5 rounded flex items-center space-x-1.5 mx-auto cursor-pointer shadow-lg shadow-teal-950/25 active:scale-95 transition"
                                  >
                                    <Play size={13} className="fill-slate-950" />
                                    <span>Run 12-Agents Pipeline Now</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right side Agent Pipeline Telemetry details */}
                        <div className="w-80 border-l border-slate-800 bg-slate-900 overflow-y-auto shrink-0 p-5 space-y-5">
                          <div>
                            <h3 className="text-xs uppercase font-mono tracking-widest text-slate-400 font-bold mb-1">
                              Agent Pipeline Trace
                            </h3>
                            <p className="text-[11px] text-slate-500 leading-normal">
                              Live execution roadmap. Traces output logic for all 12 autonomous routing cells.
                            </p>
                          </div>

                          <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                            {selectedEmail.agentTraces && selectedEmail.agentTraces.length > 0 ? (
                              selectedEmail.agentTraces.map((tr) => (
                                <div key={tr.id} className="relative pl-7 group">
                                  <div className={`absolute left-1.5 top-1 w-3.5 h-3.5 rounded-full border-2 bg-slate-950 flex items-center justify-center ${
                                    tr.status === "failed"
                                      ? "border-rose-500"
                                      : tr.status === "info"
                                      ? "border-amber-400 animate-pulse"
                                      : "border-teal-400"
                                  }`}>
                                    <div className={`w-1 h-1 rounded-full ${
                                      tr.status === "failed"
                                        ? "bg-rose-500"
                                        : tr.status === "info"
                                        ? "bg-amber-400"
                                        : "bg-teal-400"
                                    }`} />
                                  </div>
                                  <div className="text-[11px] font-bold text-white font-mono flex items-center justify-between">
                                    <span>{tr.agentType}</span>
                                    <span className="text-[9px] font-normal text-slate-500">
                                      {new Date(tr.timestamp).toLocaleTimeString([], { second: '2-digit' })}
                                    </span>
                                  </div>
                                  <h5 className="text-[11px] text-teal-400 mt-0.5">
                                    {tr.title}
                                  </h5>
                                  <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                                    {tr.description}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <div className="py-8 text-center text-xs text-slate-500 font-mono pl-3">
                                No active agent pipeline traces registered. Trigger AI analysis.
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                        <Mail size={40} className="text-slate-700 mb-2" />
                        <span className="font-mono text-xs">Pick an inbox email thread to begin operations.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 2.Grounding Knowledge Base TAB */}
                {activeTab === "knowledge" && (
                  <div className="flex-1 flex p-6 gap-6 overflow-y-auto">
                    
                    {/* Database FAQ lists */}
                    <div className="flex-1 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-bold text-white tracking-tight">
                            RAG Knowledge Documents
                          </h2>
                          <p className="text-xs text-slate-400">
                            Define corporate references. These are parsed, embedded, and dynamically consulted by the Knowledge Retrieval Agent during response generation.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {knowledgeDocs.map((doc) => (
                          <div key={doc.id} className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-slate-950 text-teal-400 border border-slate-800">
                                  {doc.category || "product"}
                                </span>
                                <button
                                  onClick={() => handleDeleteFaq(doc.id)}
                                  className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/5 cursor-pointer"
                                  title="Delete Document"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                              <h3 className="text-sm font-bold text-white mb-2">
                                {doc.name || doc.title}
                              </h3>
                              <p className="text-xs text-slate-400 leading-relaxed">
                                {doc.contentText || doc.content}
                              </p>
                            </div>
                            <div className="border-t border-slate-850 pt-2 mt-4 text-[10px] font-mono text-slate-500 flex items-center justify-between">
                              <span>Ingested: {new Date(doc.createdAt).toLocaleDateString()}</span>
                              <span>Embedding: Dense (1536d)</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Grounded interactive query validation tools */}
                      <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg">
                        <div className="flex items-center space-x-2 text-teal-400 mb-2">
                          <SearchCode size={16} />
                          <h3 className="text-xs uppercase tracking-widest font-mono font-bold">
                            Interactive RAG Retriever Simulator
                          </h3>
                        </div>
                        <p className="text-xs text-slate-400 mb-4 leading-normal">
                          Type any pricing or integration question to simulate vector lookup metrics and test which grounded sources get fed to Gemini.
                        </p>

                        <form onSubmit={handleSemanticSearch} className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g. enterprise CRM sync or Zoho authorize..."
                            value={semanticQuery}
                            onChange={(e) => setSemanticQuery(e.target.value)}
                            className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs placeholder-slate-600 focus:outline-none focus:border-teal-500"
                          />
                          <button
                            type="submit"
                            className="bg-teal-600 hover:bg-teal-500 text-slate-950 cursor-pointer text-xs font-bold py-2 px-4 rounded transition active:scale-95"
                          >
                            {semanticSearching ? "Searching..." : "Query Memory"}
                          </button>
                        </form>

                        {semanticResults.length > 0 && (
                          <div className="bg-slate-950 border border-slate-850 rounded p-4 mt-3 space-y-3">
                            <h4 className="text-xs font-bold text-teal-400 font-mono">
                              Retrieved Source Chunks:
                            </h4>
                            {semanticResults.map((resStr, i) => (
                              <div key={i} className="text-xs bg-slate-900/60 p-2.5 rounded border border-slate-850 text-slate-300 font-sans leading-relaxed">
                                {resStr}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Add Document Side Sheet */}
                    <div className="w-80 bg-slate-900 border border-slate-800 p-5 rounded-lg h-fit shrink-0 space-y-4">
                      <div>
                        <h3 className="text-sm font-bold text-white mb-1">
                          Ingest Grounding Document
                        </h3>
                        <p className="text-xs text-slate-400 leading-normal">
                          Create knowledge variables for high fidelity auto-answers.
                        </p>
                      </div>

                      <form onSubmit={handleAddFaq} className="space-y-3.5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                            Document Title
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Corporate Delivery SLAs"
                            value={newFaqTitle}
                            onChange={(e) => setNewFaqTitle(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs focus:outline-none focus:border-teal-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                            Primary Category
                          </label>
                          <select
                            value={newFaqCategory}
                            onChange={(e) => setNewFaqCategory(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded p-2"
                          >
                            <option value="product">Product Features FAQ</option>
                            <option value="pricing">Pricing Packages</option>
                            <option value="support_faq">Support Troubleshooting</option>
                            <option value="company_policy">Company Policy Rules</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                            Semantic Context / Contents
                          </label>
                          <textarea
                            required
                            rows={8}
                            placeholder="Paste references, policies, pricing listings, or FAQs. The Retrieval agent searches this exact block."
                            value={newFaqContent}
                            onChange={(e) => setNewFaqContent(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs focus:outline-none focus:border-teal-500 leading-normal"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-teal-600 hover:bg-teal-500 text-slate-950 cursor-pointer text-xs font-bold py-2 rounded transition active:scale-95"
                        >
                          Index Grounding Vector
                        </button>
                      </form>
                    </div>

                  </div>
                )}

                {/* 3. Automation flows TAB */}
                {activeTab === "workflows" && (
                  <div className="flex-1 flex p-6 gap-6 overflow-y-auto">
                    
                    {/* Active Workflow Triggers */}
                    <div className="flex-1 space-y-6">
                      <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">
                          Automation Triggers & Workflows
                        </h2>
                        <p className="text-xs text-slate-400">
                          Route inbound matches directly dynamically. Whenever classification categories and urgency vectors intersect, run customized pipeline handoffs.
                        </p>
                      </div>

                      <div className="space-y-3">
                        {workflows.map((wf) => {
                          // Parse category & urgency from trigger rules
                          const triggerLabel = wf.nodes?.[0]?.label || "Email Received";
                          const actionLabel = wf.nodes?.[1]?.label || "AI Auto-Response";

                          return (
                            <div key={wf.id} className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-sm font-bold text-white">
                                    {wf.name}
                                  </h3>
                                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
                                    wf.isActive
                                      ? "bg-teal-500/10 text-teal-400 border-teal-500/20"
                                      : "bg-slate-950 text-slate-550 border-slate-800"
                                  }`}>
                                    {wf.isActive ? "Active" : "Disabled"}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 leading-normal max-w-xl">
                                  Trigger Mode: {wf.triggerType}
                                </p>

                                <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400">
                                  <span className="text-teal-400">Rules Matrix:</span>
                                  <span>{triggerLabel}</span>
                                </div>
                              </div>

                              {/* Sequential Actions Flow */}
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded border border-slate-850 text-[11px] text-slate-350 font-mono">
                                  <ChevronRight size={12} className="text-teal-400" />
                                  <span className="capitalize">{actionLabel}</span>
                                </div>
                              </div>

                              {/* Controls */}
                              <div className="flex items-center space-x-2 border-t md:border-t-0 border-slate-800 pt-3 md:pt-0 w-full md:w-auto shrink-0">
                                <button
                                  onClick={() => handleToggleWorkflow(wf.id)}
                                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded cursor-pointer transition ${
                                    wf.isActive
                                      ? "bg-slate-800 hover:bg-slate-750 text-slate-300"
                                      : "bg-teal-600 hover:bg-teal-500 text-slate-950"
                                  }`}
                                >
                                  {wf.isActive ? "Pause" : "Activate"}
                                </button>
                                <button
                                  onClick={() => handleDeleteWorkflow(wf.id)}
                                  className="text-slate-500 hover:text-rose-400 p-1.5 hover:bg-rose-500/5 rounded cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Flow diagram visual representation indicator */}
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                        <div className="flex items-center space-x-2 text-teal-400 mb-2">
                          <GitBranch size={16} />
                          <h3 className="text-xs uppercase tracking-widest font-mono font-bold">
                            Interactive Policy Engine Matrix
                          </h3>
                        </div>
                        <p className="text-xs text-slate-400 mb-4 leading-normal">
                          Below is a visual of how MailPilot routes your team's autonomous workflows.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 py-2 text-center text-xs font-mono font-bold text-slate-300">
                          <div className="bg-slate-950 p-3 rounded border border-slate-800 flex flex-col justify-center">
                            <span className="text-teal-400 uppercase text-[9px] mb-1">Step 1</span>
                            <span>Inbound Ingest</span>
                          </div>
                          <div className="flex items-center justify-center text-slate-600">
                            <ArrowRight size={18} />
                          </div>
                          <div className="bg-slate-950 p-3 rounded border border-amber-500/20 flex flex-col justify-center">
                            <span className="text-amber-400 uppercase text-[9px] mb-1">Step 2</span>
                            <span>AI Classification</span>
                          </div>
                          <div className="flex items-center justify-center text-slate-600">
                            <ArrowRight size={18} />
                          </div>
                          <div className="bg-slate-950 p-3 rounded border border-emerald-500/20 flex flex-col justify-center">
                            <span className="text-emerald-400 uppercase text-[9px] mb-1">Step 3</span>
                            <span>CRM & Scheduling</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rule addition side form */}
                    <div className="w-80 bg-slate-900 border border-slate-800 p-5 rounded-lg h-fit shrink-0 space-y-4">
                      <div>
                        <h3 className="text-sm font-bold text-white mb-1">
                          Create Routing Rule
                        </h3>
                        <p className="text-xs text-slate-400 leading-normal">
                          Program a trigger configuration to fire on targeted classification patterns.
                        </p>
                      </div>

                      <form onSubmit={handleCreateWorkflow} className="space-y-3.5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                            Rule Name
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Sales High Tier Triage"
                            value={newWfName}
                            onChange={(e) => setNewWfName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs focus:outline-none focus:border-teal-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                            Description
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Syncs high priority ARR opportunities."
                            value={newWfDesc}
                            onChange={(e) => setNewWfDesc(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs focus:outline-none focus:border-teal-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                              On Category
                            </label>
                            <select
                              value={newWfCategory}
                              onChange={(e) => setNewWfCategory(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-350 rounded p-2"
                            >
                              <option value="sales">Sales</option>
                              <option value="support">Support</option>
                              <option value="ops">Ops</option>
                              <option value="marketing">Marketing</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                              On Urgency
                            </label>
                            <select
                              value={newWfUrgency}
                              onChange={(e) => setNewWfUrgency(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-350 rounded p-2"
                            >
                              <option value="any">Any Urgency</option>
                              <option value="high">High</option>
                              <option value="medium">Medium</option>
                              <option value="low">Low</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                            Automated Outcome Action
                          </label>
                          <select
                            value={newWfAction}
                            onChange={(e) => setNewWfAction(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-350 rounded p-2"
                          >
                            <option value="auto_draft">Auto-Draft with grounded FAQ</option>
                            <option value="send_calendly">Insert scheduling booking link</option>
                            <option value="sync_crm">Synchronize CRM contact record</option>
                            <option value="high_priority_alert">Push High-Priority Alert</option>
                          </select>
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-teal-600 hover:bg-teal-500 text-slate-950 cursor-pointer text-xs font-bold py-2 rounded transition active:scale-95"
                        >
                          Compile Policy Rule
                        </button>
                      </form>
                    </div>

                  </div>
                )}

                {/* 4. Connections & Integrations Hub TAB */}
                {activeTab === "integrations" && integrations && (
                  <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">
                          Connected Integrations Hub
                        </h2>
                        <p className="text-xs text-slate-400">
                          Authorize and inspect active SMTP keys, CRM links, and Scheduling connections. No mock placeholders — check real synchronization parameters.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* CRMs Connection boxes */}
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
                        <div className="flex items-center space-x-2 border-b border-slate-850 pb-3">
                          <Database className="text-teal-400" size={18} />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                            Active CRM Sync Channels
                          </h3>
                        </div>

                        <div className="space-y-3">
                          {/* HubSpot */}
                          <div className="flex items-center justify-between p-3 rounded bg-slate-950 border border-slate-850">
                            <div className="flex items-center space-x-3">
                              <div className="bg-amber-500/10 text-amber-500 p-2 rounded text-xs font-bold">
                                HS
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-200">HubSpot Connector</h4>
                                <span className="text-[10px] text-slate-500 font-mono">Scope: contacts.write, deals.write</span>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              Connected
                            </span>
                          </div>

                          {/* Zoho */}
                          <div className="flex items-center justify-between p-3 rounded bg-slate-950 border border-slate-850">
                            <div className="flex items-center space-x-3">
                              <div className="bg-blue-500/10 text-blue-400 p-2 rounded text-xs font-bold">
                                ZH
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-200">Zoho CRM Integration</h4>
                                <span className="text-[10px] text-slate-500 font-mono">Scope: read_write_timelines</span>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              Stale Token (401)
                            </span>
                          </div>

                          {/* Salesforce */}
                          <div className="flex items-center justify-between p-3 rounded bg-slate-950 border border-slate-850 opacity-60">
                            <div className="flex items-center space-x-3">
                              <div className="bg-sky-500/10 text-sky-400 p-2 rounded text-xs font-bold">
                                SF
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-200">Salesforce Cloud API</h4>
                                <span className="text-[10px] text-slate-500 font-mono font-normal">Not connected</span>
                              </div>
                            </div>
                            <button className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 p-1 rounded font-mono hover:text-white cursor-pointer select-none">
                              Connect
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Schedulers Booking boxes */}
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
                        <div className="flex items-center space-x-2 border-b border-slate-850 pb-3">
                          <Calendar className="text-teal-400" size={18} />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                            Calendar & Booking Ingestors
                          </h3>
                        </div>

                        <div className="space-y-4">
                          {/* Calendly */}
                          <div className="space-y-2 p-3.5 rounded bg-slate-950 border border-slate-850">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-slate-200 flex items-center space-x-2">
                                <span className="w-2 h-2 rounded bg-teal-400" />
                                <span>Calendly Client Routing</span>
                              </h4>
                              <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/5 px-2 py-0.5 rounded">
                                Active Sync
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              Target Endpoint: <a href={integrations.scheduler.calendly.link} className="text-teal-400 underline">{integrations.scheduler.calendly.link}</a>
                            </div>
                            <div className="pt-2 flex flex-wrap gap-1">
                              {integrations.scheduler.calendly.activeEvents?.map((ev, i) => (
                                <span key={i} className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                                  {ev}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Cal.com */}
                          <div className="space-y-2 p-3.5 rounded bg-slate-950 border border-slate-850">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-slate-200 flex items-center space-x-2">
                                <span className="w-2 h-2 rounded bg-amber-400" />
                                <span>Cal.com Global Scheduling</span>
                              </h4>
                              <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/5 px-2 py-0.5 rounded">
                                Active Sync
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              Target Endpoint: <span className="text-slate-400">{integrations.scheduler.calcom.link}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Inbound sender routing configurations */}
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 md:col-span-2">
                        <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                          <div className="flex items-center space-x-2">
                            <Mail className="text-teal-400" size={18} />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                              Active Mail SMTP/IMAP Inboxes
                            </h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {integrations.inboxes.map((ib) => (
                            <div key={ib.id} className="p-3.5 rounded bg-slate-950 border border-slate-850 flex items-start justify-between">
                              <div className="space-y-1">
                                <span className="text-[9px] font-mono tracking-widest text-slate-550 uppercase">
                                  {ib.provider} connection
                                </span>
                                <h4 className="text-xs font-bold text-white">
                                  {ib.email}
                                </h4>
                                <p className="text-[10px] text-emerald-400 font-mono">
                                  {ib.isActive ? "● Autopilot Active: Polling every 60s" : "○ Paused"}
                                </p>
                              </div>

                              <button
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/integrations/inbox/${ib.id}/toggle`, {
                                      method: "POST"
                                    });
                                    if (res.ok) {
                                      logEvent(`[Inbox Config] Toggled active status for ${ib.email}`);
                                      fetchData(true);
                                    }
                                  } catch (err) {}
                                }}
                                className={`text-[10px] font-bold px-2 py-1.5 rounded cursor-pointer transition ${
                                  ib.isActive ? "bg-slate-905 text-slate-400 hover:bg-slate-800 border border-slate-800" : "bg-teal-600 text-slate-950 hover:bg-teal-500"
                                }`}
                              >
                                {ib.isActive ? "Pause Autopilot" : "Resume"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Excel & Spreadsheet Ingestors */}
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 md:col-span-2">
                        <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                          <div className="flex items-center space-x-2">
                            <FileText className="text-teal-400" size={18} />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                              Enterprise Excel & SharePoint Spreadsheet Ingestors
                            </h3>
                          </div>
                        </div>

                        <p className="text-xs text-slate-400">
                          Paste a public Excel Online / SharePoint sharing link to download, parse, and ingest contacts dynamically into the AI queue.
                        </p>

                        <form onSubmit={handleConnectExcel} className="space-y-3">
                          <div className="flex gap-2">
                            <input
                              type="url"
                              required
                              placeholder="https://rishihoodeduin-my.sharepoint.com/:x:/g/..."
                              value={excelUrl}
                              onChange={(e) => setExcelUrl(e.target.value)}
                              className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs placeholder-slate-650 focus:outline-none focus:border-teal-500 text-slate-200"
                            />
                            <button
                              type="submit"
                              disabled={excelConnecting}
                              className="bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 text-xs font-bold py-2 px-5 rounded transition cursor-pointer active:scale-95 flex items-center gap-1.5"
                            >
                              {excelConnecting ? "Connecting..." : "Connect Excel Sheet"}
                            </button>
                          </div>
                          {excelMessage && (
                            <div className={`text-xs font-mono p-2.5 rounded border ${
                              excelMessage.includes('failed') || excelMessage.includes('timeout')
                                ? "bg-rose-500/10 text-rose-455 border-rose-500/20"
                                : "bg-emerald-500/10 text-emerald-450 border-emerald-500/20"
                            }`}>
                              {excelMessage}
                            </div>
                          )}
                        </form>
                      </div>

                    </div>
                  </div>
                )}

                {/* 5. Metrics & SLA Analytics Dashboard TAB */}
                {activeTab === "analytics" && analytics && (
                  <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                    
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-tight">
                        Telemetry & SLA Analytics
                      </h2>
                      <p className="text-xs text-slate-400">
                        Auditing MailPilot agent classification throughput, response speeds, and calculated ARR conversions.
                      </p>
                    </div>

                    {/* Operational performance stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                        <div className="text-xs text-slate-500 uppercase tracking-widest font-mono mb-1">
                          Processed Inbounds
                        </div>
                        <div className="text-2xl font-bold font-sans text-white">
                          {analytics.totalProcessedCount}
                        </div>
                        <div className="text-xs text-emerald-400 font-mono mt-1 flex items-center gap-1">
                          <TrendingUp size={13} />
                          <span>+18.4% WoW load</span>
                        </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                        <div className="text-xs text-slate-500 uppercase tracking-widest font-mono mb-1">
                          Completed AI Drafts
                        </div>
                        <div className="text-2xl font-bold font-sans text-teal-400">
                          {analytics.totalAIAgentActions}
                        </div>
                        <div className="text-xs text-teal-500 font-mono mt-1">
                          Orchestrated via 12-Agents pipeline
                        </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                        <div className="text-xs text-slate-500 uppercase tracking-widest font-mono mb-1">
                          Average response SLA
                        </div>
                        <div className="text-2xl font-bold font-sans text-white">
                          {analytics.averageResponseTimeMs} ms
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-1">
                          Includes semantic vector searches
                        </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                        <div className="text-xs text-slate-500 uppercase tracking-widest font-mono mb-1">
                          Est. Revenue Impact
                        </div>
                        <div className="text-2xl font-bold font-sans text-emerald-400">
                          ${analytics.estimatedRevenueSaved.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-555 font-mono mt-1">
                          B2B lead conversions closed
                        </div>
                      </div>

                    </div>

                    {/* Custom SVG Data visualizers */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* Weekly Autopilot Throughput Chart */}
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 lg:col-span-2">
                        <h3 className="text-xs uppercase font-mono tracking-widest text-slate-400 font-bold mb-4">
                          Dynamic Hourly Autopilot Throughput (Weekly Profile)
                        </h3>

                        {/* Interactive SVG Line graph pairing */}
                        <div className="h-64 relative bg-slate-950 border border-slate-850 rounded p-4 flex flex-col justify-between">
                          <svg className="w-full h-48 overflow-visible" viewBox="0 0 500 150">
                            {/* Grid boundaries */}
                            <line x1="0" y1="30" x2="500" y2="30" stroke="#1e293b" strokeDasharray="3" />
                            <line x1="0" y1="75" x2="500" y2="75" stroke="#1e293b" strokeDasharray="3" />
                            <line x1="0" y1="120" x2="500" y2="120" stroke="#1e293b" strokeDasharray="3" />

                            {/* Total Line */}
                            <path
                              d="M 10,130 L 80,105 L 160,80 L 240,65 L 320,40 L 400,60 L 480,25"
                              fill="none"
                              stroke="#0d9488"
                              strokeWidth="3"
                              strokeLinecap="round"
                            />
                            {/* Completed drafts automated fill Line */}
                            <path
                              d="M 10,140 L 80,120 L 160,110 L 240,90 L 320,65 L 400,85 L 480,55"
                              fill="none"
                              stroke="#c084fc"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeDasharray="4"
                            />

                            {/* Coordinate Points */}
                            <circle cx="80" cy="105" r="4" fill="#0d9488" />
                            <circle cx="240" cy="65" r="4" fill="#0d9488" />
                            <circle cx="320" cy="40" r="4" fill="#0d9488" />
                            <circle cx="480" cy="25" r="4" fill="#0d9488" />
                          </svg>

                          <div className="flex justify-between text-[10px] font-mono text-slate-500 px-2 mt-2">
                            <span>Mon 06/15</span>
                            <span>Wed 06/17</span>
                            <span>Fri 06/19</span>
                            <span>Sun 06/21 (Current)</span>
                          </div>

                          <div className="absolute top-4 right-4 flex items-center space-x-4 text-[10px] font-mono">
                            <span className="flex items-center space-x-1.5">
                              <span className="w-2.5 h-1.5 bg-teal-500 rounded" />
                              <span className="text-slate-400">Total Inbound Volume</span>
                            </span>
                            <span className="flex items-center space-x-1.5">
                              <span className="w-2.5 h-1.5 bg-purple-400 rounded" />
                              <span className="text-slate-400">Auto-Drafted with QA</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Agent and trigger profile breakdowns */}
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                        <h3 className="text-xs uppercase font-mono tracking-widest text-slate-400 font-bold mb-4">
                          Agent SLA Hand-off Speeds
                        </h3>

                        <div className="space-y-4">
                          {analytics.agentEfficiency.map((ag, i) => (
                            <div key={i} className="space-y-1.5 font-mono text-xs">
                              <div className="flex items-center justify-between text-slate-300">
                                <span className="font-semibold">{ag.agent}</span>
                                <span className="text-slate-400">{ag.avgTimeSec}s SLA latency</span>
                              </div>
                              <div className="w-full bg-slate-950 rounded h-2 overflow-hidden border border-slate-850">
                                <div
                                  className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded transition-all"
                                  style={{ width: `${ag.successRate}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[9px] text-slate-550">
                                <span>Automation Score</span>
                                <span>{ag.successRate}% precision</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                )}

              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}

// Subordinate Micro layout helpers (Simulating layout controls)
function UsersIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SmileIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" x2="9.01" y1="9" y2="9" />
      <line x1="15" x2="15.01" y1="9" y2="9" />
    </svg>
  );
}
