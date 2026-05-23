'use client'
/// <reference types="styled-jsx" />

import { useEffect, useState } from 'react'

// Cache global pour éviter les requêtes simultanées depuis plusieurs instances de pages
let enterpriseCachePromise: Promise<any> | null = null;

interface ListPrintWrapperProps {
  title: string
  subtitle?: string
  dateRange?: { start: string; end: string }
  pageNumber?: number
  totalPages?: number
  children: React.ReactNode
  enterprise?: any
  hideHeader?: boolean
  hideVisa?: boolean
  layout?: 'portrait' | 'landscape'
  kpis?: { label: string; value: string; color?: string }[]
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
  layout = 'portrait',
  kpis
}: ListPrintWrapperProps) {
  const [enterprise, setEnterprise] = useState<any>(providedEnterprise || null)

  useEffect(() => {
    if (providedEnterprise) {
      setEnterprise(providedEnterprise)
      return
    }

    // Utilisation du cache de promesse pour ne faire qu'UN SEUL fetch globalement
    if (!enterpriseCachePromise) {
      enterpriseCachePromise = fetch('/api/parametres')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    }

    enterpriseCachePromise.then(data => {
      if (data) setEnterprise(data);
    });
  }, [providedEnterprise])

  return (
    <div className="print:flex flex-col font-sans text-black bg-white p-4 relative list-print-container">
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
            <h1 className="text-[16px] font-black uppercase tracking-tighter">
              {enterprise?.nomEntreprise || 'GESTICOM PRO'}
            </h1>
            <p className="text-[14px] font-bold uppercase text-gray-700">
              {enterprise?.localisation || 'Localisation'}
            </p>
            <p className="text-[14px] font-medium text-gray-500">
              Contact : {enterprise?.contact || 'Non défini'} 
              {enterprise?.email ? ` | Email : ${enterprise.email}` : ''}
            </p>
            <div className="flex gap-4">
              {enterprise?.numNCC && (
                <p className="text-[14px] font-medium text-gray-500">
                  NCC : {enterprise.numNCC}
                </p>
              )}
              {enterprise?.registreCommerce && (
                <p className="text-[14px] font-medium text-gray-500">
                  RC : {enterprise.registreCommerce}
                </p>
              )}
            </div>
          </div>

          <div className="text-right">
            <h2 className="text-[16px] font-black text-gray-900 uppercase tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[14px] font-bold text-gray-700 uppercase mt-1">{subtitle}</p>
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
                   Du {new Date(dateRange.start).toLocaleDateString('fr-FR')} Au {new Date(dateRange.end).toLocaleDateString('fr-FR')}
                </p>
              )}
              {pageNumber && totalPages && (
                <p className="text-[14px] font-black text-orange-600 mt-2">
                  PAGE {pageNumber} / {totalPages}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONTENU DE LA LISTE (TABLEAU) */}
      <div className="print-content flex-1">
        {kpis && kpis.length > 0 && (
          <div className="bg-gray-50 border-2 border-black px-3 py-2 mb-3 flex justify-between text-[13px] font-black">
            {kpis.map((kpi, idx) => (
              <span key={idx}>{kpi.label}: <span className={kpi.color || ''}>{kpi.value}</span></span>
            ))}
          </div>
        )}
        {children}
      </div>

      {/* FOOTER & VISA - Désactivé temporairement */}

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
            height: auto !important; /* CRITIQUE : Évite les pages blanches / troncatures */
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          main { 
            margin: 0 !important; 
            padding: 0 !important; 
            width: 100% !important;
            display: block !important;
            overflow: visible !important;
          }
          .list-print-container {
            min-height: auto !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            flex-grow: 0 !important;
          }

          .print-content {
            flex: 1 1 auto !important;
            min-height: 0 !important;
          }
          .print-content table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-bottom: 0 !important;
            table-layout: auto !important;
          }
          .print-content th {
            background-color: #f3f4f6 !important;
            border: 2px solid #000 !important;
            padding: 10px 4px !important;
            font-size: 15px !important;
            font-weight: 900 !important;
            text-transform: uppercase;
          }
          .print-content td {
            border: 1px solid #000 !important;
            padding: 8px 4px !important;
            font-size: 14px !important;
            font-weight: 500 !important;
          }
          .print-content tr {
            page-break-inside: avoid !important;
          }
          .print-content thead {
            display: table-header-group;
          }
          .print-footer {
            page-break-inside: avoid !important;
            margin-top: 0.5rem;
            flex-shrink: 0 !important;
            align-self: flex-end !important;
          }
          .page-break {
            page-break-after: always;
          }
        }
      `}</style>
    </div>
  )
}
