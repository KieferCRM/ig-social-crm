import { NextResponse } from "next/server";
import { loadAccessContext } from "@/lib/access-context";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import {
  WORKSPACE_DOCUMENT_BUCKET,
  withWorkspaceDocument,
  withoutWorkspaceDocument,
  readWorkspaceSettingsFromAgentSettings,
  type WorkspaceDocument,
} from "@/lib/workspace-settings";

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}

export async function GET() {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("agents")
    .select("settings")
    .eq("id", auth.context.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const documents = readWorkspaceSettingsFromAgentSettings(data?.settings || null).documents;
  if (documents.length === 0) {
    return NextResponse.json({ documents: [] });
  }

  let signedUrlMap = new Map<string, string>();
  try {
    const { data: signedRows } = await admin
      .storage
      .from(WORKSPACE_DOCUMENT_BUCKET)
      .createSignedUrls(
        documents.map((document) => document.storage_path),
        60 * 60
      );

    const signedEntries = (signedRows || []).flatMap((row) => {
      if (!row.path || !row.signedUrl) return [] as Array<[string, string]>;
      return [[row.path, row.signedUrl] as [string, string]];
    });

    signedUrlMap = new Map<string, string>(signedEntries);
  } catch {
    signedUrlMap = new Map();
  }

  return NextResponse.json({
    documents: documents.map((document) => ({
      ...document,
      signed_url: signedUrlMap.get(document.storage_path) || null,
    })),
  });
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }

  const docId = crypto.randomUUID();
  const safeFileName = sanitizeFileName(file.name || "document");
  const storagePath = `${auth.context.user.id}/${docId}-${safeFileName || "document"}`;
  const dealId = String(formData.get("deal_id") || "").trim();
  const leadId = String(formData.get("lead_id") || "").trim();
  const fileType = String(formData.get("file_type") || "other").trim() || "other";
  const status = String(formData.get("status") || "draft").trim() || "draft";
  const tags = String(formData.get("tags") || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const admin = supabaseAdmin();
  const { error: uploadError } = await admin.storage.from(WORKSPACE_DOCUMENT_BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.json(
      {
        error:
          uploadError.message ||
          "Could not upload the document. Make sure the workspace-documents bucket exists.",
      },
      { status: 500 }
    );
  }

  const { data: currentRow, error: loadError } = await admin
    .from("agents")
    .select("settings")
    .eq("id", auth.context.user.id)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }

  const document: WorkspaceDocument = {
    id: docId,
    file_name: file.name,
    storage_path: storagePath,
    file_type: fileType,
    deal_id: dealId,
    lead_id: leadId,
    tags,
    status,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    uploaded_at: new Date().toISOString(),
    uploaded_by: auth.context.user.id,
    extraction_status: "pending",
  };

  const nextSettings = withWorkspaceDocument(currentRow?.settings || null, document);
  const { error: saveError } = await admin
    .from("agents")
    .upsert(
      {
        id: auth.context.user.id,
        settings: nextSettings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, document });
}

export async function PATCH(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { id?: string; status?: string; file_type?: string; tags?: string[]; lead_id?: string; deal_id?: string; extraction_status?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const documentId = String(body.id || "").trim();
  if (!documentId) return NextResponse.json({ error: "Document id is required." }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: currentRow, error: loadError } = await admin
    .from("agents")
    .select("settings")
    .eq("id", auth.context.user.id)
    .maybeSingle();

  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });

  const currentSettings = readWorkspaceSettingsFromAgentSettings(currentRow?.settings || null);
  const existing = currentSettings.documents.find((d) => d.id === documentId);
  if (!existing) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const updated = {
    ...existing,
    ...(body.status !== undefined && { status: body.status }),
    ...(body.file_type !== undefined && { file_type: body.file_type }),
    ...(body.tags !== undefined && { tags: body.tags }),
    ...(body.lead_id !== undefined && { lead_id: body.lead_id }),
    ...(body.deal_id !== undefined && { deal_id: body.deal_id }),
    ...(body.extraction_status !== undefined && { extraction_status: body.extraction_status as WorkspaceDocument["extraction_status"] }),
  };

  const nextSettings = withWorkspaceDocument(currentRow?.settings || null, updated);
  const { error: saveError } = await admin
    .from("agents")
    .upsert({ id: auth.context.user.id, settings: nextSettings, updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });

  return NextResponse.json({ ok: true, document: updated });
}

export async function DELETE(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { id?: string } = {};
  try {
    body = (await request.json()) as { id?: string };
  } catch {
    body = {};
  }

  const documentId = String(body.id || "").trim();
  if (!documentId) {
    return NextResponse.json({ error: "Document id is required." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: currentRow, error: loadError } = await admin
    .from("agents")
    .select("settings")
    .eq("id", auth.context.user.id)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }

  const currentSettings = readWorkspaceSettingsFromAgentSettings(currentRow?.settings || null);
  const existing = currentSettings.documents.find((document) => document.id === documentId);
  if (!existing) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  await admin.storage.from(WORKSPACE_DOCUMENT_BUCKET).remove([existing.storage_path]);

  const nextSettings = withoutWorkspaceDocument(currentRow?.settings || null, documentId);
  const { error: saveError } = await admin
    .from("agents")
    .upsert(
      {
        id: auth.context.user.id,
        settings: nextSettings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, removed_id: documentId });
}
