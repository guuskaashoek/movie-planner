"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, setHours, setMinutes } from "date-fns";
import classNames from "classnames";

const FORMAT_OPTIONS = ["IMAX", "4DX", "ScreenX", "3D", "2D", "Dolby Cinema", "Laser Ultra"];

type Attendee = {
  id: number;
  name: string | null;
  email: string;
  image: string | null;
};

type Film = {
  id: number;
  title: string;
  description: string | null;
  date: string | null; // Screening date (Nullable)
  releaseDate: string | null;
  startTime: string | null;
  endTime: string | null;
  posterUrl: string | null;
  formats: string | null;
  createdBy: number;
  attendees: Attendee[];
  attendeeCount: number;
  isAttending: boolean;
};

type InitialData = {
  films: Film[];
  currentUserId: number;
};

// --- CUSTOM DATE PICKER COMPONENT ---
function CustomDatePicker({
  label,
  value, // YYYY-MM-DD string
  onChange,
  optional = false,
  description,
}: {
  label: string;
  value: string;
  onChange: (date: string) => void;
  optional?: boolean;
  description?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value or default to today
  const currentDate = value ? new Date(value) : null;
  const [viewDate, setViewDate] = useState(currentDate || new Date());

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const days = eachDayOfInterval({
    start: startOfMonth(viewDate),
    end: endOfMonth(viewDate),
  });

  // Add padding days at start
  const startDay = startOfMonth(viewDate).getDay(); // 0 = Sun, 1 = Mon, etc.
  // Fix for Monday start if needed, but standard US/JS is Sunday start (0)
  const paddingDays = Array.from({ length: startDay });

  const handleSelect = (day: Date) => {
    onChange(format(day, "yyyy-MM-dd"));
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label} {optional && <span className="text-zinc-600">(Optional)</span>}
      </label>
      <div className="relative">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={classNames(
            "flex w-full cursor-pointer items-center justify-between rounded-lg border bg-zinc-950 px-4 py-3 text-sm transition-all hover:bg-zinc-900",
            isOpen ? "border-blue-500 ring-1 ring-blue-500" : "border-zinc-700"
          )}
        >
          <span className={value ? "text-zinc-100" : "text-zinc-500"}>
            {value ? format(new Date(value), "MMMM d, yyyy") : "Select date..."}
          </span>
          <div className="flex items-center gap-2">
            {value && optional && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-full p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        {isOpen && (
          <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl backdrop-blur-xl">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewDate(subMonths(viewDate, 1))}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-sm font-semibold text-zinc-200">
                {format(viewDate, "MMMM yyyy")}
              </span>
              <button
                type="button"
                onClick={() => setViewDate(addMonths(viewDate, 1))}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                <div key={d} className="text-[10px] font-medium text-zinc-500">{d}</div>
              ))}

              {paddingDays.map((_, i) => <div key={`pad-${i}`} />)}

              {days.map(day => {
                const isSelected = value ? isSameDay(day, new Date(value)) : false;
                const isViewMonth = isSameMonth(day, viewDate);
                const isCurrent = isToday(day);

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => handleSelect(day)}
                    className={classNames(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm transition-all",
                      !isViewMonth && "text-zinc-600 opacity-50",
                      isSelected
                        ? "bg-blue-600 font-bold text-white shadow-lg shadow-blue-500/20"
                        : "text-zinc-300 hover:bg-zinc-800",
                      !isSelected && isCurrent && "ring-1 ring-blue-500"
                    )}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {description && <p className="text-[10px] text-zinc-500">{description}</p>}
    </div>
  );
}

// --- CUSTOM TIME PICKER COMPONENT ---
function CustomTimePicker({
  label,
  value, // HH:mm
  onChange,
}: {
  label: string;
  value: string;
  onChange: (time: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = ["00", "15", "30", "45"];

  const handleSelect = (time: string) => {
    onChange(time);
    setIsOpen(false);
  };

  return (
    <div className="space-y-1" ref={containerRef}>
      <label className="text-[10px] text-zinc-400">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={classNames(
            "flex w-full items-center justify-between rounded-lg border bg-zinc-950 px-3 py-2 text-sm text-zinc-100 transition-all hover:bg-zinc-900",
            isOpen ? "border-blue-500 ring-1 ring-blue-500" : "border-zinc-700"
          )}
        >
          <span>{value || "--:--"}</span>
          <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full z-50 mt-2 grid max-h-48 w-48 grid-cols-2 overflow-auto rounded-xl border border-zinc-800 bg-zinc-900 p-2 shadow-xl">
            <div className="col-span-2 mb-2 border-b border-zinc-800 pb-1 text-center text-[10px] uppercase text-zinc-500">Pick Time</div>
            {/* Simplified selection for common times */}
            {hours.slice(12, 24).concat(hours.slice(0, 12)).map(h => (
              minutes.map(m => {
                const time = `${h}:${m}`;
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => handleSelect(time)}
                    className={classNames(
                      "rounded px-2 py-1 text-center text-xs hover:bg-zinc-800",
                      time === value ? "bg-blue-600 text-white" : "text-zinc-300"
                    )}
                  >
                    {time}
                  </button>
                )
              })
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilmRow({
  film,
  onEdit,
  onDelete,
  isPast = false,
}: {
  film: Film;
  onEdit: (film: Film) => void;
  onDelete: (id: number) => void;
  isPast?: boolean;
}) {
  return (
    <div
      className={classNames(
        "group flex gap-4 overflow-hidden rounded-xl border p-1 transition-all hover:border-zinc-700 hover:bg-zinc-900/50 hover:shadow-md",
        isPast
          ? "border-zinc-800/50 bg-zinc-900/20 opacity-70 hover:opacity-100"
          : "border-zinc-800 bg-zinc-900/30"
      )}
    >
      <div className="relative aspect-[2/3] w-20 flex-none overflow-hidden rounded-lg bg-zinc-950">
        {film.posterUrl ? (
          <img
            src={film.posterUrl}
            alt={film.title}
            className={classNames(
              "h-full w-full object-cover transition-transform duration-500 group-hover:scale-110",
              isPast ? "grayscale-[0.4] group-hover:grayscale-0" : ""
            )}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-800">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between py-2 pr-4">
        <div>
          <h4 className="font-semibold text-zinc-200">{film.title}</h4>
          <div className="space-y-0.5">
            {film.date ? (
              <p className="text-xs text-zinc-500">
                Screening: {format(new Date(film.date), "dd MMM yyyy")}
              </p>
            ) : film.releaseDate ? (
              <p className="text-xs text-zinc-500">
                Released: {format(new Date(film.releaseDate), "dd MMM yyyy")}
              </p>
            ) : (
              <p className="text-xs text-zinc-500">Date TBD</p>
            )}
          </div>
          {film.formats && (
            <div className="mt-2 flex flex-wrap gap-1">
              {film.formats.split(",").map(f => (
                <span key={f} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 uppercase tracking-wide border border-zinc-700/50">{f}</span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => onEdit(film)}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 hover:underline"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(film.id)}
            className="text-xs font-semibold text-zinc-600 hover:text-red-400 hover:underline"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function MyFilmsClient({ initial }: { initial: InitialData }) {
  const router = useRouter();
  const [films, setFilms] = useState<Film[]>(initial.films);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [showPastManaged, setShowPastManaged] = useState(false);

  type FormState = {
    title: string;
    date: string;
    releaseDate: string;
    startTime: string;
    endTime: string;
    posterFile: File | null;
    currentPosterUrl: string | null;
    selectedFormats: string[];
  };

  const initialFormState: FormState = {
    title: "",
    date: "",
    releaseDate: "",
    startTime: "",
    endTime: "",
    posterFile: null,
    currentPosterUrl: null,
    selectedFormats: [],
  };

  const [form, setForm] = useState<FormState>(initialFormState);
  // Track original state to detect changes
  const [originalForm, setOriginalForm] = useState<FormState>(initialFormState);

  const today = new Date().toISOString().split("T")[0];

  // Filter shows only films created by me that I can manage
  const allMyFilms = films.filter((f) => f.createdBy === initial.currentUserId);

  // A film is "past" if its screening date has passed, or (no screening date but release date has passed)
  const isPastFilm = (f: Film) =>
    (f.date && f.date < today) || (!f.date && f.releaseDate && f.releaseDate < today);

  const pastManagedFilms = allMyFilms
    .filter(isPastFilm)
    .sort((a, b) => {
      const aKey = a.date ?? a.releaseDate ?? "";
      const bKey = b.date ?? b.releaseDate ?? "";
      return bKey.localeCompare(aKey); // newest first
    });

  const myManagedFilms = allMyFilms
    .filter((f) => !isPastFilm(f))
    .sort((a, b) => {
      const aKey = a.date ?? a.releaseDate ?? "9999";
      const bKey = b.date ?? b.releaseDate ?? "9999";
      return aKey.localeCompare(bKey); // soonest first, TBA last
    });

  function toggleFormat(fmt: string) {
    setForm((prev) => {
      if (prev.selectedFormats.includes(fmt)) {
        return { ...prev, selectedFormats: prev.selectedFormats.filter((f) => f !== fmt) };
      }
      return { ...prev, selectedFormats: [...prev.selectedFormats, fmt] };
    });
  }

  // Helper to check if a field is modified
  function isModified(field: keyof FormState) {
    if (!isEditing) return false;

    if (field === 'selectedFormats') {
      const sortedA = [...form.selectedFormats].sort().join(',');
      const sortedB = [...originalForm.selectedFormats].sort().join(',');
      return sortedA !== sortedB;
    }

    // Poster file change is always a modification
    if (field === 'posterFile') {
      return !!form.posterFile;
    }

    return form[field] !== originalForm[field];
  }

  // Helper class for modified inputs
  const getFieldClass = (field: keyof FormState, baseClass: string) => {
    return classNames(
      baseClass,
      isModified(field) ? "border-amber-500/50 ring-1 ring-amber-500/20 bg-amber-500/5" : ""
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      let posterUrl = form.currentPosterUrl;
      let posterChanged = false;

      // Upload new poster if selected
      if (form.posterFile) {
        const fd = new FormData();
        fd.append("file", form.posterFile);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: fd,
        });
        if (!uploadRes.ok) throw new Error("Upload failed");
        const uploadJson = (await uploadRes.json()) as { url: string };
        posterUrl = uploadJson.url;
        posterChanged = true;
      } else if (form.currentPosterUrl !== originalForm.currentPosterUrl) {
        // Poster was removed or changed without upload (e.g. if we supported selecting from library)
        posterChanged = true;
      }

      if (isEditing) {
        // UPDATE existing film - Only send changed fields
        const body: any = {};

        if (isModified('title')) body.title = form.title;
        if (isModified('date')) body.date = form.date || null;
        if (isModified('releaseDate')) body.releaseDate = form.releaseDate || null;

        // Time depends on date, but if only time changed, we update it.
        // If date changed, we should probably send time too.
        if (isModified('startTime') || isModified('date')) body.startTime = form.date ? (form.startTime || null) : null;
        if (isModified('endTime') || isModified('date')) body.endTime = form.date ? (form.endTime || null) : null;

        if (isModified('selectedFormats')) {
          body.formats = form.selectedFormats.length > 0 ? form.selectedFormats.join(",") : null;
        }

        if (posterChanged) {
          body.posterUrl = posterUrl ?? null;
        }

        if (Object.keys(body).length === 0) {
          // No changes
          setLoading(false);
          alert("No changes to save.");
          return;
        }

        const res = await fetch(`/api/films/${isEditing}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Update failed");

      } else {
        // CREATE new film - Send all fields
        const body = {
          title: form.title,
          date: form.date || null,
          releaseDate: form.releaseDate || null,
          startTime: form.date ? (form.startTime || null) : null,
          endTime: form.date ? (form.endTime || null) : null,
          posterUrl: posterUrl ?? null,
          formats: form.selectedFormats.length > 0 ? form.selectedFormats.join(",") : null,
        };

        const res = await fetch("/api/films", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Create failed");
      }

      router.refresh();
      resetForm();
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this film?")) return;
    const res = await fetch(`/api/films/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
      setFilms((prev) => prev.filter((f) => f.id !== id));
    }
  }

  function handleEdit(film: Film) {
    setIsEditing(film.id);
    const newFormState = {
      title: film.title,
      date: film.date || "",
      releaseDate: film.releaseDate || "",
      startTime: film.startTime || "",
      endTime: film.endTime || "",
      posterFile: null,
      currentPosterUrl: film.posterUrl,
      selectedFormats: film.formats ? film.formats.split(",") : [],
    };
    setForm(newFormState);
    setOriginalForm(newFormState);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setIsEditing(null);
    setForm(initialFormState);
    setOriginalForm(initialFormState);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-12 pb-24">
      {/* --- FORM SECTION --- */}
      <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm transition-all hover:bg-zinc-900/60 sm:p-8">
        <div className="mb-8">
          <h2 className="text-xl font-bold text-zinc-100">
            {isEditing ? "Edit Film" : "Add New Film"}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {isEditing
              ? "Update the details for this screening."
              : "Plan a new screening for the group."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <span>Film Title <span className="text-red-400">*</span></span>
              {isEditing && isModified("title") && <span className="text-amber-500">Modified</span>}
            </label>
            <input
              required
              placeholder="e.g. Inception"
              className={getFieldClass("title", "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 placeholder-zinc-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all")}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <span>Experience / Formats</span>
              {isEditing && isModified("selectedFormats") && <span className="text-amber-500">Modified</span>}
            </label>
            <div className={classNames("flex flex-wrap gap-2 p-2 rounded-lg border border-transparent transition-all", isEditing && isModified("selectedFormats") ? "border-amber-500/30 bg-amber-500/5" : "")}>
              {FORMAT_OPTIONS.map((fmt) => {
                const isSelected = form.selectedFormats.includes(fmt);
                return (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => toggleFormat(fmt)}
                    className={classNames(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition-all border",
                      isSelected
                        ? "border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                        : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    )}
                  >
                    {fmt}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className={isEditing && isModified("date") ? "rounded-lg p-1 ring-1 ring-amber-500/30 bg-amber-500/5" : ""}>
              <CustomDatePicker
                label="Screening Date"
                value={form.date}
                onChange={(date) => setForm({ ...form, date })}
                optional
                description="When are we watching?"
              />
            </div>

            <div className={isEditing && isModified("releaseDate") ? "rounded-lg p-1 ring-1 ring-amber-500/30 bg-amber-500/5" : ""}>
              <CustomDatePicker
                label="Release Date"
                value={form.releaseDate}
                onChange={(date) => setForm({ ...form, releaseDate: date })}
                optional
                description="Original cinema release"
              />
            </div>
          </div>

          {/* Time fields - ONLY show if a screening date is selected */}
          {form.date && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 transition-all animate-in fade-in slide-in-from-top-4">
              <h4 className="mb-3 text-xs font-semibold uppercase text-zinc-500">Screening Time</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={isEditing && isModified("startTime") ? "rounded-lg p-1 ring-1 ring-amber-500/30 bg-amber-500/5" : ""}>
                  <CustomTimePicker
                    label="Start Time"
                    value={form.startTime}
                    onChange={(time) => setForm({ ...form, startTime: time })}
                  />
                </div>
                <div className={isEditing && isModified("endTime") ? "rounded-lg p-1 ring-1 ring-amber-500/30 bg-amber-500/5" : ""}>
                  <CustomTimePicker
                    label="End Time"
                    value={form.endTime}
                    onChange={(time) => setForm({ ...form, endTime: time })}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <span>Poster Image</span>
              {isEditing && (isModified("posterFile") || isModified("currentPosterUrl")) && <span className="text-amber-500">Modified</span>}
            </label>

            {/* Current Poster Preview */}
            {form.currentPosterUrl && !form.posterFile && (
              <div className="mb-3 flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <img
                  src={form.currentPosterUrl}
                  alt="Current poster"
                  className="h-16 w-12 rounded object-cover shadow-sm"
                  referrerPolicy="no-referrer"
                />
                <div className="text-sm text-zinc-400">Current poster</div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, currentPosterUrl: null })}
                  className="ml-auto rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                >
                  Remove
                </button>
              </div>
            )}

            <label className={classNames(
              "group flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed transition-all",
              isEditing && (isModified("posterFile") || (!form.currentPosterUrl && originalForm.currentPosterUrl))
                ? "border-amber-500/50 bg-amber-500/5"
                : "border-zinc-700 bg-zinc-950/50 hover:border-zinc-500 hover:bg-zinc-900",
              "py-10"
            )}>
              <div className={classNames("rounded-full p-3 transition-colors",
                isEditing && isModified("posterFile") ? "bg-amber-500/20 text-amber-500" : "bg-zinc-900 text-zinc-500 group-hover:text-zinc-300"
              )}>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className={classNames("text-sm group-hover:text-zinc-200", isEditing && isModified("posterFile") ? "text-amber-500" : "text-zinc-400")}>
                {form.posterFile
                  ? form.posterFile.name
                  : "Click to upload poster image"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  setForm({ ...form, posterFile: e.target.files?.[0] || null })
                }
              />
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all shadow-sm"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 hover:shadow-blue-500/40 disabled:opacity-50 transition-all"
            >
              {loading
                ? isEditing
                  ? "Saving..."
                  : "Adding..."
                : isEditing
                  ? "Save Changes"
                  : "Add Film"}
            </button>
          </div>
        </form>
      </section>

      {/* ... */}

      {/* --- MANAGED FILMS LIST --- */}
      <section className="space-y-6">
        <h3 className="text-lg font-bold text-zinc-100">Managed by You</h3>

        {myManagedFilms.length === 0 && pastManagedFilms.length === 0 ? (
          <p className="text-center text-sm text-zinc-500 py-8 italic">You haven't added any films yet.</p>
        ) : (
          <div className="space-y-4">
            {myManagedFilms.map((film) => (
              <FilmRow key={film.id} film={film} onEdit={handleEdit} onDelete={handleDelete} />
            ))}

            {/* PAST MANAGED FILMS */}
            {pastManagedFilms.length > 0 && (
              <div className="pt-2">
                <button
                  onClick={() => setShowPastManaged(!showPastManaged)}
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-left transition-all hover:bg-zinc-900/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-400 transition-transform ${showPastManaged ? "rotate-90" : ""}`}>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-200">Past Films</h4>
                      <p className="text-xs text-zinc-500">{pastManagedFilms.length} {pastManagedFilms.length === 1 ? "film" : "films"} already shown or released</p>
                    </div>
                  </div>
                </button>

                {showPastManaged && (
                  <div className="mt-4 space-y-3 animate-in slide-in-from-top-4 fade-in duration-300">
                    {pastManagedFilms.map((film) => (
                      <FilmRow key={film.id} film={film} onEdit={handleEdit} onDelete={handleDelete} isPast />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
