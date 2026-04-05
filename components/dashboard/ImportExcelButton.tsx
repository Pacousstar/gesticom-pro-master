'use client'

import React, { useRef, useState } from 'react'
import { FileUp, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface ImportExcelButtonProps {
    endpoint: string
    onSuccess?: () => void
    label?: string
}

export default function ImportExcelButton({ endpoint, onSuccess, label = 'Importer Excel' }: ImportExcelButtonProps) {
    const [isUploading, setIsUploading] = useState(false)
    const [result, setResult] = useState<{ success?: string; error?: string } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        setResult(null)

        const formData = new FormData()
        formData.append('file', file)

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData,
            })

            const data = await response.json()

            if (response.ok) {
                setResult({ success: `${data.created || 0} créés, ${data.updated || 0} mis à jour. Total: ${data.total || 0}` })
                if (onSuccess) onSuccess()
            } else {
                setResult({ error: data.error || "Erreur lors de l'importation." })
            }
        } catch (error) {
            setResult({ error: "Erreur réseau ou serveur." })
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    return (
        <div className="relative inline-block">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx, .xls, .csv"
                className="hidden"
            />
            
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={`
                    flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all
                    ${isUploading 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                        : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 active:scale-95'
                    }
                `}
            >
                {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <FileUp className="h-4 w-4" />
                )}
                {label}
            </button>

            {result && (
                <div className={`
                    absolute top-full mt-2 left-0 z-50 min-w-[250px] p-4 rounded-[1.5rem] border shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300
                    ${result.success ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}
                `}>
                    <div className="flex items-start gap-3">
                        {result.success ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                        )}
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest mb-1 italic">
                                {result.success ? 'Importation Réussie' : 'Échec de l\'Import'}
                            </p>
                            <p className="text-sm font-medium leading-tight">
                                {result.success || result.error}
                            </p>
                            <button 
                                onClick={() => setResult(null)}
                                className="mt-3 text-[9px] font-black uppercase tracking-widest underline opacity-50 hover:opacity-100"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
