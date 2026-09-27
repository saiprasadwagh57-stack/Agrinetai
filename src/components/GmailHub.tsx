import React, { useState, useEffect } from "react";
import { 
  Mail, 
  Send, 
  RefreshCw, 
  Trash2, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Inbox, 
  Sparkles, 
  ExternalLink, 
  UserCheck, 
  X, 
  ChevronRight,
  ShieldCheck,
  FileText,
  Clock,
  ArrowRight
} from "lucide-react";
import { 
  getGmailAccessToken, 
  isGmailConnected, 
  connectGmailAccount, 
  getGmailProfile, 
  listGmailMessages, 
  getGmailMessageContent, 
  sendGmailEmail, 
  trashGmailMessage,
  GmailUserProfile, 
  GmailMessageSummary,
  SendEmailPayload
} from "../lib/gmail";

interface GmailHubProps {
  currentUserEmail?: string;
  currentUserName?: string;
  defaultComposeTo?: string;
  defaultComposeSubject?: string;
  defaultComposeBody?: string;
  onCloseCompose?: () => void;
}

export const GmailHub: React.FC<GmailHubProps> = ({
  currentUserEmail = "",
  currentUserName = "Farmer",
  defaultComposeTo = "",
  defaultComposeSubject = "",
  defaultComposeBody = "",
  onCloseCompose
}) => {
  const [token, setToken] = useState<string | null>(getGmailAccessToken());
  const [isConnecting, setIsConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [profile, setProfile] = useState<GmailUserProfile | null>(null);
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"inbox" | "agrinet" | "sent">("inbox");

  // Selected message for details
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageSummary | null>(null);
  const [messageBody, setMessageBody] = useState<string>("");
  const [isLoadingBody, setIsLoadingBody] = useState(false);

  // Compose State
  const [showCompose, setShowCompose] = useState(Boolean(defaultComposeTo || defaultComposeSubject));
  const [composeTo, setComposeTo] = useState(defaultComposeTo);
  const [composeSubject, setComposeSubject] = useState(defaultComposeSubject);
  const [composeBody, setComposeBody] = useState(defaultComposeBody);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessMsg, setSendSuccessMsg] = useState<string | null>(null);

  // Mandatory Workspace Skill Confirmation Modal
  const [showConfirmSendModal, setShowConfirmSendModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<SendEmailPayload | null>(null);

  // Mandatory Delete Confirmation Modal
  const [itemToDelete, setItemToDelete] = useState<GmailMessageSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check token on mount and refresh profile
  useEffect(() => {
    const curToken = getGmailAccessToken();
    setToken(curToken);
    if (curToken) {
      loadProfileAndMessages(curToken);
    }
  }, []);

  // Update defaults when props change
  useEffect(() => {
    if (defaultComposeTo || defaultComposeSubject) {
      setComposeTo(defaultComposeTo);
      setComposeSubject(defaultComposeSubject);
      if (defaultComposeBody) setComposeBody(defaultComposeBody);
      setShowCompose(true);
    }
  }, [defaultComposeTo, defaultComposeSubject, defaultComposeBody]);

  const loadProfileAndMessages = async (authToken: string) => {
    setIsLoadingMessages(true);
    setAuthError(null);
    try {
      const prof = await getGmailProfile(authToken);
      setProfile(prof);

      let q = "";
      if (activeTab === "agrinet") {
        q = "mandi OR harvest OR crop OR farmer OR agrinet OR wheat OR rice OR produce";
      } else if (activeTab === "sent") {
        q = "in:sent";
      }

      if (searchQuery.trim()) {
        q = q ? `${q} ${searchQuery.trim()}` : searchQuery.trim();
      }

      const msgs = await listGmailMessages(authToken, { query: q, maxResults: 15 });
      setMessages(msgs);
    } catch (err: any) {
      console.error("Failed to load Gmail data:", err);
      if (err?.message?.includes("401") || err?.message?.includes("Invalid Credentials")) {
        setToken(null);
        setAuthError("Your Gmail session has expired. Please re-authenticate your Google account.");
      } else {
        setAuthError(err?.message || "Failed to load Gmail messages.");
      }
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleConnectGmail = async () => {
    setIsConnecting(true);
    setAuthError(null);
    try {
      const authResult = await connectGmailAccount();
      if (authResult?.accessToken) {
        setToken(authResult.accessToken);
        await loadProfileAndMessages(authResult.accessToken);
      }
    } catch (err: any) {
      console.error("Failed to connect Gmail:", err);
      setAuthError(err?.message || "Failed to authorize Gmail with Google.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSelectMessage = async (msg: GmailMessageSummary) => {
    setSelectedMessage(msg);
    if (!token) return;
    setIsLoadingBody(true);
    setMessageBody("");
    try {
      const body = await getGmailMessageContent(token, msg.id);
      setMessageBody(body || msg.snippet);
    } catch (err) {
      console.error("Failed to load email body:", err);
      setMessageBody(msg.snippet);
    } finally {
      setIsLoadingBody(false);
    }
  };

  // Pre-fill Agriculture Email Templates
  const applyTemplate = (type: "inquiry" | "offer" | "receipt" | "harvest") => {
    if (type === "inquiry") {
      setComposeSubject("🌾 Mandi Harvest Availability & Price Inquiry");
      setComposeBody(
        `<p>Dear Partner,</p>` +
        `<p>I am writing from <strong>AgriNet AI</strong> to inquire regarding your current batch availability and wholesale mandi rates.</p>` +
        `<p><strong>Items of interest:</strong> Wheat / Rice / Fresh produce<br/>` +
        `<strong>Desired quantity:</strong> 50 - 500 Quintals<br/>` +
        `<strong>Target delivery window:</strong> Within this week</p>` +
        `<p>Looking forward to your favorable quote and terms.</p>` +
        `<p>Regards,<br/><strong>${currentUserName}</strong><br/>AgriNet AI Verified Trader</p>`
      );
    } else if (type === "offer") {
      setComposeSubject("🤝 Official Purchase Offer for Agricultural Produce");
      setComposeBody(
        `<p>Hello,</p>` +
        `<p>We are interested in purchasing your listed harvest via AgriNet AI platform.</p>` +
        `<p><strong>Offered Rate:</strong> Mandi benchmark price with instant UPI/Bank settlement upon quality check.<br/>` +
        `<strong>Transportation:</strong> Farm-gate pickup or Mandi delivery arrangement.</p>` +
        `<p>Please confirm your acceptance or suitable timings for dispatch.</p>` +
        `<p>Best regards,<br/><strong>${currentUserName}</strong></p>`
      );
    } else if (type === "receipt") {
      setComposeSubject("🧾 AgriNet AI - Order Confirmation & Trade Note");
      setComposeBody(
        `<div style="font-family: sans-serif; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px;">` +
        `<h2 style="color: #059669; margin-top: 0;">🌾 AgriNet AI Trade Receipt</h2>` +
        `<p>Thank you for conducting your agricultural trade through AgriNet AI.</p>` +
        `<p><strong>Status:</strong> Confirmed & Dispatched<br/>` +
        `<strong>Payment:</strong> Escrow Protected</p>` +
        `<p>For inquiries, please reply directly to this email.</p>` +
        `</div>`
      );
    } else if (type === "harvest") {
      setComposeSubject("📢 Fresh Harvest Ready for Dispatch - AgriNet AI");
      setComposeBody(
        `<p>Dear Buyers,</p>` +
        `<p>A fresh batch of premium quality grade produce has just been harvested and inspected:</p>` +
        `<ul>` +
        `<li><strong>Grade:</strong> Grade A (Fresh)</li>` +
        `<li><strong>Packaging:</strong> Standard 50kg gunny bags</li>` +
        `<li><strong>Location:</strong> Local Mandi Hub</li>` +
        `</ul>` +
        `<p>Available for immediate booking on AgriNet AI.</p>` +
        `<p>Warm regards,<br/><strong>${currentUserName}</strong></p>`
      );
    }
  };

  // Step 1: Open Mandatory Workspace Confirmation Dialog before sending
  const handleInitiateSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim()) {
      alert("Please specify a recipient email address.");
      return;
    }
    if (!composeSubject.trim()) {
      alert("Please provide an email subject.");
      return;
    }

    setPendingPayload({
      to: composeTo.trim(),
      subject: composeSubject.trim(),
      htmlBody: composeBody.trim() || "<p>(Empty message)</p>",
    });
    setShowConfirmSendModal(true);
  };

  // Step 2: Execute actual send via Gmail API after user confirms
  const handleConfirmSend = async () => {
    if (!token || !pendingPayload) return;
    const sender = profile?.emailAddress || currentUserEmail || "me";

    setIsSending(true);
    setShowConfirmSendModal(false);
    try {
      await sendGmailEmail(token, sender, pendingPayload);
      setSendSuccessMsg(`Email successfully sent to ${pendingPayload.to} via Gmail!`);
      setShowCompose(false);
      setPendingPayload(null);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      if (onCloseCompose) onCloseCompose();
      // Refresh message list
      await loadProfileAndMessages(token);
    } catch (err: any) {
      console.error("Error sending email:", err);
      alert(`Failed to send email: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSending(false);
    }
  };

  // Mandatory delete confirmation
  const handleConfirmTrash = async () => {
    if (!token || !itemToDelete) return;
    setIsDeleting(true);
    try {
      await trashGmailMessage(token, itemToDelete.id);
      setMessages((prev) => prev.filter((m) => m.id !== itemToDelete.id));
      if (selectedMessage?.id === itemToDelete.id) {
        setSelectedMessage(null);
      }
      setItemToDelete(null);
    } catch (err: any) {
      alert(`Could not delete message: ${err?.message || "Error"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Gmail Status */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shadow-inner">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">Gmail Integration Hub</h2>
                {token ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                    <Clock className="w-3.5 h-3.5" />
                    Not Connected
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Send official farm invoices, trade inquiries, and sync mandi emails directly from your Gmail account.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {token ? (
              <>
                <button
                  onClick={() => loadProfileAndMessages(token)}
                  disabled={isLoadingMessages}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingMessages ? "animate-spin text-emerald-600" : ""}`} />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={() => setShowCompose(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Compose Email</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleConnectGmail}
                disabled={isConnecting}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting Gmail...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>Connect with Gmail</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Account Info Pill if connected */}
        {profile && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">Active Gmail:</span>
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-emerald-800 font-medium">
                {profile.emailAddress}
              </span>
            </div>
            <div className="flex items-center gap-4 text-slate-500">
              <span>Total Messages: <strong>{profile.messagesTotal?.toLocaleString() || "0"}</strong></span>
              <span>Threads: <strong>{profile.threadsTotal?.toLocaleString() || "0"}</strong></span>
            </div>
          </div>
        )}

        {authError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        {sendSuccessMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{sendSuccessMsg}</span>
            </div>
            <button onClick={() => setSendSuccessMsg(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {!token ? (
        /* Not Connected State Card */
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-xl mx-auto shadow-sm space-y-6">
          <div className="w-16 h-16 bg-gradient-to-tr from-red-500 to-amber-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <Mail className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Empower Your Agri-Business with Gmail</h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Connect your Gmail account to send verified trade proposals, receive notifications from mandi buyers,
              and coordinate directly with agricultural merchants without leaving AgriNet AI.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Send className="w-3.5 h-3.5 text-emerald-600" />
                <span>One-Click Farm Invoicing</span>
              </div>
              <p className="text-[11px] text-slate-500">Send formatted trade agreements and receipts with 1-click confirmation.</p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Verified Direct Sender</span>
              </div>
              <p className="text-[11px] text-slate-500">Emails are delivered straight from your official Gmail identity.</p>
            </div>
          </div>

          <button
            onClick={handleConnectGmail}
            disabled={isConnecting}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authorizing Gmail via Google...</span>
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                <span>Connect Gmail with Google</span>
              </>
            )}
          </button>
          <p className="text-[11px] text-slate-400">
            AgriNet AI respects your privacy. All tokens remain stored in browser memory only during your session.
          </p>
        </div>
      ) : (
        /* Connected State: Messages & Toolbar */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Navigation & Message List */}
          <div className="lg:col-span-6 xl:col-span-5 space-y-4">
            {/* Search & Tabs */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search emails (mandi, wheat, order)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && token && loadProfileAndMessages(token)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-medium">
                <button
                  onClick={() => {
                    setActiveTab("inbox");
                    if (token) loadProfileAndMessages(token);
                  }}
                  className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTab === "inbox" ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Inbox
                </button>
                <button
                  onClick={() => {
                    setActiveTab("agrinet");
                    if (token) loadProfileAndMessages(token);
                  }}
                  className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                    activeTab === "agrinet" ? "bg-white text-emerald-800 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Agri Trades
                </button>
                <button
                  onClick={() => {
                    setActiveTab("sent");
                    if (token) loadProfileAndMessages(token);
                  }}
                  className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTab === "sent" ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Sent
                </button>
              </div>
            </div>

            {/* Email List Container */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100 overflow-hidden">
              {isLoadingMessages ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
                  <p className="text-xs">Fetching your Gmail messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <Inbox className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">No emails found</p>
                  <p className="text-xs text-slate-400">Try changing your search terms or refresh.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isSelected = selectedMessage?.id === msg.id;
                  return (
                    <div
                      key={msg.id}
                      onClick={() => handleSelectMessage(msg)}
                      className={`p-4 text-left transition-all cursor-pointer relative hover:bg-slate-50/80 ${
                        isSelected ? "bg-emerald-50/60 border-l-4 border-l-emerald-600" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {msg.unread && (
                            <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" title="Unread" />
                          )}
                          <span className={`text-xs truncate ${msg.unread ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>
                            {msg.sender.split("<")[0].replace(/"/g, "") || msg.sender}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">
                          {msg.date ? new Date(msg.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ""}
                        </span>
                      </div>

                      <h4 className={`text-xs mt-1 truncate ${msg.unread ? "font-bold text-slate-900" : "text-slate-800"}`}>
                        {msg.subject}
                      </h4>

                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {msg.snippet}
                      </p>

                      <div className="flex items-center justify-between mt-2 pt-1">
                        <div className="flex items-center gap-1">
                          {msg.labels.includes("INBOX") && (
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">Inbox</span>
                          )}
                          {msg.labels.includes("SENT") && (
                            <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">Sent</span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemToDelete(msg);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                          title="Move to Trash"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Selected Email Details or Empty State */}
          <div className="lg:col-span-6 xl:col-span-7">
            {selectedMessage ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-snug">
                      {selectedMessage.subject}
                    </h3>
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      <p>
                        <span className="font-semibold text-slate-800">From:</span> {selectedMessage.sender}
                      </p>
                      {selectedMessage.recipient && (
                        <p>
                          <span className="font-semibold text-slate-800">To:</span> {selectedMessage.recipient}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400">
                        {selectedMessage.date ? new Date(selectedMessage.date).toLocaleString() : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const emailMatch = selectedMessage.sender.match(/<([^>]+)>/);
                        const replyTo = emailMatch ? emailMatch[1] : selectedMessage.sender;
                        setComposeTo(replyTo);
                        setComposeSubject(
                          selectedMessage.subject.startsWith("Re:")
                            ? selectedMessage.subject
                            : `Re: ${selectedMessage.subject}`
                        );
                        setComposeBody(`<br/><br/><blockquote>On ${selectedMessage.date}, ${selectedMessage.sender} wrote:<br/>${messageBody}</blockquote>`);
                        setShowCompose(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Reply via Gmail</span>
                    </button>
                    <button
                      onClick={() => setItemToDelete(selectedMessage)}
                      className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors"
                      title="Move to Trash"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Email Body Content */}
                <div className="pt-2">
                  {isLoadingBody ? (
                    <div className="py-12 text-center text-slate-400 space-y-2">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
                      <p className="text-xs">Loading email content...</p>
                    </div>
                  ) : (
                    <div
                      className="prose prose-sm max-w-none text-slate-800 overflow-x-auto text-xs leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: messageBody || selectedMessage.snippet }}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm text-slate-400 space-y-3">
                <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                  <Mail className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-700">No Email Selected</h4>
                <p className="text-xs max-w-sm mx-auto">
                  Select an email message from the list on the left to read its full content, or click <strong>Compose Email</strong> to dispatch a new message via Gmail.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compose Email Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Compose Email via Gmail</h3>
                  <p className="text-xs text-slate-500">
                    Sending from: <span className="font-mono text-emerald-700 font-medium">{profile?.emailAddress || currentUserEmail || "Gmail Account"}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCompose(false);
                  if (onCloseCompose) onCloseCompose();
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Templates Selector */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Quick Agriculture Templates:
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyTemplate("inquiry")}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 transition-colors cursor-pointer"
                >
                  🌾 Mandi Price Inquiry
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate("offer")}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-700 hover:text-blue-800 transition-colors cursor-pointer"
                >
                  🤝 Purchase Offer
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate("receipt")}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 text-slate-700 hover:text-amber-800 transition-colors cursor-pointer"
                >
                  🧾 Trade Receipt
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate("harvest")}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 transition-colors cursor-pointer"
                >
                  📢 Fresh Harvest Bulletin
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleInitiateSend} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Recipient Email (To) <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="buyer@example.com or farmer@example.com"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Subject of your communication"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Message Content (HTML / Text) <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={7}
                  required
                  placeholder="Write your email message here..."
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-sans bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                />
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-900 text-xs flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                <span>You will be prompted to confirm this action before sending via Gmail API.</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowCompose(false);
                    if (onCloseCompose) onCloseCompose();
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Review & Send Email</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANDATORY WORKSPACE SKILL USER CONFIRMATION MODAL BEFORE SENDING EMAIL */}
      {showConfirmSendModal && pendingPayload && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900">Confirm Sending Email via Gmail</h3>
              <p className="text-xs text-slate-500 mt-1">
                Please confirm that you want to send this email through your connected Google Workspace Gmail account.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">From:</span>
                <span className="font-semibold text-slate-800">{profile?.emailAddress || currentUserEmail}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">To:</span>
                <span className="font-semibold text-emerald-800">{pendingPayload.to}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Subject:</span>
                <span className="font-semibold text-slate-900 block truncate">{pendingPayload.subject}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmSendModal(false);
                }}
                disabled={isSending}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                disabled={isSending}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm & Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANDATORY WORKSPACE SKILL USER CONFIRMATION MODAL BEFORE TRASHING EMAIL */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900">Move Email to Trash?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to move <strong>"{itemToDelete.subject}"</strong> to your Gmail trash?
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmTrash}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Move to Trash</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
