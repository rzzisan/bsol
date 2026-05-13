"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FunnelBlockInspector from "@/components/funnel-block-inspector";
import { FUNNEL_BLOCK_REGISTRY, getBlockDefinition, type FunnelBlockType } from "@/components/funnel-block-registry";
import {
  buildApiHeaders,
  FUNNEL_API_BASE,
  readApiResponse,
  type FunnelData,
  type FunnelFlow,
  type FunnelFlowStep,
  type FunnelStepType,
  type LandingPageBlock,
} from "@/lib/funnel";

type Props = {
  funnel: FunnelData;
  token: string | null;
  locale: "bn" | "en";
  onFunnelUpdated: (next: FunnelData) => void;
};

type EditorMode = "structure" | "content" | "style" | "flow";
type LeftTab = "blocks" | "steps" | "templates" | "assets";
type Viewport = "desktop" | "tablet" | "mobile";

type LandingPageOption = {
  id: number;
  title: string;
  slug: string;
  status: string;
};

type ProductOption = {
  id: number;
  name: string;
  thumbnail?: string | null;
};

type ProductMedia = {
  id: number;
  url: string;
  file_name?: string | null;
  is_primary?: boolean;
};

type NewStepForm = {
  step_type: FunnelStepType;
  landing_page_id: number | null;
  slug: string;
};

const stepTypes: FunnelStepType[] = ["landing", "checkout", "order_bump", "upsell", "thank_you"];

const text = {
  bn: {
    mode: "মোড",
    save: "Save",
    publish: "Publish",
    archive: "Archive",
    publishing: "Publishing...",
    saving: "Saving...",
    archived: "Archiving...",
    blocks: "Blocks",
    steps: "Steps",
    templates: "Templates",
    assets: "Assets",
    inspector: "Inspector",
    selectedStep: "Selected Step",
    selectedBlock: "Selected Block",
    noStep: "এই funnel-এ এখনো step পাওয়া যায়নি।",
    noBlock: "এই step-এ এখনো block নেই। বাম পাশে palette থেকে Add করুন।",
    canvas: "Canvas",
    flowSummary: "Flow Summary",
    status: "Status",
    slug: "Slug",
    viewport: "Viewport",
    untitledBlock: "Untitled block",
    saveDone: "Funnel updated",
    publishDone: "Funnel published",
    archiveDone: "Funnel archived",
    addBlock: "Add",
    moveUp: "↑",
    moveDown: "↓",
    loadingBlocks: "Loading blocks...",
    flowManager: "Flow Manager",
    addStep: "Add Step",
    stepType: "Step Type",
    landingPage: "Landing Page",
    stepSlug: "Step Slug",
    enabled: "Enabled",
    transitionSuccess: "Next on Success",
    transitionFailure: "Next on Failure",
    updateStep: "Update Step",
    deleteStep: "Delete Step",
    creating: "Creating...",
    updating: "Updating...",
    deleting: "Deleting...",
    createStepDone: "Step added",
    updateStepDone: "Step updated",
    deleteStepDone: "Step deleted",
    reorderDone: "Step order updated",
    none: "None",
    mediaLibrary: "Asset Library",
    chooseProduct: "Product",
    uploadMedia: "Upload Media",
    uploadHint: "Upload JPG/PNG/WebP and click Use to apply in selected block.",
    noMedia: "No media found for this product.",
    useInBlock: "Use in Block",
    mediaApplied: "Media applied to selected block",
    uploadingMedia: "Uploading...",
    setAsThumbnail: "Set Thumbnail",
    thumbnail: "Thumbnail",
    deleteMedia: "Delete",
    mediaDeleted: "Media deleted",
    mediaReordered: "Media order updated",
    mediaPrimaryUpdated: "Thumbnail updated",
    uploadProgress: "Upload progress",
    confirmDeleteMedia: "Are you sure you want to delete this media?",
    selected: "Selected",
  },
  en: {
    mode: "Mode",
    save: "Save",
    publish: "Publish",
    archive: "Archive",
    publishing: "Publishing...",
    saving: "Saving...",
    archived: "Archiving...",
    blocks: "Blocks",
    steps: "Steps",
    templates: "Templates",
    assets: "Assets",
    inspector: "Inspector",
    selectedStep: "Selected Step",
    selectedBlock: "Selected Block",
    noStep: "No steps found for this funnel yet.",
    noBlock: "No blocks found in this step. Add from block palette.",
    canvas: "Canvas",
    flowSummary: "Flow Summary",
    status: "Status",
    slug: "Slug",
    viewport: "Viewport",
    untitledBlock: "Untitled block",
    saveDone: "Funnel updated",
    publishDone: "Funnel published",
    archiveDone: "Funnel archived",
    addBlock: "Add",
    moveUp: "↑",
    moveDown: "↓",
    loadingBlocks: "Loading blocks...",
    flowManager: "Flow Manager",
    addStep: "Add Step",
    stepType: "Step Type",
    landingPage: "Landing Page",
    stepSlug: "Step Slug",
    enabled: "Enabled",
    transitionSuccess: "Next on Success",
    transitionFailure: "Next on Failure",
    updateStep: "Update Step",
    deleteStep: "Delete Step",
    creating: "Creating...",
    updating: "Updating...",
    deleting: "Deleting...",
    createStepDone: "Step added",
    updateStepDone: "Step updated",
    deleteStepDone: "Step deleted",
    reorderDone: "Step order updated",
    none: "None",
    mediaLibrary: "Asset Library",
    chooseProduct: "Product",
    uploadMedia: "Upload Media",
    uploadHint: "Upload JPG/PNG/WebP and click Use to apply in selected block.",
    noMedia: "No media found for this product.",
    useInBlock: "Use in Block",
    mediaApplied: "Media applied to selected block",
    uploadingMedia: "Uploading...",
    setAsThumbnail: "Set Thumbnail",
    thumbnail: "Thumbnail",
    deleteMedia: "Delete",
    mediaDeleted: "Media deleted",
    mediaReordered: "Media order updated",
    mediaPrimaryUpdated: "Thumbnail updated",
    uploadProgress: "Upload progress",
    confirmDeleteMedia: "Are you sure you want to delete this media?",
    selected: "Selected",
  },
};

const modeOptions: EditorMode[] = ["structure", "content", "style", "flow"];

function activeFlowFrom(funnel: FunnelData): FunnelFlow | null {
  if (!funnel.flows || funnel.flows.length === 0) return null;
  return funnel.flows.find((flow) => flow.is_active) ?? funnel.flows[0] ?? null;
}

function fallbackBlocksFromStep(step: FunnelFlowStep | null): LandingPageBlock[] {
  if (!step?.landing_page?.content_json?.sections) return [];

  return step.landing_page.content_json.sections.map((section, index) => ({
    id: -(index + 1),
    landing_page_id: step.landing_page_id ?? 0,
    block_key: String(section.id ?? `${section.type ?? "section"}-${index + 1}`),
    block_type: String(section.type ?? "section"),
    parent_block_id: null,
    sort_order: Number(section.order ?? index + 1),
    locked: false,
    settings_json: {},
    content_json: section,
    visibility_rules_json: {},
  }));
}

export default function FunnelEditorShell({ funnel, token, locale, onFunnelUpdated }: Props) {
  const t = useMemo(() => text[locale], [locale]);
  const [name, setName] = useState(funnel.name);
  const [mode, setMode] = useState<EditorMode>("structure");
  const [leftTab, setLeftTab] = useState<LeftTab>("steps");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [busy, setBusy] = useState<"idle" | "saving" | "publishing" | "archiving" | "block" | "step">("idle");
  const [notice, setNotice] = useState<string>("");
  const [blocksByPageId, setBlocksByPageId] = useState<Record<number, LandingPageBlock[]>>({});
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [landingPages, setLandingPages] = useState<LandingPageOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [productMedia, setProductMedia] = useState<ProductMedia[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [mediaBusy, setMediaBusy] = useState<"idle" | "reorder" | "delete" | "thumbnail">("idle");
  const [mediaPolicy, setMediaPolicy] = useState<{ max_gallery_images?: number; max_file_size_mb?: number } | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null);

  const activeFlow = useMemo(() => activeFlowFrom(funnel), [funnel]);
  const [stepsState, setStepsState] = useState<FunnelFlowStep[]>(() => (activeFlow?.steps ?? []).slice().sort((a, b) => a.step_order - b.step_order));

  useEffect(() => {
    setStepsState((activeFlow?.steps ?? []).slice().sort((a, b) => a.step_order - b.step_order));
  }, [activeFlow]);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      const res = await fetch(`${FUNNEL_API_BASE}/landing/pages?per_page=100`, { headers: buildApiHeaders(token) });
      const result = await readApiResponse<LandingPageOption[]>(res);
      if (result.ok && Array.isArray(result.data)) {
        setLandingPages(result.data);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      const [productsRes, policyRes] = await Promise.all([
        fetch(`${FUNNEL_API_BASE}/products?per_page=100`, { headers: buildApiHeaders(token) }),
        fetch(`${FUNNEL_API_BASE}/products/media-policy`, { headers: buildApiHeaders(token) }),
      ]);

      const productsResult = await readApiResponse<ProductOption[]>(productsRes);
      const policyResult = await readApiResponse<{ max_gallery_images?: number; max_file_size_mb?: number }>(policyRes);

      if (productsResult.ok && Array.isArray(productsResult.data)) {
        setProducts(productsResult.data);
      }
      if (policyResult.ok && policyResult.data) {
        setMediaPolicy(policyResult.data);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!selectedProductId && products.length > 0) {
      setSelectedProductId(products[0]?.id ?? null);
    }
  }, [products, selectedProductId]);

  const [selectedStepId, setSelectedStepId] = useState<number | null>(stepsState[0]?.id ?? null);
  useEffect(() => {
    if (!stepsState.find((s) => s.id === selectedStepId)) {
      setSelectedStepId(stepsState[0]?.id ?? null);
    }
  }, [stepsState, selectedStepId]);

  const selectedStep = useMemo(
    () => stepsState.find((step) => step.id === selectedStepId) ?? stepsState[0] ?? null,
    [stepsState, selectedStepId],
  );

  const [newStepForm, setNewStepForm] = useState<NewStepForm>({
    step_type: "checkout",
    landing_page_id: null,
    slug: "",
  });

  const [stepEditor, setStepEditor] = useState({
    slug: "",
    is_enabled: true,
    next_step_on_success: "",
    next_step_on_failure: "",
  });

  useEffect(() => {
    if (!selectedStep) return;
    setStepEditor({
      slug: selectedStep.slug ?? "",
      is_enabled: selectedStep.is_enabled,
      next_step_on_success: String(selectedStep.settings_json?.next_step_on_success ?? ""),
      next_step_on_failure: String(selectedStep.settings_json?.next_step_on_failure ?? ""),
    });
  }, [selectedStep]);

  const currentPageId = selectedStep?.landing_page_id ?? 0;

  const stepBlocks = useMemo(() => {
    if (!selectedStep) return [];
    const loaded = currentPageId ? blocksByPageId[currentPageId] : undefined;
    const src = loaded && loaded.length > 0 ? loaded : fallbackBlocksFromStep(selectedStep);
    return src.slice().sort((a, b) => a.sort_order - b.sort_order);
  }, [blocksByPageId, currentPageId, selectedStep]);

  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);

  useEffect(() => {
    if (!stepBlocks.find((b) => b.id === selectedBlockId)) {
      setSelectedBlockId(stepBlocks[0]?.id ?? null);
    }
  }, [stepBlocks, selectedBlockId]);

  const selectedBlock = useMemo(
    () => stepBlocks.find((block) => block.id === selectedBlockId) ?? stepBlocks[0] ?? null,
    [stepBlocks, selectedBlockId],
  );

  useEffect(() => {
    if (!token || !selectedStep?.landing_page_id || blocksByPageId[selectedStep.landing_page_id]) return;

    void (async () => {
      setLoadingBlocks(true);
      try {
        const res = await fetch(`${FUNNEL_API_BASE}/landing/pages/${selectedStep.landing_page_id}/blocks`, {
          headers: buildApiHeaders(token),
        });
        const result = await readApiResponse<LandingPageBlock[]>(res);
        if (result.ok) {
          setBlocksByPageId((prev) => ({ ...prev, [selectedStep.landing_page_id as number]: Array.isArray(result.data) ? result.data : [] }));
        }
      } finally {
        setLoadingBlocks(false);
      }
    })();
  }, [blocksByPageId, selectedStep, token]);

  useEffect(() => {
    if (!token || !selectedProductId) return;
    setSelectedMediaId(null);
    void refreshProductMedia(selectedProductId);
  }, [selectedProductId, token]);

  const viewportClass = viewport === "desktop"
    ? "max-w-[1100px]"
    : viewport === "tablet"
      ? "max-w-[820px]"
      : "max-w-[420px]";

  const save = async () => {
    if (!token) return;
    setBusy("saving");
    setNotice("");
    try {
      const res = await fetch(`${FUNNEL_API_BASE}/funnels/${funnel.id}`, {
        method: "PUT",
        headers: buildApiHeaders(token, true),
        body: JSON.stringify({ name }),
      });
      const result = await readApiResponse<FunnelData>(res);
      if (result.ok && result.data) {
        onFunnelUpdated(result.data);
        setNotice(t.saveDone);
      } else {
        setNotice(result.message);
      }
    } finally {
      setBusy("idle");
    }
  };

  const publish = async () => {
    if (!token) return;
    setBusy("publishing");
    setNotice("");
    try {
      const res = await fetch(`${FUNNEL_API_BASE}/funnels/${funnel.id}/publish`, {
        method: "PUT",
        headers: buildApiHeaders(token),
      });
      const result = await readApiResponse<FunnelData>(res);
      if (result.ok && result.data) {
        onFunnelUpdated(result.data);
        setNotice(t.publishDone);
      } else {
        setNotice(result.message);
      }
    } finally {
      setBusy("idle");
    }
  };

  const archive = async () => {
    if (!token) return;
    setBusy("archiving");
    setNotice("");
    try {
      const res = await fetch(`${FUNNEL_API_BASE}/funnels/${funnel.id}/archive`, {
        method: "PUT",
        headers: buildApiHeaders(token),
      });
      const result = await readApiResponse<FunnelData>(res);
      if (result.ok && result.data) {
        onFunnelUpdated(result.data);
      }
      setNotice(result.ok ? t.archiveDone : result.message);
    } finally {
      setBusy("idle");
    }
  };

  const createStep = async () => {
    if (!token || !activeFlow || !newStepForm.landing_page_id) return;
    setBusy("step");
    setNotice("");
    try {
      const res = await fetch(`${FUNNEL_API_BASE}/funnels/${funnel.id}/flows/${activeFlow.id}/steps`, {
        method: "POST",
        headers: buildApiHeaders(token, true),
        body: JSON.stringify(newStepForm),
      });
      const result = await readApiResponse<FunnelFlowStep>(res);
      if (result.ok && result.data) {
        const next = [...stepsState, result.data].sort((a, b) => a.step_order - b.step_order);
        setStepsState(next);
        setSelectedStepId(result.data.id);
        setNotice(t.createStepDone);
      } else {
        setNotice(result.message);
      }
    } finally {
      setBusy("idle");
    }
  };

  const updateStep = async () => {
    if (!token || !activeFlow || !selectedStep) return;
    setBusy("step");
    setNotice("");
    try {
      const payload = {
        slug: stepEditor.slug,
        is_enabled: stepEditor.is_enabled,
        settings_json: {
          ...(selectedStep.settings_json ?? {}),
          next_step_on_success: stepEditor.next_step_on_success ? Number(stepEditor.next_step_on_success) : null,
          next_step_on_failure: stepEditor.next_step_on_failure ? Number(stepEditor.next_step_on_failure) : null,
        },
      };

      const res = await fetch(`${FUNNEL_API_BASE}/funnels/${funnel.id}/flows/${activeFlow.id}/steps/${selectedStep.id}`, {
        method: "PUT",
        headers: buildApiHeaders(token, true),
        body: JSON.stringify(payload),
      });
      const result = await readApiResponse<FunnelFlowStep>(res);
      if (result.ok && result.data) {
        setStepsState((prev) => prev.map((step) => (step.id === result.data?.id ? result.data : step)));
        setNotice(t.updateStepDone);
      } else {
        setNotice(result.message);
      }
    } finally {
      setBusy("idle");
    }
  };

  const deleteStep = async () => {
    if (!token || !activeFlow || !selectedStep) return;
    setBusy("step");
    setNotice("");
    try {
      const res = await fetch(`${FUNNEL_API_BASE}/funnels/${funnel.id}/flows/${activeFlow.id}/steps/${selectedStep.id}`, {
        method: "DELETE",
        headers: buildApiHeaders(token),
      });
      const result = await readApiResponse(res);
      if (result.ok) {
        setStepsState((prev) => prev.filter((step) => step.id !== selectedStep.id));
        setNotice(t.deleteStepDone);
      } else {
        setNotice(result.message);
      }
    } finally {
      setBusy("idle");
    }
  };

  const reorderStep = async (stepId: number, direction: -1 | 1) => {
    if (!token || !activeFlow) return;
    const current = [...stepsState].sort((a, b) => a.step_order - b.step_order);
    const index = current.findIndex((step) => step.id === stepId);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= current.length) return;

    [current[index], current[swapIndex]] = [current[swapIndex], current[index]];
    const payload = current.map((step, i) => ({ id: step.id, order: i + 1 }));

    setBusy("step");
    setNotice("");
    try {
      const res = await fetch(`${FUNNEL_API_BASE}/funnels/${funnel.id}/flows/${activeFlow.id}/steps/reorder`, {
        method: "PUT",
        headers: buildApiHeaders(token, true),
        body: JSON.stringify({ steps: payload }),
      });
      const result = await readApiResponse(res);
      if (result.ok) {
        setStepsState(current.map((step, i) => ({ ...step, step_order: i + 1 })));
        setNotice(t.reorderDone);
      } else {
        setNotice(result.message);
      }
    } finally {
      setBusy("idle");
    }
  };

  const addBlock = async (blockType: FunnelBlockType) => {
    if (!token || !selectedStep?.landing_page_id) return;
    const def = getBlockDefinition(blockType);
    if (!def) return;

    setBusy("block");
    setNotice("");
    try {
      const res = await fetch(`${FUNNEL_API_BASE}/landing/pages/${selectedStep.landing_page_id}/blocks`, {
        method: "POST",
        headers: buildApiHeaders(token, true),
        body: JSON.stringify({
          block_type: blockType,
          settings_json: def.defaultSettings,
          content_json: def.defaultContent,
          visibility_rules_json: {},
          locked: false,
        }),
      });
      const result = await readApiResponse<LandingPageBlock>(res);
      if (result.ok && result.data) {
        const next = [...(blocksByPageId[selectedStep.landing_page_id] ?? []), result.data].sort((a, b) => a.sort_order - b.sort_order);
        setBlocksByPageId((prev) => ({ ...prev, [selectedStep.landing_page_id as number]: next }));
        setSelectedBlockId(result.data.id);
      } else {
        setNotice(result.message);
      }
    } finally {
      setBusy("idle");
    }
  };

  const saveBlockWithResult = async (payload: { settings_json?: Record<string, unknown>; content_json?: Record<string, unknown>; visibility_rules_json?: Record<string, unknown>; locked?: boolean }) => {
    if (!token || !selectedStep?.landing_page_id || !selectedBlock || selectedBlock.id < 0) return;

    setBusy("block");
    setNotice("");
    try {
      const res = await fetch(`${FUNNEL_API_BASE}/landing/pages/${selectedStep.landing_page_id}/blocks/${selectedBlock.id}`, {
        method: "PUT",
        headers: buildApiHeaders(token, true),
        body: JSON.stringify(payload),
      });
      const result = await readApiResponse<LandingPageBlock>(res);
      if (result.ok && result.data) {
        setBlocksByPageId((prev) => ({
          ...prev,
          [selectedStep.landing_page_id as number]: (prev[selectedStep.landing_page_id as number] ?? []).map((item) => item.id === result.data?.id ? result.data : item),
        }));
        return true;
      } else {
        setNotice(result.message);
        return false;
      }
    } finally {
      setBusy("idle");
    }
  };

  const saveBlock = async (payload: { settings_json?: Record<string, unknown>; content_json?: Record<string, unknown>; visibility_rules_json?: Record<string, unknown>; locked?: boolean }) => {
    await saveBlockWithResult(payload);
  };

  const deleteBlock = async () => {
    if (!token || !selectedStep?.landing_page_id || !selectedBlock || selectedBlock.id < 0) return;

    setBusy("block");
    setNotice("");
    try {
      const res = await fetch(`${FUNNEL_API_BASE}/landing/pages/${selectedStep.landing_page_id}/blocks/${selectedBlock.id}`, {
        method: "DELETE",
        headers: buildApiHeaders(token),
      });
      const result = await readApiResponse(res);
      if (result.ok) {
        setBlocksByPageId((prev) => ({
          ...prev,
          [selectedStep.landing_page_id as number]: (prev[selectedStep.landing_page_id as number] ?? []).filter((item) => item.id !== selectedBlock.id),
        }));
      } else {
        setNotice(result.message);
      }
    } finally {
      setBusy("idle");
    }
  };

  const reorderBlock = async (direction: -1 | 1) => {
    if (!token || !selectedStep?.landing_page_id || !selectedBlock || selectedBlock.id < 0) return;
    const current = [...stepBlocks];
    const index = current.findIndex((item) => item.id === selectedBlock.id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= current.length) return;

    [current[index], current[swapIndex]] = [current[swapIndex], current[index]];
    const payload = current.map((item, i) => ({ id: item.id, order: i + 1 }));

    setBusy("block");
    try {
      const res = await fetch(`${FUNNEL_API_BASE}/landing/pages/${selectedStep.landing_page_id}/blocks/reorder`, {
        method: "PUT",
        headers: buildApiHeaders(token, true),
        body: JSON.stringify({ blocks: payload }),
      });
      const result = await readApiResponse(res);
      if (result.ok) {
        const next = current.map((item, i) => ({ ...item, sort_order: i + 1 }));
        setBlocksByPageId((prev) => ({ ...prev, [selectedStep.landing_page_id as number]: next }));
      } else {
        setNotice(result.message);
      }
    } finally {
      setBusy("idle");
    }
  };

  const uploadProductMedia = async (files: FileList | null) => {
    if (!token || !selectedProductId || !files || files.length === 0) return;

    setUploadingMedia(true);
    setUploadProgress(0);
    setNotice("");
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files[]", file);
      });

      const result = await new Promise<{ ok: boolean; data: ProductMedia[] | null; message: string }>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${FUNNEL_API_BASE}/products/${selectedProductId}/media`);

        const headers = new Headers(buildApiHeaders(token));
        headers.forEach((value, key) => {
          xhr.setRequestHeader(key, value);
        });

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        };

        xhr.onerror = () => {
          resolve({ ok: false, data: null, message: "Network error. Please try again." });
        };

        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText || "{}") as {
              success?: boolean;
              data?: ProductMedia[];
              message?: string;
            };
            resolve({
              ok: xhr.status >= 200 && xhr.status < 300,
              data: Array.isArray(json.data) ? json.data : null,
              message: json.message ?? (xhr.status >= 200 && xhr.status < 300 ? "OK" : "Request failed."),
            });
          } catch {
            resolve({
              ok: xhr.status >= 200 && xhr.status < 300,
              data: null,
              message: xhr.status >= 200 && xhr.status < 300 ? "OK" : "Request failed.",
            });
          }
        };

        xhr.send(formData);
      });

      if (result.ok && Array.isArray(result.data)) {
        setProductMedia(result.data);
        setSelectedMediaId(result.data[0]?.id ?? null);
      } else {
        setNotice(result.message);
      }
    } finally {
      setUploadingMedia(false);
      setUploadProgress(0);
    }
  };

  const refreshProductMedia = async (productId: number) => {
    if (!token || !productId) return;
    const res = await fetch(`${FUNNEL_API_BASE}/products/${productId}/media`, {
      headers: buildApiHeaders(token),
    });
    const result = await readApiResponse<ProductMedia[]>(res);
    if (result.ok && Array.isArray(result.data)) {
      setProductMedia(result.data);
      if (result.data.length > 0 && !result.data.find((item) => item.id === selectedMediaId)) {
        setSelectedMediaId(result.data[0].id);
      }
    }
  };

  const setPrimaryMedia = async (mediaId: number) => {
    if (!token || !selectedProductId) return;
    setMediaBusy("thumbnail");
    setNotice("");
    try {
      const res = await fetch(`${FUNNEL_API_BASE}/products/${selectedProductId}/media/${mediaId}/set-thumbnail`, {
        method: "PUT",
        headers: buildApiHeaders(token),
      });
      const result = await readApiResponse<ProductMedia[]>(res);
      if (result.ok && Array.isArray(result.data)) {
        setProductMedia(result.data);
        setNotice(t.mediaPrimaryUpdated);
      } else {
        setNotice(result.message);
      }
    } finally {
      setMediaBusy("idle");
    }
  };

  const removeMedia = async (mediaId: number) => {
    if (!token || !selectedProductId) return;
    if (!window.confirm(t.confirmDeleteMedia)) return;
    setMediaBusy("delete");
    setNotice("");
    try {
      const res = await fetch(`${FUNNEL_API_BASE}/products/${selectedProductId}/media/${mediaId}`, {
        method: "DELETE",
        headers: buildApiHeaders(token),
      });
      const result = await readApiResponse<ProductMedia[]>(res);
      if (result.ok && Array.isArray(result.data)) {
        setProductMedia(result.data);
        setSelectedMediaId(result.data[0]?.id ?? null);
        setNotice(t.mediaDeleted);
      } else {
        setNotice(result.message);
      }
    } finally {
      setMediaBusy("idle");
    }
  };

  const reorderMedia = async (mediaId: number, direction: -1 | 1) => {
    if (!token || !selectedProductId) return;
    const current = [...productMedia];
    const index = current.findIndex((item) => item.id === mediaId);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= current.length) return;

    [current[index], current[swapIndex]] = [current[swapIndex], current[index]];

    setMediaBusy("reorder");
    setNotice("");
    try {
      const res = await fetch(`${FUNNEL_API_BASE}/products/${selectedProductId}/media/reorder`, {
        method: "PUT",
        headers: buildApiHeaders(token, true),
        body: JSON.stringify({ order: current.map((item) => item.id) }),
      });
      const result = await readApiResponse<ProductMedia[]>(res);
      if (result.ok && Array.isArray(result.data)) {
        setProductMedia(result.data);
        setNotice(t.mediaReordered);
      } else {
        setNotice(result.message);
      }
    } finally {
      setMediaBusy("idle");
    }
  };

  const applyMediaToSelectedBlock = async (mediaUrl: string) => {
    if (!selectedBlock) {
      setNotice(t.noBlock);
      return;
    }

    const ok = await saveBlockWithResult({
      settings_json: {
        ...(selectedBlock.settings_json ?? {}),
        image_url: mediaUrl,
        media_url: mediaUrl,
      },
      content_json: {
        ...(selectedBlock.content_json ?? {}),
        image_url: mediaUrl,
        media_url: mediaUrl,
      },
    });
    if (ok) {
      setNotice(t.mediaApplied);
    }
  };

  return (
    <div className="space-y-4">
      <section className="catv-panel p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-[220px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-2 py-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t.mode}</span>
            {modeOptions.map((item) => (
              <button
                key={item}
                onClick={() => setMode(item)}
                className={`rounded-lg px-2 py-1 text-xs font-semibold ${mode === item ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-2 py-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t.viewport}</span>
            {(["desktop", "tablet", "mobile"] as Viewport[]).map((vp) => (
              <button
                key={vp}
                onClick={() => setViewport(vp)}
                className={`rounded-lg px-2 py-1 text-xs font-semibold ${viewport === vp ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}
              >
                {vp}
              </button>
            ))}
          </div>
          <button onClick={() => void save()} disabled={busy !== "idle"} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {busy === "saving" ? t.saving : t.save}
          </button>
          <button onClick={() => void publish()} disabled={busy !== "idle"} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {busy === "publishing" ? t.publishing : t.publish}
          </button>
          <button onClick={() => void archive()} disabled={busy !== "idle"} className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-600 disabled:opacity-60">
            {busy === "archiving" ? t.archived : t.archive}
          </button>
          <Link href={`/dashboard/funnels/${funnel.id}/preview`} className="rounded-xl border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-600">Preview</Link>
        </div>
        {notice ? <p className="mt-3 rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--muted)]">{notice}</p> : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <aside className="catv-panel p-3">
          <div className="mb-3 grid grid-cols-2 gap-2">
            {(["blocks", "steps", "templates", "assets"] as LeftTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setLeftTab(tab)}
                className={`rounded-lg px-2 py-2 text-xs font-semibold ${leftTab === tab ? "bg-[var(--accent)] text-white" : "border border-[var(--border)]"}`}
              >
                {t[tab]}
              </button>
            ))}
          </div>

          {leftTab === "steps" ? (
            <div className="space-y-2">
              {stepsState.length === 0 ? <p className="text-xs text-[var(--muted)]">{t.noStep}</p> : null}
              {stepsState.map((step) => (
                <div key={step.id} className={`rounded-xl border px-2 py-2 ${selectedStep?.id === step.id ? "border-[var(--accent)] bg-[var(--surface-soft)]" : "border-[var(--border)]"}`}>
                  <button onClick={() => setSelectedStepId(step.id)} className="w-full text-left">
                    <p className="text-xs font-semibold">#{step.step_order} • {step.step_type}</p>
                    <p className="text-[11px] text-[var(--muted)]">{step.landing_page?.title ?? "-"}</p>
                  </button>
                  {selectedStep?.id === step.id ? (
                    <div className="mt-2 flex gap-1">
                      <button onClick={() => void reorderStep(step.id, -1)} className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px]">{t.moveUp}</button>
                      <button onClick={() => void reorderStep(step.id, 1)} className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px]">{t.moveDown}</button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {leftTab === "blocks" ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--border)] p-2">
                <p className="mb-2 text-xs font-semibold text-[var(--muted)]">Block Palette</p>
                <div className="grid gap-2">
                  {FUNNEL_BLOCK_REGISTRY.map((blockDef) => (
                    <button
                      key={blockDef.type}
                      onClick={() => void addBlock(blockDef.type)}
                      disabled={busy !== "idle" || !selectedStep?.landing_page_id}
                      className="flex items-center justify-between rounded-lg border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-60"
                    >
                      <span>{blockDef.label[locale]}</span>
                      <span className="font-semibold text-[var(--accent)]">{t.addBlock}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {loadingBlocks ? <p className="text-xs text-[var(--muted)]">{t.loadingBlocks}</p> : null}
                {stepBlocks.length === 0 ? <p className="text-xs text-[var(--muted)]">{t.noBlock}</p> : null}
                {stepBlocks.map((block) => (
                  <div key={block.id} className={`rounded-xl border px-2 py-2 ${selectedBlock?.id === block.id ? "border-[var(--accent)] bg-[var(--surface-soft)]" : "border-[var(--border)]"}`}>
                    <button onClick={() => setSelectedBlockId(block.id)} className="w-full text-left">
                      <p className="text-xs font-semibold capitalize">{block.block_type.replaceAll("_", " ")}</p>
                      <p className="text-[11px] text-[var(--muted)]">{block.block_key}</p>
                    </button>
                    {selectedBlock?.id === block.id && block.id > 0 ? (
                      <div className="mt-2 flex gap-1">
                        <button onClick={() => void reorderBlock(-1)} className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px]">{t.moveUp}</button>
                        <button onClick={() => void reorderBlock(1)} className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px]">{t.moveDown}</button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {leftTab === "templates" ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-xs text-[var(--muted)]">
              Template/block preset system ready. Registry-backed presets are now available via Block Palette.
            </div>
          ) : null}

          {leftTab === "assets" ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--border)] p-3">
                <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t.mediaLibrary}</p>
                <select
                  value={selectedProductId ?? ""}
                  onChange={(e) => setSelectedProductId(Number(e.target.value) || null)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-xs"
                >
                  <option value="">{t.chooseProduct}</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>

                <label className="mt-3 block cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-center text-xs font-semibold">
                  {uploadingMedia ? t.uploadingMedia : t.uploadMedia}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    disabled={!selectedProductId || uploadingMedia}
                    onChange={(e) => {
                      void uploadProductMedia(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>

                <p className="mt-2 text-[11px] text-[var(--muted)]">
                  {t.uploadHint}
                  {mediaPolicy
                    ? ` • max ${mediaPolicy.max_gallery_images ?? "-"} files, ${mediaPolicy.max_file_size_mb ?? "-"}MB each`
                    : ""}
                </p>
                {uploadingMedia ? (
                  <p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">{t.uploadProgress}: {uploadProgress}%</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                {productMedia.length === 0 ? <p className="text-xs text-[var(--muted)]">{t.noMedia}</p> : null}
                {productMedia.map((media, index) => (
                  <div
                    key={media.id}
                    className={`rounded-xl border p-2 ${selectedMediaId === media.id ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
                    onClick={() => setSelectedMediaId(media.id)}
                  >
                    <div className="mb-2 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-soft)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={media.url} alt={media.file_name ?? `media-${media.id}`} className="h-24 w-full object-cover" />
                    </div>
                    {selectedMediaId === media.id ? <p className="mb-1 text-[10px] font-semibold text-[var(--accent)]">{t.selected}</p> : null}
                    <div className="grid gap-1">
                      <div className="flex gap-1">
                        <button
                          onClick={() => void reorderMedia(media.id, -1)}
                          disabled={mediaBusy !== "idle" || index === 0}
                          className="flex-1 rounded border border-[var(--border)] px-2 py-1 text-[10px] disabled:opacity-60"
                        >
                          {t.moveUp}
                        </button>
                        <button
                          onClick={() => void reorderMedia(media.id, 1)}
                          disabled={mediaBusy !== "idle" || index === productMedia.length - 1}
                          className="flex-1 rounded border border-[var(--border)] px-2 py-1 text-[10px] disabled:opacity-60"
                        >
                          {t.moveDown}
                        </button>
                      </div>

                      <button
                        onClick={() => void applyMediaToSelectedBlock(media.url)}
                        disabled={!selectedBlock || busy !== "idle"}
                        className="w-full rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] font-semibold disabled:opacity-60"
                      >
                        {t.useInBlock}
                      </button>

                      <div className="flex gap-1">
                        <button
                          onClick={() => void setPrimaryMedia(media.id)}
                          disabled={mediaBusy !== "idle" || Boolean(media.is_primary)}
                          className="flex-1 rounded border border-[var(--border)] px-2 py-1 text-[10px] disabled:opacity-60"
                        >
                          {media.is_primary ? t.thumbnail : t.setAsThumbnail}
                        </button>
                        <button
                          onClick={() => void removeMedia(media.id)}
                          disabled={mediaBusy !== "idle"}
                          className="flex-1 rounded border border-red-300 px-2 py-1 text-[10px] text-red-600 disabled:opacity-60"
                        >
                          {t.deleteMedia}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <main className="catv-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{mode === "flow" ? t.flowManager : t.canvas}</h3>
            <p className="text-xs text-[var(--muted)]">{mode} mode</p>
          </div>

          {mode === "flow" ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                <p className="mb-2 text-sm font-semibold">{t.addStep}</p>
                <div className="grid gap-2 md:grid-cols-3">
                  <select value={newStepForm.step_type} onChange={(e) => setNewStepForm((prev) => ({ ...prev, step_type: e.target.value as FunnelStepType }))} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-xs">
                    {stepTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select value={newStepForm.landing_page_id ?? ""} onChange={(e) => setNewStepForm((prev) => ({ ...prev, landing_page_id: Number(e.target.value) || null }))} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-xs">
                    <option value="">{t.landingPage}</option>
                    {landingPages.map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}
                  </select>
                  <input value={newStepForm.slug} onChange={(e) => setNewStepForm((prev) => ({ ...prev, slug: e.target.value }))} placeholder={t.stepSlug} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-xs" />
                </div>
                <button onClick={() => void createStep()} disabled={busy !== "idle"} className="mt-3 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
                  {busy === "step" ? t.creating : t.addStep}
                </button>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                <p className="mb-2 text-sm font-semibold">{t.selectedStep}</p>
                {!selectedStep ? (
                  <p className="text-xs text-[var(--muted)]">{t.noStep}</p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    <input value={stepEditor.slug} onChange={(e) => setStepEditor((prev) => ({ ...prev, slug: e.target.value }))} placeholder={t.stepSlug} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-xs" />
                    <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-xs">
                      <input type="checkbox" checked={stepEditor.is_enabled} onChange={(e) => setStepEditor((prev) => ({ ...prev, is_enabled: e.target.checked }))} />
                      {t.enabled}
                    </label>
                    <select value={stepEditor.next_step_on_success} onChange={(e) => setStepEditor((prev) => ({ ...prev, next_step_on_success: e.target.value }))} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-xs">
                      <option value="">{t.transitionSuccess} ({t.none})</option>
                      {stepsState.filter((step) => step.id !== selectedStep.id).map((step) => <option key={step.id} value={step.id}>#{step.step_order} {step.step_type}</option>)}
                    </select>
                    <select value={stepEditor.next_step_on_failure} onChange={(e) => setStepEditor((prev) => ({ ...prev, next_step_on_failure: e.target.value }))} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-xs">
                      <option value="">{t.transitionFailure} ({t.none})</option>
                      {stepsState.filter((step) => step.id !== selectedStep.id).map((step) => <option key={step.id} value={step.id}>#{step.step_order} {step.step_type}</option>)}
                    </select>
                    <div className="md:col-span-2 flex gap-2">
                      <button onClick={() => void updateStep()} disabled={busy !== "idle"} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{busy === "step" ? t.updating : t.updateStep}</button>
                      <button onClick={() => void deleteStep()} disabled={busy !== "idle"} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-60">{busy === "step" ? t.deleting : t.deleteStep}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mx-auto transition-all duration-200">
              <div className={`${viewportClass} mx-auto min-h-[500px] rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4`}>
                {stepBlocks.length === 0 ? (
                  <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted)]">
                    {t.noBlock}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stepBlocks.map((block) => {
                      const def = getBlockDefinition(block.block_type);
                      return (
                        <button
                          key={block.id}
                          onClick={() => setSelectedBlockId(block.id)}
                          className={`w-full rounded-xl border p-4 text-left ${selectedBlock?.id === block.id ? "border-[var(--accent)] bg-white" : "border-[var(--border)] bg-[var(--background)]"}`}
                        >
                          <p className="text-xs font-semibold uppercase text-[var(--muted)]">{block.block_type}</p>
                          <p className="mt-1 text-sm font-semibold">{def?.label[locale] ?? block.block_key ?? t.untitledBlock}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">{def?.description[locale] ?? "Custom block"}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        <aside className="catv-panel p-4">
          <h3 className="mb-3 text-sm font-semibold">{t.inspector}</h3>

          <div className="mb-3 space-y-3 text-xs">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
              <p className="font-semibold">{t.flowSummary}</p>
              <p className="mt-2 text-[var(--muted)]">{t.status}: <span className="font-semibold text-[var(--foreground)]">{funnel.status}</span></p>
              <p className="text-[var(--muted)]">{t.slug}: <span className="font-semibold text-[var(--foreground)]">/{funnel.slug}</span></p>
              <p className="text-[var(--muted)]">Steps: <span className="font-semibold text-[var(--foreground)]">{stepsState.length}</span></p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
              <p className="font-semibold">{t.selectedStep}</p>
              {selectedStep ? (
                <div className="mt-2 space-y-1 text-[var(--muted)]">
                  <p>Type: <span className="font-semibold text-[var(--foreground)]">{selectedStep.step_type}</span></p>
                  <p>Order: <span className="font-semibold text-[var(--foreground)]">{selectedStep.step_order}</span></p>
                  <p>Slug: <span className="font-semibold text-[var(--foreground)]">/{selectedStep.slug ?? "-"}</span></p>
                </div>
              ) : <p className="mt-2 text-[var(--muted)]">-</p>}
            </div>
          </div>

          <FunnelBlockInspector
            block={selectedBlock}
            locale={locale}
            busy={busy !== "idle"}
            onSave={saveBlock}
            onDelete={deleteBlock}
          />
        </aside>
      </section>
    </div>
  );
}
