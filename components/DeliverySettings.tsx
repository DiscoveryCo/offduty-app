"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"

type ScheduleType = "interval" | "times" | "custom_daily" | "custom_weekly"

interface DaySchedule {
  dayOfWeek: number
  times: string[]
}

// Common IANA timezones grouped by region
const TIMEZONES = [
  { label: "UTC", value: "UTC" },
  { label: "───── Europe ─────", value: "", disabled: true },
  { label: "London (GMT/BST)", value: "Europe/London" },
  { label: "Dublin (GMT/IST)", value: "Europe/Dublin" },
  { label: "Lisbon (WET/WEST)", value: "Europe/Lisbon" },
  { label: "Paris / Berlin / Rome (CET/CEST)", value: "Europe/Paris" },
  { label: "Helsinki / Kyiv (EET/EEST)", value: "Europe/Helsinki" },
  { label: "Moscow (MSK)", value: "Europe/Moscow" },
  { label: "───── Americas ─────", value: "", disabled: true },
  { label: "New York (ET)", value: "America/New_York" },
  { label: "Chicago (CT)", value: "America/Chicago" },
  { label: "Denver (MT)", value: "America/Denver" },
  { label: "Los Angeles (PT)", value: "America/Los_Angeles" },
  { label: "Anchorage (AKT)", value: "America/Anchorage" },
  { label: "Honolulu (HST)", value: "Pacific/Honolulu" },
  { label: "Toronto (ET)", value: "America/Toronto" },
  { label: "Vancouver (PT)", value: "America/Vancouver" },
  { label: "São Paulo (BRT)", value: "America/Sao_Paulo" },
  { label: "Buenos Aires (ART)", value: "America/Argentina/Buenos_Aires" },
  { label: "Mexico City (CST/CDT)", value: "America/Mexico_City" },
  { label: "───── Asia & Pacific ─────", value: "", disabled: true },
  { label: "Dubai (GST)", value: "Asia/Dubai" },
  { label: "Karachi (PKT)", value: "Asia/Karachi" },
  { label: "Kolkata (IST)", value: "Asia/Kolkata" },
  { label: "Dhaka (BST)", value: "Asia/Dhaka" },
  { label: "Bangkok (ICT)", value: "Asia/Bangkok" },
  { label: "Singapore / Kuala Lumpur (SGT)", value: "Asia/Singapore" },
  { label: "Hong Kong (HKT)", value: "Asia/Hong_Kong" },
  { label: "Shanghai / Beijing (CST)", value: "Asia/Shanghai" },
  { label: "Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "Seoul (KST)", value: "Asia/Seoul" },
  { label: "Sydney (AEST/AEDT)", value: "Australia/Sydney" },
  { label: "Melbourne (AEST/AEDT)", value: "Australia/Melbourne" },
  { label: "Auckland (NZST/NZDT)", value: "Pacific/Auckland" },
  { label: "───── Africa ─────", value: "", disabled: true },
  { label: "Cairo (EET)", value: "Africa/Cairo" },
  { label: "Johannesburg (SAST)", value: "Africa/Johannesburg" },
  { label: "Lagos (WAT)", value: "Africa/Lagos" },
  { label: "Nairobi (EAT)", value: "Africa/Nairobi" },
]

interface OtherInbox {
  id: string
  email: string
}

interface Props {
  inboxId: string
  scheduleType: ScheduleType
  intervalHours: number | null
  timesPerDay: number | null
  customDailyTimes: string[]
  weeklySchedule: DaySchedule[]
  dndEnabled: boolean
  dndFrom: string
  dndTo: string
  timezone: string
  otherInboxes: OtherInbox[]
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const DAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

function TimeTag({ time, onRemove }: { time: string; onRemove: () => void }) {
  const [h, m] = time.split(":").map(Number)
  const ampm = h < 12 ? "am" : "pm"
  const display12 = ((h % 12) || 12).toString().padStart(2, "0") + ":" + String(m).padStart(2, "0") + ampm
  return (
    <span className="flex items-center gap-1 border border-[#D1D0D0] rounded px-2 py-1 text-sm text-[#161616] bg-[#FFFDFB]">
      {display12}
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
          className="border border-[#D1D0D0] rounded px-2 py-1 text-sm"
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

export function DeliverySettings({
  inboxId,
  scheduleType: initType,
  intervalHours: initInterval,
  timesPerDay: initTimes,
  customDailyTimes: initDaily,
  weeklySchedule: initWeekly,
  dndEnabled: initDnd,
  dndFrom: initDndFrom,
  dndTo: initDndTo,
  timezone: timezone_init,
  otherInboxes,
}: Props) {
  const [scheduleType, setScheduleType] = useState<ScheduleType>(initType)
  const [intervalHours, setIntervalHours] = useState(initInterval ?? 4)
  const [timesPerDay, setTimesPerDay] = useState(initTimes ?? 2)
  const [customDailyTimes, setCustomDailyTimes] = useState<string[]>(initDaily)
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>(initWeekly)
  const [dndEnabled, setDndEnabled] = useState(initDnd)
  const [dndFrom, setDndFrom] = useState(initDndFrom)
  const [dndTo, setDndTo] = useState(initDndTo)
  const [timezone, setTimezone] = useState(timezone_init)
  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)

  async function copyFromInbox(sourceInboxId: string) {
    setCopying(true)
    try {
      const res = await fetch(`/api/inbox-settings?inboxId=${sourceInboxId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      const d = data.delivery
      setScheduleType(d.scheduleType)
      setIntervalHours(d.intervalHours ?? 4)
      setTimesPerDay(d.timesPerDay ?? 2)
      setCustomDailyTimes(d.customDailyTimes)
      setWeeklySchedule(d.weeklySchedule)
      setDndEnabled(d.dndEnabled)
      setDndFrom(d.dndFrom)
      setDndTo(d.dndTo)
      setTimezone(d.timezone)
      toast.success("Delivery settings copied — save to apply")
    } catch {
      toast.error("Failed to copy settings")
    } finally {
      setCopying(false)
    }
  }

  // Auto-detect browser timezone on first visit (when still at the UTC default)
  useEffect(() => {
    if (timezone_init === "UTC") {
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
        if (detected) setTimezone(detected)
      } catch {}
    }
  }, [])

  function addDailyTime(time: string) {
    if (!customDailyTimes.includes(time)) setCustomDailyTimes([...customDailyTimes, time].sort())
  }
  function removeDailyTime(time: string) {
    setCustomDailyTimes(customDailyTimes.filter((t) => t !== time))
  }
  function addWeeklyTime(day: number, time: string) {
    setWeeklySchedule(weeklySchedule.map((d) =>
      d.dayOfWeek === day && !d.times.includes(time)
        ? { ...d, times: [...d.times, time].sort() }
        : d
    ))
  }
  function removeWeeklyTime(day: number, time: string) {
    setWeeklySchedule(weeklySchedule.map((d) =>
      d.dayOfWeek === day ? { ...d, times: d.times.filter((t) => t !== time) } : d
    ))
  }
  function copyFrom(targetDay: number, sourceDay: number) {
    const source = weeklySchedule.find((d) => d.dayOfWeek === sourceDay)
    if (!source) return
    setWeeklySchedule(weeklySchedule.map((d) =>
      d.dayOfWeek === targetDay ? { ...d, times: [...source.times] } : d
    ))
  }

  function buildScheduleSlots(): { dayOfWeek: number; time: string }[] {
    if (scheduleType === "custom_daily") {
      return customDailyTimes.map((t) => ({ dayOfWeek: -1, time: t }))
    }
    if (scheduleType === "custom_weekly") {
      return weeklySchedule.flatMap((d) => d.times.map((t) => ({ dayOfWeek: d.dayOfWeek, time: t })))
    }
    return []
  }

  async function save() {
    setSaving(true)
    try {
      const [settingsRes, scheduleRes] = await Promise.all([
        fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inboxId,
            scheduleType,
            intervalHours: scheduleType === "interval" ? intervalHours : null,
            timesPerDay: scheduleType === "times" ? timesPerDay : null,
            dndEnabled,
            dndFrom: dndEnabled ? dndFrom : null,
            dndTo: dndEnabled ? dndTo : null,
            timezone,
          }),
        }),
        fetch("/api/schedule", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inboxId, slots: buildScheduleSlots() }),
        }),
      ])
      if (!settingsRes.ok || !scheduleRes.ok) throw new Error()
      toast.success("Delivery settings saved")
    } catch {
      toast.error("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Timezone picker */}
      <div className="border border-[#D1D0D0] rounded-xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] p-5 bg-[#FFFDFB]">
        <label className="block">
          <p className="font-medium text-[#161616] text-sm mb-1">Timezone</p>
          <p className="text-xs text-[#4D4D4D] mb-3">All delivery times are interpreted in this timezone, including DST changes.</p>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full border border-[#D1D0D0] rounded-lg px-3 py-2 text-sm bg-[#FFFDFB] text-[#161616]"
          >
            {/* If detected timezone isn't in the curated list, show it at the top */}
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
        </label>
      </div>

      {/* Schedule type selector */}
      <div className="space-y-3">
        {/* Option: interval */}
        <label className={`flex flex-col gap-3 border rounded-xl p-4 cursor-pointer transition-colors ${scheduleType === "interval" ? "border-[#A78BFA] bg-[#f0ebff]" : "border-[#D1D0D0] bg-[#FFFDFB]"}`} onClick={() => setScheduleType("interval")}>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 ${scheduleType === "interval" ? "border-[#A78BFA] bg-[#A78BFA]" : "border-[#D1D0D0]"}`} />
            <div className="flex-1">
              <p className="font-medium text-[#161616] text-sm">Hours of interval</p>
              <p className="text-xs text-[#4D4D4D]">eg. deliver emails every 4 hours in a day</p>
            </div>
            {scheduleType === "interval" && (
              <select
                value={intervalHours}
                onChange={(e) => setIntervalHours(Number(e.target.value))}
                className="border border-[#D1D0D0] rounded-lg px-3 py-1.5 text-sm bg-[#FFFDFB]"
                onClick={(e) => e.stopPropagation()}
              >
                {[1, 2, 3, 4, 6, 8, 12].map((h) => (
                  <option key={h} value={h}>{h} hour{h > 1 ? "s" : ""}</option>
                ))}
              </select>
            )}
          </div>
        </label>

        {/* Option: times */}
        <label className={`flex flex-col gap-3 border rounded-xl p-4 cursor-pointer transition-colors ${scheduleType === "times" ? "border-[#A78BFA] bg-[#f0ebff]" : "border-[#D1D0D0] bg-[#FFFDFB]"}`} onClick={() => setScheduleType("times")}>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 ${scheduleType === "times" ? "border-[#A78BFA] bg-[#A78BFA]" : "border-[#D1D0D0]"}`} />
            <div className="flex-1">
              <p className="font-medium text-[#161616] text-sm">Number of times</p>
              <p className="text-xs text-[#4D4D4D]">eg. send me emails 3 times in a day at equal intervals</p>
            </div>
            {scheduleType === "times" && (
              <select
                value={timesPerDay}
                onChange={(e) => setTimesPerDay(Number(e.target.value))}
                className="border border-[#D1D0D0] rounded-lg px-3 py-1.5 text-sm bg-[#FFFDFB]"
                onClick={(e) => e.stopPropagation()}
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n} times</option>
                ))}
              </select>
            )}
          </div>
        </label>

        {/* Option: custom daily */}
        <div className={`border rounded-xl p-4 cursor-pointer transition-colors ${scheduleType === "custom_daily" ? "border-[#A78BFA] bg-[#f0ebff]" : "border-[#D1D0D0] bg-[#FFFDFB]"}`}>
          <div className="flex items-center gap-3" onClick={() => setScheduleType("custom_daily")}>
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${scheduleType === "custom_daily" ? "border-[#A78BFA] bg-[#A78BFA]" : "border-[#D1D0D0]"}`} />
            <div>
              <p className="font-medium text-[#161616] text-sm">Custom daily schedule</p>
              <p className="text-xs text-[#4D4D4D]">eg. deliver emails at 1pm and 6pm</p>
            </div>
          </div>
          {scheduleType === "custom_daily" && (
            <div className="mt-3 flex flex-wrap gap-2 ml-7">
              {customDailyTimes.map((t) => (
                <TimeTag key={t} time={t} onRemove={() => removeDailyTime(t)} />
              ))}
              <AddTimeButton onAdd={addDailyTime} />
            </div>
          )}
        </div>

        {/* Option: custom weekly */}
        <div className={`border rounded-xl p-4 cursor-pointer transition-colors ${scheduleType === "custom_weekly" ? "border-[#A78BFA] bg-[#f0ebff]" : "border-[#D1D0D0] bg-[#FFFDFB]"}`}>
          <div className="flex items-center gap-3" onClick={() => setScheduleType("custom_weekly")}>
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${scheduleType === "custom_weekly" ? "border-[#A78BFA] bg-[#A78BFA]" : "border-[#D1D0D0]"}`} />
            <div>
              <p className="font-medium text-[#161616] text-sm">Custom weekly schedule</p>
              <p className="text-xs text-[#4D4D4D]">eg. deliver emails at 1pm and 6pm only on Mondays</p>
            </div>
          </div>
          {scheduleType === "custom_weekly" && (
            <div className="mt-4 space-y-3 ml-7">
              {weeklySchedule.map((day) => (
                <div key={day.dayOfWeek} className="border border-[#D1D0D0] rounded-lg bg-[#FFFDFB]">
                  <div className="px-3 py-1.5 text-xs font-semibold text-[#4D4D4D] uppercase tracking-widest border-b border-[#F2F0EE]">
                    {DAY_ABBR[day.dayOfWeek]}
                  </div>
                  <div className="px-3 py-2 flex flex-wrap items-center gap-2">
                    {day.times.map((t) => (
                      <TimeTag key={t} time={t} onRemove={() => removeWeeklyTime(day.dayOfWeek, t)} />
                    ))}
                    <AddTimeButton onAdd={(t) => addWeeklyTime(day.dayOfWeek, t)} />
                    <div className="ml-auto">
                      <select
                        className="text-xs border border-[#D1D0D0] rounded px-2 py-1 text-[#4D4D4D] bg-[#FFFDFB]"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value !== "") copyFrom(day.dayOfWeek, Number(e.target.value))
                          e.target.value = ""
                        }}
                      >
                        <option value="">Copy from ▾</option>
                        {weeklySchedule
                          .filter((d) => d.dayOfWeek !== day.dayOfWeek)
                          .map((d) => (
                            <option key={d.dayOfWeek} value={d.dayOfWeek}>
                              {DAYS[d.dayOfWeek]}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Do Not Disturb */}
      <div className="border border-[#D1D0D0] rounded-xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] p-5 bg-[#FFFDFB]">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="font-medium text-[#161616] text-sm">Do Not Disturb</p>
            <p className="text-xs text-[#4D4D4D]">No deliveries will be made during this period</p>
          </div>
          <button
            role="switch"
            aria-checked={dndEnabled}
            onClick={() => setDndEnabled(!dndEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dndEnabled ? "bg-[#A78BFA]" : "bg-[#D1D0D0]"}`}
          >
            <span className={`inline-block w-4 h-4 bg-[#FFFDFB] rounded-full shadow transition-transform ${dndEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        {dndEnabled && (
          <div className="flex items-center gap-3 mt-3">
            <span className="text-sm text-[#4D4D4D]">From</span>
            <input
              type="time"
              value={dndFrom}
              onChange={(e) => setDndFrom(e.target.value)}
              className="border border-[#D1D0D0] rounded-lg px-3 py-1.5 text-sm"
            />
            <span className="text-sm text-[#4D4D4D]">To</span>
            <input
              type="time"
              value={dndTo}
              onChange={(e) => setDndTo(e.target.value)}
              className="border border-[#D1D0D0] rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
        )}
      </div>

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
            className="border border-[#D1D0D0] rounded-lg px-3 py-2.5 text-sm text-[#4D4D4D] bg-[#FFFDFB] disabled:opacity-50 max-w-44"
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
