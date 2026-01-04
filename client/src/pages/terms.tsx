import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Shield, Camera, Phone } from "lucide-react";

export default function Terms() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-heading font-bold text-foreground">Terms & Conditions</h1>
          <p className="text-muted-foreground mt-1">Last updated: January 2026</p>
        </header>

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
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Your Data & Privacy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Photos and messages you share with the AI assistant are processed to provide responses and may be stored to improve your experience. We do not sell your data to third parties.
            </p>
            <p>
              For detailed information about how we handle your data, please review our Privacy Policy.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Acceptance of Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              By using Home Buddy, you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions. If you do not agree to these terms, please do not use this application.
            </p>
            <p>
              We reserve the right to update these terms at any time. Continued use of the application after changes constitutes acceptance of the updated terms.
            </p>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground pb-8">
          <p>Questions? Contact us at support@homebuddy.app</p>
        </div>
      </div>
    </Layout>
  );
}
