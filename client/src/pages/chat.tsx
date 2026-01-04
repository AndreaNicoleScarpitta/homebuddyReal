import { Layout } from "@/components/layout";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Paperclip, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CHAT_HISTORY } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";
import logoImage from "@assets/generated_images/minimalist_geometric_house_logo_with_a_wrench_or_gear_integration,_blue_and_green_gradient..png";

export default function Chat() {
  const [messages, setMessages] = useState(CHAT_HISTORY);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const newMessages = [
      ...messages,
      { role: "user", content: input }
    ];
    setMessages(newMessages);
    setInput("");

    // Mock AI response
    setTimeout(() => {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "I can help with that! Based on your home profile, scheduling a professional inspection for your roof would be the best next step. Would you like me to find local pros?" }
      ]);
    }, 1000);
  };

  return (
    <Layout>
      <div className="h-[calc(100vh-8rem)] flex flex-col max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-heading font-bold text-foreground">Assistant</h1>
          <p className="text-muted-foreground">Expert advice for your home, 24/7.</p>
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden border-none shadow-md bg-white/50 backdrop-blur-sm">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-6">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-4 ${
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
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
                      {msg.role === "assistant" ? "HomeWise" : "You"}
                    </span>
                    <div
                      className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-white border text-foreground rounded-tl-none"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="p-4 bg-white/80 border-t backdrop-blur-md">
            <div className="relative flex items-center gap-2">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary shrink-0">
                <Paperclip className="h-5 w-5" />
              </Button>
               <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary shrink-0">
                <ImageIcon className="h-5 w-5" />
              </Button>
              <Input
                placeholder="Ask about maintenance, repairs, or costs..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="flex-1 rounded-full px-4 border-muted-foreground/20 focus-visible:ring-primary/20"
              />
              <Button 
                size="icon" 
                onClick={handleSend}
                disabled={!input.trim()}
                className="rounded-full shadow-lg shadow-primary/20 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
