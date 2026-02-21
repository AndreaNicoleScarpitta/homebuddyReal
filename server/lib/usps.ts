import { logInfo, logError } from "./logger";

interface USPSAddress {
  streetAddress: string;
  secondaryAddress?: string;
  city: string;
  state: string;
  ZIPCode: string;
  ZIPPlus4?: string;
}

interface USPSVerificationResult {
  verified: boolean;
  address?: USPSAddress;
  error?: string;
}

let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.USPS_CLIENT_ID;
  const clientSecret = process.env.USPS_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("USPS API credentials not configured");
  }
  
  if (accessToken && Date.now() < tokenExpiry - 60000) {
    return accessToken;
  }
  
  const response = await fetch("https://apis.usps.com/oauth2/v3/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials"
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    logError("usps.auth", new Error(error));
    throw new Error("Failed to authenticate with USPS");
  }
  
  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);
  
  return accessToken!;
}

export async function verifyAddress(
  streetAddress: string,
  city: string,
  state: string,
  zipCode?: string
): Promise<USPSVerificationResult> {
  try {
    const token = await getAccessToken();
    
    const params = new URLSearchParams({
      streetAddress,
      city,
      state,
    });
    
    if (zipCode) {
      params.append("ZIPCode", zipCode);
    }
    
    const url = `https://apis.usps.com/addresses/v3/address?${params.toString()}`;
    
    logInfo("usps.verify", "Verifying address with USPS", { streetAddress, city, state });
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logError("usps.verify", new Error(errorText));
      
      if (response.status === 404) {
        return { verified: false, error: "Address not found" };
      }
      
      return { verified: false, error: "Unable to verify address" };
    }
    
    const data = await response.json();
    
    logInfo("usps.verify", "Address verified successfully", { 
      verified: true,
      zip: data.address?.ZIPCode 
    });
    
    return {
      verified: true,
      address: data.address
    };
  } catch (error) {
    logError("usps.verify", error instanceof Error ? error : new Error(String(error)));
    return {
      verified: false,
      error: error instanceof Error ? error.message : "Verification failed"
    };
  }
}

export function isUSPSConfigured(): boolean {
  return !!(process.env.USPS_CLIENT_ID && process.env.USPS_CLIENT_SECRET);
}
