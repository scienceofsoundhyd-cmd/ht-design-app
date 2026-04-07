"use client"

import { useLayoutEffect } from "react"
import { usePathname } from "next/navigation"

export default function BackgroundController() {
  const pathname = usePathname()

  useLayoutEffect(() => {
    const isReflections = pathname.startsWith("/reflections")
    if (isReflections) {
      document.body.classList.remove("not-reflections")
    } else {
      document.body.classList.add("not-reflections")
    }
  }, [pathname])

  return null
}
