// Movement library — the "training drop". Nick sees an exercise, drops the
// frames in, and it becomes a coached card here. Cards work with or without
// demo images (a "demo coming soon" state shows until frames are added).

export type Movement = {
  slug: string;
  name: string;
  subtitle: string;
  trains: string[];        // muscle tags
  equipment: string;
  aliases: string[];       // lowercased fragments to match a programme's exercise names
  images: { src: string; caption: string }[];
  why: string;
  steps: string[];
  cues: string[];
  setsReps: string;
  watchOuts: string[];
  sourceCredit?: string;
  addedOn: string;         // ISO date
};

export const MOVEMENTS: Movement[] = [
  // ── Barry — Block 3 (Progression & Variation) ──────────────────────
  // Placed first so these aliases win over Block 1/2 placeholder aliases
  // that anticipated this stage (e.g. "box squat" on Sit-to-Stand).
  {
    slug: "box-squat",
    name: "Box Squat (Lower Bench)",
    subtitle: "The next layer on Sit-to-Stand",
    trains: ["Quads", "Glutes"],
    equipment: "Lower bench or box",
    aliases: ["box squat"],
    images: [],
    why:
      "You earned this one — the knee stayed green through Sit-to-Stand, so now the bench comes down a notch for more range and a bit more work. Same pattern you already know, just a little deeper. If the knee ever says otherwise, we go straight back to the higher bench — that's not a step back, that's the plan working.",
    steps: [
      "Sit tall on the lower bench, feet flat, roughly shoulder-width.",
      "Arms out in front for balance, chest up, lean forward slightly from the hips.",
      "Drive through your heels and stand all the way up. Squeeze the glutes at the top.",
      "Sit back down under control — 2–3 seconds — tapping the bench without flopping onto it.",
    ],
    cues: ["Same pattern as before, just deeper.", "Drive through the heels.", "Control the way down — no flopping."],
    setsReps: "3 × 10–12",
    watchOuts: ["Knee discomfort above 3/10 — stop the set, go back to the higher bench, tell Nick.", "Only lower the bench as far as stays comfortable — there's no rush."],
    addedOn: "2026-08-29",
  },
  {
    slug: "incline-chest-press",
    name: "Incline Chest Press",
    subtitle: "Chest press, different angle",
    trains: ["Chest", "Front delts", "Triceps"],
    equipment: "Incline machine or dumbbells",
    aliases: ["incline chest press", "incline press"],
    images: [],
    why:
      "Same safe, supported pressing you've been doing for two months — just tilted, so the work lands a bit higher across the chest. After eight weeks on the flat press this is genuinely new stimulus for the muscle, not just a different name for the same thing.",
    steps: [
      "Set the seat so the handles sit at upper-chest height.",
      "Back flat against the pad, feet planted.",
      "Press up and slightly forward until the arms are nearly straight — don't lock out hard.",
      "Control it back until you feel a gentle stretch. Breathe out on the push, in on the return.",
    ],
    cues: ["Smooth out, smooth back.", "Breathe out as you press — never hold your breath.", "Handles high on the chest, not the shoulders."],
    setsReps: "3 × 10–12 · 2–3 reps in the tank",
    watchOuts: ["Never hold your breath under load — that's the one that matters for the heart.", "Don't slam the weight stack down between reps."],
    addedOn: "2026-08-29",
  },
  {
    slug: "single-arm-seated-row",
    name: "Single-Arm Seated Row",
    subtitle: "One side at a time",
    trains: ["Back", "Biceps", "Rear delts", "Core"],
    equipment: "Cable or machine row, single handle",
    aliases: ["single-arm seated row", "single arm seated row", "single-arm row", "one arm row"],
    images: [],
    why:
      "Same pull you've mastered on the two-handed row, but one arm at a time — which quietly asks your core to work harder to stop you twisting. That's a bonus, not a complication: stronger core protects the lower back for everything else you do.",
    steps: [
      "Chest up against the pad or seated tall, slight bend in the knees.",
      "One hand on the handle, arm straight to start.",
      "Pull to your ribs, leading with the elbow, resisting the urge to rotate your torso.",
      "Control it back out until the arm is straight again. Complete all reps one side before swapping.",
    ],
    cues: ["Pull to your ribs, elbow leads.", "Resist twisting — let the core hold you square.", "Control it back — don't get pulled forward."],
    setsReps: "3 × 10–12 each side",
    watchOuts: ["If you feel yourself twisting to finish the rep, the weight's too heavy — come down a notch.", "Keep it smooth, no jerking."],
    addedOn: "2026-08-29",
  },
  {
    slug: "single-leg-glute-bridge",
    name: "Single-Leg Glute Bridge",
    subtitle: "The harder version of one you know well",
    trains: ["Glutes", "Hamstrings", "Core"],
    equipment: "Bench (or floor)",
    aliases: ["single-leg glute bridge", "single leg glute bridge"],
    images: [],
    why:
      "Same movement as the Glute Bridge you've done for two months — one leg at a time raises the demand without needing any extra load. Good for the glutes, good for balance, and it keeps building the muscle that protects your knee and back.",
    steps: [
      "Shoulders resting on a bench, one foot flat on the floor, the other leg held up, knee bent.",
      "Start with hips low.",
      "Drive through the planted heel and push the hips up until your body's in a straight line.",
      "Squeeze the glute hard at the top for a beat, then lower under control. Complete all reps one side before swapping.",
    ],
    cues: ["Drive through the planted heel.", "Squeeze at the top — hold for a beat.", "Keep the hips level — don't let one side dip."],
    setsReps: "3 × 10–12 each side",
    watchOuts: ["If the hips can't stay level, go back to two legs for a session or two — no rush.", "Full range — all the way up, all the way down."],
    addedOn: "2026-08-29",
  },
  {
    slug: "step-up",
    name: "Step-Up (Low Box)",
    subtitle: "Real-world leg strength",
    trains: ["Quads", "Glutes"],
    equipment: "Low box or step",
    aliases: ["step-up", "step up"],
    images: [],
    why:
      "This is stairs, kerbs, getting in and out of the van — real strength you use every day, and a natural next step from the leg press. Start on the lowest box you can find; height goes up gradually, only as the knee allows.",
    steps: [
      "Stand facing a low box, hands free or lightly holding a rail for balance.",
      "Step up fully with one foot, driving through the heel until you're standing tall on the box.",
      "Step back down under control with the same foot leading.",
      "Complete all reps one side before swapping.",
    ],
    cues: ["Drive through the heel, not the toes.", "Stand tall at the top — don't rush it.", "Control the step down — no dropping."],
    setsReps: "3 × 10–12 each side · lowest box height",
    watchOuts: ["Knee discomfort above 3/10 — drop the box height or swap to Leg Press that session, tell Nick.", "Hold a rail if balance feels off — that's smart, not soft."],
    addedOn: "2026-08-29",
  },
  {
    slug: "seated-arnold-press",
    name: "Seated Arnold Press",
    subtitle: "Shoulder press, different path",
    trains: ["Shoulders", "Triceps"],
    equipment: "Dumbbells · back support",
    aliases: ["arnold press"],
    images: [],
    why:
      "Same overhead strength as the Seated Shoulder Press you know, but the dumbbells rotate as they rise — palms facing you at the bottom, facing forward at the top. That small change works the shoulder through a bit more of its natural range. Back stays supported throughout, same as always.",
    steps: [
      "Back supported, dumbbells at shoulder height, palms facing you.",
      "Press up while rotating your palms to face forward as the dumbbells rise.",
      "Don't slam into lockout — stop just short and control it.",
      "Reverse the rotation on the way back down until palms face you again.",
    ],
    cues: ["Rotate as you press.", "Breathe out as you press.", "Back stays supported, ribs down."],
    setsReps: "3 × 10–12",
    watchOuts: ["Keep it light enough that the rotation stays smooth — this isn't the exercise to chase heavy on.", "Never hold your breath under load."],
    addedOn: "2026-08-29",
  },
  {
    slug: "single-arm-lat-pulldown",
    name: "Single-Arm Lat Pulldown",
    subtitle: "One side at a time",
    trains: ["Back", "Biceps", "Core"],
    equipment: "Cable pulldown, single handle",
    aliases: ["single-arm lat pulldown", "single arm lat pulldown"],
    images: [],
    why:
      "Same pulling pattern as the Lat Pulldown you've been doing for two months, one arm at a time. Like the single-arm row, this adds a stability demand for the core as a side effect — a bonus, not a complication.",
    steps: [
      "Seated tall, one hand on the single handle, arm straight to start.",
      "Pull down to shoulder height, leading with the elbow, resisting the urge to lean or twist.",
      "Control it all the way back up until the arm is straight.",
      "Complete all reps one side before swapping.",
    ],
    cues: ["Pull with the elbow, not the hand.", "Stay square — resist twisting.", "Control it back up — no swinging."],
    setsReps: "3 × 10–12 each side",
    watchOuts: ["Don't yank with the whole body to finish a rep — come down a notch instead.", "Never pull behind the neck."],
    addedOn: "2026-08-29",
  },
  {
    slug: "single-leg-romanian-deadlift",
    name: "Single-Leg Romanian Deadlift (Supported)",
    subtitle: "The next layer on your RDL",
    trains: ["Hamstrings", "Glutes", "Back", "Balance"],
    equipment: "Dumbbells · rail or bench for balance",
    aliases: ["single-leg romanian deadlift", "single leg romanian deadlift", "single-leg rdl"],
    images: [],
    why:
      "Same hip hinge as the Dumbbell Romanian Deadlift you've grooved for two months, now on one leg with a hand on a rail for balance. It's a genuine step up — more hamstring and glute work, more balance demand — but the pattern in your body is already there. That's what two months of the two-leg version bought you.",
    steps: [
      "Stand tall, dumbbell in the opposite hand to your standing leg, other hand lightly on a rail or bench.",
      "Push the hips back as the free leg extends behind you, dumbbell travelling down the front of the standing leg.",
      "Go as far as balance and a hamstring stretch allow, back flat throughout.",
      "Drive the hips forward to stand tall. Complete all reps one side before swapping.",
    ],
    cues: ["Hold the rail — that's smart, not cheating.", "Hips square, don't let them rotate open.", "Feel the hamstring stretch, then drive through."],
    setsReps: "3 × 10–12 each side · start light",
    watchOuts: ["Back stays flat — never round it.", "If balance is genuinely off, go back to the two-leg RDL for a session — no rush.", "Start light and groove it before adding weight."],
    addedOn: "2026-08-29",
  },

  {
    slug: "rotating-dumbbell-bench-press",
    name: "Rotating Dumbbell Bench Press",
    subtitle: "Shoulder-friendly chest press",
    trains: ["Chest", "Front delts", "Triceps"],
    equipment: "Dumbbells · flat bench",
    aliases: ["rotating dumbbell", "rotating db"],
    images: [
      { src: "/moves/rotating-db-press-1.jpg", caption: "Bottom — palms in, elbows tucked" },
      { src: "/moves/rotating-db-press-2.jpg", caption: "Press & rotate" },
      { src: "/moves/rotating-db-press-3.jpg", caption: "Top — palms forward, squeeze" },
    ],
    why:
      "The bottom position is the money. You start with the dumbbells turned in — palms facing each other, elbows tucked to your ribs — which is far kinder to the shoulder than a barbell bench where the elbows flare. As you press up you rotate the palms to face forward and squeeze the chest at the top. Full chest work, happy shoulders. One of the best pressing options for anyone with a cranky shoulder.",
    steps: [
      "Lie flat, dumbbells at the bottom of your chest, palms facing each other, elbows tucked close to your ribs.",
      "Press up and rotate — as the dumbbells rise, turn your palms to face your feet.",
      "At the top, squeeze the chest hard for a beat. Stop a couple of inches short of clashing the dumbbells.",
      "Reverse on the way down — rotate back to palms-in as the elbows return to your sides. 2–3 seconds down, controlled.",
    ],
    cues: ["Turn as you press.", "Elbows to your ribs at the bottom, not out wide.", "Squeeze at the top like you're crushing something between the dumbbells."],
    setsReps: "3 × 8–12 · leave 2–3 reps in the tank",
    watchOuts: ["Don't clash the dumbbells at the top — stop a couple of inches apart.", "Keep the rotation smooth through the whole press, not a wrist-flick at the end."],
    sourceCredit: "Saved from @dickersonross",
    addedOn: "2026-07-23",
  },

  // ── Barry — Session A ──────────────────────────────────────────────
  {
    slug: "sit-to-stand",
    name: "Sit-to-Stand",
    subtitle: "Knee-friendly squat pattern",
    trains: ["Quads", "Glutes"],
    equipment: "High bench or sturdy chair",
    aliases: ["sit-to-stand", "sit to stand", "box squat"],
    images: [],
    why:
      "This is us testing the knee, not thrashing it. Standing up from a high bench takes the deep part of the squat out — the bit that usually bothers a knee — so we groove the movement and let the joint tell us how it feels. Weeks 1–2 it's bodyweight only. If the knee stays comfortable, we lower the bench and add a little load from Week 3. Master this and a proper squat is just a matter of time.",
    steps: [
      "Sit tall on a high bench, feet flat, roughly shoulder-width.",
      "Arms out in front for balance. Lean forward slightly from the hips.",
      "Drive through your heels and stand all the way up. Squeeze the glutes at the top.",
      "Sit back down under control — 2–3 seconds — tapping the bench without flopping onto it.",
    ],
    cues: ["Drive through the heels.", "Chest up, don't collapse forward.", "Control the way down — no flopping."],
    setsReps: "3 × 10–12 · bodyweight (Weeks 1–2)",
    watchOuts: ["Knee discomfort above 3/10 — stop the set and tell Nick.", "Keep the bench high enough that it stays comfortable. Lower it only when the knee's earned it."],
    addedOn: "2026-07-23",
  },
  {
    slug: "seated-chest-press",
    name: "Seated Chest Press (Machine)",
    subtitle: "Supported pressing",
    trains: ["Chest", "Front delts", "Triceps"],
    equipment: "Chest press machine",
    aliases: ["seated chest press", "chest press"],
    images: [],
    why:
      "The machine does the balancing so you can just press — perfect while we build the habit and keep everything shoulder-safe. Back supported, smooth path, no wobble. It lets you push a bit harder without any risk of a dumbbell going wandering.",
    steps: [
      "Set the seat so the handles sit at chest height, not up by your shoulders.",
      "Back flat against the pad, feet planted.",
      "Press out smoothly until the arms are nearly straight — don't lock out hard.",
      "Control it back until you feel a gentle stretch across the chest. Breathe out on the push, in on the return.",
    ],
    cues: ["Smooth out, smooth back.", "Breathe out as you press — never hold your breath.", "Handles at chest height, not shoulders."],
    setsReps: "3 × 10–12 · 2–3 reps in the tank",
    watchOuts: ["Never hold your breath under load — that's the one that matters for the heart.", "Don't slam the weight stack down between reps."],
    addedOn: "2026-07-23",
  },
  {
    slug: "seated-row",
    name: "Seated Row (Machine)",
    subtitle: "Mid-back builder",
    trains: ["Back", "Biceps", "Rear delts"],
    equipment: "Seated row machine",
    aliases: ["seated row", "cable row"],
    images: [],
    why:
      "Balances out all the pressing and pulls your shoulders back where they belong — great for posture and for keeping the shoulder joint healthy. We pull to the ribs and squeeze the shoulder blades together. Simple, safe, and you'll feel it in all the right places.",
    steps: [
      "Chest up against the pad, slight bend in the knees.",
      "Grab the handles, arms straight to start, shoulders relaxed forward.",
      "Pull to your ribs, leading with the elbows and squeezing the shoulder blades together.",
      "Control it back out until the arms are straight again — don't let it yank you forward.",
    ],
    cues: ["Chest up, pull to your ribs.", "Squeeze the shoulder blades at the end.", "Control it back — don't get pulled forward."],
    setsReps: "3 × 10–12",
    watchOuts: ["Don't heave with the lower back — the arms and mid-back do the work.", "Keep it smooth, no jerking."],
    addedOn: "2026-07-23",
  },
  {
    slug: "glute-bridge",
    name: "Glute Bridge",
    subtitle: "Hip & posterior chain",
    trains: ["Glutes", "Hamstrings"],
    equipment: "Bench · (plate optional)",
    aliases: ["glute bridge", "hip thrust"],
    images: [],
    why:
      "This builds the muscle that protects your knee and your back — the glutes. Strong hips take the strain off everything else. Bodyweight to start; once 12 reps feels easy, we rest a plate across the hips to keep it progressing.",
    steps: [
      "Shoulders resting on a bench, feet flat on the floor, knees bent.",
      "Start with hips low.",
      "Drive through the heels and push the hips up until your body's in a straight line from knees to shoulders.",
      "Squeeze the glutes hard at the top for a beat, then lower under control.",
    ],
    cues: ["Drive through the heels.", "Squeeze the glutes at the top — hold for a beat.", "Ribs down, don't arch the lower back."],
    setsReps: "3 × 10–12 · add a plate when it's easy",
    watchOuts: ["Push the hips up with the glutes, not by arching the lower back.", "Full range — all the way up, all the way down."],
    addedOn: "2026-07-23",
  },

  // ── Barry — Session B ──────────────────────────────────────────────
  {
    slug: "leg-press",
    name: "Leg Press (Machine)",
    subtitle: "Knee-spared leg strength",
    trains: ["Quads", "Glutes", "Hamstrings"],
    equipment: "Leg press machine",
    aliases: ["leg press"],
    images: [],
    why:
      "A big leg movement with the back fully supported and no balance required — ideal while we're still listening to the knee. Feet high on the plate shifts the work toward the glutes and hamstrings and spares the knee. Weeks 1–2 it's the lightest setting to learn the groove; real loading comes Week 3 if the knee's stayed green.",
    steps: [
      "Sit back, back and head against the pad, feet high on the plate about shoulder-width.",
      "Release the safeties and lower the platform only as far as stays comfortable — no deeper.",
      "Drive through the heels to press back up, without locking the knees out hard at the top.",
      "Control the descent every rep — 2–3 seconds down.",
    ],
    cues: ["Feet high on the plate — spare the knee.", "Only as deep as stays comfortable.", "Drive through the heels, soft knees at the top."],
    setsReps: "3 × 10–12 · lightest setting (Weeks 1–2)",
    watchOuts: ["Never let the knees cave inward.", "Don't chase depth — comfort first while the knee's settling.", "Knee pain above 3/10 — stop and tell Nick."],
    addedOn: "2026-07-23",
  },
  {
    slug: "seated-shoulder-press",
    name: "Seated Shoulder Press",
    subtitle: "Supported overhead press",
    trains: ["Shoulders", "Triceps"],
    equipment: "Machine or dumbbells · back support",
    aliases: ["seated shoulder press", "shoulder press", "overhead press"],
    images: [],
    why:
      "Overhead strength with the back supported so there's no strain on the lower back. Smooth and controlled — we're building capable shoulders, not testing your ego. Great for everyday strength: lifting things onto shelves, carrying, all of it.",
    steps: [
      "Back supported against the pad, handles or dumbbells at shoulder height.",
      "Press smoothly overhead until the arms are nearly straight.",
      "Don't slam into lockout — stop just short and control it.",
      "Lower back to shoulder height under control. Breathe out on the press.",
    ],
    cues: ["Press smooth — no slamming at the top.", "Breathe out as you press.", "Back stays supported, ribs down."],
    setsReps: "3 × 10–12",
    watchOuts: ["Keep it light enough that form stays clean — shoulders are easy to overload.", "Never hold your breath under load."],
    addedOn: "2026-07-23",
  },
  {
    slug: "lat-pulldown",
    name: "Lat Pulldown",
    subtitle: "Vertical pull",
    trains: ["Back", "Biceps"],
    equipment: "Lat pulldown machine",
    aliases: ["lat pulldown", "pulldown"],
    images: [],
    why:
      "Builds the width of the back and the pulling strength that a lifetime of desks and phones erodes. Pull to the top of the chest, control it back up. Another one that's great for the posture and the shoulders.",
    steps: [
      "Secure your thighs under the pads. Grab the bar a bit wider than shoulder-width.",
      "Start with arms straight, lean back very slightly.",
      "Pull the bar to the top of your chest, leading with the elbows.",
      "Control it all the way back up until the arms are straight — don't let it snap back.",
    ],
    cues: ["Pull to the top of your chest.", "Lead with the elbows, not the hands.", "Control it back up — no swinging."],
    setsReps: "3 × 10–12",
    watchOuts: ["Don't yank with the whole body — a small lean back is fine, heaving isn't.", "Never pull behind the neck."],
    addedOn: "2026-07-23",
  },
  {
    slug: "dumbbell-romanian-deadlift",
    name: "Dumbbell Romanian Deadlift",
    subtitle: "Knee-friendly hip hinge",
    trains: ["Hamstrings", "Glutes", "Back"],
    equipment: "Dumbbells",
    aliases: ["romanian deadlift", "rdl", "dumbbell romanian"],
    images: [],
    why:
      "The best knee-friendly leg exercise there is — the knees barely bend, it's all hips. You'll feel it right in the hamstrings and glutes. It also teaches the hip hinge, which is how you should be picking things up off the floor for the rest of your life. We'll groove this one together first before you do it alone.",
    steps: [
      "Stand tall holding dumbbells in front of your thighs, soft bend in the knees.",
      "Push the hips back — like closing a car door with your backside — letting the dumbbells travel down the front of your legs.",
      "Go as far as you feel a stretch in the hamstrings, back flat throughout, dumbbells close to the legs.",
      "Drive the hips forward to stand tall and squeeze the glutes. Slow and controlled.",
    ],
    cues: ["Push the hips back, don't squat down.", "Dumbbells stay close to your legs.", "Feel the hamstrings stretch, then drive the hips through."],
    setsReps: "3 × 10–12 · start light",
    watchOuts: ["Back stays flat — never round it.", "This is a hip hinge, not a squat: the knees barely move.", "Start light and groove it before adding weight."],
    addedOn: "2026-07-23",
  },
];

export function getMovement(slug: string): Movement | undefined {
  return MOVEMENTS.find((m) => m.slug === slug);
}

// Resolve a programme's exercise name (e.g. "Seated Chest Press (machine)") to
// its movement card, matching on the movement's aliases.
export function movementForExercise(exerciseName: string): Movement | undefined {
  const n = exerciseName.toLowerCase();
  return MOVEMENTS.find((m) => m.aliases.some((a) => n.includes(a)));
}
