import { useEffect, useRef, useState } from "react"
import { FileUp, Layers, Scan, Trash2, X } from "lucide-react"
import { loadVolumeFiles, type VolumeData } from "../lib/volumeLoader"

interface VolumeInspectorProps {
  volume: VolumeData | null
  sliceIndex: number
  threshold: number
  opacity: number
  onVolumeChange: (volume: VolumeData | null) => void
  onSliceIndexChange: (slice: number) => void
  onThresholdChange: (threshold: number) => void
  onOpacityChange: (opacity: number) => void
  onClose: () => void
}

export default function VolumeInspector({
  volume,
  sliceIndex,
  threshold,
  opacity,
  onVolumeChange,
  onSliceIndexChange,
  onThresholdChange,
  onOpacityChange,
  onClose,
}: VolumeInspectorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(volume ? "ready" : "idle")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!volume || !canvasRef.current) return
    const canvas = canvasRef.current
    const [width, height, depth] = volume.dimensions
    const activeSlice = Math.max(0, Math.min(depth - 1, sliceIndex))
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) return
    const image = context.createImageData(width, height)
    const sliceOffset = activeSlice * width * height
    for (let index = 0; index < width * height; index += 1) {
      const value = volume.values[sliceOffset + index]
      const intensity = Math.round(value * 255)
      const target = index * 4
      image.data[target] = value >= threshold ? 255 : intensity
      image.data[target + 1] = value >= threshold ? 174 : intensity
      image.data[target + 2] = value >= threshold ? 92 : intensity
      image.data[target + 3] = 255
    }
    context.putImageData(image, 0, 0)
  }, [sliceIndex, threshold, volume])

  async function load(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target.files?.length) return
    setStatus("loading")
    setError("")
    try {
      const next = await loadVolumeFiles(event.target.files)
      onVolumeChange(next)
      onSliceIndexChange(Math.floor(next.dimensions[2] / 2))
      setStatus("ready")
    } catch (loadError) {
      setStatus("error")
      setError(loadError instanceof Error ? loadError.message : "Volume could not be loaded")
    } finally {
      event.target.value = ""
    }
  }

  return (
    <aside className="volume-inspector" aria-label="Volume inspector">
      <header>
        <div><Scan size={15} /><span><strong>Volume workspace</strong><small>LOCAL MEMORY ONLY</small></span></div>
        <button type="button" aria-label="Close volume workspace" onClick={onClose}><X size={14} /></button>
      </header>

      {!volume ? (
        <label className={`volume-dropzone ${status === "error" ? "error" : ""}`}>
          <input type="file" multiple accept=".nii,.nii.gz,.dcm,application/dicom" onChange={load} />
          <FileUp size={21} />
          <strong>{status === "loading" ? "Reading volume" : "Load NIfTI or DICOM"}</strong>
          <span>One .nii/.nii.gz file or an uncompressed DICOM stack</span>
          {error ? <b>{error}</b> : null}
        </label>
      ) : (
        <>
          <div className="volume-preview"><canvas ref={canvasRef} /><span>AXIAL · {sliceIndex + 1}/{volume.dimensions[2]}</span></div>
          <dl className="volume-metadata">
            <div><dt>Format</dt><dd>{volume.format.toUpperCase()}</dd></div>
            <div><dt>Source matrix</dt><dd>{volume.sourceDimensions.join(" × ")}</dd></div>
            <div><dt>Render matrix</dt><dd>{volume.dimensions.join(" × ")}</dd></div>
            <div><dt>Spacing mm</dt><dd>{volume.spacing.map((item) => item.toFixed(2)).join(" · ")}</dd></div>
          </dl>
          <div className="volume-sliders">
            <label><span><Layers size={12} />Axial slice <b>{sliceIndex + 1}</b></span><input type="range" min="0" max={Math.max(0, volume.dimensions[2] - 1)} value={sliceIndex} onChange={(event) => onSliceIndexChange(Number(event.target.value))} /></label>
            <label><span>Voxel threshold <b>{threshold.toFixed(2)}</b></span><input type="range" min="0.05" max="0.95" step="0.01" value={threshold} onChange={(event) => onThresholdChange(Number(event.target.value))} /></label>
            <label><span>Overlay opacity <b>{Math.round(opacity * 100)}%</b></span><input type="range" min="0.1" max="1" step="0.05" value={opacity} onChange={(event) => onOpacityChange(Number(event.target.value))} /></label>
          </div>
          <button type="button" className="volume-remove" onClick={() => { onVolumeChange(null); setStatus("idle") }}><Trash2 size={13} />Unload local volume</button>
        </>
      )}
      <p className="volume-privacy">Raw voxels and filenames remain in this browser tab. Only anonymous dimensions, spacing, contrast, and voxel count can enter the fusion contract.</p>
    </aside>
  )
}
