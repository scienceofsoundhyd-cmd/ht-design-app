'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type UserPlan = 'free' | 'pro' | null

export function useUserPlan() {
  const [plan,    setPlan]    = useState<UserPlan>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      supabase.from('user_profiles')
        .select('plan, is_admin')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setPlan(data?.plan ?? 'free')
          setIsAdmin(data?.is_admin ?? false)
          setLoading(false)
        })
    })
  }, [])

  return {
    plan,
    loading,
    isAdmin,
    isPro:     plan === 'pro',
    isFree:    plan === 'free',
    canExportPDF:     plan === 'pro',
    // Free tier: 1 project max. Pro: unlimited.
    maxProjects: plan === 'pro' ? Infinity : 1,
  }
}