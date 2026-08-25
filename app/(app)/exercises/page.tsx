"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  type Exercise,
  EXERCISE_COLUMNS,
  PAGE_SIZE,
  BODY_PARTS,
  EQUIPMENTS,
  stripStepPrefix,
  labelCase,
} from "@/lib/exercises";

// Shared palette with the Fuel recipe library so the two libraries read as one
// system. GIFs sit on a warm cream tile — the exercisedb figures are drawn on
// white, so a light backing keeps them legible against the dark app chrome.
const CARD = "#12151C";
const CREAM = "#F4EEE2";
const BRASS = "#C9A24B";
const GIF_TILE = "#EDE7D8";

export default function ExercisesPage() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [bodyParts, setBodyParts] = useState<Set<string>>(new Set());
  const [equipments, setEquipments] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [items, setItems] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [openExercise, setOpenExercise] = useState<Exercise | null>(null);

  // Guards against out-of-order responses when filters/search change quickly:
  // every fetch stamps the current request id and stale results are dropped.
  const requestId = useRef(0);
  const pageRef = useRef(0);

  // Debounce the search box so we don't fire a query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const bodyKey = Array.from(bodyParts).sort().join(",");
  const equipKey = Array.from(equipments).sort().join(",");

  // Build + run a query for a given page. reset=true replaces the list (new
  // search/filters); reset=false appends the next page (infinite scroll).
  const fetchPage = useCallback(
    async (reset: boolean) => {
      const rid = ++requestId.current;
      const page = reset ? 0 : pageRef.current + 1;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError(false);

      try {
        const supabase = createClient();
        let q = supabase
          .from("exercises")
          .select(EXERCISE_COLUMNS)
          .order("name", { ascending: true })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

        if (debouncedQuery) q = q.ilike("name", `%${debouncedQuery}%`);
        if (bodyParts.size > 0) q = q.overlaps("body_parts", Array.from(bodyParts));
        if (equipments.size > 0) q = q.overlaps("equipments", Array.from(equipments));

        const { data, error: qErr } = await q;
        if (qErr) throw qErr;
        if (rid !== requestId.current) return; // a newer request superseded this one

        const rows = (data ?? []) as Exercise[];
        pageRef.current = page;
        setHasMore(rows.length === PAGE_SIZE);
        setItems((prev) => (reset ? rows : [...prev, ...rows]));
      } catch {
        if (rid === requestId.current) setError(true);
      } finally {
        if (rid === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [debouncedQuery, bodyParts, equipments],
  );

  // Re-run from page 0 whenever the search text or a filter changes.
  useEffect(() => {
    fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, bodyKey, equipKey]);

  // Infinite scroll — load the next page when the sentinel scrolls into view.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          fetchPage(false);
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadingMore, fetchPage]);

  function toggle(set: Set<string>, value: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  const activeFilterCount = bodyParts.size + equipments.size;

  function clearFilters() {
    setBodyParts(new Set());
    setEquipments(new Set());
  }

  if (openExercise) {
    return <ExerciseDetail exercise={openExercise} onBack={() => setOpenExercise(null)} />;
  }

  return (
    <div className="min-h-screen bg-edge-bg max-w-lg mx-auto px-4 pt-safe pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 py-4 mb-4">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-edge-surface border border-white/10 flex items-center justify-center flex-shrink-0"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="font-display text-3xl leading-none">Exercises</h1>
          <p className="text-edge-muted text-xs">Movement library · 1,500 demos</p>
        </div>
      </div>

      {/* Search + filter toggle */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-edge-surface border border-white/[0.08] rounded-xl px-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-edge-muted flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises…"
            className="flex-1 bg-transparent py-3 text-sm text-white placeholder:text-edge-muted outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-edge-muted active:text-white flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={() => setFiltersOpen((o) => !o)}
          className={`pressable relative w-12 rounded-xl border flex items-center justify-center transition-colors ${
            filtersOpen || activeFilterCount > 0
              ? "bg-edge-bronze border-edge-bronze text-white"
              : "bg-edge-surface border-white/[0.08] text-edge-muted"
          }`}
          aria-label="Filters"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M6 12h12M10 20h4" />
          </svg>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-edge-bg text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {filtersOpen && (
        <div className="bg-edge-surface border border-white/[0.08] rounded-2xl p-4 mb-4 anim-0">
          <FilterGroup
            title="Body part"
            options={BODY_PARTS}
            selected={bodyParts}
            onToggle={(v) => toggle(bodyParts, v, setBodyParts)}
          />
          <div className="h-px bg-white/[0.06] my-4" />
          <FilterGroup
            title="Equipment"
            options={EQUIPMENTS}
            selected={equipments}
            onToggle={(v) => toggle(equipments, v, setEquipments)}
          />
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="mt-4 w-full font-condensed font-bold text-xs uppercase tracking-widest py-2.5 rounded-lg bg-white/5 border border-white/10 text-edge-secondary active:bg-white/10"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Active filter summary chips (when panel closed) */}
      {!filtersOpen && activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {Array.from(bodyParts).map((v) => (
            <ActiveChip key={`b-${v}`} label={labelCase(v)} onRemove={() => toggle(bodyParts, v, setBodyParts)} />
          ))}
          {Array.from(equipments).map((v) => (
            <ActiveChip key={`e-${v}`} label={labelCase(v)} onRemove={() => toggle(equipments, v, setEquipments)} />
          ))}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-edge-bronze border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-edge-muted text-sm">Loading exercises…</p>
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-white/80 text-sm mb-1">Couldn&apos;t load the exercises.</p>
          <p className="text-edge-muted text-xs mb-5">Check your connection and try again.</p>
          <button
            onClick={() => fetchPage(true)}
            className="font-condensed font-bold text-xs uppercase tracking-widest px-5 py-2.5 rounded-lg"
            style={{ backgroundColor: BRASS, color: CARD }}
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-white/80 text-sm mb-1">No exercises match that.</p>
          <p className="text-edge-muted text-xs">Try a different search or clear your filters.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {items.map((ex) => (
              <ExerciseCard key={ex.exercise_id} exercise={ex} onOpen={setOpenExercise} />
            ))}
          </div>

          {/* Infinite-scroll sentinel + spinner */}
          <div ref={sentinelRef} className="h-10" />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-edge-bronze border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!hasMore && (
            <p className="text-center text-edge-muted text-xs py-6">That&apos;s everything.</p>
          )}
        </>
      )}
    </div>
  );
}

function FilterGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-muted mb-3">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const on = selected.has(opt);
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className={`font-condensed font-bold text-[11px] uppercase tracking-wide px-2.5 py-1.5 rounded-lg border transition-colors ${
                on
                  ? "bg-edge-bronze border-edge-bronze text-white"
                  : "bg-white/5 border-white/10 text-edge-secondary active:bg-white/10"
              }`}
            >
              {labelCase(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      onClick={onRemove}
      className="flex items-center gap-1.5 font-condensed font-bold text-[11px] uppercase tracking-wide pl-2.5 pr-2 py-1 rounded-lg"
      style={{ color: BRASS, backgroundColor: "rgba(201,162,75,0.12)" }}
    >
      {label}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

function ExerciseCard({ exercise, onOpen }: { exercise: Exercise; onOpen: (e: Exercise) => void }) {
  const primary = exercise.body_parts[0] ?? exercise.target_muscles[0];
  return (
    <button
      onClick={() => onOpen(exercise)}
      className="pressable rounded-2xl border border-white/[0.06] overflow-hidden text-left flex flex-col"
      style={{ backgroundColor: CARD }}
    >
      <div className="w-full aspect-square" style={{ backgroundColor: GIF_TILE }}>
        {/* Plain img (not next/image): the source is an animated GIF on an
            external host — next/image would neither optimise nor animate it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={exercise.gif_url}
          alt={exercise.name}
          loading="lazy"
          className="w-full h-full object-contain"
        />
      </div>
      <div className="p-3">
        {primary && (
          <p className="font-condensed font-bold text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: BRASS }}>
            {labelCase(primary)}
          </p>
        )}
        <p className="font-display font-semibold text-sm leading-snug line-clamp-2" style={{ color: CREAM }}>
          {exercise.name}
        </p>
      </div>
    </button>
  );
}

function ExerciseDetail({ exercise, onBack }: { exercise: Exercise; onBack: () => void }) {
  const steps = (exercise.instructions ?? []).map(stripStepPrefix).filter(Boolean);

  return (
    <div className="min-h-screen bg-edge-bg max-w-lg mx-auto px-4 pt-safe pb-24">
      <div className="flex items-center gap-3 py-4 mb-6">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-edge-surface border border-white/10 flex items-center justify-center flex-shrink-0"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {exercise.body_parts[0] && (
          <p className="font-condensed font-bold text-xs uppercase tracking-[0.2em]" style={{ color: BRASS }}>
            {labelCase(exercise.body_parts[0])}
          </p>
        )}
      </div>

      {/* Full GIF */}
      <div className="rounded-2xl overflow-hidden mb-6" style={{ backgroundColor: GIF_TILE }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={exercise.gif_url} alt={exercise.name} className="w-full aspect-square object-contain" />
      </div>

      <h1 className="font-display font-semibold text-3xl leading-tight mb-5" style={{ color: CREAM }}>
        {exercise.name}
      </h1>

      <ChipRow title="Target" values={exercise.target_muscles} accent />
      <ChipRow title="Secondary" values={exercise.secondary_muscles} />
      <ChipRow title="Equipment" values={exercise.equipments} />

      {steps.length > 0 && (
        <div className="mt-2 mb-8">
          <p className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-muted mb-4">Instructions</p>
          <ol className="space-y-4">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-4">
                <span
                  className="font-condensed font-black text-base flex-shrink-0 w-5 text-right leading-relaxed"
                  style={{ color: BRASS }}
                >
                  {i + 1}
                </span>
                <span className="text-white/80 text-sm leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function ChipRow({ title, values, accent }: { title: string; values: string[]; accent?: boolean }) {
  if (!values || values.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="font-condensed font-bold text-[11px] uppercase tracking-widest text-edge-muted mb-2">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="font-condensed font-bold text-[11px] uppercase tracking-wide px-2.5 py-1 rounded-md"
            style={
              accent
                ? { color: BRASS, backgroundColor: "rgba(201,162,75,0.12)" }
                : { color: "#9BA3AF", backgroundColor: "rgba(255,255,255,0.05)" }
            }
          >
            {labelCase(v)}
          </span>
        ))}
      </div>
    </div>
  );
}
