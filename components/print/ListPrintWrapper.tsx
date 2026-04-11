'use client'
/// <reference types="styled-jsx" />

import { useEffect, useState } from 'react'

interface ListPrintWrapperProps {
  title: string
  subtitle?: string
  dateRange?: { start: string; end: string }
  pageNumber?: number
  totalPages?: number
  children: React.ReactNode
  enterprise?: any // Optional data to avoid redundant API calls
  hideHeader?: boolean
  hideVisa?: boolean
  layout?: 'portrait' | 'landscape'
}

export default function ListPrintWrapper({
  title,
  subtitle,
  dateRange,
  pageNumber,
  totalPages,
  children,
  enterprise: providedEnterprise,
  hideHeader = false,
  hideVisa = false,
  layout = 'portrait'
}: ListPrintWrapperProps) {
  const [enterprise, setEnterprise] = useState<any>(providedEnterprise || null)

  useEffect(() => {
    if (providedEnterprise) {
      setEnterprise(providedEnterprise)
      return
    }
    // Only fetch if not provided and not already fetched
    if (!enterprise) {
      fetch('/api/parametres')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setEnterprise(d))
        .catch(() => {})
    }
  }, [providedEnterprise, enterprise])

  return (
    <div className="print:flex flex-col font-sans text-black bg-white p-4 min-h-screen relative">
      {/* HEADER PROFESSIONNEL */}
      {!hideHeader && (
        <div className="flex justify-between items-start mb-8 border-b-4 border-gray-900 pb-6">
          <div className="space-y-1">
            {enterprise?.logo && (
              <img 
                src={enterprise.logo} 
                alt="Logo" 
                className="h-16 w-auto mb-2 object-contain"
              />
            )}
            <h1 className="text-[18px] font-black uppercase tracking-tighter italic">
              {enterprise?.nomEntreprise || 'GESTICOM PRO'}
            </h1>
            <p className="text-[15px] font-bold uppercase text-gray-700">
              {enterprise?.localisation || 'Localisation'}
            </p>
            <p className="text-[15px] font-medium text-gray-500">
              Contact : {enterprise?.contact || 'Non défini'} 
              {enterprise?.email ? ` | Email : ${enterprise.email}` : ''}
            </p>
            <div className="flex gap-4">
              {enterprise?.numNCC && (
                <p className="text-[15px] font-medium text-gray-500 italic">
                  NCC : {enterprise.numNCC}
                </p>
              )}
              {enterprise?.registreCommerce && (
                <p className="text-[15px] font-medium text-gray-500 italic">
                  RC : {enterprise.registreCommerce}
                </p>
              )}
            </div>
          </div>

          <div className="text-right">
            <h2 className="text-3xl font-black text-gray-900 uppercase italic tracking-tighter">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm font-bold text-gray-700 uppercase mt-1">{subtitle}</p>
            )}
            <div className="mt-3 space-y-1">
              <p className="text-[11px] font-black uppercase text-gray-400">
                Date d'édition : {new Date().toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
              {dateRange && (
                <p className="inline-block bg-gray-100 px-3 py-1 rounded text-[11px] font-black uppercase text-gray-800 border border-gray-200">
                  Période : Du {new Date(dateRange.start).toLocaleDateString('fr-FR')} Au {new Date(dateRange.end).toLocaleDateString('fr-FR')}
                </p>
              )}
              {pageNumber && totalPages && (
                <p className="text-[15px] font-black text-orange-600 mt-2">
                  PAGE {pageNumber} / {totalPages}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONTENU DE LA LISTE (TABLEAU) */}
      <div className="print-content flex-grow">
        {children}
      </div>

      {/* FOOTER & VISA - Apparaît sur chaque page, mais les visas sont souvent sur la dernière */}
      {!hideVisa && (
        <div className="mt-12 flex justify-between items-end pt-8 border-t-2 border-black print-footer">
          <div className="text-[15px] italic text-gray-500 uppercase font-black max-w-[50%] leading-tight">
            Document officiel généré par le système GestiCom Pro. 
            Tous droits réservés. {enterprise?.nomEntreprise || 'GESTICOM'}.
            <br />
            <span className="text-[13px] font-bold">{enterprise?.mentionSpeciale || 'Veuillez exiger votre reçu pour toute transaction.'}</span>
          </div>
          
          <div className="flex gap-12">
            <div className="text-center w-56">
              <p className="text-[15px] font-black uppercase border-b-2 border-gray-900 pb-1 mb-20 whitespace-nowrap">Le Responsable Stock / Visa</p>
            </div>
            <div className="text-center w-64">
              <p className="text-[15px] font-black uppercase border-b-2 border-black pb-1 mb-20 whitespace-nowrap">La Direction Générale / Cachet</p>
              <div className="mt-16 text-[13px] font-bold text-gray-400 italic">
                (Signature et Cachet)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styles spécifiques d'impression pour forcer la pagination et le rendu des couleurs */}
      <style jsx global>{`
        @media print {
          @page {
            size: ${layout};
            margin: 10mm;
          }
          /* Masquage total de l'interface dashboard */
          nav, aside, header, .no-print, button, form, .flex-wrap, .Pagination, [role="navigation"], .sidebar, .topbar { 
            display: none !important; 
          }
          html, body {
            background: white !important;
            color: black !important;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          main { 
            margin: 0 !important; 
            padding: 0 !important; 
            width: 100% !important;
            display: block !important;
          }
          /* Forcer le conteneur d'impression à prendre toute la largeur */
          div[class*="min-h-screen"] {
            padding: 0 !important;
            margin: 0 !important;
          }

          .print-content table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-bottom: 20px;
            table-layout: auto !important;
          }
          .print-content th {
            background-color: #f3f4f6 !important;
            border: 2px solid #000 !important;
            padding: 10px 4px !important;
            font-size: 15px !important; /* Standard demandé */
            font-weight: 900 !important;
            text-transform: uppercase;
          }
          .print-content td {
            border: 1px solid #000 !important;
            padding: 8px 4px !important;
            font-size: 14px !important; /* Standard demandé */
            font-weight: 500 !important;
          }
          .print-content tfoot td {
            font-size: 15px !important; /* Standard demandé */
            font-weight: 900 !important;
            background-color: #f9fafb !important;
            border-top: 2px solid #000 !important;
          }
          .print-content tr {
            page-break-inside: avoid;
          }
          .print-content thead {
            display: table-header-group;
          }
          .print-content tfoot {
            display: table-footer-group;
          }
          .print-footer {
            page-break-inside: avoid !important;
            margin-top: auto;
          }
          .page-break {
            page-break-after: always;
          }
          /* Éviter les dégradés et images inutiles */
          * {
            box-shadow: none !important;
            text-shadow: none !important;
          }
        }
      `}</style>
    </div>
  )
}
