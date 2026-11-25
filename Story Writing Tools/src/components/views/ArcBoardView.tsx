import { useCallback, useEffect, useRef, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Check,
  Expand,
  FolderPlus,
  Network,
  Plus,
  Save,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApp } from "../../context/AppContext";
import { storageBridge } from "../../services/bridge";

export type ArcNodeKind = "event" | "note";

export interface ArcNodeData extends Record<string, unknown> {
  kind: ArcNodeKind;
  title: string;
  notes: string;
  tag?: string;
}

type ArcFlowNode = Node<ArcNodeData, "arcCard">;

function ArcCardNode({ data, selected }: NodeProps<ArcFlowNode>) {
  const { t } = useTranslation();
  const isNote = data.kind === "note";
  const hasLongNotes = (data.notes ?? "").length > 110;

  return (
    <div
      className={`group relative w-60 rounded-xl border p-3.5 shadow-md transition-all ${
        selected
          ? "border-accent ring-2 ring-accent/40"
          : isNote
            ? "border-amber-500/45"
            : "border-edge-strong"
      } ${isNote ? "bg-amber-500/12 backdrop-blur-xs" : "bg-surface"}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="t-top"
        className="!h-2.5 !w-2.5 !border-2 !border-surface !bg-accent"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="t-left"
        className="!h-2.5 !w-2.5 !border-2 !border-surface !bg-accent"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="s-right"
        className="!h-2.5 !w-2.5 !border-2 !border-surface !bg-accent"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="s-bottom"
        className="!h-2.5 !w-2.5 !border-2 !border-surface !bg-accent"
      />

      <div className="flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            isNote
              ? "bg-amber-500/20 text-amber-400"
              : "bg-accent-soft text-accent"
          }`}
        >
          {isNote ? (
            <StickyNote className="h-3 w-3" />
          ) : (
            <Network className="h-3 w-3" />
          )}
          {isNote ? t("arcView.noteBadge") : t("arcView.eventBadge")}
        </span>
        {data.tag && (
          <span className="truncate rounded-md bg-elevated px-1.5 py-0.5 text-[10px] text-ink-muted">
            {data.tag}
          </span>
        )}
      </div>

      <h4 className="mt-2 line-clamp-2 font-display text-sm font-semibold text-ink">
        {data.title}
      </h4>

      {data.notes ? (
        <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-ink-secondary">
          {data.notes}
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] italic text-ink-muted">
          {t("arcView.clickToEdit")}
        </p>
      )}

      {hasLongNotes && (
        <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-accent">
          <Expand className="h-3 w-3" />
          {t("arcView.openLongNote")}
        </div>
      )}
    </div>
  );
}

const NODE_TYPES = { arcCard: ArcCardNode };

function parseJsonSafe<T>(raw: string, fallback: T): T {
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function ArcBoardView() {
  const { t } = useTranslation();
  const { activeProject, openProjectModal } = useApp();

  const [nodes, setNodes, onNodesChange] = useNodesState<ArcFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  // Detail modal state for inspecting/editing long notes cleanly without breaking canvas
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalTag, setModalTag] = useState("");
  const [modalKind, setModalKind] = useState<ArcNodeKind>("event");
  const [modalNotes, setModalNotes] = useState("");

  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activeProject) {
      setNodes([]);
      setEdges([]);
      setIsLoaded(false);
      return;
    }

    let cancelled = false;
    setIsLoaded(false);
    setEditingNodeId(null);

    void storageBridge.getArcCanvas(activeProject.id).then((canvas) => {
      if (cancelled) return;
      const loadedNodes = parseJsonSafe<ArcFlowNode[]>(canvas.nodesJson, []);
      const loadedEdges = parseJsonSafe<Edge[]>(canvas.edgesJson, []);
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setIsLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [activeProject?.id, setNodes, setEdges]);

  const persistCanvas = useCallback(
    async (
      projectId: number,
      nextNodes: ArcFlowNode[],
      nextEdges: Edge[],
      showToast = false
    ) => {
      await storageBridge.saveArcCanvas(
        projectId,
        JSON.stringify(nextNodes),
        JSON.stringify(nextEdges)
      );
      if (showToast) {
        setSavedToast(true);
        window.setTimeout(() => setSavedToast(false), 1800);
      }
    },
    []
  );

  // Debounced auto-save whenever nodes or edges change after initial load
  useEffect(() => {
    if (!activeProject || !isLoaded) return;

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    const projectId = activeProject.id;
    saveTimerRef.current = window.setTimeout(() => {
      void persistCanvas(projectId, nodes, edges, false);
    }, 650);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [activeProject, isLoaded, nodes, edges, persistCanvas]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: false,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 18,
              height: 18,
            },
            style: { strokeWidth: 2 },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const addCard = (kind: ArcNodeKind) => {
    const index = nodes.length;
    const newNode: ArcFlowNode = {
      id: `arc-${crypto.randomUUID()}`,
      type: "arcCard",
      position: {
        x: 120 + (index % 4) * 280,
        y: 100 + Math.floor(index / 4) * 190,
      },
      data: {
        kind,
        title:
          kind === "event"
            ? t("arcView.newEventTitle", { num: index + 1 })
            : t("arcView.newNoteTitle", { num: index + 1 }),
        notes: "",
        tag: "",
      },
    };
    setNodes((prev) => [...prev, newNode]);
    openNodeModal(newNode);
  };

  const openNodeModal = (node: ArcFlowNode) => {
    setEditingNodeId(node.id);
    setModalTitle(node.data.title);
    setModalTag(node.data.tag ?? "");
    setModalKind(node.data.kind);
    setModalNotes(node.data.notes ?? "");
  };

  const handleSaveModal = () => {
    if (!editingNodeId) return;
    setNodes((prev) =>
      prev.map((node) =>
        node.id === editingNodeId
          ? {
              ...node,
              data: {
                ...node.data,
                kind: modalKind,
                title: modalTitle.trim() || node.data.title,
                tag: modalTag.trim(),
                notes: modalNotes,
              },
            }
          : node
      )
    );
    setEditingNodeId(null);
  };

  const handleDeleteNodeFromModal = () => {
    if (!editingNodeId) return;
    const targetId = editingNodeId;
    setNodes((prev) => prev.filter((n) => n.id !== targetId));
    setEdges((prev) =>
      prev.filter((e) => e.source !== targetId && e.target !== targetId)
    );
    setEditingNodeId(null);
  };

  if (!activeProject) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center rounded-2xl border border-dashed border-edge-strong bg-surface p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Network className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold text-ink">
          {t("worldView.noProjectTitle")}
        </h3>
        <p className="mt-1.5 text-sm text-ink-secondary">
          {t("arcView.noProjectSubtitle")}
        </p>
        <button
          type="button"
          onClick={openProjectModal}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover"
        >
          <FolderPlus className="h-4 w-4" />
          {t("placeholder.openProjects")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Canvas Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-edge bg-surface px-4 py-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => addCard("event")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg transition-colors hover:bg-accent-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("arcView.addEvent")}
          </button>

          <button
            type="button"
            onClick={() => addCard("note")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/12 px-3 py-1.5 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-500/20"
          >
            <StickyNote className="h-3.5 w-3.5" />
            {t("arcView.addNote")}
          </button>

          <span className="hidden text-xs text-ink-muted md:inline">
            {t("arcView.toolbarHint")}
          </span>
        </div>

        <button
          type="button"
          onClick={() =>
            void persistCanvas(activeProject.id, nodes, edges, true)
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-edge-strong bg-elevated px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
        >
          {savedToast ? (
            <>
              <Check className="h-3.5 w-3.5 text-highlight" />
              {t("worldView.saved")}
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              {t("arcView.saveBoard")}
            </>
          )}
        </button>
      </div>

      {/* Infinite 2D React Flow Canvas */}
      <div className="relative min-h-[480px] flex-1 overflow-hidden rounded-2xl border border-edge bg-surface shadow-sm">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={(_event, node) => openNodeModal(node)}
          onNodeClick={(_event, node) => {
            if ((node.data.notes ?? "").length > 110) {
              openNodeModal(node);
            }
          }}
          nodeTypes={NODE_TYPES}
          fitView={nodes.length > 0}
          deleteKeyCode={["Backspace", "Delete"]}
          defaultEdgeOptions={{
            markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
            style: { strokeWidth: 2 },
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>

        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl border border-dashed border-edge-strong bg-surface/90 px-6 py-5 text-center backdrop-blur-xs">
              <Network className="mx-auto h-7 w-7 text-accent" />
              <p className="mt-2 text-sm font-semibold text-ink">
                {t("arcView.emptyTitle")}
              </p>
              <p className="mt-1 max-w-xs text-xs text-ink-secondary">
                {t("arcView.emptySubtitle")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Card Detail Modal (for reading/editing long notes cleanly without breaking canvas) */}
      {editingNodeId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setEditingNodeId(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-edge-strong bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-edge px-5 py-3.5">
              <h4 className="font-display text-base font-semibold text-ink">
                {t("arcView.modalTitle")}
              </h4>
              <button
                type="button"
                onClick={() => setEditingNodeId(null)}
                className="rounded-lg p-1 text-ink-muted hover:bg-elevated hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-secondary">
                    {t("arcView.cardTypeLabel")}
                  </label>
                  <select
                    value={modalKind}
                    onChange={(e) =>
                      setModalKind(e.target.value as ArcNodeKind)
                    }
                    className="w-full rounded-lg border border-edge-strong bg-elevated px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="event">{t("arcView.eventBadge")}</option>
                    <option value="note">{t("arcView.noteBadge")}</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-secondary">
                    {t("arcView.tagLabel")}
                  </label>
                  <input
                    type="text"
                    value={modalTag}
                    onChange={(e) => setModalTag(e.target.value)}
                    placeholder={t("arcView.tagPlaceholder")}
                    className="w-full rounded-lg border border-edge-strong bg-elevated px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-secondary">
                  {t("arcView.cardTitleLabel")}
                </label>
                <input
                  type="text"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  className="w-full rounded-lg border border-edge-strong bg-elevated px-3 py-2 text-sm font-semibold text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-secondary">
                  {t("arcView.notesLabel")}
                </label>
                <textarea
                  rows={9}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder={t("arcView.notesPlaceholder")}
                  className="w-full resize-y rounded-xl border border-edge-strong bg-elevated p-3 text-sm leading-relaxed text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-edge px-5 py-3.5">
              <button
                type="button"
                onClick={handleDeleteNodeFromModal}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("projects.delete")}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingNodeId(null)}
                  className="rounded-lg px-3 py-1.5 text-xs text-ink-secondary hover:text-ink"
                >
                  {t("projects.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleSaveModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover"
                >
                  <Check className="h-3.5 w-3.5" />
                  {t("arcView.applyCard")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
