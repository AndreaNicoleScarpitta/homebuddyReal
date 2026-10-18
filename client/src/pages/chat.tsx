import { Layout } from "@/components/layout";
import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Camera, Loader2, AlertCircle, X, Info, Plus, PanelLeftClose, PanelLeftOpen, MessageSquare, Clock, Search, ArrowLeft, ArrowUpRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getHome, getChatSessions, createChatSession, getChatSession, updateChatSessionTitle } from "@/lib/api";
import type { ChatSession, V2ChatMessage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { PhotoConsentModal, usePhotoConsent } from "@/components/photo-consent-modal";
import { Link } from "wouter";
import logoImage from "@assets/generated_images/orange_house_logo_with_grey_gear..png";
import { trackEvent, trackSlugPageView } from "@/lib/analytics";
import { PAGE_SLUGS } from "@/lib/slug-registry";
import { useIsMobile } from "@/hooks/use-mobile";

function renderRichText(text: string): React.JSX.Element {
  const lines = text.split('\n');
  const elements: React.JSX.Element[] = [];
  let listItems: string[] = [];
  let inList = false;

  const processInlineMarkdown = (line: string): React.JSX.Element[] => {
    const parts: React.JSX.Element[] = [];
    let remaining = line;
    let keyIndex = 0;

    while (remaining) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const italicMatch = remaining.match(/(?<!\*)\*([^*]+?)\*(?!\*)/);
      const codeMatch = remaining.match(/`([^`]+)`/);

      if (boldMatch && (!italicMatch || boldMatch.index! <= italicMatch.index!) && (!codeMatch || boldMatch.index! <= codeMatch.index!)) {
        if (boldMatch.index! > 0) {
          parts.push(<span key={keyIndex++}>{remaining.slice(0, boldMatch.index)}</span>);
        }
        parts.push(<strong key={keyIndex++} className="font-semibold">{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch.index! + boldMatch[0].length);
      } else if (italicMatch && (!codeMatch || italicMatch.index! <= codeMatch.index!)) {
        if (italicMatch.index! > 0) {
          parts.push(<span key={keyIndex++}>{remaining.slice(0, italicMatch.index)}</span>);
        }
        parts.push(<em key={keyIndex++}>{italicMatch[1]}</em>);
        remaining = remaining.slice(italicMatch.index! + italicMatch[0].length);
      } else if (codeMatch) {
        if (codeMatch.index! > 0) {
          parts.push(<span key={keyIndex++}>{remaining.slice(0, codeMatch.index)}</span>);
        }
        parts.push(<code key={keyIndex++} className="bg-muted px-1 py-0.5 rounded text-sm font-mono">{codeMatch[1]}</code>);
        remaining = remaining.slice(codeMatch.index! + codeMatch[0].length);
      } else {
        parts.push(<span key={keyIndex++}>{remaining}</span>);
        break;
      }
    }
    return parts;
  };

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-2">
          {listItems.map((item, i) => (
            <li key={i}>{processInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  lines.forEach((line, i) => {
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={i} className="font-semibold text-foreground mt-3 mb-1">{processInlineMarkdown(trimmedLine.slice(4))}</h4>
      );
    } else if (trimmedLine.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={i} className="font-bold text-foreground mt-3 mb-1.5 text-base">{processInlineMarkdown(trimmedLine.slice(3))}</h3>
      );
    } else if (trimmedLine.startsWith('# ')) {
      flushList();
      elements.push(
        <h2 key={i} className="font-bold text-foreground mt-4 mb-2 text-lg">{processInlineMarkdown(trimmedLine.slice(2))}</h2>
      );
    } else if (/^[-*]\s/.test(trimmedLine)) {
      inList = true;
      listItems.push(trimmedLine.slice(2));
    } else if (/^\d+\.\s/.test(trimmedLine)) {
      if (!inList || listItems.length === 0) {
        flushList();
        inList = true;
      }
      listItems.push(trimmedLine.replace(/^\d+\.\s/, ''));
    } else if (trimmedLine === '') {
      flushList();
      elements.push(<div key={i} className="h-2" />);
    } else {
      flushList();
      elements.push(
        <p key={i} className="leading-relaxed">{processInlineMarkdown(line)}</p>
      );
    }
  });

  flushList();

  return <div className="space-y-1">{elements}</div>;
}

function formatSessionDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface SessionListProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  isCreating: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

function SessionList({ sessions, activeSessionId, onSelectSession, onNewChat, isCreating, searchQuery, onSearchChange }: SessionListProps) {
  const filtered = searchQuery.trim()
    ? sessions.filter(s => (s.title || "New conversation").toLowerCase().includes(searchQuery.toLowerCase()))
    : sessions;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <Button
          onClick={onNewChat}
          disabled={isCreating}
          className="w-full gap-2"
          data-testid="button-new-chat"
        >
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New Chat
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            data-testid="input-chat-search"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>{searchQuery ? "No matches" : "No conversations yet"}</p>
            </div>
          ) : (
            filtered.map((session) => (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors text-sm group ${
                  activeSessionId === session.id
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "hover:bg-muted text-foreground"
                }`}
                data-testid={`button-session-${session.id}`}
              >
                <div className="font-medium line-clamp-2 break-words">
                  {session.title || "New conversation"}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatSessionDate(session.createdAt)}</span>
                  <span>·</span>
                  <span>{session.messageCount} msg{session.messageCount !== 1 ? "s" : ""}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function Chat() {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => { trackSlugPageView(PAGE_SLUGS.chat); }, []);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<V2ChatMessage[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [hasAutoTitled, setHasAutoTitled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSafetyNotice, setShowSafetyNotice] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hasConsented, isLoaded, grantConsent } = usePhotoConsent();
  const isMobile = useIsMobile();

  const { data: home } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
  });

  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery({
    queryKey: ["chatSessions", home?.id],
    queryFn: () => getChatSessions(home!.id),
    enabled: !!home?.id,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [sessionMessages, streamingMessage]);

  const loadSession = useCallback(async (sessionId: string) => {
    setIsLoadingSession(true);
    try {
      const data = await getChatSession(sessionId);
      const mapped: V2ChatMessage[] = data.messages.map((m: any) => ({
        id: m.message_id || m.id,
        homeId: m.home_id || m.homeId || "",
        role: m.role,
        content: m.content,
        createdAt: m.created_at || m.createdAt || "",
      }));
      setSessionMessages(mapped);
      setActiveSessionId(sessionId);
      setHasAutoTitled(true);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load conversation.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSession(false);
    }
  }, [toast]);

  const handleSelectSession = useCallback((sessionId: string) => {
    if (sessionId === activeSessionId) return;
    loadSession(sessionId);
    setMobileSidebarOpen(false);
  }, [activeSessionId, loadSession]);

  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
    setSessionMessages([]);
    setHasAutoTitled(false);
    setStreamingMessage("");
    setInput("");
    setMobileSidebarOpen(false);
    trackEvent("click", "chat", "new_chat");
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 10MB",
        variant: "destructive",
      });
      return;
    }

    if (!isLoaded) {
      return;
    }
    
    if (!hasConsented) {
      setPendingImageFile(file);
      setShowConsentModal(true);
    } else {
      attachImage(file);
    }
  };

  const attachImage = (file: File) => {
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleConsentAccept = () => {
    grantConsent();
    setShowConsentModal(false);
    if (pendingImageFile) {
      attachImage(pendingImageFile);
      setPendingImageFile(null);
    }
  };

  const handleConsentCancel = () => {
    setShowConsentModal(false);
    setPendingImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSend = async (suggestedPrompt?: string) => {
    const userMessage = suggestedPrompt ?? input;
    if ((!userMessage.trim() && !selectedImage) || !home || isStreaming) return;
    const imageToSend = selectedImage;
    const imagePreviewToSend = imagePreview;
    
    setInput("");
    setSelectedImage(null);
    setImagePreview(null);
    setIsStreaming(true);
    setStreamingMessage("");

    trackEvent('send_message', 'chat', imageToSend ? 'with_photo' : 'text_only');

    let currentSessionId = activeSessionId;

    try {
      if (!currentSessionId) {
        setIsCreatingSession(true);
        try {
          const { sessionId } = await createChatSession(home.id);
          currentSessionId = sessionId;
          setActiveSessionId(sessionId);
        } catch {
          toast({
            title: "Error",
            description: "Failed to create chat session.",
            variant: "destructive",
          });
          setIsStreaming(false);
          setIsCreatingSession(false);
          return;
        } finally {
          setIsCreatingSession(false);
        }
      }

      const userMsg: V2ChatMessage = {
        id: crypto.randomUUID(),
        homeId: home.id,
        role: "user",
        content: userMessage || "What can you tell me about this?",
        createdAt: new Date().toISOString(),
      };
      setSessionMessages(prev => [...prev, userMsg]);

      let imageBase64: string | undefined;
      if (imageToSend && imagePreviewToSend) {
        imageBase64 = imagePreviewToSend.split(",")[1];
      }

      const response = await fetch(`/v2/homes/${home.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ 
          content: userMessage || "What can you tell me about this?",
          image: imageBase64,
          imageType: imageToSend?.type,
          sessionId: currentSessionId,
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullResponse += data.content;
                  setStreamingMessage(prev => prev + data.content);
                } else if (data.done) {
                  queryClient.invalidateQueries({ queryKey: ["chatSessions", home.id] });
                } else if (data.error) {
                  toast({
                    title: "Error",
                    description: data.error,
                    variant: "destructive",
                  });
                }
              } catch {}
            }
          }
        }
      }

      if (fullResponse) {
        const assistantMsg: V2ChatMessage = {
          id: crypto.randomUUID(),
          homeId: home.id,
          role: "assistant",
          content: fullResponse,
          createdAt: new Date().toISOString(),
        };
        setSessionMessages(prev => [...prev, assistantMsg]);
      }

      if (!hasAutoTitled && currentSessionId && userMessage.trim()) {
        const title = userMessage.trim().slice(0, 80);
        try {
          await updateChatSessionTitle(currentSessionId, title);
          queryClient.invalidateQueries({ queryKey: ["chatSessions", home.id] });
        } catch {}
        setHasAutoTitled(true);
      }

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
      setStreamingMessage("");
    }
  };

  if (!home) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-muted-foreground">Please complete your home profile first.</p>
          </div>
        </div>
      </Layout>
    );
  }

  const messages = sessionMessages;
  const isLoading = isLoadingSession;

  const sidebarContent = (
    <SessionList
      sessions={sessions}
      activeSessionId={activeSessionId}
      onSelectSession={handleSelectSession}
      onNewChat={handleNewChat}
      isCreating={isCreatingSession}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    />
  );

  return (
    <Layout immersive>
      <PhotoConsentModal 
        isOpen={showConsentModal} 
        onAccept={handleConsentAccept}
        onCancel={handleConsentCancel}
      />
      
      <div className="flex h-full min-h-0 w-full">
        {!isMobile && sidebarOpen && (
          <div className="w-[300px] shrink-0 border-r bg-card/50 flex flex-col" data-testid="sidebar-sessions">
            {sidebarContent}
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-card/80 px-3 py-2.5 md:px-5">
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              {isMobile && (
                <Link href="/dashboard" aria-label="Back to Home" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              )}
              {isMobile ? (
                <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Open conversation history" className="h-10 w-10 shrink-0" data-testid="button-mobile-sidebar">
                      <PanelLeftOpen className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[280px] p-0">
                    {sidebarContent}
                  </SheetContent>
                </Sheet>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={sidebarOpen ? "Close conversation history" : "Open conversation history"}
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="shrink-0"
                  data-testid="button-toggle-sidebar"
                >
                  {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
                </Button>
              )}
              <div className="min-w-0">
                <h1 className="truncate text-base font-heading font-bold leading-tight md:text-xl" data-testid="text-heading">Home Assistant</h1>
                <p className="truncate text-xs text-muted-foreground">Repairs, maintenance and costs</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleNewChat}
              disabled={isCreatingSession || isStreaming}
              aria-label="Start a new conversation"
              className="h-10 w-10 shrink-0"
              data-testid="button-new-chat-header"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </header>

          {showSafetyNotice && (
            <div role="note" className="mx-3 mt-2 flex shrink-0 items-start gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground md:mx-5" data-testid="chat-safety-notice">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="min-w-0 flex-1 leading-relaxed">
                General guidance, not professional advice. <Link href="/terms" className="font-medium underline underline-offset-2">View terms</Link>
              </p>
              <button type="button" onClick={() => setShowSafetyNotice(false)} aria-label="Dismiss informational notice" className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="Home Assistant conversation">
            <ScrollArea className="min-h-0 flex-1" data-testid="chat-message-scroll">
              <div className="mx-auto w-full max-w-3xl px-3 pb-5 pt-4 md:px-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-sm text-muted-foreground">Loading messages...</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="mx-auto flex w-full max-w-lg flex-col gap-5 py-3 md:py-10" data-testid="chat-empty-state">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Home className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-heading font-semibold">What can I help with?</h2>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Troubleshoot a problem, prioritize maintenance, or understand repair costs for your home.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested questions</p>
                    <button type="button"
                      onClick={() => { trackEvent("click", "chat", "suggestion_prioritize"); void handleSend("What maintenance tasks should I prioritize for my home?"); }}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted"
                      data-testid="button-suggestion-prioritize"
                    >
                      <span>What maintenance should I prioritize?</span><ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                    <button type="button"
                      onClick={() => { trackEvent("click", "chat", "suggestion_budget"); void handleSend("How much could a home repair cost?"); }}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted"
                      data-testid="button-suggestion-budget"
                    >
                      <span>How much could a repair cost?</span><ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                    <button type="button"
                      onClick={() => { trackEvent("click", "chat", "suggestion_diy"); void handleSend("Help me safely diagnose a problem with my home."); }}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted"
                      data-testid="button-suggestion-diy"
                    >
                      <span>Help me diagnose a problem</span><ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">You can also attach a photo using the camera below. Estimates are general ranges, not quotes.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 md:gap-4 ${
                        msg.role === "user" ? "flex-row-reverse" : "flex-row"
                      }`}
                      data-testid={`message-${msg.id}`}
                    >
                      <Avatar className="h-8 w-8 shrink-0 border shadow-sm md:h-10 md:w-10">
                        {msg.role === "assistant" ? (
                          <AvatarImage src={logoImage} />
                        ) : null}
                        <AvatarFallback className={msg.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-muted"}>
                          {msg.role === "assistant" ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className={`flex flex-col gap-1 max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                        <span className="text-xs text-muted-foreground font-medium mb-1">
                          {msg.role === "assistant" ? "Home Buddy" : "You"}
                        </span>
                        <div
                          className={`p-3 md:p-4 rounded-2xl shadow-sm text-sm leading-relaxed break-words ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-tr-none"
                              : "bg-card border text-foreground rounded-tl-none"
                          }`}
                        >
                          <div className={msg.role === "assistant" ? "" : "whitespace-pre-wrap"}>
                          {msg.role === "assistant" ? renderRichText(msg.content) : msg.content}
                        </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {streamingMessage && (
                    <div className="flex gap-2.5 md:gap-4">
                      <Avatar className="h-10 w-10 border shadow-sm">
                        <AvatarImage src={logoImage} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <Bot className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-1 max-w-[80%] items-start">
                        <span className="text-xs text-muted-foreground font-medium mb-1">
                          Home Buddy
                        </span>
                        <div className="rounded-2xl rounded-tl-none border bg-card p-3 text-sm leading-relaxed text-foreground shadow-sm md:p-4">
                          <div>{renderRichText(streamingMessage)}</div>
                          <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-1" />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {isStreaming && !streamingMessage && (
                    <div className="flex gap-4">
                      <Avatar className="h-10 w-10 border shadow-sm">
                        <AvatarImage src={logoImage} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <Bot className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-1 max-w-[80%] items-start">
                        <span className="text-xs text-muted-foreground font-medium mb-1">
                          Home Buddy
                        </span>
                        <div className="rounded-2xl rounded-tl-none border bg-card p-3 text-sm leading-relaxed text-foreground shadow-sm md:p-4">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={scrollRef} />
                </div>
              )}
              </div>
            </ScrollArea>

            <div className="shrink-0 border-t bg-card px-3 pb-2 pt-3 md:px-5" data-testid="chat-composer">
              {imagePreview && (
                <div className="mb-3 flex items-start gap-2">
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Selected"
                      className="h-20 w-20 object-cover rounded-lg border"
                      loading="lazy"
                      width="80"
                      height="80"
                    />
                    <button
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-sm hover:bg-destructive/90"
                      data-testid="button-remove-image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-start gap-1">
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>Photo analysis is for guidance only. A professional may see things we can't.</span>
                  </div>
                </div>
              )}
              
              <div className="flex w-full min-w-0 items-end gap-2">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageSelect}
                  ref={fileInputRef}
                  className="hidden"
                  data-testid="input-image-file"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-11 w-11 text-muted-foreground hover:text-primary shrink-0" 
                      onClick={() => { trackEvent('click', 'chat', 'add_photo'); fileInputRef.current?.click(); }}
                      disabled={isStreaming}
                      aria-label="Attach a photo"
                      data-testid="button-add-photo"
                    >
                      <Camera className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add a photo for analysis</TooltipContent>
                </Tooltip>
                <Textarea
                  placeholder={selectedImage ? "Ask about this photo..." : "Ask about your home..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !isStreaming) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  disabled={isStreaming}
                  className="min-w-0 w-0 flex-1 min-h-[44px] h-[44px] max-h-28 px-3 py-2.5 text-base md:text-sm border-muted-foreground/20 focus-visible:ring-primary/20 resize-none overflow-y-auto rounded-xl"
                  rows={1}
                  data-testid="input-message"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="icon" 
                      onClick={() => void handleSend()}
                      disabled={(!input.trim() && !selectedImage) || isStreaming}
                      className="h-11 w-11 rounded-full shadow-sm shrink-0"
                      aria-label="Send message"
                      data-testid="button-send"
                    >
                      {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Send message</TooltipContent>
                </Tooltip>
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">AI guidance only · <Link href="/terms" className="underline underline-offset-2">Terms &amp; limitations</Link></p>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
