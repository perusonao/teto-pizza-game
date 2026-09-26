# Discovery Hint Economy 1.0 — simulation tables (appendix)

Generated from `src/logic/discoveryHintEconomy.sim.test.ts` (test-only harness
`src/logic/testSupport/discoveryHintEconomySim.ts`) on `main` `42ce42842a2eb509d6995c101911fc3f29aa1b43`:

```
HINT_ECONOMY_SIM_OUT=/tmp/sim.json npx vitest run src/logic/discoveryHintEconomy.sim.test.ts
```

Curves: FREE = current production (0/0/0/0), A 10/20/40/80, B 5/10/20/40, C 10/20/30/50,
D 0/10/20/40. Quality: Q80 = ★4 (100 Pitz/bake), Q65 = ★3 (80), Q30 = ★1 (floor 20); the
first-discovery bonus (+50) is on top. Methodology and caveats: main report §6.

## 1. Effort summary — total bakes to Dex 25 (experimental + Margherita replays)

`g` = Margherita replays needed to pay the Shop, `i` = insufficient-Pitz hint attempts.
| Quality | Profile | FREE | A | B | C | D |
|---|---|---|---|---|---|---|
| Q80 | P0 | 427 (g11, i0) | 427 (g11, i0) | 427 (g11, i0) | 427 (g11, i0) | 427 (g11, i0) |
| Q80 | P1 | 413 (g22, i0) | 415 (g24, i0) | 414 (g23, i0) | 415 (g24, i0) | 413 (g22, i0) |
| Q80 | P2 | 322 (g19, i0) | 325 (g25, i1) | 329 (g23, i1) | 325 (g25, i1) | 325 (g22, i0) |
| Q80 | P3 | 242 (g9, i0) | 324 (g22, i7) | 248 (g15, i2) | 325 (g27, i9) | 262 (g15, i3) |
| Q80 | P4 | 101 (g0, i0) | 304 (g28, i16) | 109 (g8, i0) | 292 (g25, i12) | 108 (g7, i0) |
| Q80 | P5 | 135 (g0, i0) | 240 (g22, i11) | 181 (g11, i4) | 201 (g18, i8) | 154 (g8, i2) |
| Q65 | P0 | 438 (g22, i0) | 438 (g22, i0) | 438 (g22, i0) | 438 (g22, i0) | 438 (g22, i0) |
| Q65 | P1 | 424 (g33, i0) | 427 (g36, i0) | 446 (g32, i1) | 427 (g36, i0) | 424 (g33, i0) |
| Q65 | P2 | 333 (g30, i0) | 344 (g35, i1) | 338 (g35, i0) | 344 (g35, i1) | 336 (g33, i0) |
| Q65 | P3 | 250 (g17, i0) | 297 (g35, i9) | 317 (g32, i4) | 314 (g33, i8) | 286 (g31, i2) |
| Q65 | P4 | 101 (g0, i0) | 348 (g40, i21) | 199 (g25, i9) | 305 (g35, i19) | 203 (g22, i7) |
| Q65 | P5 | 136 (g1, i0) | 344 (g44, i23) | 216 (g23, i11) | 228 (g29, i12) | 182 (g17, i6) |
| Q30 | P0 | 605 (g189, i0) | 605 (g189, i0) | 605 (g189, i0) | 605 (g189, i0) | 605 (g189, i0) |
| Q30 | P1 | 594 (g203, i0) | 591 (g198, i3) | 599 (g208, i5) | 591 (g198, i3) | 594 (g203, i0) |
| Q30 | P2 | 494 (g191, i0) | 591 (g198, i24) | 616 (g202, i15) | 591 (g198, i24) | 493 (g177, i5) |
| Q30 | P3 | 371 (g138, i0) | 590 (g197, i20) | 594 (g202, i20) | 590 (g197, i20) | 503 (g188, i19) |
| Q30 | P4 | 163 (g62, i0) | 590 (g198, i24) | 615 (g202, i24) | 590 (g198, i24) | 492 (g177, i24) |
| Q30 | P5 | 208 (g73, i0) | 606 (g215, i23) | 657 (g252, i27) | 606 (g215, i23) | 509 (g194, i19) |

## 2. Candidate x profile matrices

### Q65

| Curve | Profile | Hint spend | Shop spend (pack+refill) | Pitz earned (discovery+other) | Min Pitz after Dex 1 | Ending Pitz | Insufficient-Pitz hint attempts | Experimental bakes | Margherita replays (grind) | Total bakes | Soft-blocked stages | Hard deadlock |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| FREE | P0 | 0 | 5650 (2200+3450) | 5810 (3250+2560) | 0 | 160 | 0 | 416 | 22 | 438 | 8 | no |
| FREE | P1 | 0 | 5730 (2200+3530) | 5890 (3250+2640) | 0 | 160 | 0 | 391 | 33 | 424 | 7 | no |
| FREE | P2 | 0 | 5500 (2200+3300) | 5650 (3250+2400) | 0 | 150 | 0 | 303 | 30 | 333 | 6 | no |
| FREE | P3 | 0 | 4430 (2200+2230) | 4610 (3250+1360) | 0 | 180 | 0 | 233 | 17 | 250 | 4 | no |
| FREE | P4 | 0 | 2920 (2200+720) | 3250 (3250+0) | 70 | 330 | 0 | 101 | 0 | 101 | 0 | no |
| FREE | P5 | 0 | 3140 (2200+940) | 3330 (3250+80) | 20 | 190 | 0 | 135 | 1 | 136 | 1 | no |
| A | P0 | 0 | 5650 (2200+3450) | 5810 (3250+2560) | 0 | 160 | 0 | 416 | 22 | 438 | 8 | no |
| A | P1 | 240 | 5730 (2200+3530) | 6130 (3250+2880) | 0 | 160 | 0 | 391 | 36 | 427 | 9 | no |
| A | P2 | 700 | 5220 (2200+3020) | 6050 (3250+2800) | 0 | 130 | 1 | 309 | 35 | 344 | 10 | no |
| A | P3 | 1020 | 4860 (2200+2660) | 6050 (3250+2800) | 0 | 170 | 9 | 262 | 35 | 297 | 11 | no |
| A | P4 | 1100 | 5220 (2200+3020) | 6450 (3250+3200) | 0 | 130 | 21 | 308 | 40 | 348 | 11 | no |
| A | P5 | 1400 | 5230 (2200+3030) | 6770 (3250+3520) | 0 | 140 | 23 | 300 | 44 | 344 | 11 | no |
| B | P0 | 0 | 5650 (2200+3450) | 5810 (3250+2560) | 0 | 160 | 0 | 416 | 22 | 438 | 8 | no |
| B | P1 | 115 | 5900 (2200+3700) | 6210 (3250+2960) | 0 | 195 | 1 | 414 | 32 | 446 | 8 | no |
| B | P2 | 360 | 5500 (2200+3300) | 6050 (3250+2800) | 0 | 190 | 0 | 303 | 35 | 338 | 8 | no |
| B | P3 | 610 | 5060 (2200+2860) | 5810 (3250+2560) | 0 | 140 | 4 | 285 | 32 | 317 | 10 | no |
| B | P4 | 1120 | 3950 (2200+1750) | 5250 (3250+2000) | 0 | 180 | 9 | 174 | 25 | 199 | 7 | no |
| B | P5 | 1100 | 3860 (2200+1660) | 5090 (3250+1840) | 0 | 130 | 11 | 193 | 23 | 216 | 7 | no |
| C | P0 | 0 | 5650 (2200+3450) | 5810 (3250+2560) | 0 | 160 | 0 | 416 | 22 | 438 | 8 | no |
| C | P1 | 240 | 5730 (2200+3530) | 6130 (3250+2880) | 0 | 160 | 0 | 391 | 36 | 427 | 9 | no |
| C | P2 | 700 | 5220 (2200+3020) | 6050 (3250+2800) | 0 | 130 | 1 | 309 | 35 | 344 | 10 | no |
| C | P3 | 900 | 4860 (2200+2660) | 5890 (3250+2640) | 0 | 130 | 8 | 281 | 33 | 314 | 11 | no |
| C | P4 | 1020 | 4860 (2200+2660) | 6050 (3250+2800) | 0 | 170 | 19 | 270 | 35 | 305 | 10 | no |
| C | P5 | 1410 | 3980 (2200+1780) | 5570 (3250+2320) | 0 | 180 | 12 | 199 | 29 | 228 | 10 | no |
| D | P0 | 0 | 5650 (2200+3450) | 5810 (3250+2560) | 0 | 160 | 0 | 416 | 22 | 438 | 8 | no |
| D | P1 | 0 | 5730 (2200+3530) | 5890 (3250+2640) | 0 | 160 | 0 | 391 | 33 | 424 | 7 | no |
| D | P2 | 240 | 5500 (2200+3300) | 5890 (3250+2640) | 0 | 150 | 0 | 303 | 33 | 336 | 7 | no |
| D | P3 | 560 | 4980 (2200+2780) | 5730 (3250+2480) | 0 | 190 | 2 | 255 | 31 | 286 | 8 | no |
| D | P4 | 1040 | 3840 (2200+1640) | 5010 (3250+1760) | 0 | 130 | 7 | 181 | 22 | 203 | 7 | no |
| D | P5 | 1020 | 3440 (2200+1240) | 4610 (3250+1360) | 0 | 150 | 6 | 165 | 17 | 182 | 5 | no |

### Q80

| Curve | Profile | Hint spend | Shop spend (pack+refill) | Pitz earned (discovery+other) | Min Pitz after Dex 1 | Ending Pitz | Insufficient-Pitz hint attempts | Experimental bakes | Margherita replays (grind) | Total bakes | Soft-blocked stages | Hard deadlock |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| FREE | P0 | 0 | 5650 (2200+3450) | 5850 (3750+2100) | 0 | 200 | 0 | 416 | 11 | 427 | 3 | no |
| FREE | P1 | 0 | 5730 (2200+3530) | 5950 (3750+2200) | 0 | 220 | 0 | 391 | 22 | 413 | 6 | no |
| FREE | P2 | 0 | 5500 (2200+3300) | 5650 (3750+1900) | 0 | 150 | 0 | 303 | 19 | 322 | 5 | no |
| FREE | P3 | 0 | 4430 (2200+2230) | 4650 (3750+900) | 0 | 220 | 0 | 233 | 9 | 242 | 2 | no |
| FREE | P4 | 0 | 2920 (2200+720) | 3750 (3750+0) | 90 | 830 | 0 | 101 | 0 | 101 | 0 | no |
| FREE | P5 | 0 | 3140 (2200+940) | 3750 (3750+0) | 90 | 610 | 0 | 135 | 0 | 135 | 0 | no |
| A | P0 | 0 | 5650 (2200+3450) | 5850 (3750+2100) | 0 | 200 | 0 | 416 | 11 | 427 | 3 | no |
| A | P1 | 240 | 5730 (2200+3530) | 6150 (3750+2400) | 0 | 180 | 0 | 391 | 24 | 415 | 6 | no |
| A | P2 | 700 | 5320 (2200+3120) | 6250 (3750+2500) | 0 | 230 | 1 | 300 | 25 | 325 | 7 | no |
| A | P3 | 1090 | 5210 (2200+3010) | 6450 (3750+2700) | 0 | 150 | 7 | 302 | 22 | 324 | 8 | no |
| A | P4 | 1480 | 4860 (2200+2660) | 6550 (3750+2800) | 0 | 210 | 16 | 276 | 28 | 304 | 10 | no |
| A | P5 | 1600 | 4190 (2200+1990) | 5950 (3750+2200) | 0 | 160 | 11 | 218 | 22 | 240 | 10 | no |
| B | P0 | 0 | 5650 (2200+3450) | 5850 (3750+2100) | 0 | 200 | 0 | 416 | 11 | 427 | 3 | no |
| B | P1 | 120 | 5730 (2200+3530) | 6050 (3750+2300) | 5 | 200 | 0 | 391 | 23 | 414 | 6 | no |
| B | P2 | 350 | 5510 (2200+3310) | 6050 (3750+2300) | 0 | 190 | 1 | 306 | 23 | 329 | 6 | no |
| B | P3 | 660 | 4430 (2200+2230) | 5250 (3750+1500) | 0 | 160 | 2 | 233 | 15 | 248 | 5 | no |
| B | P4 | 1480 | 2920 (2200+720) | 4550 (3750+800) | 0 | 150 | 0 | 101 | 8 | 109 | 4 | no |
| B | P5 | 1180 | 3480 (2200+1280) | 4850 (3750+1100) | 0 | 190 | 4 | 170 | 11 | 181 | 5 | no |
| C | P0 | 0 | 5650 (2200+3450) | 5850 (3750+2100) | 0 | 200 | 0 | 416 | 11 | 427 | 3 | no |
| C | P1 | 240 | 5730 (2200+3530) | 6150 (3750+2400) | 0 | 180 | 0 | 391 | 24 | 415 | 6 | no |
| C | P2 | 700 | 5320 (2200+3120) | 6250 (3750+2500) | 0 | 230 | 1 | 300 | 25 | 325 | 7 | no |
| C | P3 | 880 | 5360 (2200+3160) | 6450 (3750+2700) | 0 | 210 | 9 | 298 | 27 | 325 | 7 | no |
| C | P4 | 1450 | 4580 (2200+2380) | 6250 (3750+2500) | 0 | 220 | 12 | 267 | 25 | 292 | 7 | no |
| C | P5 | 1720 | 3680 (2200+1480) | 5550 (3750+1800) | 0 | 150 | 8 | 183 | 18 | 201 | 8 | no |
| D | P0 | 0 | 5650 (2200+3450) | 5850 (3750+2100) | 0 | 200 | 0 | 416 | 11 | 427 | 3 | no |
| D | P1 | 0 | 5730 (2200+3530) | 5950 (3750+2200) | 0 | 220 | 0 | 391 | 22 | 413 | 6 | no |
| D | P2 | 240 | 5500 (2200+3300) | 5950 (3750+2200) | 0 | 210 | 0 | 303 | 22 | 325 | 6 | no |
| D | P3 | 520 | 4540 (2200+2340) | 5250 (3750+1500) | 0 | 190 | 3 | 247 | 15 | 262 | 4 | no |
| D | P4 | 1360 | 2920 (2200+720) | 4450 (3750+700) | 10 | 170 | 0 | 101 | 7 | 108 | 4 | no |
| D | P5 | 1060 | 3330 (2200+1130) | 4550 (3750+800) | 0 | 160 | 2 | 146 | 8 | 154 | 4 | no |

### Q30

| Curve | Profile | Hint spend | Shop spend (pack+refill) | Pitz earned (discovery+other) | Min Pitz after Dex 1 | Ending Pitz | Insufficient-Pitz hint attempts | Experimental bakes | Margherita replays (grind) | Total bakes | Soft-blocked stages | Hard deadlock |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| FREE | P0 | 0 | 5650 (2200+3450) | 5730 (1750+3980) | 0 | 80 | 0 | 416 | 189 | 605 | 17 | no |
| FREE | P1 | 0 | 5730 (2200+3530) | 5810 (1750+4060) | 0 | 80 | 0 | 391 | 203 | 594 | 16 | no |
| FREE | P2 | 0 | 5500 (2200+3300) | 5570 (1750+3820) | 0 | 70 | 0 | 303 | 191 | 494 | 17 | no |
| FREE | P3 | 0 | 4430 (2200+2230) | 4510 (1750+2760) | 0 | 80 | 0 | 233 | 138 | 371 | 17 | no |
| FREE | P4 | 0 | 2920 (2200+720) | 2990 (1750+1240) | 0 | 70 | 0 | 101 | 62 | 163 | 15 | no |
| FREE | P5 | 0 | 3140 (2200+940) | 3210 (1750+1460) | 0 | 70 | 0 | 135 | 73 | 208 | 15 | no |
| A | P0 | 0 | 5650 (2200+3450) | 5730 (1750+3980) | 0 | 80 | 0 | 416 | 189 | 605 | 17 | no |
| A | P1 | 210 | 5530 (2200+3330) | 5810 (1750+4060) | 0 | 70 | 3 | 393 | 198 | 591 | 20 | no |
| A | P2 | 210 | 5530 (2200+3330) | 5810 (1750+4060) | 0 | 70 | 24 | 393 | 198 | 591 | 20 | no |
| A | P3 | 190 | 5530 (2200+3330) | 5790 (1750+4040) | 0 | 70 | 20 | 393 | 197 | 590 | 19 | no |
| A | P4 | 210 | 5530 (2200+3330) | 5810 (1750+4060) | 0 | 70 | 24 | 392 | 198 | 590 | 20 | no |
| A | P5 | 240 | 5730 (2200+3530) | 6050 (1750+4300) | 0 | 80 | 23 | 391 | 215 | 606 | 20 | no |
| B | P0 | 0 | 5650 (2200+3450) | 5730 (1750+3980) | 0 | 80 | 0 | 416 | 189 | 605 | 17 | no |
| B | P1 | 95 | 5730 (2200+3530) | 5910 (1750+4160) | 0 | 85 | 5 | 391 | 208 | 599 | 18 | no |
| B | P2 | 195 | 5720 (2200+3520) | 5990 (1750+4240) | 0 | 75 | 15 | 414 | 202 | 616 | 20 | no |
| B | P3 | 190 | 5630 (2200+3430) | 5890 (1750+4140) | 0 | 70 | 20 | 392 | 202 | 594 | 19 | no |
| B | P4 | 195 | 5720 (2200+3520) | 5990 (1750+4240) | 0 | 75 | 24 | 413 | 202 | 615 | 20 | no |
| B | P5 | 255 | 6450 (2200+4250) | 6790 (1750+5040) | 0 | 85 | 27 | 405 | 252 | 657 | 19 | no |
| C | P0 | 0 | 5650 (2200+3450) | 5730 (1750+3980) | 0 | 80 | 0 | 416 | 189 | 605 | 17 | no |
| C | P1 | 210 | 5530 (2200+3330) | 5810 (1750+4060) | 0 | 70 | 3 | 393 | 198 | 591 | 20 | no |
| C | P2 | 210 | 5530 (2200+3330) | 5810 (1750+4060) | 0 | 70 | 24 | 393 | 198 | 591 | 20 | no |
| C | P3 | 190 | 5530 (2200+3330) | 5790 (1750+4040) | 0 | 70 | 20 | 393 | 197 | 590 | 19 | no |
| C | P4 | 210 | 5530 (2200+3330) | 5810 (1750+4060) | 0 | 70 | 24 | 392 | 198 | 590 | 20 | no |
| C | P5 | 240 | 5730 (2200+3530) | 6050 (1750+4300) | 0 | 80 | 23 | 391 | 215 | 606 | 20 | no |
| D | P0 | 0 | 5650 (2200+3450) | 5730 (1750+3980) | 0 | 80 | 0 | 416 | 189 | 605 | 17 | no |
| D | P1 | 0 | 5730 (2200+3530) | 5810 (1750+4060) | 0 | 80 | 0 | 391 | 203 | 594 | 16 | no |
| D | P2 | 190 | 5020 (2200+2820) | 5290 (1750+3540) | 0 | 80 | 5 | 316 | 177 | 493 | 20 | no |
| D | P3 | 200 | 5230 (2200+3030) | 5510 (1750+3760) | 0 | 80 | 19 | 315 | 188 | 503 | 19 | no |
| D | P4 | 190 | 5020 (2200+2820) | 5290 (1750+3540) | 0 | 80 | 24 | 315 | 177 | 492 | 20 | no |
| D | P5 | 220 | 5330 (2200+3130) | 5630 (1750+3880) | 0 | 80 | 19 | 315 | 194 | 509 | 19 | no |

## 3. Level value

Experimental bakes per stage when the player knows exactly H0..H4 (FREE prices, Q65; P0/P1/P2/L3/P4 runs).


| # | Recipe | max level | H0 | H1 | H2 | H3 | H4 |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | margherita | H4 | 2 | 2 | 2 | 2 | 1 |
| 2 | bismarck | H3 | 1 | 1 | 1 | 1 | 1 |
| 3 | breakfast-pizza | H4 | 2 | 2 | 2 | 2 | 2 |
| 4 | funghi | H3 | 1 | 1 | 1 | 1 | 1 |
| 5 | melanzane-pizza | H4 | 5 | 5 | 5 | 5 | 5 |
| 6 | parmigiana-pizza | H4 | 11 | 11 | 11 | 11 | 5 |
| 7 | pepperoni | H3 | 1 | 1 | 1 | 1 | 1 |
| 8 | salsiccia | H3 | 1 | 1 | 1 | 1 | 1 |
| 9 | meat-lovers | H4 | 7 | 7 | 7 | 7 | 2 |
| 10 | bambino | H4 | 2 | 2 | 2 | 2 | 2 |
| 11 | hawaiian | H4 | 3 | 3 | 3 | 3 | 3 |
| 12 | capricciosa | H4 | 49 | 37 | 37 | 26 | 1 |
| 13 | pizza-portuguesa | H4 | 17 | 18 | 18 | 17 | 3 |
| 14 | fugazza | H3 | 4 | 17 | 3 | 2 | 2 |
| 15 | marinara | H3 | 5 | 4 | 4 | 3 | 3 |
| 16 | napoletana | H4 | 4 | 4 | 4 | 4 | 4 |
| 17 | tonno-e-cipolla | H4 | 4 | 4 | 4 | 4 | 4 |
| 18 | pesto-tonno | H4 | 30 | 29 | 9 | 8 | 4 |
| 19 | genovese | H3 | 2 | 2 | 1 | 1 | 1 |
| 20 | new-haven-apizza | H4 | 60 | 60 | 35 | 6 | 5 |
| 21 | pesto-caprese | H4 | 42 | 41 | 20 | 21 | 20 |
| 22 | pesto-patate | H4 | 20 | 20 | 19 | 19 | 19 |
| 23 | pizza-bianca | H3 | 26 | 25 | 24 | 2 | 2 |
| 24 | puttanesca-pizza | H4 | 73 | 50 | 47 | 24 | 8 |
| 25 | quattro-formaggi | H4 | 44 | 44 | 42 | 42 | 1 |
| | **total** | | **416** | **391** | **303** | **215** | **101** |
| | refill Pitz | | 3450 | 3530 | 3300 | 2270 | 720 |

## 4. Per-stage results (Q65)

#### Per-stage: Q65 curve A profile P5

| # | Recipe | Pitz before | Discovery reward | Other earned | Hint | Unlock | Refill | Pitz after | Hint level (max) | Exp. bakes | Grind | Stock used | Blocked? | Reason |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---|---|
| 1 | margherita | 0 | 130 | 0 | 0 | 0 | 0 | 130 | H2 (H4) | 2 | 0 | 0 | no | ok |
| 2 | bismarck | 130 | 130 | 0 | 10 | 60 | 0 | 190 | H1 (H3) | 1 | 0 | 1 | no | ok |
| 3 | breakfast-pizza | 190 | 130 | 0 | 30 | 60 | 0 | 230 | H2 (H4) | 2 | 0 | 7 | no | ok |
| 4 | funghi | 230 | 130 | 0 | 10 | 60 | 0 | 290 | H1 (H3) | 1 | 0 | 3 | no | ok |
| 5 | melanzane-pizza | 290 | 130 | 0 | 150 | 60 | 0 | 210 | H4 (H4) | 5 | 0 | 22 | no | ok |
| 6 | parmigiana-pizza | 210 | 130 | 80 | 150 | 60 | 30 | 180 | H4 (H4) | 8 | 1 | 44 | soft | Shop needed 1 Margherita replay(s) |
| 7 | pepperoni | 180 | 130 | 0 | 10 | 80 | 0 | 220 | H1 (H3) | 1 | 0 | 4 | no | ok |
| 8 | salsiccia | 220 | 130 | 0 | 10 | 80 | 0 | 260 | H1 (H3) | 1 | 0 | 3 | no | ok |
| 9 | meat-lovers | 260 | 130 | 0 | 150 | 80 | 0 | 160 | H4 (H4) | 5 | 0 | 39 | no | ok |
| 10 | bambino | 160 | 130 | 0 | 30 | 80 | 0 | 180 | H2 (H4) | 2 | 0 | 9 | no | ok |
| 11 | hawaiian | 180 | 130 | 0 | 70 | 80 | 0 | 160 | H3 (H4) | 3 | 0 | 15 | no | ok |
| 12 | capricciosa | 160 | 130 | 160 | 30 | 160 | 120 | 140 | H2 (H4) | 15 | 2 | 120 | soft | Shop needed 2 Margherita replay(s) |
| 13 | pizza-portuguesa | 140 | 130 | 240 | 70 | 80 | 160 | 200 | H3 (H4) | 23 | 3 | 198 | soft | Shop needed 3 Margherita replay(s) |
| 14 | fugazza | 200 | 130 | 0 | 70 | 80 | 30 | 150 | H3 (H3) | 4 | 0 | 14 | no | ok |
| 15 | marinara | 150 | 130 | 0 | 30 | 80 | 40 | 130 | H2 (H3) | 4 | 0 | 20 | no | hint unaffordable (skipped) |
| 16 | napoletana | 130 | 130 | 0 | 30 | 100 | 0 | 130 | H2 (H4) | 4 | 0 | 21 | no | hint unaffordable (skipped) |
| 17 | tonno-e-cipolla | 130 | 130 | 0 | 30 | 100 | 0 | 130 | H2 (H4) | 4 | 0 | 22 | no | hint unaffordable (skipped) |
| 18 | pesto-tonno | 130 | 130 | 320 | 70 | 100 | 240 | 170 | H3 (H4) | 21 | 4 | 138 | soft | Shop needed 4 Margherita replay(s) / search cap |
| 19 | genovese | 170 | 130 | 80 | 30 | 100 | 110 | 140 | H2 (H3) | 2 | 1 | 7 | soft | Shop needed 1 Margherita replay(s) |
| 20 | new-haven-apizza | 140 | 130 | 320 | 70 | 100 | 260 | 160 | H3 (H4) | 30 | 4 | 219 | soft | Shop needed 4 Margherita replay(s) |
| 21 | pesto-caprese | 160 | 130 | 320 | 70 | 100 | 300 | 140 | H3 (H4) | 22 | 4 | 143 | soft | Shop needed 4 Margherita replay(s) |
| 22 | pesto-patate | 140 | 130 | 400 | 70 | 100 | 300 | 200 | H3 (H4) | 30 | 5 | 191 | soft | Shop needed 5 Margherita replay(s) |
| 23 | pizza-bianca | 200 | 130 | 240 | 70 | 100 | 230 | 170 | H3 (H3) | 12 | 3 | 72 | soft | Shop needed 3 Margherita replay(s) |
| 24 | puttanesca-pizza | 170 | 130 | 480 | 70 | 100 | 420 | 190 | H3 (H4) | 44 | 6 | 213 | soft | Shop needed 6 Margherita replay(s) / search cap |
| 25 | quattro-formaggi | 190 | 130 | 880 | 70 | 200 | 790 | 140 | H3 (H4) | 54 | 11 | 448 | soft | Shop needed 11 Margherita replay(s) |

#### Per-stage: Q65 curve B profile P5

| # | Recipe | Pitz before | Discovery reward | Other earned | Hint | Unlock | Refill | Pitz after | Hint level (max) | Exp. bakes | Grind | Stock used | Blocked? | Reason |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---|---|
| 1 | margherita | 0 | 130 | 0 | 0 | 0 | 0 | 130 | H2 (H4) | 2 | 0 | 0 | no | ok |
| 2 | bismarck | 130 | 130 | 0 | 5 | 60 | 0 | 195 | H1 (H3) | 1 | 0 | 1 | no | ok |
| 3 | breakfast-pizza | 195 | 130 | 0 | 15 | 60 | 0 | 250 | H2 (H4) | 2 | 0 | 7 | no | ok |
| 4 | funghi | 250 | 130 | 0 | 5 | 60 | 0 | 315 | H1 (H3) | 1 | 0 | 3 | no | ok |
| 5 | melanzane-pizza | 315 | 130 | 0 | 75 | 60 | 0 | 310 | H4 (H4) | 5 | 0 | 22 | no | ok |
| 6 | parmigiana-pizza | 310 | 130 | 0 | 75 | 60 | 30 | 275 | H4 (H4) | 8 | 0 | 44 | no | ok |
| 7 | pepperoni | 275 | 130 | 0 | 5 | 80 | 0 | 320 | H1 (H3) | 1 | 0 | 4 | no | ok |
| 8 | salsiccia | 320 | 130 | 0 | 5 | 80 | 0 | 365 | H1 (H3) | 1 | 0 | 3 | no | ok |
| 9 | meat-lovers | 365 | 130 | 0 | 75 | 80 | 0 | 340 | H4 (H4) | 5 | 0 | 39 | no | ok |
| 10 | bambino | 340 | 130 | 0 | 15 | 80 | 0 | 375 | H2 (H4) | 2 | 0 | 9 | no | ok |
| 11 | hawaiian | 375 | 130 | 0 | 35 | 80 | 0 | 390 | H3 (H4) | 3 | 0 | 15 | no | ok |
| 12 | capricciosa | 390 | 130 | 0 | 75 | 160 | 0 | 285 | H4 (H4) | 4 | 0 | 28 | no | ok |
| 13 | pizza-portuguesa | 285 | 130 | 0 | 75 | 80 | 40 | 220 | H4 (H4) | 6 | 0 | 44 | no | ok |
| 14 | fugazza | 220 | 130 | 0 | 35 | 80 | 0 | 235 | H3 (H3) | 4 | 0 | 14 | no | ok |
| 15 | marinara | 235 | 130 | 0 | 35 | 80 | 0 | 250 | H3 (H3) | 5 | 0 | 25 | no | ok |
| 16 | napoletana | 250 | 130 | 0 | 75 | 100 | 40 | 165 | H4 (H4) | 4 | 0 | 21 | no | ok |
| 17 | tonno-e-cipolla | 165 | 130 | 0 | 35 | 100 | 0 | 160 | H3 (H4) | 4 | 0 | 22 | no | hint unaffordable (skipped) |
| 18 | pesto-tonno | 160 | 130 | 160 | 75 | 100 | 100 | 175 | H4 (H4) | 13 | 2 | 94 | soft | Shop needed 2 Margherita replay(s) |
| 19 | genovese | 175 | 130 | 80 | 15 | 100 | 120 | 150 | H2 (H3) | 2 | 1 | 7 | soft | Shop needed 1 Margherita replay(s) |
| 20 | new-haven-apizza | 150 | 130 | 0 | 35 | 100 | 0 | 145 | H3 (H4) | 7 | 0 | 44 | no | hint unaffordable (skipped) |
| 21 | pesto-caprese | 145 | 130 | 400 | 75 | 100 | 340 | 160 | H4 (H4) | 31 | 5 | 193 | soft | Shop needed 5 Margherita replay(s) |
| 22 | pesto-patate | 160 | 130 | 240 | 75 | 100 | 180 | 175 | H4 (H4) | 20 | 3 | 132 | soft | Shop needed 3 Margherita replay(s) |
| 23 | pizza-bianca | 175 | 130 | 240 | 35 | 100 | 240 | 170 | H3 (H3) | 11 | 3 | 64 | soft | Shop needed 3 Margherita replay(s) |
| 24 | puttanesca-pizza | 170 | 130 | 320 | 75 | 100 | 240 | 205 | H4 (H4) | 29 | 4 | 182 | soft | Shop needed 4 Margherita replay(s) |
| 25 | quattro-formaggi | 205 | 130 | 400 | 75 | 200 | 330 | 130 | H4 (H4) | 22 | 5 | 166 | soft | Shop needed 5 Margherita replay(s) |

#### Per-stage: Q65 curve C profile P5

| # | Recipe | Pitz before | Discovery reward | Other earned | Hint | Unlock | Refill | Pitz after | Hint level (max) | Exp. bakes | Grind | Stock used | Blocked? | Reason |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---|---|
| 1 | margherita | 0 | 130 | 0 | 0 | 0 | 0 | 130 | H2 (H4) | 2 | 0 | 0 | no | ok |
| 2 | bismarck | 130 | 130 | 0 | 10 | 60 | 0 | 190 | H1 (H3) | 1 | 0 | 1 | no | ok |
| 3 | breakfast-pizza | 190 | 130 | 0 | 30 | 60 | 0 | 230 | H2 (H4) | 2 | 0 | 7 | no | ok |
| 4 | funghi | 230 | 130 | 0 | 10 | 60 | 0 | 290 | H1 (H3) | 1 | 0 | 3 | no | ok |
| 5 | melanzane-pizza | 290 | 130 | 0 | 110 | 60 | 0 | 250 | H4 (H4) | 5 | 0 | 22 | no | ok |
| 6 | parmigiana-pizza | 250 | 130 | 0 | 110 | 60 | 30 | 180 | H4 (H4) | 8 | 0 | 44 | no | ok |
| 7 | pepperoni | 180 | 130 | 0 | 10 | 80 | 0 | 220 | H1 (H3) | 1 | 0 | 4 | no | ok |
| 8 | salsiccia | 220 | 130 | 0 | 10 | 80 | 0 | 260 | H1 (H3) | 1 | 0 | 3 | no | ok |
| 9 | meat-lovers | 260 | 130 | 0 | 110 | 80 | 0 | 200 | H4 (H4) | 5 | 0 | 39 | no | ok |
| 10 | bambino | 200 | 130 | 0 | 30 | 80 | 0 | 220 | H2 (H4) | 2 | 0 | 9 | no | ok |
| 11 | hawaiian | 220 | 130 | 0 | 60 | 80 | 0 | 210 | H3 (H4) | 3 | 0 | 15 | no | ok |
| 12 | capricciosa | 210 | 130 | 160 | 60 | 160 | 120 | 160 | H3 (H4) | 15 | 2 | 120 | soft | Shop needed 2 Margherita replay(s) |
| 13 | pizza-portuguesa | 160 | 130 | 160 | 110 | 80 | 80 | 180 | H4 (H4) | 11 | 2 | 88 | soft | Shop needed 2 Margherita replay(s) |
| 14 | fugazza | 180 | 130 | 0 | 60 | 80 | 0 | 170 | H3 (H3) | 4 | 0 | 14 | no | ok |
| 15 | marinara | 170 | 130 | 0 | 60 | 80 | 0 | 160 | H3 (H3) | 5 | 0 | 25 | no | ok |
| 16 | napoletana | 160 | 130 | 0 | 10 | 100 | 40 | 140 | H1 (H4) | 4 | 0 | 21 | no | hint unaffordable (skipped) |
| 17 | tonno-e-cipolla | 140 | 130 | 0 | 30 | 100 | 0 | 140 | H2 (H4) | 4 | 0 | 22 | no | hint unaffordable (skipped) |
| 18 | pesto-tonno | 140 | 130 | 80 | 30 | 100 | 90 | 130 | H2 (H4) | 10 | 1 | 70 | soft | Shop needed 1 Margherita replay(s) |
| 19 | genovese | 130 | 130 | 80 | 30 | 100 | 50 | 160 | H2 (H3) | 2 | 1 | 7 | soft | Shop needed 1 Margherita replay(s) |
| 20 | new-haven-apizza | 160 | 130 | 240 | 110 | 100 | 160 | 160 | H4 (H4) | 16 | 3 | 111 | soft | Shop needed 3 Margherita replay(s) |
| 21 | pesto-caprese | 160 | 130 | 320 | 110 | 100 | 200 | 200 | H4 (H4) | 21 | 4 | 134 | soft | Shop needed 4 Margherita replay(s) |
| 22 | pesto-patate | 200 | 130 | 80 | 30 | 100 | 150 | 130 | H2 (H4) | 20 | 1 | 132 | soft | Shop needed 1 Margherita replay(s) |
| 23 | pizza-bianca | 130 | 130 | 240 | 60 | 100 | 210 | 130 | H3 (H3) | 4 | 3 | 15 | soft | Shop needed 3 Margherita replay(s) |
| 24 | puttanesca-pizza | 130 | 130 | 400 | 110 | 100 | 320 | 130 | H4 (H4) | 30 | 5 | 226 | soft | Shop needed 5 Margherita replay(s) |
| 25 | quattro-formaggi | 130 | 130 | 560 | 110 | 200 | 330 | 180 | H4 (H4) | 22 | 7 | 166 | soft | Shop needed 7 Margherita replay(s) |

#### Per-stage: Q65 curve D profile P5

| # | Recipe | Pitz before | Discovery reward | Other earned | Hint | Unlock | Refill | Pitz after | Hint level (max) | Exp. bakes | Grind | Stock used | Blocked? | Reason |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---|---|
| 1 | margherita | 0 | 130 | 0 | 0 | 0 | 0 | 130 | H2 (H4) | 2 | 0 | 0 | no | ok |
| 2 | bismarck | 130 | 130 | 0 | 0 | 60 | 0 | 200 | H1 (H3) | 1 | 0 | 1 | no | ok |
| 3 | breakfast-pizza | 200 | 130 | 0 | 10 | 60 | 0 | 260 | H2 (H4) | 2 | 0 | 7 | no | ok |
| 4 | funghi | 260 | 130 | 0 | 0 | 60 | 0 | 330 | H1 (H3) | 1 | 0 | 3 | no | ok |
| 5 | melanzane-pizza | 330 | 130 | 0 | 70 | 60 | 0 | 330 | H4 (H4) | 5 | 0 | 22 | no | ok |
| 6 | parmigiana-pizza | 330 | 130 | 0 | 70 | 60 | 30 | 300 | H4 (H4) | 8 | 0 | 44 | no | ok |
| 7 | pepperoni | 300 | 130 | 0 | 0 | 80 | 0 | 350 | H1 (H3) | 1 | 0 | 4 | no | ok |
| 8 | salsiccia | 350 | 130 | 0 | 0 | 80 | 0 | 400 | H1 (H3) | 1 | 0 | 3 | no | ok |
| 9 | meat-lovers | 400 | 130 | 0 | 70 | 80 | 0 | 380 | H4 (H4) | 5 | 0 | 39 | no | ok |
| 10 | bambino | 380 | 130 | 0 | 10 | 80 | 0 | 420 | H2 (H4) | 2 | 0 | 9 | no | ok |
| 11 | hawaiian | 420 | 130 | 0 | 30 | 80 | 0 | 440 | H3 (H4) | 3 | 0 | 15 | no | ok |
| 12 | capricciosa | 440 | 130 | 0 | 70 | 160 | 0 | 340 | H4 (H4) | 4 | 0 | 28 | no | ok |
| 13 | pizza-portuguesa | 340 | 130 | 0 | 70 | 80 | 40 | 280 | H4 (H4) | 6 | 0 | 44 | no | ok |
| 14 | fugazza | 280 | 130 | 0 | 30 | 80 | 0 | 300 | H3 (H3) | 4 | 0 | 14 | no | ok |
| 15 | marinara | 300 | 130 | 0 | 30 | 80 | 0 | 320 | H3 (H3) | 5 | 0 | 25 | no | ok |
| 16 | napoletana | 320 | 130 | 0 | 70 | 100 | 40 | 240 | H4 (H4) | 4 | 0 | 21 | no | ok |
| 17 | tonno-e-cipolla | 240 | 130 | 0 | 70 | 100 | 0 | 200 | H4 (H4) | 4 | 0 | 22 | no | ok |
| 18 | pesto-tonno | 200 | 130 | 0 | 70 | 100 | 0 | 160 | H4 (H4) | 7 | 0 | 40 | no | ok |
| 19 | genovese | 160 | 130 | 0 | 10 | 100 | 40 | 140 | H2 (H3) | 2 | 0 | 7 | no | ok |
| 20 | new-haven-apizza | 140 | 130 | 0 | 30 | 100 | 0 | 140 | H3 (H4) | 7 | 0 | 44 | no | hint unaffordable (skipped) |
| 21 | pesto-caprese | 140 | 130 | 400 | 70 | 100 | 330 | 170 | H4 (H4) | 21 | 5 | 134 | soft | Shop needed 5 Margherita replay(s) |
| 22 | pesto-patate | 170 | 130 | 320 | 70 | 100 | 270 | 180 | H4 (H4) | 30 | 4 | 191 | soft | Shop needed 4 Margherita replay(s) |
| 23 | pizza-bianca | 180 | 130 | 160 | 30 | 100 | 200 | 140 | H3 (H3) | 7 | 2 | 36 | soft | Shop needed 2 Margherita replay(s) |
| 24 | puttanesca-pizza | 140 | 130 | 160 | 70 | 100 | 90 | 170 | H4 (H4) | 19 | 2 | 126 | soft | Shop needed 2 Margherita replay(s) |
| 25 | quattro-formaggi | 170 | 130 | 320 | 70 | 200 | 200 | 150 | H4 (H4) | 14 | 4 | 93 | soft | Shop needed 4 Margherita replay(s) |

#### Per-stage: Q65 curve A profile P4

| # | Recipe | Pitz before | Discovery reward | Other earned | Hint | Unlock | Refill | Pitz after | Hint level (max) | Exp. bakes | Grind | Stock used | Blocked? | Reason |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---|---|
| 1 | margherita | 0 | 130 | 0 | 0 | 0 | 0 | 130 | H4 (H4) | 1 | 0 | 0 | no | ok |
| 2 | bismarck | 130 | 130 | 0 | 70 | 60 | 0 | 130 | H3 (H3) | 1 | 0 | 1 | no | ok |
| 3 | breakfast-pizza | 130 | 130 | 0 | 70 | 60 | 0 | 130 | H3 (H4) | 2 | 0 | 7 | no | hint unaffordable (skipped) |
| 4 | funghi | 130 | 130 | 0 | 70 | 60 | 0 | 130 | H3 (H3) | 1 | 0 | 3 | no | ok |
| 5 | melanzane-pizza | 130 | 130 | 0 | 70 | 60 | 0 | 130 | H3 (H4) | 5 | 0 | 22 | no | hint unaffordable (skipped) |
| 6 | parmigiana-pizza | 130 | 130 | 80 | 70 | 60 | 60 | 150 | H3 (H4) | 11 | 1 | 66 | soft | Shop needed 1 Margherita replay(s) |
| 7 | pepperoni | 150 | 130 | 0 | 70 | 80 | 0 | 130 | H3 (H3) | 1 | 0 | 4 | no | ok |
| 8 | salsiccia | 130 | 130 | 0 | 30 | 80 | 0 | 150 | H2 (H3) | 1 | 0 | 3 | no | hint unaffordable (skipped) |
| 9 | meat-lovers | 150 | 130 | 0 | 70 | 80 | 0 | 130 | H3 (H4) | 7 | 0 | 70 | no | hint unaffordable (skipped) |
| 10 | bambino | 130 | 130 | 0 | 30 | 80 | 0 | 150 | H2 (H4) | 2 | 0 | 9 | no | hint unaffordable (skipped) |
| 11 | hawaiian | 150 | 130 | 0 | 70 | 80 | 0 | 130 | H3 (H4) | 3 | 0 | 15 | no | hint unaffordable (skipped) |
| 12 | capricciosa | 130 | 130 | 320 | 30 | 160 | 240 | 150 | H2 (H4) | 37 | 4 | 214 | soft | Shop needed 4 Margherita replay(s) / search cap |
| 13 | pizza-portuguesa | 150 | 130 | 160 | 30 | 80 | 190 | 140 | H2 (H4) | 18 | 2 | 151 | soft | Shop needed 2 Margherita replay(s) |
| 14 | fugazza | 140 | 130 | 160 | 30 | 80 | 170 | 150 | H2 (H3) | 3 | 2 | 13 | soft | Shop needed 2 Margherita replay(s) |
| 15 | marinara | 150 | 130 | 0 | 30 | 80 | 40 | 130 | H2 (H3) | 4 | 0 | 20 | no | hint unaffordable (skipped) |
| 16 | napoletana | 130 | 130 | 0 | 30 | 100 | 0 | 130 | H2 (H4) | 4 | 0 | 21 | no | hint unaffordable (skipped) |
| 17 | tonno-e-cipolla | 130 | 130 | 0 | 30 | 100 | 0 | 130 | H2 (H4) | 4 | 0 | 22 | no | hint unaffordable (skipped) |
| 18 | pesto-tonno | 130 | 130 | 80 | 30 | 100 | 50 | 160 | H2 (H4) | 9 | 1 | 69 | soft | Shop needed 1 Margherita replay(s) |
| 19 | genovese | 160 | 130 | 0 | 30 | 100 | 0 | 160 | H2 (H3) | 1 | 0 | 4 | no | hint unaffordable (skipped) |
| 20 | new-haven-apizza | 160 | 130 | 240 | 10 | 100 | 290 | 130 | H1 (H4) | 41 | 3 | 227 | soft | Shop needed 3 Margherita replay(s) / search cap |
| 21 | pesto-caprese | 130 | 130 | 320 | 70 | 100 | 270 | 140 | H3 (H4) | 20 | 4 | 131 | soft | Shop needed 4 Margherita replay(s) |
| 22 | pesto-patate | 140 | 130 | 320 | 70 | 100 | 230 | 190 | H3 (H4) | 19 | 4 | 129 | soft | Shop needed 4 Margherita replay(s) |
| 23 | pizza-bianca | 190 | 130 | 240 | 30 | 100 | 250 | 180 | H2 (H3) | 24 | 3 | 153 | soft | Shop needed 3 Margherita replay(s) |
| 24 | puttanesca-pizza | 180 | 130 | 480 | 30 | 100 | 470 | 190 | H2 (H4) | 47 | 6 | 297 | soft | Shop needed 6 Margherita replay(s) |
| 25 | quattro-formaggi | 190 | 130 | 800 | 30 | 200 | 760 | 130 | H2 (H4) | 42 | 10 | 368 | soft | Shop needed 10 Margherita replay(s) |

#### Per-stage: Q65 curve A profile P0

| # | Recipe | Pitz before | Discovery reward | Other earned | Hint | Unlock | Refill | Pitz after | Hint level (max) | Exp. bakes | Grind | Stock used | Blocked? | Reason |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---|---|
| 1 | margherita | 0 | 130 | 0 | 0 | 0 | 0 | 130 | H0 (H4) | 2 | 0 | 0 | no | ok |
| 2 | bismarck | 130 | 130 | 0 | 0 | 60 | 0 | 200 | H0 (H3) | 1 | 0 | 1 | no | ok |
| 3 | breakfast-pizza | 200 | 130 | 0 | 0 | 60 | 0 | 270 | H0 (H4) | 2 | 0 | 7 | no | ok |
| 4 | funghi | 270 | 130 | 0 | 0 | 60 | 0 | 340 | H0 (H3) | 1 | 0 | 3 | no | ok |
| 5 | melanzane-pizza | 340 | 130 | 0 | 0 | 60 | 0 | 410 | H0 (H4) | 5 | 0 | 22 | no | ok |
| 6 | parmigiana-pizza | 410 | 130 | 0 | 0 | 60 | 60 | 420 | H0 (H4) | 11 | 0 | 66 | no | ok |
| 7 | pepperoni | 420 | 130 | 0 | 0 | 80 | 0 | 470 | H0 (H3) | 1 | 0 | 4 | no | ok |
| 8 | salsiccia | 470 | 130 | 0 | 0 | 80 | 0 | 520 | H0 (H3) | 1 | 0 | 3 | no | ok |
| 9 | meat-lovers | 520 | 130 | 0 | 0 | 80 | 0 | 570 | H0 (H4) | 7 | 0 | 70 | no | ok |
| 10 | bambino | 570 | 130 | 0 | 0 | 80 | 0 | 620 | H0 (H4) | 2 | 0 | 9 | no | ok |
| 11 | hawaiian | 620 | 130 | 0 | 0 | 80 | 0 | 670 | H0 (H4) | 3 | 0 | 15 | no | ok |
| 12 | capricciosa | 670 | 130 | 0 | 0 | 160 | 320 | 320 | H0 (H4) | 49 | 0 | 266 | no | ok / search cap |
| 13 | pizza-portuguesa | 320 | 130 | 80 | 0 | 80 | 290 | 160 | H0 (H4) | 17 | 1 | 168 | soft | Shop needed 1 Margherita replay(s) |
| 14 | fugazza | 160 | 130 | 0 | 0 | 80 | 70 | 140 | H0 (H3) | 4 | 0 | 20 | no | ok |
| 15 | marinara | 140 | 130 | 0 | 0 | 80 | 40 | 150 | H0 (H3) | 5 | 0 | 22 | no | ok |
| 16 | napoletana | 150 | 130 | 0 | 0 | 100 | 0 | 180 | H0 (H4) | 4 | 0 | 21 | no | ok |
| 17 | tonno-e-cipolla | 180 | 130 | 0 | 0 | 100 | 0 | 210 | H0 (H4) | 4 | 0 | 22 | no | ok |
| 18 | pesto-tonno | 210 | 130 | 80 | 0 | 100 | 150 | 170 | H0 (H4) | 30 | 1 | 132 | soft | Shop needed 1 Margherita replay(s) |
| 19 | genovese | 170 | 130 | 80 | 0 | 100 | 120 | 160 | H0 (H3) | 2 | 1 | 7 | soft | Shop needed 1 Margherita replay(s) |
| 20 | new-haven-apizza | 160 | 130 | 480 | 0 | 100 | 410 | 260 | H0 (H4) | 60 | 1 | 291 | soft | Shop needed 1 Margherita replay(s) |
| 21 | pesto-caprese | 260 | 130 | 240 | 0 | 100 | 340 | 190 | H0 (H4) | 42 | 3 | 245 | soft | Shop needed 3 Margherita replay(s) |
| 22 | pesto-patate | 190 | 130 | 0 | 0 | 100 | 50 | 170 | H0 (H4) | 20 | 0 | 117 | no | ok |
| 23 | pizza-bianca | 170 | 130 | 160 | 0 | 100 | 220 | 140 | H0 (H3) | 26 | 2 | 134 | soft | Shop needed 2 Margherita replay(s) |
| 24 | puttanesca-pizza | 140 | 130 | 640 | 0 | 100 | 590 | 220 | H0 (H4) | 73 | 3 | 358 | soft | Shop needed 3 Margherita replay(s) |
| 25 | quattro-formaggi | 220 | 130 | 800 | 0 | 200 | 790 | 160 | H0 (H4) | 44 | 10 | 340 | soft | Shop needed 10 Margherita replay(s) |
