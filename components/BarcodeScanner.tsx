'use client'

import { useRef, useState, useCallback } from 'react'
import { ScanBarcode, CameraOff, Loader2 } from 'lucide-react'

type Props = {
  onScan: (code: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<any>(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [scanning, setScanning] = useState(false)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  const startScan = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 }
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream

      if ('BarcodeDetector' in window) {
        detectorRef.current = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e', 'codabar', 'itf'] })
        setReady(true)
        setScanning(true)
        scanLoop()
      } else {
        setError('Scan automatique non supporté. Saisissez le code manuellement.')
        setReady(true)
      }
    } catch {
      setError('Accès caméra refusé. Saisissez le code manuellement.')
      setReady(true)
    }
  }, [])

  function scanLoop() {
    if (!detectorRef.current || !videoRef.current || !scanning) return
    detectorRef.current.detect(videoRef.current).then((codes: any[]) => {
      if (codes.length > 0) {
        const code = codes[0].rawValue
        stopCamera()
        setScanning(false)
        onScan(code)
        return
      }
      if (scanning) requestAnimationFrame(scanLoop)
    }).catch(() => {
      if (scanning) setTimeout(scanLoop, 300)
    })
  }

  const handleStop = useCallback(() => {
    setScanning(false)
    stopCamera()
    onClose()
  }, [stopCamera, onClose])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 bg-gray-900 shrink-0">
        <h2 className="font-black text-white text-lg flex items-center gap-2">
          <ScanBarcode className="h-6 w-6 text-orange-400" /> Scanner
        </h2>
        <button onClick={handleStop} className="text-white bg-gray-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-gray-600 touch-target">
          Fermer
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center bg-black">
        {!ready ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-orange-400" />
            <p className="text-white font-bold">Activation de la caméra...</p>
            <button onClick={startScan} className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-black text-base touch-target mt-4">
              Autoriser la caméra
            </button>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline className="max-h-full max-w-full" onCanPlay={startScan} />
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center p-6">
                  <CameraOff className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-white font-bold text-lg mb-4">{error}</p>
                  <button onClick={handleStop} className="bg-gray-700 text-white px-6 py-3 rounded-2xl font-bold text-base touch-target">
                    Retour
                  </button>
                </div>
              </div>
            )}
            {!error && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-40 border-2 border-orange-400 rounded-2xl opacity-60" />
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-center text-sm text-gray-400 py-3 bg-gray-900 shrink-0">
        Placez le code-barres dans le cadre orange
      </p>
    </div>
  )
}
