export type SmsSendInput = {
  agentId: string;
  fromPhone: string;
  toPhone: string;
  text: string;
};

export type BusinessNumberAssignmentInput = {
  agentId: string;
  areaCode?: string | null;
};

export type BusinessNumberAssignmentResult = {
  ok: boolean;
  provider: "mock" | "twilio";
  status: "assigned" | "manual_review_required" | "failed";
  businessPhoneNumber: string | null;
  providerNumberId: string | null;
  error: string | null;
  mode: "real" | "mock";
};

export type SmsSendResult = {
  ok: boolean;
  status: "queued" | "sent" | "failed";
  provider: "mock" | "twilio";
  providerMessageId: string | null;
  error: string | null;
};

export type CallBridgeInput = {
  agentId: string;
  fromPhone: string;
  leadPhone: string;
  forwardingPhone: string;
};

export type CallBridgeResult = {
  ok: boolean;
  status: "queued" | "ringing" | "completed" | "failed";
  provider: "mock" | "twilio";
  providerCallId: string | null;
  error: string | null;
};

function providerMode(): "mock" | "twilio" {
  const mode = (process.env.RECEPTIONIST_PROVIDER || "mock").trim().toLowerCase();
  return mode === "twilio" ? "twilio" : "mock";
}

function safePhone(value: string): string {
  return value.trim().replace(/[^\d+]/g, "");
}

function mockId(prefix: string): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `mock_${prefix}_${stamp}_${rand}`;
}

function twilioCredentials(): {
  accountSid: string;
  authToken: string;
} | null {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  if (!accountSid || !authToken) return null;
  return { accountSid, authToken };
}

function twilioAuthHeader(accountSid: string, authToken: string): string {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

function sanitizeAreaCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 3) return null;
  return digits;
}

async function assignMockBusinessNumber(
  input: BusinessNumberAssignmentInput
): Promise<BusinessNumberAssignmentResult> {
  const agentHash = Array.from(input.agentId || "agent").reduce((hash, character) => {
    return (hash * 31 + character.charCodeAt(0)) >>> 0;
  }, 7);
  const areaCode = sanitizeAreaCode(input.areaCode) || "555";
  const line = String(1000000 + (agentHash % 9000000)).slice(-7);
  const number = `+1${areaCode}${line.slice(0, 7)}`.slice(0, 12);

  return {
    ok: true,
    provider: "mock",
    status: "assigned",
    businessPhoneNumber: number,
    providerNumberId: mockId("pn"),
    error: null,
    mode: "mock",
  };
}

async function assignTwilioBusinessNumber(
  input: BusinessNumberAssignmentInput
): Promise<BusinessNumberAssignmentResult> {
  const credentials = twilioCredentials();
  if (!credentials) {
    return {
      ok: false,
      provider: "twilio",
      status: "failed",
      businessPhoneNumber: null,
      providerNumberId: null,
      error: "Twilio credentials are missing.",
      mode: "real",
    };
  }

  const availableParams = new URLSearchParams();
  availableParams.set("SmsEnabled", "true");
  availableParams.set("VoiceEnabled", "true");
  availableParams.set("Limit", "1");
  const areaCode = sanitizeAreaCode(input.areaCode);
  if (areaCode) {
    availableParams.set("AreaCode", areaCode);
  }

  try {
    const availableResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/AvailablePhoneNumbers/US/Local.json?${availableParams.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: twilioAuthHeader(credentials.accountSid, credentials.authToken),
        },
      }
    );

    const availablePayload = (await availableResponse.json()) as {
      available_phone_numbers?: Array<{ phone_number?: string }>;
      message?: string;
    };

    if (!availableResponse.ok) {
      return {
        ok: false,
        provider: "twilio",
        status: "failed",
        businessPhoneNumber: null,
        providerNumberId: null,
        error: availablePayload.message || "Could not search Twilio numbers.",
        mode: "real",
      };
    }

    const candidate = (availablePayload.available_phone_numbers || [])[0]?.phone_number;
    if (!candidate) {
      return {
        ok: false,
        provider: "twilio",
        status: "manual_review_required",
        businessPhoneNumber: null,
        providerNumberId: null,
        error: "No available Twilio number found for this request.",
        mode: "real",
      };
    }

    const purchaseParams = new URLSearchParams();
    purchaseParams.set("PhoneNumber", candidate);

    const purchaseResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/IncomingPhoneNumbers.json`,
      {
        method: "POST",
        headers: {
          Authorization: twilioAuthHeader(credentials.accountSid, credentials.authToken),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: purchaseParams,
      }
    );

    const purchasePayload = (await purchaseResponse.json()) as {
      sid?: string;
      phone_number?: string;
      message?: string;
    };

    if (!purchaseResponse.ok) {
      return {
        ok: false,
        provider: "twilio",
        status: "failed",
        businessPhoneNumber: null,
        providerNumberId: purchasePayload.sid || null,
        error: purchasePayload.message || "Could not assign Twilio number.",
        mode: "real",
      };
    }

    return {
      ok: true,
      provider: "twilio",
      status: "assigned",
      businessPhoneNumber: safePhone(purchasePayload.phone_number || candidate),
      providerNumberId: purchasePayload.sid || null,
      error: null,
      mode: "real",
    };
  } catch {
    return {
      ok: false,
      provider: "twilio",
      status: "failed",
      businessPhoneNumber: null,
      providerNumberId: null,
      error: "Twilio number assignment failed.",
      mode: "real",
    };
  }
}

async function sendTwilioSms(input: SmsSendInput): Promise<SmsSendResult> {
  const credentials = twilioCredentials();
  if (!credentials) {
    return {
      ok: false,
      status: "failed",
      provider: "twilio",
      providerMessageId: null,
      error: "Twilio credentials are missing.",
    };
  }

  const toPhone = safePhone(input.toPhone);
  const fromPhone = safePhone(input.fromPhone);

  if (!toPhone || !fromPhone) {
    return {
      ok: false,
      status: "failed",
      provider: "twilio",
      providerMessageId: null,
      error: "To/From phone values are invalid.",
    };
  }

  const params = new URLSearchParams();
  params.set("To", toPhone);
  params.set("From", fromPhone);
  params.set("Body", input.text.trim());

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: twilioAuthHeader(credentials.accountSid, credentials.authToken),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      }
    );

    const payload = (await response.json()) as {
      sid?: string;
      status?: string;
      message?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        provider: "twilio",
        providerMessageId: payload.sid || null,
        error: payload.message || "Twilio SMS request failed.",
      };
    }

    const status = payload.status === "sent" || payload.status === "delivered" ? "sent" : "queued";

    return {
      ok: true,
      status,
      provider: "twilio",
      providerMessageId: payload.sid || null,
      error: null,
    };
  } catch {
    return {
      ok: false,
      status: "failed",
      provider: "twilio",
      providerMessageId: null,
      error: "Twilio SMS request failed.",
    };
  }
}

async function startTwilioBridgeCall(input: CallBridgeInput): Promise<CallBridgeResult> {
  const credentials = twilioCredentials();
  if (!credentials) {
    return {
      ok: false,
      status: "failed",
      provider: "twilio",
      providerCallId: null,
      error: "Twilio credentials are missing.",
    };
  }

  const fromPhone = safePhone(input.fromPhone);
  const forwardingPhone = safePhone(input.forwardingPhone);
  const leadPhone = safePhone(input.leadPhone);

  if (!fromPhone || !forwardingPhone || !leadPhone) {
    return {
      ok: false,
      status: "failed",
      provider: "twilio",
      providerCallId: null,
      error: "Invalid forwarding, lead, or business phone number.",
    };
  }

  const twiml = `<Response><Say voice=\"alice\">Connecting your LockboxHQ call now.</Say><Dial callerId=\"${fromPhone}\">${leadPhone}</Dial></Response>`;

  const params = new URLSearchParams();
  params.set("To", forwardingPhone);
  params.set("From", fromPhone);
  params.set("Twiml", twiml);

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: twilioAuthHeader(credentials.accountSid, credentials.authToken),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      }
    );

    const payload = (await response.json()) as {
      sid?: string;
      status?: string;
      message?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        provider: "twilio",
        providerCallId: payload.sid || null,
        error: payload.message || "Twilio call bridge request failed.",
      };
    }

    return {
      ok: true,
      status: payload.status === "in-progress" ? "ringing" : "queued",
      provider: "twilio",
      providerCallId: payload.sid || null,
      error: null,
    };
  } catch {
    return {
      ok: false,
      status: "failed",
      provider: "twilio",
      providerCallId: null,
      error: "Twilio call bridge request failed.",
    };
  }
}

export async function sendReceptionistSms(input: SmsSendInput): Promise<SmsSendResult> {
  const mode = providerMode();

  if (mode === "twilio") {
    return sendTwilioSms(input);
  }

  return {
    ok: true,
    status: "queued",
    provider: "mock",
    providerMessageId: mockId("sms"),
    error: null,
  };
}

export async function assignReceptionistBusinessNumber(
  input: BusinessNumberAssignmentInput
): Promise<BusinessNumberAssignmentResult> {
  const mode = providerMode();
  if (mode === "twilio") {
    return assignTwilioBusinessNumber(input);
  }
  return assignMockBusinessNumber(input);
}

export async function startReceptionistBridgeCall(
  input: CallBridgeInput
): Promise<CallBridgeResult> {
  const mode = providerMode();

  if (mode === "twilio") {
    return startTwilioBridgeCall(input);
  }

  return {
    ok: true,
    status: "queued",
    provider: "mock",
    providerCallId: mockId("call"),
    error: null,
  };
}
