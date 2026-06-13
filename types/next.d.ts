// Type declarations for next subpath modules (shim for broken next@16 installation)

declare module 'next/server' {
  export class NextRequest extends Request {
    readonly nextUrl: URL
    readonly cookies: { get(name: string): { name: string; value: string } | undefined }
    json(): Promise<any>
    formData(): Promise<FormData>
  }
  export class NextResponse extends Response {
    static json(body: any, init?: ResponseInit): NextResponse
    static redirect(url: string, status?: number): NextResponse
    static next(): NextResponse
    readonly cookies: { set(name: string, value: string): void; delete(name: string): void }
  }
}

declare module 'next/server.js' {
  export * from 'next/server'
}

declare module 'next/types.js' {
  import type { Metadata } from 'next'
  export type ResolvingMetadata = () => Promise<Metadata>
  export type ResolvingViewport = () => Promise<Record<string, any>>
}

declare module 'next/headers' {
  export function cookies(): {
    get(name: string): { name: string; value: string } | undefined
    set(name: string, value: string, options?: any): void
    delete(name: string): void
    getAll(): { name: string; value: string }[]
  }
  export function headers(): Headers
  export function draftMode(): { isEnabled: boolean }
}

declare module 'next/navigation' {
  export function useRouter(): {
    push(url: string): void
    replace(url: string): void
    back(): void
    prefetch(url: string): void
    refresh(): void
  }
  export function usePathname(): string
  export function useSearchParams(): URLSearchParams
  export function useParams(): Record<string, string | string[]>
  export function redirect(url: string): never
  export function notFound(): never
  export function useSelectedLayoutSegment(): string | null
  export function useSelectedLayoutSegments(): string[]
}

declare module 'next/link' {
  import React from 'react'
  interface LinkProps {
    href: string
    children?: React.ReactNode
    className?: string
    [key: string]: any
  }
  const Link: React.FC<LinkProps>
  export default Link
}

declare module 'next/image' {
  import React from 'react'
  interface ImageProps {
    src: string
    alt: string
    width?: number
    height?: number
    fill?: boolean
    className?: string
    priority?: boolean
    [key: string]: any
  }
  const Image: React.FC<ImageProps>
  export default Image
  export function getImageProps(props: ImageProps): any
}

declare module 'next/dynamic' {
  import React from 'react'
  interface DynamicOptions {
    loading?: React.ComponentType
    ssr?: boolean
    [key: string]: any
  }
  function dynamic<T>(
    loader: () => Promise<{ default: React.ComponentType<T> }>,
    options?: DynamicOptions
  ): React.ComponentType<T>
  export default dynamic
}

declare module 'next/cache' {
  export function revalidatePath(path: string): void
  export function unstable_cache<T extends (...args: any[]) => any>(
    fn: T,
    keys?: string[],
    options?: { revalidate?: number; tags?: string[] }
  ): T
  export function unstable_noStore(): void
}

declare module 'next' {
  import React from 'react'
  export type Metadata = Record<string, any>
  export type Viewport = Record<string, any>
  export type NextPage<P = {}, IP = P> = React.ComponentType<P> & {
    getInitialProps?(context: any): IP
  }
}
