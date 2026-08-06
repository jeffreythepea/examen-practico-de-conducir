# ElevenLabs expiring-credit experiment

Status: the API-key permissions were corrected on 2026-08-05. Jeffrey approved
George, Matilda, and Eric after listening review, and the resumable generator
published all five voices successfully: 1,140 integrity-checked MP3 variants,
38.21 MiB of audio. The run reused 456 recordings and added 684; the account
reported 18,327 credits remaining afterward.

This is an isolated experiment plan. Generated audition and ambience files stay
under the ignored `tmp/` tree until Jeffrey reviews them. They must not be added
to the production audio manifest merely because they were generated.

## 1. Additional examiner voice audition — complete

The audition compared three natural voices against Roger and Sarah. Jeffrey
approved all three, so the production run added George (`JBFqnCBsd6RMkjVDRZzb`),
Matilda (`XrExE9yKIg1WjnnlVkGX`), and Eric (`cjVigY5qzO86Huf0OWal`). The
recovery-safe generator published 228 variants per voice, across 76 phrasings
and three speeds, without fabricating or partially publishing manifest entries.

At the current catalog size, the third voice contains 2,149 Spanish characters
per speed, approximately 6,447 billed characters before any model or plan
multiplier.

## 2. Hard-mode audition — generated for review

The audition runner now accepts an isolated 1.15x speed and generated the same
eight representative commands for all five selected voices: 40 nonempty MP3s,
1,100,559 bytes total. Preserve every Spanish command verbatim. The possible
hard mode changes delivery only; it never changes accepted results, command
IDs, phrasing IDs, or the three production speeds. Nothing enters runtime until
Jeffrey reviews it and separately approves a product design.

## 3. Road and cabin ambience — generated for review

The Sound Effects v2 endpoint generated one isolated, review-only seamless
12-second variation of each prompt:

- `Subtle interior ambience of a compact manual car driving steadily on a quiet Spanish city street, soft engine hum and tire noise, no speech, no music, no horn, no siren, seamless loop.`
- `Subtle interior ambience of a compact manual car driving steadily on a rural Spanish road, gentle engine and tire noise with faint wind, no speech, no music, no horn, no siren, seamless loop.`

Keep the files out of runtime until headphone and iPad-speaker review establishes
that commands remain easy to understand. If retained, ambience needs its own
setup control and must never affect scoring or audio-failure handling.

The current ElevenLabs API documentation allows 0.5–30 second sound effects and
supports seamless looping with `eleven_text_to_sound_v2`. Both outputs are
12.04-second 44.1 kHz stereo MP3s, 193,141 bytes each. Although the current API
product guide quotes 11 credits per explicitly timed second, the account counter
increased by 542 credits for these two requests. The files remain under ignored
`tmp/audio-ambience/` storage and outside the production manifest.

## 4. Image and video assessment

ElevenLabs Image & Video is beta. It can generate or refine stills and create
video from prompts or reference frames, but it does not offer a material
advantage for this game right now:

- Existing road photographs and vehicle-control images already support precise,
  audited response targets.
- The moving-road experiment deliberately keeps interaction geometry in code;
  a generated video would make target alignment, pausing, reduced motion,
  offline packaging, and deterministic testing harder.
- New still images are useful only when an actual lesson exposes a missing road
  scene. They can be generated then with the established image workflow and
  audited against the required interaction.

Recommendation: spend expiring credits on voice and ambience auditions, not
image or video generation.

## Official references checked 2026-08-05

- Sound Effects overview: https://elevenlabs.io/docs/overview/capabilities/sound-effects
- Sound Effects API: https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert
- Image & Video overview: https://elevenlabs.io/docs/overview/capabilities/image-video
- API authentication: https://elevenlabs.io/docs/api-reference/authentication
