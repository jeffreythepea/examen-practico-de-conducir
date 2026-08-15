# Final Gold-Glyph Replacement Asset Freeze

**Frozen:** 2026-08-15
**Reviewer:** Jeffrey Pease
**Approval:** Both revised prototypes approved in-thread with “good use these.”
**Provenance:** AI-generated illustrative scene edits and car cutouts, assembled
deterministically with the checked prototype render scripts under
`tmp/final-glyph-replacement/`.

## Approved production files

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `assets/driving/regular-u-turn-v1.mp4` | 1,157,192 | `059f7c566ad5cc1e72d47c4f9f312deb37cc7b0be23023398ceed43e9be54b66` |
| `assets/driving/regular-u-turn-v1-poster.webp` | 545,000 | `fcf2c93c8a82c6374b1d59892d1239842399014411e5af82ff99cdde8699bd82` |
| `assets/driving/join-traffic-merge-v1.mp4` | 991,411 | `5dc8133a06912d9d8cb968130bcbb42c809d59febf401b08e90dbb0aa6a715e1` |
| `assets/driving/join-traffic-merge-v1-poster.webp` | 415,636 | `45a82d0bcc63c3baae09f9fa0d596e3218303917e69b1521356b8842920d7038` |

## Measured media properties

| Clip | Dimensions | Duration | Frames | Codec | Pixel format | Fast start |
| --- | --- | ---: | ---: | --- | --- | --- |
| `regular-u-turn-v1` | 1536×1024 | 6.000 s | 180 | H.264 | `yuv420p` | `moov` at byte 36, before `mdat` at 2,968 |
| `join-traffic-merge-v1` | 1536×1024 | 5.000 s | 150 | H.264 | `yuv420p` | `moov` at byte 36, before `mdat` at 2,656 |

Both MP4s contain one silent video stream. Both posters are 1536×1024 WebP
files extracted from the decoded first frame. Poster-to-first-frame SSIM is
0.9882 for the U-turn and 0.9877 for join traffic.

## Review corrections incorporated

- The U-turn clean plate reconstructs the dashed center line beneath the
  starting car.
- The returning U-turn uses a separate front-facing car sprite so the front
  remains larger than the rear when approaching the camera.
- The join-traffic sprite stays flat against the road plane instead of
  rotating with its lateral translation.
- The join-traffic path remains wholly inside the right-hand travel lane and
  never crosses the dashed center line.

## Image-edit prompts

The built-in image-editing workflow was used to remove each stationary learner
car from its scene while preserving road geometry, then to isolate matching
transparent car sprites. The U-turn return sprite used the approved blue car
as its identity reference and requested a 180-degree, nose-toward-camera aerial
view with the front naturally larger than the rear. No provider credential or
generated prompt payload is shipped in the runtime package.
