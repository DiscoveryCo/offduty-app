"use client"

import { useState } from "react"
import { toast } from "sonner"
import { X } from "lucide-react"

interface OtherInbox {
  id: string
  email: string
}

interface Props {
  inboxId: string
  domains: string[]
  emails: string[]
  keywords: string[]
  otherInboxes: OtherInbox[]
}

export function VipSettings({ inboxId, domains: initDomains, emails: initEmails, keywords: initKeywords, otherInboxes }: Props) {
  const [domains, setDomains] = useState<string[]>(initDomains)
  const [emails, setEmails] = useState<string[]>(initEmails)
  const [keywords, setKeywords] = useState<string[]>(initKeywords)
  const [domainInput, setDomainInput] = useState("")
  const [emailInput, setEmailInput] = useState("")
  const [keywordInput, setKeywordInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)

  async function copyFromInbox(sourceInboxId: string) {
    setCopying(true)
    try {
      const res = await fetch(`/api/inbox-settings?inboxId=${sourceInboxId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDomains(data.vip.domains)
      setEmails(data.vip.emails)
      setKeywords(data.vip.keywords)
      toast.success("VIP settings copied — save to apply")
    } catch {
      toast.error("Failed to copy settings")
    } finally {
      setCopying(false)
    }
  }

  function addToList(
    input: string,
    setInput: (v: string) => void,
    list: string[],
    setList: (v: string[]) => void
  ) {
    const trimmed = input.trim().toLowerCase()
    if (trimmed && !list.includes(trimmed)) setList([...list, trimmed])
    setInput("")
  }

  function removeFrom(val: string, list: string[], setList: (v: string[]) => void) {
    setList(list.filter((v) => v !== val))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch("/api/vip", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inboxId, domains, emails, keywords }),
      })
      if (res.status === 429) { toast.error("Too many requests — please wait a moment and try again."); return }
      if (!res.ok) throw new Error()
      toast.success("VIP settings saved")
    } catch {
      toast.error("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Domains */}
      <section>
        <h3 className="font-semibold text-[#161616] mb-1">VIP Domains</h3>
        <p className="text-sm text-[#4D4D4D] mb-3">
          Emails from any of these domains will be immediately delivered.
        </p>
        <div className="border border-[#E5E7EB] rounded-lg bg-gray-50 min-h-20 p-3">
          <div className="flex flex-wrap gap-2 mb-2">
            {domains.map((d) => (
              <span key={d} className="flex items-center gap-1 bg-white border border-[#E5E7EB] rounded px-2 py-1 text-sm text-[#161616]">
                {d}
                <button onClick={() => removeFrom(d, domains, setDomains)} className="text-[#4D4D4D] hover:text-[#4D4D4D] ml-1">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault()
                addToList(domainInput, setDomainInput, domains, setDomains)
              }
            }}
            placeholder="Add domains..."
            className="w-full bg-transparent text-sm text-[#161616] placeholder-[#4D4D4D] outline-none"
          />
        </div>
      </section>

      {/* Email Addresses */}
      <section>
        <h3 className="font-semibold text-[#161616] mb-1">VIP Email Addresses</h3>
        <p className="text-sm text-[#4D4D4D] mb-3">
          Emails from any of these addresses will be immediately delivered.
        </p>
        <div className="border border-[#E5E7EB] rounded-lg bg-gray-50 min-h-20 p-3">
          <div className="flex flex-wrap gap-2 mb-2">
            {emails.map((e) => (
              <span key={e} className="flex items-center gap-1 bg-white border border-[#E5E7EB] rounded px-2 py-1 text-sm text-[#161616]">
                {e}
                <button onClick={() => removeFrom(e, emails, setEmails)} className="text-[#4D4D4D] hover:text-[#4D4D4D] ml-1">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === ",") {
                ev.preventDefault()
                addToList(emailInput, setEmailInput, emails, setEmails)
              }
            }}
            placeholder="Add email addresses..."
            className="w-full bg-transparent text-sm text-[#161616] placeholder-[#4D4D4D] outline-none"
          />
        </div>
      </section>

      {/* Keywords */}
      <section>
        <h3 className="font-semibold text-[#161616] mb-1">VIP Keywords</h3>
        <p className="text-sm text-[#4D4D4D] mb-3">
          Emails containing any of these words will be immediately delivered.
        </p>
        <div className="border border-[#E5E7EB] rounded-lg bg-gray-50 min-h-20 p-3">
          <div className="flex flex-wrap gap-2 mb-2">
            {keywords.map((k) => (
              <span key={k} className="flex items-center gap-1 bg-white border border-[#E5E7EB] rounded px-2 py-1 text-sm text-[#161616]">
                {k}
                <button onClick={() => removeFrom(k, keywords, setKeywords)} className="text-[#4D4D4D] hover:text-[#4D4D4D] ml-1">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault()
                addToList(keywordInput, setKeywordInput, keywords, setKeywords)
              }
            }}
            placeholder="Add keywords..."
            className="w-full bg-transparent text-sm text-[#161616] placeholder-[#4D4D4D] outline-none"
          />
        </div>
        <p className="text-xs text-[#4D4D4D] mt-2">
          VIP Keywords can be used to NOT miss out on emails like password-resets and email-confirmations.
        </p>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || copying}
          className="bg-[#A78BFA] text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-[#8B5CF6] transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {otherInboxes.length > 0 && (
          <select
            disabled={copying}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) copyFromInbox(e.target.value)
              e.target.value = ""
            }}
            className="border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-[#4D4D4D] bg-white disabled:opacity-50 max-w-44"
          >
            <option value="">Copy from inbox…</option>
            {otherInboxes.map((inbox) => (
              <option key={inbox.id} value={inbox.id}>{inbox.email}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}
