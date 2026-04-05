/**
 * Sécurité GestiCom Pro - TOTAL BYPASS
 */
import { NextResponse } from 'next/server';

export async function getHardwareId(): Promise<string> {
    return "GESTICOM-PRO-MASTER";
}

export function verifyLicenseKey(hwid: string, key: string): boolean {
    return true;
}

export function ensureActivated() {
    // Always allowed
    return true;
}
