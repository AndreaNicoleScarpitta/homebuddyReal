import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Shield, Camera, Phone, Users, Scale, FileText } from "lucide-react";

export function TermsContent() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-heading font-bold text-foreground">Terms & Conditions</h1>
        <p className="text-muted-foreground mt-1">Last updated: February 2026</p>
      </header>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Scale className="h-5 w-5 text-primary" />
            Agreement to Terms
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            These Terms and Conditions constitute a legally binding agreement between you and Home Buddy governing your access to and use of the Home Buddy application and related services.
          </p>
          <p>
            By accessing or using our service, you agree to be bound by these Terms. If you disagree with any part of these terms, you may not access or use the service.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Important Disclaimer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            Home Buddy provides general informational guidance only. We are not licensed contractors, inspectors, or home repair professionals.
          </p>
          <p>
            The advice, estimates, and recommendations provided through this application—including AI-powered responses and image analysis—are for informational purposes only and should not be considered professional advice, formal estimates, or inspection reports.
          </p>
          <p>
            <strong className="text-foreground">You are responsible for all decisions regarding your home.</strong> Always consult qualified, licensed professionals before undertaking repairs, especially those involving electrical systems, gas lines, structural elements, roofing, plumbing, or any work requiring permits.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            User Accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            When you create an account through our social login providers (Google, Facebook, or Instagram), you are responsible for maintaining the security of your account and all activities that occur under it.
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>You must provide accurate information during the registration process</li>
            <li>You are responsible for safeguarding your account credentials</li>
            <li>You must notify us immediately of any unauthorized use of your account</li>
            <li>We reserve the right to suspend or terminate accounts that violate these terms</li>
            <li>You may delete your account at any time by contacting us</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Acceptable Use
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>You agree not to:</p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>Use the service for any unlawful purpose or in violation of any applicable laws</li>
            <li>Attempt to gain unauthorized access to any part of the service</li>
            <li>Interfere with or disrupt the service or servers connected to it</li>
            <li>Upload malicious content, viruses, or harmful code</li>
            <li>Misrepresent your identity or impersonate another person</li>
            <li>Use the service to harass, abuse, or harm others</li>
            <li>Resell, redistribute, or commercially exploit the service without authorization</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Camera className="h-5 w-5 text-primary" />
            Photo Analysis Limitations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            When you upload photos for analysis, our AI assistant will provide observations based solely on what is visible in the image. Important limitations include:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>Photos cannot reveal hidden conditions behind walls, under floors, or in inaccessible areas</li>
            <li>Lighting, angle, and image quality can significantly affect accuracy</li>
            <li>The AI cannot assess structural integrity, material composition, or safety hazards that aren't visually apparent</li>
            <li>Moisture, mold, pest damage, and similar issues often require professional testing to confirm</li>
            <li>Cost and time estimates are rough ranges based on typical scenarios—your situation may vary significantly</li>
          </ul>
          <p className="font-medium text-foreground">
            Photo analysis is meant to help you ask better questions of professionals, not to replace professional inspection.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="h-5 w-5 text-destructive" />
            Emergency Situations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            For any emergency situation, do not rely on this application.
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li><strong>Gas leaks or odors:</strong> Leave immediately and call your gas company or 911</li>
            <li><strong>Electrical fires or sparking:</strong> Evacuate and call 911</li>
            <li><strong>Flooding or burst pipes:</strong> Shut off water main if safe, call a plumber</li>
            <li><strong>Structural damage or collapse risk:</strong> Evacuate and call emergency services</li>
            <li><strong>Carbon monoxide detector alarm:</strong> Evacuate and call 911</li>
          </ul>
          <p>
            This application is not designed for emergency response. In any situation where safety is at immediate risk, prioritize evacuation and contact emergency services (911) or qualified emergency repair services.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-green-600" />
            Limitation of Liability
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            By using Home Buddy, you acknowledge and agree that:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>No professional-client, contractor-client, or inspector-client relationship is formed through your use of this application</li>
            <li>All guidance, recommendations, and estimates are provided "as is" without warranty of any kind</li>
            <li>We are not liable for any damages, injuries, or losses resulting from actions taken based on information provided through this application</li>
            <li>You assume full responsibility for verifying information and consulting appropriate professionals before making decisions about your property</li>
            <li>Cost estimates are general ranges and actual costs may vary significantly based on your location, specific conditions, and contractor availability</li>
            <li>The service is provided on an "as is" and "as available" basis without warranties of any kind, express or implied</li>
            <li>In no event shall Home Buddy be liable for any indirect, incidental, special, consequential, or punitive damages</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Your Data & Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            We collect and process personal data in accordance with our Privacy Policy. By using Home Buddy, you consent to the collection and use of information as described below:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>Account information from your social login provider (name, email, profile picture)</li>
            <li>Home profile data you provide (address, systems, maintenance records)</li>
            <li>Photos and messages shared with the AI assistant for providing responses</li>
            <li>Usage data to improve the service experience</li>
          </ul>
          <p className="font-medium text-foreground">
            We do not sell your personal data to third parties.
          </p>
          <p>
            You may request deletion of your data at any time by contacting us. Upon account deletion, your personal data will be removed from our systems within 30 days.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Intellectual Property</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The service and its original content, features, and functionality are owned by Home Buddy and are protected by intellectual property laws. You retain ownership of any content you submit through the service, but grant us a license to use it for providing and improving the service.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Changes to Terms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            We reserve the right to modify or replace these Terms at any time. Material changes will be communicated through the application or via email. Continued use of the service after changes constitutes acceptance of the updated terms.
          </p>
          <p>
            By using Home Buddy, you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions.
          </p>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-muted-foreground pb-8">
        <p>Questions? Contact us at drew@homebuddy.space</p>
      </div>
    </div>
  );
}

export default function Terms() {
  return (
    <Layout>
      <TermsContent />
    </Layout>
  );
}
