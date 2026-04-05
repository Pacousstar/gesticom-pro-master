'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Camera, CameraOff, Loader2, ZapOff } from 'lucide-react'

interface BarcodeScannerProps {
    /** Appelé quand un code-barres est détecté avec succès */
    onScan: (code: string) => void
    /** Fermer la fenêtre */
    onClose: () => void
}

/**
 * Composant modal de scan de code-barres via la caméra du navigateur.
 * Utilise la librairie html5-qrcode (chargée dynamiquement pour le SSR Next.js).
 * Fonctionne entièrement en mode offline — aucune requête réseau requise pour le scan.
 */
export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
    const videoRef = useRef<HTMLDivElement>(null)
    const scannerRef = useRef<any>(null)
    const [status, setStatus] = useState<'loading' | 'scanning' | 'error'>('loading')
    const [errMsg, setErrMsg] = useState('')
    const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([])
    const [selectedCamera, setSelectedCamera] = useState<string>('')
    const hasStarted = useRef(false)

    // Démarrer le scanner sur la caméra sélectionnée
    const startScanner = async (cameraId: string) => {
        if (!scannerRef.current || !cameraId) return
        try {
            // Arrêter un éventuel scan en cours
            if (scannerRef.current._isScanning) {
                await scannerRef.current.stop()
            }
            setStatus('scanning')
            await scannerRef.current.start(
                { deviceId: { exact: cameraId } },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 160 },
                    aspectRatio: 1.7,
                    // Formater la zone de scan pour les codes-barres 1D (non carré)
                    formatsToSupport: undefined,
                },
                (decodedText: string) => {
                    // Code détecté — arrêter et transmettre le résultat
                    scannerRef.current?.stop().catch(() => { })
                    onScan(decodedText.trim())
                },
                () => {
                    // Callback d'erreur de frame (normal quand pas encore de code visible)
                }
            )
        } catch (e: any) {
            setStatus('error')
            setErrMsg(e?.message || 'Impossible de démarrer la caméra.')
        }
    }

    useEffect(() => {
        if (hasStarted.current) return
        hasStarted.current = true

        const init = async () => {
            // Chargement dynamique (évite l'erreur SSR de Next.js)
            const { Html5Qrcode, Html5QrcodeScanner } = await import('html5-qrcode')

            // Lister les caméras disponibles
            let camList: Array<{ id: string; label: string }> = []
            try {
                camList = await Html5Qrcode.getCameras()
            } catch {
                setStatus('error')
                setErrMsg("Accès à la caméra refusé. Autorisez l'accès dans les paramètres du navigateur.")
                return
            }

            if (!camList || camList.length === 0) {
                setStatus('error')
                setErrMsg('Aucune caméra détectée sur cet appareil.')
                return
            }

            setCameras(camList)

            // Préférer la caméra arrière (environment) afin de cibler le code-barres physique
            const arriere = camList.find(
                (c) => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('rear') || c.label.toLowerCase().includes('arrière') || c.label.toLowerCase().includes('environment')
            )
            const cameraId = arriere?.id || camList[camList.length - 1].id
            setSelectedCamera(cameraId)

            if (!videoRef.current) return
            const scanner = new Html5Qrcode('barcode-scanner-viewport')
            scannerRef.current = scanner

            await startScanner(cameraId)
        }

        init()

        return () => {
            // Nettoyage à la fermeture du composant
            scannerRef.current?.stop().catch(() => { })
        }
    }, [])

    // Changer de caméra à la volée
    const handleCameraChange = async (newId: string) => {
        setSelectedCamera(newId)
        if (scannerRef.current) {
            try {
                if (scannerRef.current._isScanning) {
                    await scannerRef.current.stop()
                }
            } catch { /* ignore */ }
            await startScanner(newId)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
                {/* En-tête */}
                <div className="flex items-center justify-between bg-orange-500 px-4 py-3">
                    <div className="flex items-center gap-2 text-white">
                        <Camera className="h-5 w-5" />
                        <span className="font-semibold text-sm">Scanner un code-barres</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1 text-white hover:bg-orange-600 transition-colors"
                        title="Fermer"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Zone de la caméra */}
                <div className="relative bg-black">
                    {status === 'loading' && (
                        <div className="flex h-48 items-center justify-center gap-2 text-white">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <span className="text-sm">Démarrage de la caméra…</span>
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="flex h-48 flex-col items-center justify-center gap-3 px-4 text-white">
                            <CameraOff className="h-10 w-10 text-red-400" />
                            <p className="text-center text-sm text-red-300">{errMsg}</p>
                            <p className="text-center text-xs text-gray-400">
                                Astuce : autorisez l'accès à la caméra dans votre navigateur et rechargez.
                            </p>
                        </div>
                    )}
                    {/* Viewport injecté par html5-qrcode */}
                    <div
                        id="barcode-scanner-viewport"
                        ref={videoRef}
                        className={status === 'scanning' ? 'block' : 'hidden'}
                    />
                </div>

                {/* Sélection de caméra (si plusieurs disponibles) */}
                {cameras.length > 1 && status === 'scanning' && (
                    <div className="px-4 pt-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Caméra utilisée</label>
                        <select
                            value={selectedCamera}
                            onChange={(e) => handleCameraChange(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                        >
                            {cameras.map((c) => (
                                <option key={c.id} value={c.id}>{c.label || `Caméra ${c.id.slice(0, 8)}`}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Instructions */}
                <div className="px-4 py-4 text-center">
                    {status === 'scanning' && (
                        <>
                            <p className="text-sm text-gray-600">
                                📦 Pointez la caméra vers le <strong>code-barres</strong> du produit
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                                Compatible codes EAN-13, QR Code, Code 128, etc.
                            </p>
                        </>
                    )}
                    <button
                        onClick={onClose}
                        className="mt-3 w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                        Saisie manuelle à la place
                    </button>
                </div>
            </div>
        </div>
    )
}
