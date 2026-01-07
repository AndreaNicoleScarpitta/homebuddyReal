import { Layout } from "@/components/layout";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Send, CheckCircle2 } from "lucide-react";

async function submitContactForm(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  const response = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to send message");
  }
  
  return response.json();
}

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const submitMutation = useMutation({
    mutationFn: submitContactForm,
    onSuccess: () => {
      setSubmitted(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    },
    onError: (error) => {
      toast({
        title: "Couldn't send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) {
      toast({
        title: "Please fill in all required fields",
        description: "Name, email, and message are required.",
        variant: "destructive",
      });
      return;
    }
    submitMutation.mutate({ name, email, subject, message });
  };

  if (submitted) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <Card className="text-center py-12">
            <CardContent>
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-heading font-bold mb-2">Message Sent!</h2>
              <p className="text-muted-foreground mb-6">
                Thank you for reaching out. We'll get back to you as soon as possible.
              </p>
              <Button onClick={() => setSubmitted(false)} data-testid="button-send-another">
                Send Another Message
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-heading font-bold text-foreground" data-testid="text-heading">
            Contact Us
          </h1>
          <p className="text-muted-foreground mt-1">
            Have a question or feedback? We'd love to hear from you.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Send a Message</CardTitle>
            <CardDescription>
              Fill out the form below and we'll get back to you soon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-email"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="What's this about?"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  data-testid="input-subject"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  placeholder="Tell us how we can help..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  required
                  data-testid="input-message"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full md:w-auto"
                disabled={submitMutation.isPending}
                data-testid="button-submit"
              >
                {submitMutation.isPending ? (
                  <>Sending...</>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
