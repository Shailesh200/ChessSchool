"use client";

import { useEffect } from 'react'
import { bindPulseClicks, loadPulse, bindPostEngagement, type LoadPulseOptions } from './index'

export function Pulse({ websiteId, origin, domains }: LoadPulseOptions) {
  useEffect(() => loadPulse({ websiteId, origin, domains }), [websiteId, origin, domains])
  useEffect(() => bindPulseClicks(), [])
  return null
}

export function usePostEngagement(slug: string) {
  useEffect(() => bindPostEngagement(slug), [slug])
}
