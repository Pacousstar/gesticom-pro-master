'use client'
/// <reference types="styled-jsx" />

import { useEffect, useState } from 'react'

interface ListPrintWrapperProps {
  title: string
  subtitle?: string
  dateRange?: { start: string; end: string }
  children: React.ReactNode
}

export default function ListPrintWrapper({
  title,
  subtitle,
  dateRange,
  children
}: ListPrintWrapperProps) {
  const [enterprise, setEnterprise] = useState<any>(null)

  useEffect(() => {
    fetch('/api/parametres')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEnterprise(d))
      .catch(() => {})
  }, [])

  return (
    <div className="hidden print:block font-sans text-black bg-white p-6 min-h-screen">
      {/* HEADER PROFESSIONNEL */}
      <div className="flex justify-between items-start mb-8 border-b-4 border-gray-900 pb-6">
        <div className="space-y-1">
          {enterprise?.logo && (
            <img 
              src={enterprise.logo} 
              alt="Logo" 
              className="h-16 w-auto mb-2 object-contain"
            />
          )}
          <h1 className="text-2xl font-black uppercase tracking-tighter italic">
            {enterprise?.nomEntreprise || 'GESTICOM PRO'}
          </h1>
          <p className="text-[10px] font-bold uppercase text-gray-600">
            {enterprise?.localisation || 'Localisation'}
          </p>
          <p className="text-[9px] font-medium text-gray-500">
            Contact : {enterprise?.contact || 'Non défini'} 
            {enterprise?.email ? ` | Email : ${enterprise.email}` : ''}
          </p>
          {enterprise?.numNCC && (
            <p className="text-[9px] font-medium text-gray-500 italic">
              NCC : {enterprise.numNCC}
            </p>
          )}
        </div>

        <div className="text-right">
          <h2 className="text-3xl font-black text-gray-900 uppercase italic tracking-tighter">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm font-bold text-gray-700 uppercase mt-1">{subtitle}</p>
          )}
          <div className="mt-3 space-y-1">
            <p className="text-[10px] font-black uppercase text-gray-400">
              Date d'édition : {new Date().toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
            {dateRange && (
              <p className="inline-block bg-gray-100 px-3 py-1 rounded text-[10px] font-black uppercase text-gray-800 border border-gray-200">
                Période : Du {new Date(dateRange.start).toLocaleDateString('fr-FR')} Au {new Date(dateRange.end).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* CONTENU DE LA LISTE (TABLEAU) */}
      <div className="print-content">
        {children}
      </div>

      {/* FOOTER & VISA */}
      <div className="mt-12 flex justify-between items-end pt-12 print-footer">
        <div className="text-[9px] italic text-gray-400 uppercase font-bold">
           Document généré par GestiCom Pro - Archivage Administratif
           <br />
           Propriété de {enterprise?.nomEntreprise || 'l\'entreprise'}
        </div>
        
        <div className="flex gap-12">
          <div className="text-center w-40">
             <p className="text-[10px] font-black uppercase border-b border-gray-300 pb-1 mb-20">Visa Comptabilité</p>
          </div>
          <div className="text-center w-48">
             <p className="text-[10px] font-black uppercase border-b border-black pb-1 mb-20">Visa Direction Générale</p>
             <div className="mt-16 text-[8px] font-bold text-gray-400 italic">
               (Signature et Cachet)
             </div>
          </div>
        </div>
      </div>

      {/* Styles spécifiques d'impression pour forcer la pagination et le rendu des couleurs */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-content table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto;
          }
          .print-content tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          .print-content thead {
            display: table-header-group;
          }
          .print-content tfoot {
            display: table-footer-group;
          }
          .print-footer {
            page-break-inside: avoid !important;
            border-top: 2px solid #000 !important;
          }
        }
      `}</style>
    </div>
  )
}
