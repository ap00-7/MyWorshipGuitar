# Chord Library Accuracy Audit

## Scope and result

- The complete inline Chord Library inventory in `src/v5.tsx` was audited: **148 unique definitions**.
- **148 / 148** shapes were checked against standard tuning, their declared chord formula, string state, fret offset, and finger-state consistency. Automated checks now cover the complete inventory.
- **35 definitions were corrected**: 9 had sounding-note/voicing mismatches, finger assignments were corrected in affected shapes, and barre display metadata was clarified where needed.
- **11 definitions remain flagged for manual fingering/playability review**; their pitches passed, but a repeated finger spans separated strings and an authoritative comfortable fingering was not inferred.
- Chord-name count by category:
- Major: 12
- Minor: 12
- Dominant 7th: 12
- Major 7th: 12
- Add9: 5
- Suspended 2nd: 4
- Suspended 4th / aliases: 17
- Minor 7th: 12
- Slash chords: 2
- Sixth / minor sixth: 24
- Ninth: 12
- Diminished: 12
- Augmented: 12
- The diagram library contains no 11th or 13th voicing definitions. These chord symbols may be accepted by progression parsing, but they have no library shape to audit.
- No database or song-progressions were changed.

## Verification method and references

For every shape, string positions are interpreted low-to-high as E-A-D-G-B-E, with each fret adding one semitone. Resulting pitches are compared with the chord's theoretical intervals; slash-chord bass notes are checked from the lowest sounding string. Fifths may be omitted where the voicing still contains its root and defining quality/extension tones. Muted strings contribute no pitch.

Formula checks use established interval definitions: major (0, 4, 7), minor (0, 3, 7), dominant 7 (0, 4, 7, 10), major 7 (0, 4, 7, 11), minor 7 (0, 3, 7, 10), sus2 (0, 2, 7), sus4 (0, 5, 7), add9 (0, 2, 4, 7), diminished (0, 3, 6; diminished seventh where listed), augmented (0, 4, 8), 6th (0, 4, 7, 9; minor 6th uses 0, 3, 7, 9), and dominant 9 (0, 2, 4, 7, 10).

- Fender, [How to Tune a Guitar](https://www.fender.com/articles/techniques/how-to-tune-a-guitar), for standard guitar tuning.
- MusicTheory.net, [Lessons](https://www.musictheory.net/lessons), for interval/chord construction background.
- Per-definition verification is the explicit tuning-plus-interval calculation above, not a claim that every voicing duplicates one reference chart. Alternative playable voicings are retained when they sound the named chord.

## Confirmed issue details

The nine incorrect sounding shapes corrected were **Bb9, Bbdim, Bb+, D+, Gb6, Gbmaj7, Gbsus, G9, and Gm6**. Their previous pitches either contained tones outside the named chord or omitted required quality/extension tones. Corrections were selected by deriving the target tones and verifying each replacement string/fret against E-A-D-G-B-E.

The renderer previously assigned the orange `fretted` marker style to every fretted string in the indicator row above the board, as well as placing the actual note on the fretboard. The indicator row now renders only X, O, or a blank slot; numbered orange circles are confined to fretboard fret intersections. Barre lines now use the active string span and are layered below the numbered markers.

Finger assignments are checked to ensure muted/open strings use X/0 and a finger number is not assigned to different fret values. Remaining separated-string repeated-finger cases are listed as requiring manual comfort/playability review rather than asserted as verified.

## Complete inventory and per-definition audit

String order in every vector is **low E, A, D, G, B, high E**. The indicator vector uses **X** for muted, **O** for open, and **-** for a fretted string (the numbered marker appears at the fret below). In "Before", fret and finger vectors are the pre-audit definitions when changed.

| Chord | Before (frets / fingers) | Corrected frets | Indicators | Fingers | Declared chord tones | Audit result |
|---|---|---|---|---|---|---|
| A | Same as current | -1 0 2 2 2 0 | X O - - - O | x 0 2 2 2 0 | A C# E | Confirmed by note/fret calculation |
| Am | Same as current | -1 0 2 2 1 0 | X O - - - O | x 0 2 3 1 0 | A C E | Confirmed by note/fret calculation |
| A7 | -1 0 2 0 2 0 / x 0 2 0 2 0 | -1 0 2 0 2 0 | X O - O - O | x 0 1 0 2 0 | A C# E G | Corrected: fingering/playability |
| B7 | -1 2 1 2 0 2 / x 2 1 2 0 2 | -1 2 1 2 0 2 | X - - - O - | x 2 1 3 0 4 | B D# F# A | Corrected: fingering/playability |
| C | Same as current | -1 3 2 0 1 0 | X - - O - O | x 3 2 0 1 0 | C E G | Confirmed by note/fret calculation |
| C7 | Same as current | -1 3 2 3 1 0 | X - - - - O | x 3 2 4 1 0 | C E G Bb | Confirmed by note/fret calculation |
| Cmaj7 | Same as current | -1 3 2 0 0 0 | X - - O O O | x 3 2 0 0 0 | C E G B | Confirmed by note/fret calculation |
| Cadd9 | -1 3 2 0 3 3 / x 3 2 0 3 4 | -1 3 2 0 3 3 | X - - O - - | x 3 2 0 4 4 | C D E G | Corrected: fingering/playability |
| Csus2 | Same as current | -1 3 0 0 1 3 | X - O O - - | x 3 0 0 1 4 | C D G | Confirmed by note/fret calculation |
| Csus4 | Same as current | -1 3 3 0 1 1 | X - - O - - | x 3 4 0 1 1 | C F G | Confirmed by note/fret calculation |
| D | -1 -1 0 2 3 2 / x x 0 2 3 2 | -1 -1 0 2 3 2 | X X O - - - | x x 0 1 3 2 | D F# A | Corrected: fingering/playability |
| Dm | Same as current | -1 -1 0 2 3 1 | X X O - - - | x x 0 2 3 1 | D F A | Confirmed by note/fret calculation |
| D7 | -1 -1 0 2 1 2 / x x 0 2 1 2 | -1 -1 0 2 1 2 | X X O - - - | x x 0 3 1 2 | D F# A C | Corrected: fingering/playability |
| Dm7 | Same as current | -1 -1 0 2 1 1 | X X O - - - | x x 0 2 1 1 | D F A C | Confirmed by note/fret calculation |
| Dmaj7 | Same as current | -1 -1 0 2 2 2 | X X O - - - | x x 0 2 2 2 | D F# A C# | Confirmed by note/fret calculation |
| Dsus2 | Same as current | -1 -1 0 2 3 0 | X X O - - O | x x 0 2 3 0 | D E A | Confirmed by note/fret calculation |
| Dsus4 | Same as current | -1 -1 0 2 3 3 | X X O - - - | x x 0 1 2 3 | D G A | Confirmed by note/fret calculation |
| E | Same as current | 0 2 2 1 0 0 | O - - - O O | 0 2 2 1 0 0 | E G# B | Confirmed by note/fret calculation |
| Em | Same as current | 0 2 2 0 0 0 | O - - O O O | 0 2 2 0 0 0 | E G B | Confirmed by note/fret calculation |
| E7 | Same as current | 0 2 0 1 0 0 | O - O - O O | 0 2 0 1 0 0 | E G# B D | Confirmed by note/fret calculation |
| Em7 | Same as current | 0 2 0 0 0 0 | O - O O O O | 0 2 0 0 0 0 | E G B D | Confirmed by note/fret calculation |
| Eadd9 | 0 2 2 1 0 2 / 0 2 2 1 0 2 | 0 2 2 1 0 2 | O - - - O - | 0 2 3 1 0 4 | E G# B F# | Corrected: fingering/playability |
| Esus4 | Same as current | 0 2 2 2 0 0 | O - - - O O | 0 2 2 2 0 0 | E A B | Confirmed by note/fret calculation |
| F | Same as current | 1 3 3 2 1 1 | - - - - - - | 1 3 4 2 1 1 | F A C | Confirmed by note/fret calculation |
| Fmaj7 | Same as current | -1 -1 3 2 1 0 | X X - - - O | x x 3 2 1 0 | C E F A | Confirmed by note/fret calculation |
| Fadd9 | 1 3 3 2 1 3 / 1 3 4 2 1 4 | -1 -1 3 2 1 3 | X X - - - - | x x 3 2 1 4 | A C F G | Corrected: fingering/playability |
| G | 3 2 0 0 0 3 / 3 2 0 0 0 3 | 3 2 0 0 0 3 | - - O O O - | 3 2 0 0 0 4 | G B D | Corrected: fingering/playability |
| G7 | Same as current | 3 2 0 0 0 1 | - - O O O - | 3 2 0 0 0 1 | G B D F | Confirmed by note/fret calculation |
| Gmaj7 | 2 2 0 0 0 2 / 2 2 0 0 0 2 | 3 -1 0 0 0 2 | - X O O O - | 2 x 0 0 0 1 | G B D F# | Corrected: fingering/playability |
| Gsus2 | 3 0 0 0 3 3 / 3 0 0 0 3 3 | 3 0 0 0 3 3 | - O O O - - | 3 0 0 0 4 4 | G A D | Corrected: fingering/playability |
| Gsus4 | Same as current | 3 3 0 0 1 3 | - - O O - - | 3 3 0 0 1 4 | G C D | Confirmed by note/fret calculation |
| Am7 | Same as current | -1 0 2 0 1 0 | X O - O - O | x 0 2 0 1 0 | A C E G | Confirmed by note/fret calculation |
| Asus2 | Same as current | -1 0 2 2 0 0 | X O - - O O | x 0 2 2 0 0 | A B E | Confirmed by note/fret calculation |
| Asus4 | Same as current | -1 0 2 2 3 0 | X O - - - O | x 0 2 2 3 0 | A D E | Confirmed by note/fret calculation |
| Dadd9 | 2 -1 0 2 3 0 / 2 x 0 2 3 0 | 2 -1 0 2 3 0 | - X O - - O | 1 x 0 2 3 0 | D F# A E | Corrected: fingering/playability |
| Gadd9 | Same as current | 3 2 0 2 0 3 | - - O - O - | 3 2 0 1 0 4 | A B D G | Confirmed by note/fret calculation |
| F# | Same as current | 2 4 4 3 2 2 | - - - - - - | 1 3 4 2 1 1 | A# C# F# | Confirmed by note/fret calculation |
| F#m | Same as current | 2 4 4 2 2 2 | - - - - - - | 1 3 4 1 1 1 | A C# F# | Confirmed by note/fret calculation |
| C#m | -1 4 6 6 5 4 / x 1 3 4 2 1 | -1 4 6 6 5 4 | X - - - - - | x 1 3 4 2 1 | C# E G# | Corrected: barre representation |
| G#m | 4 6 6 4 4 4 / 1 3 4 1 1 1 | 4 6 6 4 4 4 | - - - - - - | 1 3 4 1 1 1 | G# B D# | Corrected: barre representation |
| Bb | Same as current | 1 1 3 3 3 1 | - - - - - - | 1 1 3 3 3 1 | Bb D F | Confirmed by note/fret calculation |
| Bbm | Same as current | 1 1 3 3 2 1 | - - - - - - | 1 1 3 4 2 1 | Bb Db F | Confirmed by note/fret calculation |
| Bm | Same as current | -1 2 4 4 3 2 | X - - - - - | x 1 3 4 2 1 | B D F# | Confirmed by note/fret calculation |
| Cm | Same as current | -1 3 5 5 4 3 | X - - - - - | x 1 3 4 2 1 | C Eb G | Confirmed by note/fret calculation |
| Fm | Same as current | 1 3 3 1 1 1 | - - - - - - | 1 3 4 1 1 1 | F Ab C | Confirmed by note/fret calculation |
| Gm | Same as current | 3 5 5 3 3 3 | - - - - - - | 1 3 4 1 1 1 | G Bb D | Confirmed by note/fret calculation |
| D/F# | 2 -1 0 2 3 2 / 2 x 0 1 3 1 | 2 -1 0 2 3 2 | - X O - - - | 2 x 0 1 3 4 | D F# A | Corrected: fingering/playability |
| G/B | Same as current | -1 2 0 0 0 3 | X - O O O - | x 2 0 0 0 3 | G B D | Confirmed by note/fret calculation |
| Ab | Same as current | 4 6 6 5 4 4 | - - - - - - | 1 3 4 2 1 1 | Ab C Eb | Confirmed by note/fret calculation |
| Ab6 | Same as current | 4 3 3 5 4 4 | - - - - - - | 2 1 1 3 2 2 | Ab C Eb F | Pitch-checked; manual fingering review needed |
| Ab7 | Same as current | 4 3 4 5 4 4 | - - - - - - | 2 1 2 3 2 2 | Ab C Eb Gb | Pitch-checked; manual fingering review needed |
| Ab9 | Same as current | 4 3 4 3 4 4 | - - - - - - | 2 1 3 1 4 4 | Ab C Eb Gb Bb | Pitch-checked; manual fingering review needed |
| G#m6 | Same as current | 4 6 6 4 6 4 | - - - - - - | 1 3 4 1 4 1 | G# B D# F | Pitch-checked; manual fingering review needed |
| G#m7 | Same as current | 4 6 4 4 4 4 | - - - - - - | 1 3 1 1 1 1 | G# B D# F# | Confirmed by note/fret calculation |
| Abmaj7 | Same as current | 4 6 5 5 4 4 | - - - - - - | 1 3 2 2 1 1 | Ab C Eb G | Confirmed by note/fret calculation |
| G#dim | Same as current | 4 5 6 4 6 4 | - - - - - - | 1 2 3 1 4 1 | G# B D F | Confirmed by note/fret calculation |
| Ab+ | 4 3 2 1 1 0 / 3 2 1 1 1 0 | 4 3 2 1 1 0 | - - - - - O | 4 3 2 1 1 0 | Ab C E | Corrected: fingering/playability |
| Absus | Same as current | 4 6 6 6 4 4 | - - - - - - | 1 3 4 4 1 1 | Ab Db Eb | Confirmed by note/fret calculation |
| A6 | Same as current | -1 0 2 2 2 2 | X O - - - - | x 0 1 1 1 1 | A C# E F# | Confirmed by note/fret calculation |
| A9 | -1 0 2 4 2 3 / x 0 1 3 1 2 | -1 0 2 4 2 3 | X O - - - - | x 0 1 3 2 4 | A C# E G B | Corrected: fingering/playability |
| Am6 | Same as current | -1 0 2 2 1 2 | X O - - - - | x 0 2 3 1 4 | A C E F# | Confirmed by note/fret calculation |
| Amaj7 | Same as current | -1 0 2 1 2 0 | X O - - - O | x 0 2 1 3 0 | A C# E G# | Confirmed by note/fret calculation |
| Adim | Same as current | -1 0 1 2 1 -1 | X O - - - X | x 0 1 3 2 x | A C Eb Gb | Confirmed by note/fret calculation |
| A+ | -1 0 3 2 2 1 / x 0 3 2 1 1 | -1 0 3 2 2 1 | X O - - - - | x 0 4 3 2 1 | A C# F | Corrected: fingering/playability |
| Asus | Same as current | -1 0 2 2 3 0 | X O - - - O | x 0 1 1 2 0 | A D E | Confirmed by note/fret calculation |
| Bb6 | Same as current | 1 1 3 3 3 3 | - - - - - - | 1 1 2 3 3 3 | Bb D F G | Confirmed by note/fret calculation |
| Bb7 | Same as current | 1 1 3 1 3 1 | - - - - - - | 1 1 3 1 4 1 | Bb D F Ab | Confirmed by note/fret calculation |
| Bb9 | 1 1 3 1 1 3 / 1 1 3 1 1 4 | -1 1 0 1 1 1 | X - O - - - | x 1 0 2 3 4 | Bb D F Ab C | Corrected: sounding chord tones/voicing |
| Bbm6 | Same as current | 1 1 3 3 2 3 | - - - - - - | 1 1 3 4 2 4 | Bb Db F G | Pitch-checked; manual fingering review needed |
| Bbm7 | Same as current | 1 1 3 1 2 1 | - - - - - - | 1 1 3 1 2 1 | Bb Db F Ab | Confirmed by note/fret calculation |
| Bbmaj7 | Same as current | 1 1 3 2 3 1 | - - - - - - | 1 1 3 2 4 1 | Bb D F A | Confirmed by note/fret calculation |
| Bbdim | 1 2 3 1 3 1 / 1 2 3 1 4 1 | -1 1 2 0 2 3 | X - - O - - | x 1 2 0 3 4 | Bb Db E G | Corrected: sounding chord tones/voicing |
| Bb+ | 1 0 3 2 2 1 / 1 0 3 2 2 1 | -1 1 0 3 3 2 | X - O - - - | x 1 0 3 4 2 | Bb D F# | Corrected: sounding chord tones/voicing |
| Bbsus | Same as current | 1 1 3 3 4 1 | - - - - - - | 1 1 2 3 4 1 | Bb Eb F | Confirmed by note/fret calculation |
| B | Same as current | -1 2 4 4 4 2 | X - - - - - | x 1 3 4 4 1 | B D# F# | Confirmed by note/fret calculation |
| B6 | Same as current | 2 2 4 4 4 4 | - - - - - - | 1 1 3 3 3 3 | B D# F# G# | Confirmed by note/fret calculation |
| B9 | Same as current | 2 2 1 2 2 2 | - - - - - - | 2 3 1 4 4 4 | B D# F# A C# | Confirmed by note/fret calculation |
| Bm6 | Same as current | -1 2 4 4 3 4 | X - - - - - | x 1 3 4 2 4 | B D F# G# | Pitch-checked; manual fingering review needed |
| Bm7 | Same as current | -1 2 4 2 3 2 | X - - - - - | x 1 3 1 2 1 | B D F# A | Confirmed by note/fret calculation |
| Bmaj7 | Same as current | -1 2 4 3 4 2 | X - - - - - | x 1 3 2 4 1 | B D# F# A# | Confirmed by note/fret calculation |
| Bdim | Same as current | -1 2 3 4 3 -1 | X - - - - X | x 1 2 4 3 x | B D F Ab | Confirmed by note/fret calculation |
| B+ | Same as current | -1 2 1 0 0 3 | X - - O O - | x 2 1 0 0 3 | B D# G | Confirmed by note/fret calculation |
| Bsus | Same as current | -1 2 4 4 5 2 | X - - - - - | x 1 3 3 4 1 | B E F# | Confirmed by note/fret calculation |
| C6 | -1 3 2 2 1 0 / x 3 2 1 1 0 | -1 3 2 2 1 0 | X - - - - O | x 3 2 2 1 0 | C E G A | Corrected: fingering/playability |
| C9 | Same as current | -1 3 2 3 3 3 | X - - - - - | x 2 1 3 4 4 | C E G Bb D | Confirmed by note/fret calculation |
| Cm6 | -1 3 1 2 1 3 / x 3 1 2 1 4 | -1 3 1 2 1 3 | X - - - - - | x 3 1 2 1 4 | C Eb G A | Corrected: barre representation |
| Cm7 | Same as current | -1 3 5 3 4 3 | X - - - - - | x 1 3 1 2 1 | C Eb G Bb | Confirmed by note/fret calculation |
| Cdim | -1 3 4 2 4 2 / x 2 3 1 4 1 | -1 3 4 2 4 2 | X - - - - - | x 2 3 1 4 1 | C Eb Gb A | Corrected: barre representation |
| C+ | Same as current | -1 3 2 1 1 0 | X - - - - O | x 3 2 1 1 0 | C E G# | Confirmed by note/fret calculation |
| Csus | Same as current | -1 3 3 0 1 1 | X - - O - - | x 3 4 0 1 1 | C F G | Confirmed by note/fret calculation |
| Db | Same as current | -1 4 6 6 6 4 | X - - - - - | x 1 3 4 4 1 | Db F Ab | Confirmed by note/fret calculation |
| Db6 | Same as current | 4 4 6 6 6 6 | - - - - - - | 1 1 3 3 3 3 | Db F Ab Bb | Confirmed by note/fret calculation |
| Db7 | Same as current | -1 4 6 4 6 4 | X - - - - - | x 1 3 1 4 1 | Db F Ab Cb | Confirmed by note/fret calculation |
| Db9 | Same as current | 4 4 3 4 4 4 | - - - - - - | 2 3 1 4 4 4 | Db F Ab Cb Eb | Confirmed by note/fret calculation |
| C#m6 | Same as current | -1 4 6 6 5 6 | X - - - - - | x 1 3 4 2 4 | C# E G# A# | Pitch-checked; manual fingering review needed |
| C#m7 | Same as current | -1 4 6 4 5 4 | X - - - - - | x 1 3 1 2 1 | C# E G# B | Confirmed by note/fret calculation |
| Dbmaj7 | Same as current | -1 4 6 5 6 4 | X - - - - - | x 1 3 2 4 1 | Db F Ab C | Confirmed by note/fret calculation |
| C#dim | -1 4 5 3 5 3 / x 2 3 1 4 1 | -1 4 5 3 5 3 | X - - - - - | x 2 3 1 4 1 | C# E G Bb | Corrected: barre representation |
| Db+ | -1 4 3 2 2 1 / x 3 2 1 1 1 | -1 -1 3 2 2 1 | X X - - - - | x x 4 3 2 1 | Db F A | Corrected: fingering/playability |
| Dbsus | Same as current | -1 4 6 6 7 4 | X - - - - - | x 1 3 3 4 1 | Db Gb Ab | Confirmed by note/fret calculation |
| D6 | Same as current | -1 -1 0 2 0 2 | X X O - O - | x x 0 1 0 2 | D F# A B | Confirmed by note/fret calculation |
| D9 | Same as current | -1 5 4 5 5 5 | X - - - - - | x 2 1 3 4 4 | D F# A C E | Confirmed by note/fret calculation |
| Dm6 | Same as current | -1 -1 0 2 0 1 | X X O - O - | x x 0 2 0 1 | D F A B | Confirmed by note/fret calculation |
| Ddim | Same as current | -1 -1 0 1 0 1 | X X O - O - | x x 0 1 0 2 | D F Ab B | Confirmed by note/fret calculation |
| D+ | -1 -1 0 3 2 2 / x x 0 3 1 2 | -1 -1 0 3 3 2 | X X O - - - | x x 0 2 3 1 | D F# A# | Corrected: sounding chord tones/voicing |
| Dsus | Same as current | -1 -1 0 2 3 3 | X X O - - - | x x 0 1 2 3 | D G A | Confirmed by note/fret calculation |
| Eb | Same as current | -1 6 8 8 8 6 | X - - - - - | x 1 3 4 4 1 | Eb G Bb | Confirmed by note/fret calculation |
| Ebm | Same as current | -1 6 8 8 7 6 | X - - - - - | x 1 3 4 2 1 | Eb Gb Bb | Confirmed by note/fret calculation |
| Eb6 | Same as current | 6 6 8 8 8 8 | - - - - - - | 1 1 3 3 3 3 | Eb G Bb C | Confirmed by note/fret calculation |
| Eb7 | Same as current | -1 6 8 6 8 6 | X - - - - - | x 1 3 1 4 1 | Eb G Bb Db | Confirmed by note/fret calculation |
| Eb9 | Same as current | 6 6 5 6 6 6 | - - - - - - | 2 3 1 4 4 4 | Eb G Bb Db F | Confirmed by note/fret calculation |
| Ebm6 | Same as current | -1 6 8 8 7 8 | X - - - - - | x 1 3 4 2 4 | Eb Gb Bb C | Pitch-checked; manual fingering review needed |
| Ebm7 | Same as current | -1 6 8 6 7 6 | X - - - - - | x 1 3 1 2 1 | Eb Gb Bb Db | Confirmed by note/fret calculation |
| Ebmaj7 | Same as current | -1 6 8 7 8 6 | X - - - - - | x 1 3 2 4 1 | Eb G Bb D | Confirmed by note/fret calculation |
| Ebdim | -1 6 7 5 7 5 / x 2 3 1 4 1 | -1 6 7 5 7 5 | X - - - - - | x 2 3 1 4 1 | Eb Gb A C | Corrected: barre representation |
| Eb+ | -1 6 5 4 4 3 / x 3 2 1 1 1 | -1 -1 5 4 4 3 | X X - - - - | x x 4 3 2 1 | Eb G B | Corrected: fingering/playability |
| Ebsus | Same as current | -1 6 8 8 9 6 | X - - - - - | x 1 3 3 4 1 | Eb Ab Bb | Confirmed by note/fret calculation |
| E6 | Same as current | 0 2 2 1 2 0 | O - - - - O | 0 2 2 1 3 0 | E G# B C# | Confirmed by note/fret calculation |
| E9 | Same as current | 0 2 0 1 0 2 | O - O - O - | 0 2 0 1 0 3 | E G# B D F# | Confirmed by note/fret calculation |
| Em6 | Same as current | 0 2 2 0 2 0 | O - - O - O | 0 2 3 0 4 0 | E G B C# | Confirmed by note/fret calculation |
| Emaj7 | Same as current | 0 2 1 1 0 0 | O - - - O O | 0 3 1 2 0 0 | E G# B D# | Confirmed by note/fret calculation |
| Edim | Same as current | 0 1 2 0 2 0 | O - - O - O | 0 1 2 0 3 0 | E G Bb Db | Confirmed by note/fret calculation |
| E+ | Same as current | 0 3 2 1 1 0 | O - - - - O | 0 3 2 1 1 0 | E G# C | Confirmed by note/fret calculation |
| Esus | Same as current | 0 2 2 2 0 0 | O - - - O O | 0 1 1 1 0 0 | E A B | Confirmed by note/fret calculation |
| F6 | Same as current | 1 3 3 2 3 1 | - - - - - - | 1 3 4 2 4 1 | F A C D | Pitch-checked; manual fingering review needed |
| F7 | Same as current | 1 3 1 2 1 1 | - - - - - - | 1 3 1 2 1 1 | F A C Eb | Confirmed by note/fret calculation |
| F9 | Same as current | 1 3 1 2 1 3 | - - - - - - | 1 3 1 2 1 4 | F A C Eb G | Confirmed by note/fret calculation |
| Fm6 | Same as current | 1 3 3 1 3 1 | - - - - - - | 1 3 4 1 4 1 | F Ab C D | Pitch-checked; manual fingering review needed |
| Fm7 | Same as current | 1 3 1 1 1 1 | - - - - - - | 1 3 1 1 1 1 | F Ab C Eb | Confirmed by note/fret calculation |
| Fdim | Same as current | 1 2 3 1 3 1 | - - - - - - | 1 2 3 1 4 1 | F Ab B D | Confirmed by note/fret calculation |
| F+ | 1 0 3 2 2 1 / 1 0 3 2 2 1 | -1 -1 3 2 2 1 | X X - - - - | x x 4 3 2 1 | F A C# | Corrected: fingering/playability |
| Fsus | Same as current | 1 3 3 3 1 1 | - - - - - - | 1 3 4 4 1 1 | F Bb C | Confirmed by note/fret calculation |
| Gb6 | 2 2 4 4 4 4 / 1 1 3 3 3 3 | -1 -1 4 3 4 2 | X X - - - - | x x 3 2 4 1 | Gb Bb Db Eb | Corrected: sounding chord tones/voicing |
| F#7 | Same as current | 2 4 2 3 2 2 | - - - - - - | 1 3 1 2 1 1 | F# A# C# E | Confirmed by note/fret calculation |
| F#9 | Same as current | 2 4 2 3 2 4 | - - - - - - | 1 3 1 2 1 4 | F# A# C# E G# | Confirmed by note/fret calculation |
| F#m6 | Same as current | 2 4 4 2 4 2 | - - - - - - | 1 3 4 1 4 1 | F# A C# D# | Pitch-checked; manual fingering review needed |
| F#m7 | Same as current | 2 4 2 2 2 2 | - - - - - - | 1 3 1 1 1 1 | F# A C# E | Confirmed by note/fret calculation |
| Gbmaj7 | 2 4 3 3 4 2 / 1 3 2 2 4 1 | -1 -1 4 3 2 1 | X X - - - - | x x 4 3 2 1 | Gb Bb Db F | Corrected: sounding chord tones/voicing |
| F#dim | Same as current | 2 3 4 2 4 2 | - - - - - - | 1 2 3 1 4 1 | F# A C Eb | Confirmed by note/fret calculation |
| Gb+ | 2 1 4 3 3 2 / 2 1 4 3 3 2 | -1 -1 4 3 3 2 | X X - - - - | x x 4 3 2 1 | Gb Bb D | Corrected: fingering/playability |
| Gbsus | 2 4 4 4 5 2 / 1 3 3 3 4 1 | -1 -1 4 4 2 2 | X X - - - - | x x 3 4 1 1 | Gb Cb Db | Corrected: sounding chord tones/voicing |
| G6 | Same as current | 3 2 0 0 0 0 | - - O O O O | 3 2 0 0 0 0 | G B D E | Confirmed by note/fret calculation |
| G9 | 3 2 0 1 0 3 / 3 2 0 1 0 4 | 3 -1 3 2 0 1 | - X - - O - | 2 x 3 1 0 4 | G B D F A | Corrected: sounding chord tones/voicing |
| Gm6 | 3 5 5 3 3 5 / 1 3 4 1 1 4 | 3 -1 0 3 3 0 | - X O - - O | 2 x 0 1 3 0 | G Bb D E | Corrected: sounding chord tones/voicing |
| Gm7 | Same as current | 3 5 3 3 3 3 | - - - - - - | 1 3 1 1 1 1 | G Bb D F | Confirmed by note/fret calculation |
| Gdim | Same as current | 3 4 5 3 5 3 | - - - - - - | 1 2 3 1 4 1 | G Bb Db E | Confirmed by note/fret calculation |
| G+ | Same as current | 3 2 1 0 0 3 | - - - O O - | 3 2 1 0 0 4 | G B D# | Confirmed by note/fret calculation |
| Gsus | Same as current | 3 3 0 0 1 3 | - - O O - - | 3 4 0 0 1 2 | G C D | Confirmed by note/fret calculation |

## Inventory by category

### Major

A, C, D, E, F, G, F#, Bb, Ab, B, Db, Eb

### Minor

Am, Dm, Em, F#m, C#m, G#m, Bbm, Bm, Cm, Fm, Gm, Ebm

### Dominant 7th

A7, B7, C7, D7, E7, G7, Ab7, Bb7, Db7, Eb7, F7, F#7

### Major 7th

Cmaj7, Dmaj7, Fmaj7, Gmaj7, Abmaj7, Amaj7, Bbmaj7, Bmaj7, Dbmaj7, Ebmaj7, Emaj7, Gbmaj7

### Add9

Cadd9, Eadd9, Fadd9, Dadd9, Gadd9

### Suspended 2nd

Csus2, Dsus2, Gsus2, Asus2

### Suspended 4th / aliases

Csus4, Dsus4, Esus4, Gsus4, Asus4, Absus, Asus, Bbsus, Bsus, Csus, Dbsus, Dsus, Ebsus, Esus, Fsus, Gbsus, Gsus

### Minor 7th

Dm7, Em7, Am7, G#m7, Bbm7, Bm7, Cm7, C#m7, Ebm7, Fm7, F#m7, Gm7

### Slash chords

D/F#, G/B

### Sixth / minor sixth

Ab6, G#m6, A6, Am6, Bb6, Bbm6, B6, Bm6, C6, Cm6, Db6, C#m6, D6, Dm6, Eb6, Ebm6, E6, Em6, F6, Fm6, Gb6, F#m6, G6, Gm6

### Ninth

Ab9, A9, Bb9, B9, C9, Db9, D9, Eb9, E9, F9, F#9, G9

### Diminished

G#dim, Adim, Bbdim, Bdim, Cdim, C#dim, Ddim, Ebdim, Edim, Fdim, F#dim, Gdim

### Augmented

Ab+, A+, Bb+, B+, C+, Db+, D+, Eb+, E+, F+, Gb+, G+

## Manual fingering review queue

Ab6, Ab7, Ab9, G#m6, Bbm6, Bm6, C#m6, Ebm6, F6, Fm6, F#m6

These voicings passed the pitch/formula checks. The repeated-finger placements across separated strings need a guitarist to confirm whether the intended barre/hand position is comfortable; no fingering change was guessed.
