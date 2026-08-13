export type VolumeFormat = "nifti" | "dicom"

export interface VolumeData {
  id: string
  format: VolumeFormat
  dimensions: [number, number, number]
  sourceDimensions: [number, number, number]
  spacing: [number, number, number]
  values: Float32Array
  normalizedContrast: number
  sourceFileCount: number
}

export interface VolumeSummary {
  format: VolumeFormat
  dimensions: [number, number, number]
  spacing: [number, number, number]
  normalized_contrast: number
  voxel_count: number
}

const NIFTI_HEADER_BYTES = 348
const LONG_VR = new Set(["OB", "OD", "OF", "OL", "OV", "OW", "SQ", "UC", "UR", "UT", "UN"])

function normalizeVolume(raw: Float32Array) {
  let minimum = Number.POSITIVE_INFINITY
  let maximum = Number.NEGATIVE_INFINITY
  for (const value of raw) {
    if (Number.isFinite(value)) {
      minimum = Math.min(minimum, value)
      maximum = Math.max(maximum, value)
    }
  }
  const range = Math.max(maximum - minimum, 1e-8)
  let sum = 0
  let sumSquares = 0
  for (let index = 0; index < raw.length; index += 1) {
    const normalized = Math.max(0, Math.min(1, (raw[index] - minimum) / range))
    raw[index] = normalized
    sum += normalized
    sumSquares += normalized * normalized
  }
  const mean = sum / Math.max(1, raw.length)
  const variance = Math.max(0, sumSquares / Math.max(1, raw.length) - mean * mean)
  return Math.min(1, Math.sqrt(variance) * 4)
}

function downsampleSteps(dimensions: [number, number, number], maximum = 72) {
  return dimensions.map((dimension) => Math.max(1, Math.ceil(dimension / maximum))) as [number, number, number]
}

function valueReader(view: DataView, datatype: number, littleEndian: boolean) {
  if (datatype === 2) return { bytes: 1, read: (offset: number) => view.getUint8(offset) }
  if (datatype === 4) return { bytes: 2, read: (offset: number) => view.getInt16(offset, littleEndian) }
  if (datatype === 8) return { bytes: 4, read: (offset: number) => view.getInt32(offset, littleEndian) }
  if (datatype === 16) return { bytes: 4, read: (offset: number) => view.getFloat32(offset, littleEndian) }
  if (datatype === 64) return { bytes: 8, read: (offset: number) => view.getFloat64(offset, littleEndian) }
  if (datatype === 256) return { bytes: 1, read: (offset: number) => view.getInt8(offset) }
  if (datatype === 512) return { bytes: 2, read: (offset: number) => view.getUint16(offset, littleEndian) }
  if (datatype === 768) return { bytes: 4, read: (offset: number) => view.getUint32(offset, littleEndian) }
  throw new Error(`NIfTI datatype ${datatype} is not supported`)
}

export function parseNiftiBuffer(buffer: ArrayBuffer): VolumeData {
  if (buffer.byteLength < NIFTI_HEADER_BYTES) throw new Error("NIfTI file is smaller than its header")
  const view = new DataView(buffer)
  const littleEndian = view.getInt32(0, true) === NIFTI_HEADER_BYTES
  if (!littleEndian && view.getInt32(0, false) !== NIFTI_HEADER_BYTES) throw new Error("Only NIfTI-1 volumes are supported")
  const dimensions: [number, number, number] = [
    view.getInt16(42, littleEndian),
    view.getInt16(44, littleEndian),
    Math.max(1, view.getInt16(46, littleEndian)),
  ]
  if (dimensions.some((dimension) => dimension < 1 || dimension > 4096)) throw new Error("NIfTI dimensions are invalid")
  const spacing: [number, number, number] = [
    Math.abs(view.getFloat32(80, littleEndian)) || 1,
    Math.abs(view.getFloat32(84, littleEndian)) || 1,
    Math.abs(view.getFloat32(88, littleEndian)) || 1,
  ]
  const datatype = view.getInt16(70, littleEndian)
  const voxelOffset = Math.max(NIFTI_HEADER_BYTES, Math.floor(view.getFloat32(108, littleEndian)))
  const slope = view.getFloat32(112, littleEndian) || 1
  const intercept = view.getFloat32(116, littleEndian) || 0
  const reader = valueReader(view, datatype, littleEndian)
  const voxelCount = dimensions[0] * dimensions[1] * dimensions[2]
  if (voxelOffset + voxelCount * reader.bytes > buffer.byteLength) throw new Error("NIfTI voxel payload is truncated")
  const [stepX, stepY, stepZ] = downsampleSteps(dimensions)
  const sampledDimensions: [number, number, number] = [
    Math.ceil(dimensions[0] / stepX),
    Math.ceil(dimensions[1] / stepY),
    Math.ceil(dimensions[2] / stepZ),
  ]
  const values = new Float32Array(sampledDimensions[0] * sampledDimensions[1] * sampledDimensions[2])
  let writeIndex = 0
  for (let z = 0; z < dimensions[2]; z += stepZ) {
    for (let y = 0; y < dimensions[1]; y += stepY) {
      for (let x = 0; x < dimensions[0]; x += stepX) {
        const sourceIndex = x + y * dimensions[0] + z * dimensions[0] * dimensions[1]
        values[writeIndex] = reader.read(voxelOffset + sourceIndex * reader.bytes) * slope + intercept
        writeIndex += 1
      }
    }
  }
  return {
    id: crypto.randomUUID(),
    format: "nifti",
    dimensions: sampledDimensions,
    sourceDimensions: dimensions,
    spacing,
    values,
    normalizedContrast: normalizeVolume(values),
    sourceFileCount: 1,
  }
}

interface DicomElement {
  group: number
  element: number
  vr: string
  length: number
  valueOffset: number
  nextOffset: number
}

function readDicomElement(view: DataView, offset: number, explicit: boolean): DicomElement | null {
  if (offset + 8 > view.byteLength) return null
  const group = view.getUint16(offset, true)
  const element = view.getUint16(offset + 2, true)
  if (explicit) {
    const vr = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5))
    const long = LONG_VR.has(vr)
    const length = long ? view.getUint32(offset + 8, true) : view.getUint16(offset + 6, true)
    const valueOffset = offset + (long ? 12 : 8)
    return { group, element, vr, length, valueOffset, nextOffset: valueOffset + length }
  }
  const length = view.getUint32(offset + 4, true)
  return { group, element, vr: "", length, valueOffset: offset + 8, nextOffset: offset + 8 + length }
}

function dicomText(bytes: Uint8Array) {
  return new TextDecoder("ascii").decode(bytes).replace(/\0/g, "").trim()
}

function tagKey(group: number, element: number) {
  return `${group.toString(16).padStart(4, "0")},${element.toString(16).padStart(4, "0")}`
}

interface DicomSlice {
  rows: number
  columns: number
  spacing: [number, number]
  thickness: number
  instance: number
  pixels: Int16Array | Uint16Array | Uint8Array
  slope: number
  intercept: number
}

export function parseDicomBuffer(buffer: ArrayBuffer): DicomSlice {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  let offset = buffer.byteLength > 132 && dicomText(bytes.subarray(128, 132)) === "DICM" ? 132 : 0
  let transferSyntax = "1.2.840.10008.1.2.1"
  while (offset + 8 <= buffer.byteLength) {
    const element = readDicomElement(view, offset, true)
    if (!element || element.group !== 0x0002) break
    if (tagKey(element.group, element.element) === "0002,0010") transferSyntax = dicomText(bytes.subarray(element.valueOffset, element.nextOffset))
    offset = element.nextOffset
  }
  if (!["1.2.840.10008.1.2", "1.2.840.10008.1.2.1"].includes(transferSyntax)) {
    throw new Error("Only uncompressed little-endian DICOM transfer syntaxes are supported")
  }
  const explicit = transferSyntax !== "1.2.840.10008.1.2"
  let rows = 0
  let columns = 0
  let bitsAllocated = 16
  let signed = false
  let instance = 0
  let thickness = 1
  let spacing: [number, number] = [1, 1]
  let slope = 1
  let intercept = 0
  let pixelOffset = -1
  let pixelLength = 0
  while (offset + 8 <= buffer.byteLength) {
    const element = readDicomElement(view, offset, explicit)
    if (!element) break
    if (element.length === 0xffffffff || element.nextOffset > buffer.byteLength) {
      offset += 8
      continue
    }
    const key = tagKey(element.group, element.element)
    const text = () => dicomText(bytes.subarray(element.valueOffset, element.nextOffset))
    if (key === "0028,0010") rows = view.getUint16(element.valueOffset, true)
    else if (key === "0028,0011") columns = view.getUint16(element.valueOffset, true)
    else if (key === "0028,0030") {
      const parts = text().split("\\").map(Number)
      spacing = [parts[1] || parts[0] || 1, parts[0] || 1]
    } else if (key === "0018,0050") thickness = Number(text()) || 1
    else if (key === "0020,0013") instance = Number(text()) || 0
    else if (key === "0028,0100") bitsAllocated = view.getUint16(element.valueOffset, true)
    else if (key === "0028,0103") signed = view.getUint16(element.valueOffset, true) === 1
    else if (key === "0028,1052") intercept = Number(text()) || 0
    else if (key === "0028,1053") slope = Number(text()) || 1
    else if (key === "7fe0,0010") {
      pixelOffset = element.valueOffset
      pixelLength = element.length
      break
    }
    offset = element.nextOffset
  }
  if (!rows || !columns || pixelOffset < 0) throw new Error("DICOM image dimensions or pixel data are missing")
  const expectedPixels = rows * columns
  let pixels: DicomSlice["pixels"]
  if (bitsAllocated === 8) pixels = new Uint8Array(buffer, pixelOffset, Math.min(expectedPixels, pixelLength))
  else if (bitsAllocated === 16 && signed) pixels = new Int16Array(buffer, pixelOffset, Math.min(expectedPixels, Math.floor(pixelLength / 2)))
  else if (bitsAllocated === 16) pixels = new Uint16Array(buffer, pixelOffset, Math.min(expectedPixels, Math.floor(pixelLength / 2)))
  else throw new Error(`DICOM bit depth ${bitsAllocated} is not supported`)
  if (pixels.length < expectedPixels) throw new Error("DICOM pixel payload is truncated")
  return { rows, columns, spacing, thickness, instance, pixels, slope, intercept }
}

async function arrayBufferFor(file: File) {
  if (!file.name.toLowerCase().endsWith(".gz")) return file.arrayBuffer()
  if (!("DecompressionStream" in window)) throw new Error("This browser cannot decompress .nii.gz files")
  const decompressed = file.stream().pipeThrough(new DecompressionStream("gzip"))
  return new Response(decompressed).arrayBuffer()
}

async function loadDicomStack(files: File[]): Promise<VolumeData> {
  const slices = await Promise.all(files.map(async (file) => parseDicomBuffer(await file.arrayBuffer())))
  slices.sort((first, second) => first.instance - second.instance)
  const first = slices[0]
  if (slices.some((slice) => slice.rows !== first.rows || slice.columns !== first.columns)) throw new Error("DICOM stack dimensions do not match")
  const sourceDimensions: [number, number, number] = [first.columns, first.rows, slices.length]
  const [stepX, stepY, stepZ] = downsampleSteps(sourceDimensions)
  const dimensions: [number, number, number] = [
    Math.ceil(sourceDimensions[0] / stepX),
    Math.ceil(sourceDimensions[1] / stepY),
    Math.ceil(sourceDimensions[2] / stepZ),
  ]
  const values = new Float32Array(dimensions[0] * dimensions[1] * dimensions[2])
  let writeIndex = 0
  for (let z = 0; z < slices.length; z += stepZ) {
    const slice = slices[z]
    for (let y = 0; y < slice.rows; y += stepY) {
      for (let x = 0; x < slice.columns; x += stepX) {
        values[writeIndex] = Number(slice.pixels[x + y * slice.columns]) * slice.slope + slice.intercept
        writeIndex += 1
      }
    }
  }
  return {
    id: crypto.randomUUID(),
    format: "dicom",
    dimensions,
    sourceDimensions,
    spacing: [first.spacing[0], first.spacing[1], first.thickness],
    values,
    normalizedContrast: normalizeVolume(values),
    sourceFileCount: files.length,
  }
}

export async function loadVolumeFiles(fileList: FileList | File[]): Promise<VolumeData> {
  const files = Array.from(fileList)
  if (!files.length) throw new Error("Select a NIfTI volume or DICOM image stack")
  const lowerNames = files.map((file) => file.name.toLowerCase())
  if (files.length === 1 && (lowerNames[0].endsWith(".nii") || lowerNames[0].endsWith(".nii.gz"))) {
    return parseNiftiBuffer(await arrayBufferFor(files[0]))
  }
  if (lowerNames.every((name) => name.endsWith(".dcm") || !name.includes("."))) return loadDicomStack(files)
  throw new Error("Use one .nii/.nii.gz file or an uncompressed .dcm stack")
}

export function volumeSummary(volume: VolumeData): VolumeSummary {
  return {
    format: volume.format,
    dimensions: volume.sourceDimensions,
    spacing: volume.spacing,
    normalized_contrast: volume.normalizedContrast,
    voxel_count: volume.sourceDimensions[0] * volume.sourceDimensions[1] * volume.sourceDimensions[2],
  }
}
