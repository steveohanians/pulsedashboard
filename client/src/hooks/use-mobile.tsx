/**
 * Custom hook for responsive mobile detection
 * Uses media query to detect if the viewport is mobile-sized
 */
import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Detects if the current viewport is mobile-sized (< 768px)
 * @returns boolean indicating if the viewport is mobile
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
