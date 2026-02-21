import { Layout } from "@/components/layout";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Camera, Loader2, AlertCircle, X, Info, Plus, ListTodo, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getHome, getChatMessages } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { PhotoConsentModal, usePhotoConsent } from "@/components/photo-consent-modal";
import { AddSystemWizard } from "@/components/add-system-wizard";
import { Link } from "wouter";
import logoImage from "@assets/generated_images/orange_house_logo_with_grey_gear..png";
import { trackEvent } from "@/lib/analytics";

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

export default function Chat() {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [showAddSystem, setShowAddSystem] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hasConsented, isLoaded, grantConsent } = usePhotoConsent();

  const { data: home } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chat", home?.id],
    queryFn: () => getChatMessages(home!.id),
    enabled: !!home?.id,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingMessage]);

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

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || !home || isStreaming) return;

    const userMessage = input;
    const imageToSend = selectedImage;
    const imagePreviewToSend = imagePreview;
    
    setInput("");
    setSelectedImage(null);
    setImagePreview(null);
    setIsStreaming(true);
    setStreamingMessage("");

    trackEvent('send_message', 'chat', imageToSend ? 'with_photo' : 'text_only');

    try {
      let imageBase64: string | undefined;
      if (imageToSend && imagePreviewToSend) {
        imageBase64 = imagePreviewToSend.split(",")[1];
      }

      const response = await fetch(`/api/home/${home.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content: userMessage || "What can you tell me about this?",
          image: imageBase64,
          imageType: imageToSend?.type,
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

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
                  setStreamingMessage(prev => prev + data.content);
                } else if (data.done) {
                  queryClient.invalidateQueries({ queryKey: ["chat", home.id] });
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

  return (
    <Layout>
      <PhotoConsentModal 
        isOpen={showConsentModal} 
        onAccept={handleConsentAccept}
        onCancel={handleConsentCancel}
      />
      
      {home && (
        <AddSystemWizard 
          isOpen={showAddSystem} 
          onClose={() => setShowAddSystem(false)} 
          homeId={home.id} 
        />
      )}
      
      <div className="h-[calc(100vh-8rem)] flex flex-col max-w-3xl mx-auto">
        <div className="mb-4">
          <h1 className="text-3xl font-heading font-bold text-foreground" data-testid="text-heading">Assistant</h1>
          <p className="text-muted-foreground">Expert guidance for your home, 24/7.</p>
        </div>

        <div className="flex items-start gap-2 p-3 mb-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
          <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-blue-800 dark:text-blue-200">
            <span className="font-medium">For informational purposes only.</span> Our AI provides general guidance, not professional advice. 
            <Link href="/terms" className="underline ml-1 hover:text-blue-600">View terms</Link>
          </div>
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden border-none shadow-md bg-white/50 backdrop-blur-sm">
          <ScrollArea className="flex-1 p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading messages...</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md px-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bot className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-3">How can I help?</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    I can help you understand repairs, estimate costs, or figure out what can wait. You can also share photos for guidance.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button 
                      onClick={() => { trackEvent('click', 'chat', 'suggestion_prioritize'); setInput("What repairs should I prioritize?"); }}
                      className="px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded-full transition-colors"
                    >
                      What should I fix first?
                    </button>
                    <button 
                      onClick={() => { trackEvent('click', 'chat', 'suggestion_budget'); setInput("How much should I budget for home repairs?"); }}
                      className="px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded-full transition-colors"
                    >
                      Help me plan costs
                    </button>
                    <button 
                      onClick={() => { trackEvent('click', 'chat', 'suggestion_diy'); setInput("What can I safely do myself vs hire a pro?"); }}
                      className="px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded-full transition-colors"
                    >
                      DIY or hire a pro?
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-6 italic">
                    Estimates are general ranges, not quotes. You're always in control.
                  </p>
                  
                  {/* Quick Actions */}
                  <div className="mt-6 pt-4 border-t border-muted">
                    <p className="text-xs text-muted-foreground mb-3">Quick Actions</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => { trackEvent('click', 'chat', 'quick_add_task'); setInput("Help me add a maintenance task for my home"); }}
                        className="text-xs"
                        data-testid="button-add-task-quick"
                      >
                        <ListTodo className="h-3 w-3 mr-1.5" />
                        Add Task
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => { trackEvent('click', 'chat', 'quick_add_system'); setShowAddSystem(true); }}
                        className="text-xs"
                        data-testid="button-add-system-quick"
                      >
                        <Wrench className="h-3 w-3 mr-1.5" />
                        Add System
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-4 ${
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                    data-testid={`message-${msg.id}`}
                  >
                    <Avatar className="h-10 w-10 border shadow-sm">
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
                        className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-none"
                            : "bg-white border text-foreground rounded-tl-none"
                        }`}
                      >
                        <div className={msg.role === "assistant" ? "" : "whitespace-pre-wrap"}>
                        {msg.role === "assistant" ? renderRichText(msg.content) : msg.content}
                      </div>
                        {msg.role === "assistant" && (
                          <div className="mt-3 pt-2 border-t border-muted/30 text-xs text-muted-foreground italic">
                            This is general guidance only. Consult a professional for your specific situation.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {streamingMessage && (
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
                      <div className="p-4 rounded-2xl shadow-sm text-sm leading-relaxed bg-white border text-foreground rounded-tl-none">
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
                      <div className="p-4 rounded-2xl shadow-sm text-sm leading-relaxed bg-white border text-foreground rounded-tl-none">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={scrollRef} />
              </div>
            )}
          </ScrollArea>

          <div className="p-4 bg-white/80 border-t backdrop-blur-md">
            {imagePreview && (
              <div className="mb-3 flex items-start gap-2">
                <div className="relative">
                  <img 
                    src={imagePreview} 
                    alt="Selected" 
                    className="h-20 w-20 object-cover rounded-lg border"
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
            
            <div className="relative flex items-end gap-2">
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
                    className="text-muted-foreground hover:text-primary shrink-0" 
                    onClick={() => { trackEvent('click', 'chat', 'add_photo'); fileInputRef.current?.click(); }}
                    disabled={isStreaming}
                    data-testid="button-add-photo"
                  >
                    <Camera className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add a photo for analysis</TooltipContent>
              </Tooltip>
              <Textarea
                placeholder={selectedImage ? "Ask about this photo..." : "Ask about maintenance, repairs, or costs..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isStreaming) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isStreaming}
                className="flex-1 min-h-[44px] max-h-32 px-4 py-2.5 border-muted-foreground/20 focus-visible:ring-primary/20 resize-none overflow-auto rounded-2xl"
                rows={1}
                data-testid="input-message"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="icon" 
                    onClick={handleSend}
                    disabled={(!input.trim() && !selectedImage) || isStreaming}
                    className="rounded-full shadow-lg shadow-primary/20 shrink-0"
                    data-testid="button-send"
                  >
                    {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Send message</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
