"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"

type ScheduleType = "interval" | "times" | "custom_daily" | "custom_weekly"

interface DaySchedule {
  dayOfWeek: number
  times: string[]
}

interface Props {
  scheduleType: ScheduleType
  intervalHours: number | null
  timesPerDay: number | null
  customDailyTimes: string[]
  weeklySchedule: DaySchedule[]
  dndEnabled: boolean
  dndFrom: string
  dndTo: string
  timezone: string
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const DAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

function TimeTag({ time, onRemove }: { time: string; onRemove: () => void }) {
  const [h, m] = time.split(":").map(Number)
  const ampm = h < 12 ? "am" : "pm"
  const display12 = ((h % 12) || 12).toString().padStart(2, "0") + ":" + String(m).padStart(2, "0") + ampm
  return (
    <span className="flex items-center gap-1 border border-gray-300 rounded px-2 py-1 text-sm text-gray-700 bg-white">
      {display12}
      <button onClick={onRemove} className="text-gray-400 hover:text-gray-700 ml-0.5">
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
          className="border border-gray-300 rounded px-2 py-1 text-sm"
          autoFocus
        />
        <button
          onClick={() => { onAdd(value); setShow(false) }}
          className="text-xs bg-[#7c7cf8] text-white px-2 py-1 rounded hover:bg-[#6b6be7]"
        >
          Add
        </button>
        <button onClick={() => setShow(false)} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setShow(true)}
      className="w-7 h-7 rounded-full bg-[#7c7cf8] text-white flex items-center justify-center hover:bg-[#6b6be7] transition-colors"
    >
      <Plus className="w-4 h-4" />
    </button>
  )
}

export function DeliverySettings({
  scheduleType: initType,
  intervalHours: initInterval,
  timesPerDay: initTimes,
  customDailyTimes: initDaily,
  weeklySchedule: initWeekly,
  dndEnabled: initDnd,
  dndFrom: initDndFrom,
  dndTo: initDndTo,
  timezone,
}: Props) {
  const [scheduleType, setScheduleType] = useState<ScheduleType>(initType)
  const [intervalHours, setIntervalHours] = useState(initInterval ?? 4)
  const [timesPerDay, setTimesPerDay] = useState(initTimes ?? 2)
  const [customDailyTimes, setCustomDailyTimes] = useState<string[]>(initDaily)
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>(initWeekly)
  const [dndEnabled, setDndEnabled] = useState(initDnd)
  const [dndFrom, setDndFrom] = useState(initDndFrom)
  const [dndTo, setDndTo] = useState(initDndTo)
  const [saving, setSaving] = useState(false)

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
            scheduleType,
            intervalHours: scheduleType === "interval" ? intervalHours : null,
            timesPerDay: scheduleType === "times" ? timesPerDay : null,
            dndEnabled,
            dndFrom: dndEnabled ? dndFrom : null,
            dndTo: dndEnabled ? dndTo : null,
          }),
        }),
        fetch("/api/schedule", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildScheduleSlots()),
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
      {/* Timezone banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800">
        All times are in the <strong>{timezone}</strong> timezone. If your timezone
        ever changes, stop and start DiscoveryMail again to reset to the new timezone.
      </div>

      {/* Schedule type selector */}
      <div className="space-y-3">
        {/* Option: interval */}
        <label className={`flex flex-col gap-3 border rounded-xl p-4 cursor-pointer transition-colors ${scheduleType === "interval" ? "border-[#7c7cf8] bg-[#f5f5ff]" : "border-gray-200 bg-white"}`}>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 ${scheduleType === "interval" ? "border-[#7c7cf8] bg-[#7c7cf8]" : "border-gray-300"}`} />
            <div className="flex-1" onClick={() => setScheduleType("interval")}>
              <p className="font-medium text-gray-900 text-sm">Hours of interval</p>
              <p className="text-xs text-gray-500">eg. deliver emails every 4 hours in a day</p>
            </div>
            {scheduleType === "interval" && (
              <select
                value={intervalHours}
                onChange={(e) => setIntervalHours(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
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
        <label className={`flex flex-col gap-3 border rounded-xl p-4 cursor-pointer transition-colors ${scheduleType === "times" ? "border-[#7c7cf8] bg-[#f5f5ff]" : "border-gray-200 bg-white"}`}>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 ${scheduleType === "times" ? "border-[#7c7cf8] bg-[#7c7cf8]" : "border-gray-300"}`} />
            <div className="flex-1" onClick={() => setScheduleType("times")}>
              <p className="font-medium text-gray-900 text-sm">Number of times</p>
              <p className="text-xs text-gray-500">eg. send me emails 3 times in a day at equal intervals</p>
            </div>
            {scheduleType === "times" && (
              <select
                value={timesPerDay}
                onChange={(e) => setTimesPerDay(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
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
        <div className={`border rounded-xl p-4 cursor-pointer transition-colors ${scheduleType === "custom_daily" ? "border-[#7c7cf8] bg-[#f5f5ff]" : "border-gray-200 bg-white"}`}>
          <div className="flex items-center gap-3" onClick={() => setScheduleType("custom_daily")}>
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${scheduleType === "custom_daily" ? "border-[#7c7cf8] bg-[#7c7cf8]" : "border-gray-300"}`} />
            <div>
              <p className="font-medium text-gray-900 text-sm">Custom daily schedule</p>
              <p className="text-xs text-gray-500">eg. deliver emails at 1pm and 6pm</p>
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
        <div className={`border rounded-xl p-4 cursor-pointer transition-colors ${scheduleType === "custom_weekly" ? "border-[#7c7cf8] bg-[#f5f5ff]" : "border-gray-200 bg-white"}`}>
          <div className="flex items-center gap-3" onClick={() => setScheduleType("custom_weekly")}>
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${scheduleType === "custom_weekly" ? "border-[#7c7cf8] bg-[#7c7cf8]" : "border-gray-300"}`} />
            <div>
              <p className="font-medium text-gray-900 text-sm">Custom weekly schedule</p>
              <p className="text-xs text-gray-500">eg. deliver emails at 1pm and 6pm only on Mondays</p>
            </div>
          </div>
          {scheduleType === "custom_weekly" && (
            <div className="mt-4 space-y-3 ml-7">
              {weeklySchedule.map((day) => (
                <div key={day.dayOfWeek} className="border border-gray-200 rounded-lg bg-white">
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-widest border-b border-gray-100">
                    {DAY_ABBR[day.dayOfWeek]}
                  </div>
                  <div className="px-3 py-2 flex flex-wrap items-center gap-2">
                    {day.times.map((t) => (
                      <TimeTag key={t} time={t} onRemove={() => removeWeeklyTime(day.dayOfWeek, t)} />
                    ))}
                    <AddTimeButton onAdd={(t) => addWeeklyTime(day.dayOfWeek, t)} />
                    <div className="ml-auto">
                      <select
                        className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-500 bg-white"
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
      <div className="border border-gray-200 rounded-xl p-5 bg-white">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="font-medium text-gray-900 text-sm">Do Not Disturb</p>
            <p className="text-xs text-gray-500">No deliveries will be made during this period</p>
          </div>
          <button
            role="switch"
            aria-checked={dndEnabled}
            onClick={() => setDndEnabled(!dndEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dndEnabled ? "bg-[#7c7cf8]" : "bg-gray-200"}`}
          >
            <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform ${dndEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        {dndEnabled && (
          <div className="flex items-center gap-3 mt-3">
            <span className="text-sm text-gray-600">From</span>
            <input
              type="time"
              value={dndFrom}
              onChange={(e) => setDndFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
            <span className="text-sm text-gray-600">To</span>
            <input
              type="time"
              value={dndTo}
              onChange={(e) => setDndTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
        )}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="bg-[#7c7cf8] text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-[#6b6be7] transition-colors disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  )
}
