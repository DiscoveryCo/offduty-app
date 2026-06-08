"use client"

import { useState, useEffect } from "react"
import { X, Plus } from "lucide-react"
import { toast } from "sonner"

type ScheduleType = "interval" | "times" | "custom_daily" | "custom_weekly"

interface DaySchedule {
  dayOfWeek: number
  times: string[]
}

const TIMEZONES = [
  { label: "UTC", value: "UTC" },
  { label: "───── Europe ─────", value: "", disabled: true },
  { label: "London (GMT/BST)", value: "Europe/London" },
  { label: "Dublin (GMT/IST)", value: "Europe/Dublin" },
  { label: "Paris / Berlin / Rome (CET/CEST)", value: "Europe/Paris" },
  { label: "Helsinki / Kyiv (EET/EEST)", value: "Europe/Helsinki" },
  { label: "Moscow (MSK)", value: "Europe/Moscow" },
  { label: "───── Americas ─────", value: "", disabled: true },
  { label: "New York (ET)", value: "America/New_York" },
  { label: "Chicago (CT)", value: "America/Chicago" },
  { label: "Denver (MT)", value: "America/Denver" },
  { label: "Los Angeles (PT)", value: "America/Los_Angeles" },
  { label: "Toronto (ET)", value: "America/Toronto" },
  { label: "Vancouver (PT)", value: "America/Vancouver" },
  { label: "São Paulo (BRT)", value: "America/Sao_Paulo" },
  { label: "Mexico City (CST/CDT)", value: "America/Mexico_City" },
  { label: "───── Asia & Pacific ─────", value: "", disabled: true },
  { label: "Dubai (GST)", value: "Asia/Dubai" },
  { label: "Kolkata (IST)", value: "Asia/Kolkata" },
  { label: "Singapore / KL (SGT)", value: "Asia/Singapore" },
  { label: "Shanghai / Beijing (CST)", value: "Asia/Shanghai" },
  { label: "Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "Sydney (AEST/AEDT)", value: "Australia/Sydney" },
  { label: "Auckland (NZST/NZDT)", value: "Pacific/Auckland" },
  { label: "───── Africa ─────", value: "", disabled: true },
  { label: "Johannesburg (SAST)", value: "Africa/Johannesburg" },
  { label: "Nairobi (EAT)", value: "Africa/Nairobi" },
]

const DAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function fmt12(time: string) {
  const [h, m] = time.split(":").map(Number)
  const ampm = h < 12 ? "am" : "pm"
  return `${((h % 12) || 12).toString().padStart(2, "0")}:${String(m).padStart(2, "0")}${ampm}`
}

function TimeTag({ time, onRemove }: { time: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 border border-[#E5E7EB] rounded px-2 py-1 text-sm text-[#161616] bg-white">
      {fmt12(time)}
      <button onClick={onRemove} className="text-[#4D4D4D] hover:text-[#161616] ml-0.5">
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}

function AddTimeButton({ onAdd }: { onAdd: (time: string) => void }) {
  const [show, setShow] = useState(false)
  const [value, setValue] = useState("09:00")
  if (show) {
    return (
      <span className="flex items-center gap-1">
        <input
          type="time"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="border border-[#E5E7EB] rounded px-2 py-1 text-sm"
          autoFocus
        />
        <button
          onClick={() => { onAdd(value); setShow(false) }}
          className="text-xs bg-[#A78BFA] text-white px-2 py-1 rounded hover:bg-[#8B5CF6]"
        >
          Add
        </button>
        <button onClick={() => setShow(false)} className="text-[#4D4D4D] hover:text-[#4D4D4D]">
          <X className="w-4 h-4" />
        </button>
      </span>
    )
  }
  return (
    <button
      onClick={() => setShow(true)}
      className="w-7 h-7 rounded-full bg-[#A78BFA] text-white flex items-center justify-center hover:bg-[#8B5CF6] transition-colors"
    >
      <Plus className="w-4 h-4" />
    </button>
  )
}

export function OnboardingModal({ inboxId }: { inboxId: string }) {
  const [visible, setVisible] = useState(true)
  const [saving, setSaving] = useState(false)

  const [timezone, setTimezone] = useState("UTC")
  const [scheduleType, setScheduleType] = useState<ScheduleType>("custom_daily")
  const [intervalHours, setIntervalHours] = useState(4)
  const [timesPerDay, setTimesPerDay] = useState(2)
  const [customDailyTimes, setCustomDailyTimes] = useState<string[]>([])
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>(
    [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, times: [] }))
  )

  // Auto-detect timezone on mount
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (detected) setTimezone(detected)
    } catch {}
  }, [])

  function addDailyTime(t: string) {
    if (!customDailyTimes.includes(t)) setCustomDailyTimes([...customDailyTimes, t].sort())
  }
  function removeDailyTime(t: string) {
    setCustomDailyTimes(customDailyTimes.filter((x) => x !== t))
  }
  function addWeeklyTime(day: number, t: string) {
    setWeeklySchedule(weeklySchedule.map((d) =>
      d.dayOfWeek === day && !d.times.includes(t) ? { ...d, times: [...d.times, t].sort() } : d
    ))
  }
  function removeWeeklyTime(day: number, t: string) {
    setWeeklySchedule(weeklySchedule.map((d) =>
      d.dayOfWeek === day ? { ...d, times: d.times.filter((x) => x !== t) } : d
    ))
  }

  function buildSlots() {
    if (scheduleType === "custom_daily") return customDailyTimes.map((t) => ({ dayOfWeek: -1, time: t }))
    if (scheduleType === "custom_weekly") return weeklySchedule.flatMap((d) => d.times.map((t) => ({ dayOfWeek: d.dayOfWeek, time: t })))
    return []
  }

  async function markDone() {
    await fetch("/api/complete-onboarding", { method: "POST" })
  }

  async function handleSkip() {
    await markDone()
    setVisible(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const [s1, s2] = await Promise.all([
        fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inboxId,
            scheduleType,
            intervalHours: scheduleType === "interval" ? intervalHours : null,
            timesPerDay: scheduleType === "times" ? timesPerDay : null,
            dndEnabled: false,
            timezone,
          }),
        }),
        fetch("/api/schedule", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inboxId, slots: buildSlots() }),
        }),
      ])
      if (!s1.ok || !s2.ok) throw new Error()
      await markDone()
      toast.success("Schedule saved — offduty is ready to go.")
      setVisible(false)
    } catch {
      toast.error("Failed to save. You can set your schedule in Settings.")
      setSaving(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleSkip}
        aria-hidden
      />

      {/* Card — overflow-hidden keeps rounded corners intact in Chrome;
               scrolling is handled by the body section only */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header — flex-shrink-0 so it never scrolls away */}
        <div className="flex-shrink-0 bg-white border-b border-[#E5E7EB] px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#161616]">When should email arrive?</h2>
            <p className="text-sm text-[#4D4D4D] mt-1">
              offduty is now holding your inbox. Set when you'd like email to land.
              You can change this any time in Settings.
            </p>
          </div>
          <button
            onClick={handleSkip}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-[#4D4D4D] hover:bg-gray-100 transition-colors mt-0.5"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — only this section scrolls */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Timezone */}
          <div>
            <label className="block text-xs font-semibold text-[#4D4D4D] uppercase tracking-wider mb-1.5">
              Your timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-[#161616]"
            >
              {!TIMEZONES.some((tz) => tz.value === timezone) && timezone && (
                <option value={timezone}>{timezone}</option>
              )}
              {TIMEZONES.map((tz, i) =>
                tz.disabled ? (
                  <option key={i} disabled value="">{tz.label}</option>
                ) : (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                )
              )}
            </select>
          </div>

          {/* Schedule type */}
          <div>
            <p className="text-xs font-semibold text-[#4D4D4D] uppercase tracking-wider mb-1.5">
              Delivery schedule
            </p>
            <div className="space-y-2">

              {/* Interval */}
              <label
                className={`flex items-center gap-3 border rounded-xl p-3.5 cursor-pointer transition-colors ${scheduleType === "interval" ? "border-[#A78BFA] bg-[#f5f3ff]" : "border-[#E5E7EB] bg-white"}`}
                onClick={() => setScheduleType("interval")}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${scheduleType === "interval" ? "border-[#A78BFA] bg-[#A78BFA]" : "border-[#E5E7EB]"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#161616]">Every few hours</p>
                  <p className="text-xs text-[#4D4D4D]">Deliver email at regular intervals throughout the day</p>
                </div>
                {scheduleType === "interval" && (
                  <select
                    value={intervalHours}
                    onChange={(e) => setIntervalHours(Number(e.target.value))}
                    onClick={(e) => e.stopPropagation()}
                    className="border border-[#E5E7EB] rounded-lg px-2 py-1 text-sm bg-white flex-shrink-0"
                  >
                    {[1, 2, 3, 4, 6, 8, 12].map((h) => (
                      <option key={h} value={h}>Every {h}h</option>
                    ))}
                  </select>
                )}
              </label>

              {/* Times per day */}
              <label
                className={`flex items-center gap-3 border rounded-xl p-3.5 cursor-pointer transition-colors ${scheduleType === "times" ? "border-[#A78BFA] bg-[#f5f3ff]" : "border-[#E5E7EB] bg-white"}`}
                onClick={() => setScheduleType("times")}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${scheduleType === "times" ? "border-[#A78BFA] bg-[#A78BFA]" : "border-[#E5E7EB]"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#161616]">A set number of times per day</p>
                  <p className="text-xs text-[#4D4D4D]">Delivered at equal intervals across your day</p>
                </div>
                {scheduleType === "times" && (
                  <select
                    value={timesPerDay}
                    onChange={(e) => setTimesPerDay(Number(e.target.value))}
                    onClick={(e) => e.stopPropagation()}
                    className="border border-[#E5E7EB] rounded-lg px-2 py-1 text-sm bg-white flex-shrink-0"
                  >
                    {[2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>{n}×/day</option>
                    ))}
                  </select>
                )}
              </label>

              {/* Custom daily */}
              <div
                className={`border rounded-xl p-3.5 cursor-pointer transition-colors ${scheduleType === "custom_daily" ? "border-[#A78BFA] bg-[#f5f3ff]" : "border-[#E5E7EB] bg-white"}`}
              >
                <div className="flex items-center gap-3" onClick={() => setScheduleType("custom_daily")}>
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${scheduleType === "custom_daily" ? "border-[#A78BFA] bg-[#A78BFA]" : "border-[#E5E7EB]"}`} />
                  <div>
                    <p className="text-sm font-medium text-[#161616]">Specific times every day</p>
                    <p className="text-xs text-[#4D4D4D]">e.g. 9am and 5pm, same every day</p>
                  </div>
                </div>
                {scheduleType === "custom_daily" && (
                  <div className="mt-2.5 flex flex-wrap gap-2 ml-7">
                    {customDailyTimes.map((t) => (
                      <TimeTag key={t} time={t} onRemove={() => removeDailyTime(t)} />
                    ))}
                    <AddTimeButton onAdd={addDailyTime} />
                  </div>
                )}
              </div>

              {/* Custom weekly */}
              <div
                className={`border rounded-xl p-3.5 cursor-pointer transition-colors ${scheduleType === "custom_weekly" ? "border-[#A78BFA] bg-[#f5f3ff]" : "border-[#E5E7EB] bg-white"}`}
              >
                <div className="flex items-center gap-3" onClick={() => setScheduleType("custom_weekly")}>
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${scheduleType === "custom_weekly" ? "border-[#A78BFA] bg-[#A78BFA]" : "border-[#E5E7EB]"}`} />
                  <div>
                    <p className="text-sm font-medium text-[#161616]">Different times on different days</p>
                    <p className="text-xs text-[#4D4D4D]">Full weekly control, day by day</p>
                  </div>
                </div>
                {scheduleType === "custom_weekly" && (
                  <div className="mt-3 space-y-2 ml-7">
                    {weeklySchedule.map((day) => (
                      <div key={day.dayOfWeek} className="border border-[#E5E7EB] rounded-lg bg-white overflow-hidden">
                        <div className="px-3 py-1 text-xs font-semibold text-[#4D4D4D] uppercase tracking-widest border-b border-gray-100 bg-gray-50">
                          {DAY_ABBR[day.dayOfWeek]}
                        </div>
                        <div className="px-3 py-2 flex flex-wrap items-center gap-2">
                          {day.times.map((t) => (
                            <TimeTag key={t} time={t} onRemove={() => removeWeeklyTime(day.dayOfWeek, t)} />
                          ))}
                          <AddTimeButton onAdd={(t) => addWeeklyTime(day.dayOfWeek, t)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer — flex-shrink-0 so it stays pinned at the bottom */}
        <div className="flex-shrink-0 bg-white border-t border-[#E5E7EB] px-6 py-4 flex items-center justify-between gap-3">
          <button
            onClick={handleSkip}
            className="text-sm text-[#4D4D4D] hover:text-[#161616] transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#A78BFA] hover:bg-[#8B5CF6] text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save schedule"}
          </button>
        </div>
      </div>
    </div>
  )
}
