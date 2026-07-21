import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileJson2,
  FileSpreadsheet,
  GripVertical,
  Hand,
  Image as ImageIcon,
  Mic,
  MousePointer2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload
} from "lucide-react";
import { useRef, type ChangeEvent } from "react";
import type { StudioConcept } from "../core/concepts";
import type { StudioAsset } from "../types";

export type SetupStep = "media" | "cues";

interface StudioSetupProps {
  step: SetupStep;
  hydrated: boolean;
  assets: StudioAsset[];
  concepts: StudioConcept[];
  errorMessage: string | null;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveAsset: (asset: StudioAsset) => void;
  onUpdateConcept: (conceptId: string, updates: Partial<StudioConcept>) => void;
  onMoveAsset: (assetId: string, conceptId: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

const shortName = (name: string, length = 34) => name.length > length ? `${name.slice(0, length - 1)}…` : name;

function AssetPreview({ asset }: { asset: StudioAsset }) {
  if (asset.kind === "image" && asset.sourceUrl) return <img src={asset.sourceUrl} alt="" />;
  if (asset.kind === "video" && asset.sourceUrl) return <video src={asset.sourceUrl} muted playsInline preload="metadata" aria-hidden="true" />;
  if (asset.kind === "csv") return <span className="setup-file-preview"><FileSpreadsheet /><b>CSV</b></span>;
  if (asset.kind === "json") return <span className="setup-file-preview"><FileJson2 /><b>JSON</b></span>;
  return <span className="setup-file-preview"><ImageIcon /><b>MEDIA</b></span>;
}

function ConceptPreview({ concept, assets }: { concept: StudioConcept; assets: StudioAsset[] }) {
  const members = concept.assetIds
    .map((id) => assets.find((asset) => asset.id === id))
    .filter((asset): asset is StudioAsset => Boolean(asset));
  if (members.length === 1) return <AssetPreview asset={members[0]} />;
  return <span className="setup-scene-preview">{members.slice(0, 4).map((asset) => <span key={asset.id}><AssetPreview asset={asset} /></span>)}</span>;
}

export function StudioSetup({
  step,
  hydrated,
  assets,
  concepts,
  errorMessage,
  onImport,
  onRemoveAsset,
  onUpdateConcept,
  onMoveAsset,
  onBack,
  onContinue
}: StudioSetupProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const ready = hydrated && assets.length > 0;

  return <main className="setup-flow concept-setup" data-setup-step={step}>
    <input ref={inputRef} data-testid="setup-asset-input" className="visually-hidden" type="file" multiple accept="image/*,video/*,.csv,text/csv,.json,application/json" onChange={onImport} />

    <header className="setup-header">
      <div className="setup-brand"><span><Hand /></span><div><strong>Rii-Flow</strong><small>PRESENTATION OS</small></div></div>
      <nav className="setup-progress" aria-label="Studio setup progress">
        <span className={step === "media" ? "active" : "done"}><b>{step === "media" ? "1" : <Check />}</b><em>Visuals</em></span><i />
        <span className={step === "cues" ? "active" : ""}><b>2</b><em>Concepts</em></span><i />
        <span><b>3</b><em>Present</em></span>
      </nav>
      <div className="setup-save"><ShieldCheck /><span><strong>Saved locally</strong><small>No account needed</small></span></div>
    </header>

    {step === "media" ? (
      <section className="setup-media-page" aria-labelledby="setup-media-title">
        <div className="setup-welcome-copy">
          <span className="setup-eyebrow"><Sparkles /> New presentation</span>
          <h1 id="setup-media-title">What do you want to explain?</h1>
          <p>Import the visuals. Rii-Flow quietly organizes related files into concepts.</p>
          <button className="setup-import-primary" onClick={() => inputRef.current?.click()}>
            <span><Upload /></span><span><strong>{assets.length ? "Add more visuals" : "Import visuals"}</strong><small>Images, GIFs, videos, CSV, or JSON</small></span><ArrowRight />
          </button>
          <div className="setup-flow-preview" aria-label="How Rii-Flow works">
            <span><b>1</b><small>Import</small></span><i /><span><b><Mic /></b><small>Speak</small></span><i /><span><b><MousePointer2 /></b><small>Pinch</small></span>
          </div>
        </div>

        <div className="setup-media-board">
          <header><span><small>Your visuals</small><strong>{hydrated ? `${assets.length} ${assets.length === 1 ? "visual" : "visuals"}` : "Loading your media…"}</strong></span>{assets.length > 0 && <button onClick={() => inputRef.current?.click()}><Upload /> Add visuals</button>}</header>
          {!hydrated ? <div className="setup-loading"><span /><strong>Opening your local studio</strong></div> : assets.length === 0 ? (
            <button className="setup-empty-library" onClick={() => inputRef.current?.click()}><span><Upload /></span><strong>Your visuals will appear here</strong><small>Choose several files at once. Related names are grouped automatically.</small></button>
          ) : <div className="setup-media-grid">{assets.map((asset) => <article key={asset.id} className="setup-media-card">
            <div className="setup-media-thumb"><AssetPreview asset={asset} /><span>{asset.kind}</span></div>
            <div><strong title={asset.name}>{shortName(asset.name)}</strong><small>{asset.kind === "video" ? "Video" : asset.kind === "image" ? "Image" : "Data"}</small></div>
            <button aria-label={`Remove ${asset.name}`} onClick={() => onRemoveAsset(asset)}><Trash2 /></button>
          </article>)}</div>}
        </div>
      </section>
    ) : (
      <section className="setup-cues-page" aria-labelledby="setup-cues-title">
        <aside className="setup-cues-intro">
          <button className="setup-back" onClick={onBack}><ArrowLeft /> Back to visuals</button>
          <span className="setup-eyebrow"><Sparkles /> Your concepts</span>
          <h1 id="setup-cues-title">Name the ideas, not the files.</h1>
          <p>Rename a concept or add words you naturally use. Drag a visual onto another concept to regroup it.</p>
          <div className="setup-example"><span><Mic /></span><div><small>You speak naturally</small><strong>“Let’s compare pricing”</strong></div><ArrowRight /><span><MousePointer2 /></span><div><small>When ready</small><strong>Pinch to show</strong></div></div>
          <div className="setup-cue-rule"><ShieldCheck /><span><strong>Speech creates context. Pinch confirms.</strong><small>Words alone never show a visual.</small></span></div>
        </aside>

        <div className="setup-cue-board concept-board">
          <header><span><small>Step 2 of 3</small><strong>Your concepts</strong></span><em>{concepts.length} ready</em></header>
          {errorMessage && <div className="setup-cue-error" role="alert">{errorMessage}</div>}
          <div className="setup-cue-list concept-list">
            {concepts.map((concept) => <article key={concept.id} className="setup-cue-card concept-card" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const assetId = event.dataTransfer.getData("text/rii-flow-asset"); if (assetId) onMoveAsset(assetId, concept.id); }}>
              <div className="setup-cue-thumb"><ConceptPreview concept={concept} assets={assets} /></div>
              <label className="concept-name-field"><span>Concept</span><input aria-label={`Concept name for ${concept.displayName}`} value={concept.displayName} onChange={(event) => onUpdateConcept(concept.id, { displayName: event.target.value })} /></label>
              <label className="concept-alias-field"><span><Mic /> Recognizes</span><input aria-label={`Aliases for ${concept.displayName}`} value={concept.aliases.join(", ")} onChange={(event) => onUpdateConcept(concept.id, { aliases: event.target.value.split(",") })} placeholder="pricing, plans, cost" /></label>
              <div className="concept-inline-controls"><span><MousePointer2 /> Pinch confirms</span><label><span>Animation</span><select aria-label={`Animation for ${concept.displayName}`} value={concept.animation} onChange={(event) => onUpdateConcept(concept.id, { animation: event.target.value as StudioConcept["animation"] })}><option value="fade">Fade</option><option value="slide">Glide</option><option value="pop">Pop</option><option value="float">Float</option></select></label></div>
              <div className="concept-members" aria-label={`${concept.displayName} visuals`}>{concept.assetIds.map((id) => {
                const asset = assets.find((candidate) => candidate.id === id);
                return asset ? <span key={id} draggable onDragStart={(event) => { event.dataTransfer.setData("text/rii-flow-asset", id); event.dataTransfer.effectAllowed = "move"; }}><GripVertical /><i><AssetPreview asset={asset} /></i><b>{shortName(asset.name, 18)}</b></span> : null;
              })}</div>
            </article>)}
          </div>
        </div>
      </section>
    )}

    <footer className="setup-footer">
      <span>{step === "media" ? ready ? "Rii-Flow will organize these into concepts." : "Import at least one visual to continue." : "The presenter never needs to remember a gesture per file."}</span>
      <button data-testid="setup-continue" disabled={step === "media" && !ready} onClick={onContinue}>{step === "media" ? "Organize concepts" : "Start presenting"}<ArrowRight /></button>
    </footer>
  </main>;
}
